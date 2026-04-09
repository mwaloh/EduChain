import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { generateWalletFromEmail, isValidWalletAddress } from '../services/walletService';

export function studentsRoute(prisma: PrismaClient) {
  const router = Router();

  /**
   * POST /api/students
   * Create a new student (Institution admin only)
   * Body: { email, program, yearOfStudy, admissionNo, walletAddress? }
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { email, program, yearOfStudy, admissionNo, walletAddress } = req.body;
      const adminEmail = (req.headers['x-user-email'] as string) || '';
      const institutionId = (req.headers['x-institution-id'] as string) || '';

      // Validate required fields
      if (!email || !institutionId) {
        return res.status(400).json({ error: 'Email and institution ID are required' });
      }

      // Validate email format
      if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      // Check if institution exists
      const institution = await prisma.institution.findUnique({
        where: { id: institutionId },
      });

      if (!institution) {
        return res.status(404).json({ error: 'Institution not found' });
      }

      // Check if institution admin permission
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized: Must be institution admin' });
      }

      // Check if student already exists in institution
      const existingStudent = await prisma.studentProfile.findFirst({
        where: {
          institutionId,
          email,
          deletedAt: null,
        },
      });

      if (existingStudent) {
        return res.status(409).json({ error: 'Student with this email already exists in institution' });
      }

      // Generate or validate wallet
      let finalWalletAddress = walletAddress;
      if (!finalWalletAddress) {
        const wallet = generateWalletFromEmail(email);
        finalWalletAddress = wallet.address;
      } else {
        if (!isValidWalletAddress(finalWalletAddress)) {
          return res.status(400).json({ error: 'Invalid wallet address format' });
        }
      }

      // Create student profile
      const studentProfile = await prisma.studentProfile.create({
        data: {
          institutionId,
          email,
          walletAddress: finalWalletAddress,
          program: program || null,
          yearOfStudy: yearOfStudy ? Number(yearOfStudy) : null,
          admissionNo: admissionNo || null,
          status: 'active',
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          timestamp: new Date(),
          action: 'STUDENT_CREATED',
          userAddress: 'N/A',
          actorEmail: adminEmail,
          userRole: 'institution_admin',
          entityType: 'StudentProfile',
          entityId: studentProfile.id,
          afterJson: JSON.stringify(studentProfile),
          status: 'success',
          details: JSON.stringify({ email }),
        },
      });

      res.status(201).json({
        success: true,
        student: {
          ...studentProfile,
          yearOfStudy: studentProfile.yearOfStudy || undefined,
        },
      });
    } catch (error: any) {
      console.error('Error creating student:', error);
      res.status(500).json({ error: 'Failed to create student' });
    }
  });

  /**
   * GET /api/students
   * List all students for an institution (Institution admin only)
   * Query: ?status=active&search=email&page=1&limit=20
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const institutionId = (req.headers['x-institution-id'] as string) || '';
      const adminEmail = (req.headers['x-user-email'] as string) || '';
      const { status, search, page = '1', limit = '20' } = req.query;

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Check institution admin permission
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const pageNum = Math.max(1, Number(page));
      const pageSize = Math.min(100, Math.max(1, Number(limit)));
      const skip = (pageNum - 1) * pageSize;

      // Build filter
      const whereClause: any = {
        institutionId,
        deletedAt: null,
      };

      if (status && status !== 'all') {
        whereClause.status = status;
      }

      if (search) {
        whereClause.OR = [{ email: { contains: search as string, mode: 'insensitive' } }, { admissionNo: { contains: search as string, mode: 'insensitive' } }];
      }

      // Get total count
      const total = await prisma.studentProfile.count({ where: whereClause });

      // Get paginated results
      const students = await prisma.studentProfile.findMany({
        where: whereClause,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        success: true,
        students,
        pagination: {
          page: pageNum,
          limit: pageSize,
          total,
          pages: Math.ceil(total / pageSize),
        },
      });
    } catch (error: any) {
      console.error('Error fetching students:', error);
      res.status(500).json({ error: 'Failed to fetch students' });
    }
  });

  /**
   * GET /api/students/:id
   * Get single student by ID
   */
  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const institutionId = (req.headers['x-institution-id'] as string) || '';
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Check permissions
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      const student = await prisma.studentProfile.findUnique({
        where: { id },
      });

      if (!student) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Verify student belongs to admin's institution
      if (student.institutionId !== institutionId) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Don't return soft-deleted records
      if (student.deletedAt) {
        return res.status(404).json({ error: 'Student not found' });
      }

      res.json({ success: true, student });
    } catch (error: any) {
      console.error('Error fetching student:', error);
      res.status(500).json({ error: 'Failed to fetch student' });
    }
  });

  /**
   * PUT /api/students/:id
   * Update student profile
   */
  router.put('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const institutionId = (req.headers['x-institution-id'] as string) || '';
      const adminEmail = (req.headers['x-user-email'] as string) || '';
      const { program, yearOfStudy, admissionNo, status } = req.body;

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Check permissions
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Find student
      const student = await prisma.studentProfile.findUnique({
        where: { id },
      });

      if (!student || student.institutionId !== institutionId || student.deletedAt) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Validate status if provided
      if (status && !['active', 'inactive', 'graduated'].includes(status)) {
        return res.status(400).json({ error: 'Invalid status' });
      }

      // Store before state for audit
      const beforeJson = JSON.stringify(student);

      // Update
      const updatedStudent = await prisma.studentProfile.update({
        where: { id },
        data: {
          program: program ?? student.program,
          yearOfStudy: yearOfStudy ? Number(yearOfStudy) : student.yearOfStudy,
          admissionNo: admissionNo ?? student.admissionNo,
          status: status ?? student.status,
        },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          timestamp: new Date(),
          action: 'STUDENT_UPDATED',
          userAddress: 'N/A',
          actorEmail: adminEmail,
          userRole: 'institution_admin',
          entityType: 'StudentProfile',
          entityId: id,
          beforeJson,
          afterJson: JSON.stringify(updatedStudent),
          status: 'success',
          details: JSON.stringify({ updatedFields: Object.keys(req.body) }),
        },
      });

      res.json({ success: true, student: updatedStudent });
    } catch (error: any) {
      console.error('Error updating student:', error);
      res.status(500).json({ error: 'Failed to update student' });
    }
  });

  /**
   * DELETE /api/students/:id
   * Soft delete a student (sets deletedAt)
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const institutionId = (req.headers['x-institution-id'] as string) || '';
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Check permissions
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Find student
      const student = await prisma.studentProfile.findUnique({
        where: { id },
      });

      if (!student || student.institutionId !== institutionId || student.deletedAt) {
        return res.status(404).json({ error: 'Student not found' });
      }

      // Soft delete
      const deletedStudent = await prisma.studentProfile.update({
        where: { id },
        data: { deletedAt: new Date() },
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          timestamp: new Date(),
          action: 'STUDENT_DELETED',          userAddress: 'N/A',          actorEmail: adminEmail,
          userRole: 'institution_admin',
          entityType: 'StudentProfile',
          entityId: id,
          beforeJson: JSON.stringify(student),
          status: 'success',
          details: JSON.stringify({ softDelete: true }),
        },
      });

      res.json({ success: true, message: 'Student deleted successfully' });
    } catch (error: any) {
      console.error('Error deleting student:', error);
      res.status(500).json({ error: 'Failed to delete student' });
    }
  });

  /**
   * GET /api/students/institution/stats
   * Get institution student statistics
   */
  router.get('/institution/stats', async (req: Request, res: Response) => {
    try {
      const institutionId = (req.headers['x-institution-id'] as string) || '';
      const adminEmail = (req.headers['x-user-email'] as string) || '';

      if (!institutionId) {
        return res.status(400).json({ error: 'Institution ID required' });
      }

      // Check permissions
      const adminRecord = await prisma.institutionAdmin.findFirst({
        where: {
          institution: { id: institutionId },
          email: adminEmail,
          deletedAt: null,
        },
      });

      if (!adminRecord) {
        return res.status(403).json({ error: 'Unauthorized' });
      }

      // Get stats
      const totalStudents = await prisma.studentProfile.count({
        where: { institutionId, deletedAt: null },
      });

      const activeStudents = await prisma.studentProfile.count({
        where: { institutionId, status: 'active', deletedAt: null },
      });

      const inactiveStudents = await prisma.studentProfile.count({
        where: { institutionId, status: 'inactive', deletedAt: null },
      });

      const graduatedStudents = await prisma.studentProfile.count({
        where: { institutionId, status: 'graduated', deletedAt: null },
      });

      // Get credential stats
      const totalCredentials = await prisma.credential.count({
        where: { institutionId },
      });

      const revokedCredentials = await prisma.credential.count({
        where: { institutionId, revoked: true },
      });

      const activeCredentials = totalCredentials - revokedCredentials;

      res.json({
        success: true,
        stats: {
          students: {
            total: totalStudents,
            active: activeStudents,
            inactive: inactiveStudents,
            graduated: graduatedStudents,
          },
          credentials: {
            total: totalCredentials,
            active: activeCredentials,
            revoked: revokedCredentials,
          },
        },
      });
    } catch (error: any) {
      console.error('Error fetching stats:', error);
      res.status(500).json({ error: 'Failed to fetch statistics' });
    }
  });

  return router;
}
