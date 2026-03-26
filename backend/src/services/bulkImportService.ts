import { PrismaClient } from "@prisma/client";
import { ethers } from "ethers";
import { EventEmitter } from "events";
import ContractService from "./contract";
import IPFSService from "./ipfs";

export interface CSVRow {
  [key: string]: string;
}

export interface BulkImportJob {
  jobId: string;
  institutionAddress: string;
  status: "pending" | "processing" | "completed" | "failed";
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  errors: Array<{ rowNumber: number; studentAddress: string; error: string }>;
  createdAt: Date;
  completedAt?: Date;
}

export interface CSVValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  previewRows: CSVRow[];
}

export interface CredentialImportData {
  studentAddress: string;
  credentialName: string;
  course: string;
  institution: string;
  expiresIn?: number; // days from now
  gradeScore?: string;
  description?: string;
}

class BulkImportService extends EventEmitter {
  private prisma: PrismaClient;

  constructor(prisma: PrismaClient) {
    super();
    this.prisma = prisma;
  }

  /**
   * Validates CSV content and structure
   */
  validateCSV(csvContent: string): CSVValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const lines = csvContent.trim().split("\n");

    if (lines.length < 2) {
      errors.push("CSV must contain at least a header and one data row");
      return { isValid: false, errors, warnings, previewRows: [] };
    }

    const headers = this.parseCSVLine(lines[0]);
    const requiredHeaders = [
      "studentAddress",
      "credentialName",
      "course",
      "institution",
    ];

    // Validate headers
    for (const required of requiredHeaders) {
      if (!headers.includes(required)) {
        errors.push(
          `Missing required column: ${required}. Required columns: ${requiredHeaders.join(", ")}`
        );
      }
    }

    if (errors.length > 0) {
      return { isValid: false, errors, warnings, previewRows: [] };
    }

    // Parse and validate data rows
    const previewRows: CSVRow[] = [];
    const validRows: CSVRow[] = [];

    for (let i = 1; i < Math.min(lines.length, 11); i++) {
      const row = this.parseCSVLine(lines[i]);
      const rowData: CSVRow = {};
      let hasData = false;

      for (let j = 0; j < headers.length; j++) {
        rowData[headers[j]] = row[j] || "";
        if (row[j]) hasData = true;
      }

      if (!hasData) continue;

      // Validate individual row data
      const rowErrors = this.validateCredentialData(rowData, i + 1);
      if (rowErrors.length === 0) {
        validRows.push(rowData);
        previewRows.push(rowData);
      } else {
        warnings.push(`Row ${i + 1}: ${rowErrors.join("; ")}`);
      }
    }

    if (validRows.length === 0) {
      errors.push(
        "No valid credential rows found after validation. Check the format of your data."
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      previewRows: previewRows.slice(0, 5),
    };
  }

  /**
   * Parses a CSV line handling quoted fields
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let insideQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (insideQuotes && nextChar === '"') {
          current += '"';
          i++;
        } else {
          insideQuotes = !insideQuotes;
        }
      } else if (char === "," && !insideQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  }

  /**
   * Validates a single credential data row
   */
  private validateCredentialData(
    data: CSVRow,
    rowNumber: number
  ): string[] {
    const errors: string[] = [];

    // Validate student address
    if (!data.studentAddress || !ethers.isAddress(data.studentAddress)) {
      errors.push(
        `Invalid Ethereum address: ${data.studentAddress || "empty"}`
      );
    }

    // Validate required fields
    if (!data.credentialName || data.credentialName.trim().length === 0) {
      errors.push("credentialName is required and cannot be empty");
    } else if (data.credentialName.length > 255) {
      errors.push("credentialName cannot exceed 255 characters");
    }

    if (!data.course || data.course.trim().length === 0) {
      errors.push("course is required and cannot be empty");
    } else if (data.course.length > 255) {
      errors.push("course cannot exceed 255 characters");
    }

    if (!data.institution || data.institution.trim().length === 0) {
      errors.push("institution is required and cannot be empty");
    } else if (data.institution.length > 255) {
      errors.push("institution cannot exceed 255 characters");
    }

    // Validate optional fields
    if (data.expiresIn && isNaN(parseInt(data.expiresIn))) {
      errors.push("expiresIn must be a number (days)");
    }

    if (data.gradeScore && !this.isValidGrade(data.gradeScore)) {
      errors.push(
        "gradeScore format invalid. Use formats like: A, A+, 85, 4.0, etc."
      );
    }

    return errors;
  }

  /**
   * Validates grade/score format
   */
  private isValidGrade(grade: string): boolean {
    const gradeRegex =
      /^([A-F][+\-]?|[0-9]{1,3}(\.[0-9]{1,2})?|[0-4]\.[0-9]{1,2})$/i;
    return gradeRegex.test(grade.trim());
  }

  /**
   * Starts bulk import job
   */
  async startBulkImport(
    csvContent: string,
    institutionAddress: string
  ): Promise<BulkImportJob> {
    const jobId = `job_${Date.now()}_${Math.random()
      .toString(36)
      .substring(7)}`;

    // Validate CSV format first
    const validation = this.validateCSV(csvContent);
    if (!validation.isValid) {
      throw new Error(`CSV validation failed: ${validation.errors.join("; ")}`);
    }

    const lines = csvContent.trim().split("\n");
    const headers = this.parseCSVLine(lines[0]);
    const totalRows = lines.length - 1; // Exclude header

    // Create job record
    let job = await this.prisma.bulkImportJob.create({
      data: {
        jobId,
        institutionAddress,
        status: "pending",
        totalRows,
        processedRows: 0,
        successCount: 0,
        failureCount: 0,
      },
    });

    // Start processing asynchronously
    this.processBulkImport(csvContent, institutionAddress, jobId).catch(
      (error) => {
        console.error(`Error in bulk import job ${jobId}:`, error);
      }
    );

    return job;
  }

  /**
   * Processes bulk import in background
   */
  private async processBulkImport(
    csvContent: string,
    institutionAddress: string,
    jobId: string
  ): Promise<void> {
    try {
      const lines = csvContent.trim().split("\n");
      const headers = this.parseCSVLine(lines[0]);
      const errors: Array<{
        rowNumber: number;
        studentAddress: string;
        error: string;
      }> = [];

      let successCount = 0;
      let processedRows = 0;

      // Update status to processing
      await this.prisma.bulkImportJob.update({
        where: { jobId },
        data: { status: "processing" },
      });

      // Process each row
      for (let i = 1; i < lines.length; i++) {
        const rowData = this.parseCSVLine(lines[i]);
        const row: CSVRow = {};
        let hasData = false;

        for (let j = 0; j < headers.length; j++) {
          row[headers[j]] = rowData[j] || "";
          if (rowData[j]) hasData = true;
        }

        if (!hasData) continue;

        const credentialData: CredentialImportData = {
          studentAddress: row.studentAddress,
          credentialName: row.credentialName,
          course: row.course,
          institution: row.institution,
          expiresIn: row.expiresIn ? parseInt(row.expiresIn) : undefined,
          gradeScore: row.gradeScore,
          description: row.description,
        };

        try {
          // Validate row
          const rowErrors = this.validateCredentialData(row, i + 1);
          if (rowErrors.length > 0) {
            errors.push({
              rowNumber: i + 1,
              studentAddress: credentialData.studentAddress,
              error: rowErrors.join("; "),
            });
            processedRows++;
            continue;
          }

          // Issue credential
          await this.issueCredential(
            credentialData,
            institutionAddress
          );

          // Create claim token for this student
          const claimToken = await this.prisma.claimToken.create({
            data: {
              credentialId: "", // Will be set after credential is created
              studentEmail: credentialData.studentEmail || "",
              studentName: credentialData.studentName,
              expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
            }
          });

          successCount++;
        } catch (error: any) {
          errors.push({
            rowNumber: i + 1,
            studentAddress: credentialData.studentAddress,
            error: error.message || "Unknown error",
          });
        }

        processedRows++;

        // Update progress every 10 rows
        if (processedRows % 10 === 0) {
          await this.prisma.bulkImportJob.update({
            where: { jobId },
            data: { processedRows, successCount },
          });

          this.emit("progress", { jobId, processedRows, successCount });
        }
      }

      // Update final status
      await this.prisma.bulkImportJob.update({
        where: { jobId },
        data: {
          status: "completed",
          processedRows,
          successCount,
          failureCount: errors.length,
          errors: JSON.stringify(errors), // Add this line
          completedAt: new Date(),
        },
      });

      this.emit("completed", {
        jobId,
        successCount,
        failureCount: errors.length,
        errors,
      });
    } catch (error: any) {
      await this.prisma.bulkImportJob.update({
        where: { jobId },
        data: { status: "failed", completedAt: new Date() },
      });

      this.emit("failed", { jobId, error: error.message });
    }
  }

  /**
   * Issues a single credential
   */
  private async issueCredential(
    data: CredentialImportData,
    institutionAddress: string
  ): Promise<void> {
    // Prepare metadata
    const metadata: any = {
      name: data.credentialName,
      course: data.course,
      institution: data.institution,
      issuedAt: new Date().toISOString(),
    };

    if (data.gradeScore) {
      metadata.gradeScore = data.gradeScore;
    }

    if (data.description) {
      metadata.description = data.description;
    }

    // Upload metadata to IPFS
    const ipfsCid = await IPFSService.uploadJSON(metadata);

    // Mint credential on blockchain
    await ContractService.issueCredential(
      data.studentAddress,
      ipfsCid,
      data.expiresIn ? Math.floor(Date.now() / 1000) + data.expiresIn * 86400 : 0
    );

    // Log in database
    await this.prisma.credentialAudit.create({
      data: {
        action: "BULK_IMPORT",
        studentAddress: data.studentAddress,
        institutionAddress,
        metadata: JSON.stringify(metadata),
        transactionHash: "", // Would be filled from contract event
        details: `Bulk imported credential: ${data.credentialName}`,
      },
    });
  }

  /**
   * Gets job status
   */
  async getJobStatus(jobId: string): Promise<BulkImportJob | null> {
    return this.prisma.bulkImportJob.findUnique({
      where: { jobId },
    });
  }

  /**
   * Gets all jobs for institution
   */
  async getInstitutionJobs(
    institutionAddress: string,
    limit: number = 10
  ): Promise<BulkImportJob[]> {
    return this.prisma.bulkImportJob.findMany({
      where: { institutionAddress },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  /**
   * Cancels a pending job
   */
  async cancelJob(jobId: string): Promise<BulkImportJob> {
    return this.prisma.bulkImportJob.update({
      where: { jobId },
      data: { status: "failed" },
    });
  }
}

export default new BulkImportService(
  new PrismaClient()
);
