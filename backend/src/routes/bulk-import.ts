import { Router, Request, Response } from "express";
import multer from "multer";
import { PrismaClient } from "@prisma/client";
import BulkImportService from "../services/bulkImportService";
import { emailService } from "../services/emailService";
import { createUserWallet } from "../services/walletService";

export function bulkImportRoute(prisma: PrismaClient) {
  const router = Router();

// Configure multer for CSV uploads
const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (
      allowedMimes.includes(file.mimetype) ||
      file.originalname.endsWith(".csv")
    ) {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"));
    }
  },
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
});

/**
 * POST /api/bulk-import/validate
 * Validates CSV content without importing
 */
router.post("/validate", upload.single("file"), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const csvContent = req.file.buffer.toString("utf-8");
    const validation = BulkImportService.validateCSV(csvContent);

    res.json(validation);
  } catch (error: any) {
    console.error("CSV validation error:", error);
    res
      .status(400)
      .json({ error: error.message || "CSV validation failed" });
  }
});

/**
 * POST /api/bulk-import/upload
 * Uploads and starts bulk import job with email notifications
 */
router.post("/upload", upload.single("file"), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const { institutionAddress, sendEmails = 'true' } = req.body;

    if (!institutionAddress) {
      return res.status(400).json({ error: "institutionAddress is required" });
    }

    const csvContent = req.file.buffer.toString("utf-8");

    // Start the bulk import job
    const job = await BulkImportService.startBulkImport(
      csvContent,
      institutionAddress
    );

    // If emails should be sent, process them asynchronously
    if (sendEmails === 'true') {
      // Start email sending in background
      setImmediate(async () => {
        try {
          await sendBulkClaimEmails(prisma, job.jobId, institutionAddress);
        } catch (error) {
          console.error('Failed to send bulk emails:', error);
        }
      });
    }

    res.json({
      success: true,
      job: {
        jobId: job.jobId,
        status: job.status,
        totalRows: job.totalRows,
        createdAt: job.createdAt,
        emailsQueued: sendEmails === 'true',
      },
    });
  } catch (error: any) {
    console.error("Bulk import error:", error);
    res
      .status(400)
      .json({ error: error.message || "Bulk import failed" });
  }
});

/**
 * GET /api/bulk-import/jobs/:institutionAddress
 * Gets all import jobs for an institution
 */
router.get("/jobs/:institutionAddress", async (req: Request, res: Response) => {
  try {
    const { institutionAddress } = req.params;
    const jobs = await BulkImportService.getInstitutionJobs(
      institutionAddress,
      20
    );

    res.json({
      success: true,
      jobs,
    });
  } catch (error: any) {
    console.error("Error fetching jobs:", error);
    res.status(500).json({ error: "Failed to fetch jobs" });
  }
});

/**
 * GET /api/bulk-import/job/:jobId
 * Gets status of a specific import job
 */
router.get("/job/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await BulkImportService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    res.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("Error fetching job status:", error);
    res.status(500).json({ error: "Failed to fetch job status" });
  }
});

/**
 * POST /api/bulk-import/cancel/:jobId
 * Cancels a pending import job
 */
router.post("/cancel/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await BulkImportService.cancelJob(jobId);

    res.json({
      success: true,
      job,
    });
  } catch (error: any) {
    console.error("Error canceling job:", error);
    res.status(500).json({ error: "Failed to cancel job" });
  }
});

/**
 * GET /api/bulk-import/template
 * Returns a CSV template for bulk import
 */
router.get("/template", (req: Request, res: Response) => {
  const template = `studentAddress,credentialName,course,institution,gradeScore,expiresIn,description
0x1234567890123456789012345678901234567890,Bachelor of Science in Computer Science,CS101 - Intro to CS,MIT,A+,365,Outstanding performance in coursework
0x0987654321098765432109876543210987654321,Master of Science in Data Science,DS501 - Advanced Analytics,Stanford,4.0,730,Thesis: Machine Learning Applications`;

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=credential-template.csv");
  res.send(template);
});

/**
 * GET /api/bulk-import/download/:jobId
 * Downloads import results as CSV
 */
router.get("/download/:jobId", async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = await BulkImportService.getJobStatus(jobId);

    if (!job) {
      return res.status(404).json({ error: "Job not found" });
    }

    // Format results as CSV
    let csv = "Row,StudentAddress,Status,Error\n";

    const errors = Array.isArray(job.errors)
      ? job.errors
      : JSON.parse(String(job.errors || "[]"));

    // Add error rows
    for (const error of errors) {
      const escapedError = `"${(error.error || "").replace(/"/g, '""')}"`;
      csv += `${error.rowNumber},${error.studentAddress},FAILED,${escapedError}\n`;
    }

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename=import-results-${jobId}.csv`
    );
    res.send(csv);
  } catch (error: any) {
    console.error("Error downloading results:", error);
    res.status(500).json({ error: "Failed to download results" });
  }
});

  return router;
}

/**
 * Sends claim emails for all students in a bulk import job
 */
async function sendBulkClaimEmails(
  prisma: PrismaClient,
  jobId: string,
  _institutionAddress: string
) {
  try {
    console.log(`[EMAIL] Starting bulk email send for job ${jobId}`);

    // Get all claim tokens for this job
    const claimTokens = await prisma.claimToken.findMany({
      where: {
        // Find tokens created recently (within last 5 minutes) for this institution
        createdAt: {
          gte: new Date(Date.now() - 5 * 60 * 1000)
        },
        studentEmail: {
          not: ""
        }
      },
      include: {
        credential: {
          include: {
            institution: true
          }
        }
      }
    });

    console.log(`[EMAIL] Found ${claimTokens.length} claim tokens to email`);

    let sentCount = 0;
    let failedCount = 0;

    for (const token of claimTokens) {
      try {
        if (!token.studentEmail) continue;

        const claimUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/claim/${token.token}`;

        await emailService.sendCredentialIssuedEmail({
          studentEmail: token.studentEmail,
          studentName: token.studentName || 'Student',
          institutionName: token.credential?.institution?.name || 'Your Institution',
          degree: 'Your Academic Credential',
          claimToken: token.token,
          claimUrl,
        });

        sentCount++;
        console.log(`[EMAIL] Sent claim email to ${token.studentEmail}`);
      } catch (error) {
        console.error(`[EMAIL] Failed to send email to ${token.studentEmail}:`, error);
        failedCount++;
      }

      // Small delay to avoid overwhelming email service
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[EMAIL] Bulk email send complete: ${sentCount} sent, ${failedCount} failed`);

    // Update job with email status
    await prisma.bulkImportJob.update({
      where: { jobId },
      data: {
        // Could add email status fields to schema if needed
      }
    });

  } catch (error) {
    console.error(`[EMAIL] Bulk email send failed for job ${jobId}:`, error);
  }
}
