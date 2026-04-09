import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * Generate audit log entry
 * Call this after every data mutation
 */
export async function logAudit(params: {
  action: string; // e.g., 'USER_CREATED', 'CREDENTIAL_REVOKED'
  actorUserId?: string;
  actorEmail: string;
  userRole: string; // 'student', 'institution_admin', 'super_admin', 'employer'
  userAddress?: string; // Blockchain address if applicable
  entityType?: string; // 'User', 'Credential', 'StudentProfile'
  entityId?: string;
  beforeJson?: string; // JSON string of previous state
  afterJson?: string; // JSON string of new state
  details?: any; // Any additional details object
  status: 'success' | 'failed';
  ipAddress?: string;
  userAgent?: string;
  relatedCredentialId?: bigint;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        timestamp: new Date(),
        action: params.action,
        actorUserId: params.actorUserId,
        actorEmail: params.actorEmail,
        userRole: params.userRole,
        userAddress: params.userAddress || '',
        entityType: params.entityType,
        entityId: params.entityId,
        beforeJson: params.beforeJson || null,
        afterJson: params.afterJson || null,
        details: params.details ? JSON.stringify(params.details) : JSON.stringify({}),
        status: params.status,
        ipAddress: params.ipAddress || null,
        userAgent: params.userAgent || null,
        relatedCredentialId: params.relatedCredentialId || null,
      },
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
    // Don't throw - audit logging should not break the main operation
  }
}

/**
 * Audit log builder for common operations
 */
export const auditActions = {
  USER_CREATED: 'USER_CREATED',
  USER_UPDATED: 'USER_UPDATED',
  USER_DELETED: 'USER_DELETED',
  
  INSTITUTION_CREATED: 'INSTITUTION_CREATED',
  INSTITUTION_APPROVED: 'INSTITUTION_APPROVED',
  INSTITUTION_REJECTED: 'INSTITUTION_REJECTED',
  INSTITUTION_SUSPENDED: 'INSTITUTION_SUSPENDED',
  INSTITUTION_UPDATED: 'INSTITUTION_UPDATED',
  
  STUDENT_CREATED: 'STUDENT_CREATED',
  STUDENT_UPDATED: 'STUDENT_UPDATED',
  STUDENT_DELETED: 'STUDENT_DELETED',
  
  CREDENTIAL_MINTED: 'CREDENTIAL_MINTED',
  CREDENTIAL_VERIFIED: 'CREDENTIAL_VERIFIED',
  CREDENTIAL_REVOKED: 'CREDENTIAL_REVOKED',
  
  ADMIN_ROLE_ASSIGNED: 'ADMIN_ROLE_ASSIGNED',
  ADMIN_ROLE_REVOKED: 'ADMIN_ROLE_REVOKED',
};

/**
 * Safely get entity by ID (excludes soft-deleted)
 */
export async function getSafeEntity<T extends { id: string; deletedAt: Date | null }>(
  model: any,
  id: string
): Promise<T | null> {
  return model.findFirst({
    where: {
      id,
      deletedAt: null,
    },
  });
}

/**
 * Safely list entities (excludes soft-deleted)
 */
export async function listSafeEntities<T extends { deletedAt: Date | null }>(
  model: any,
  where?: any
) {
  return model.findMany({
    where: {
      ...where,
      deletedAt: null,
    },
  });
}

/**
 * Soft delete an entity
 */
export async function softDelete<T extends { id: string; deletedAt: Date | null }>(
  model: any,
  id: string
): Promise<T> {
  return model.update({
    where: { id },
    data: { deletedAt: new Date() },
  });
}

/**
 * Restore a soft-deleted entity
 */
export async function restoreEntity<T extends { id: string; deletedAt: Date | null }>(
  model: any,
  id: string
): Promise<T> {
  return model.update({
    where: { id },
    data: { deletedAt: null },
  });
}

/**
 * Hard delete an entity (use with caution, prefer soft delete)
 */
export async function hardDelete<T extends { id: string }>(model: any, id: string): Promise<T> {
  return model.delete({
    where: { id },
  });
}

/**
 * Get audit history for an entity
 */
export async function getEntityAuditHistory(
  entityType: string,
  entityId: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: {
      entityType,
      entityId,
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get all actions by a user
 */
export async function getUserAuditHistory(
  userEmail: string,
  limit: number = 50
) {
  return prisma.auditLog.findMany({
    where: {
      actorEmail: userEmail,
    },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

/**
 * Get audit logs in a time range
 */
export async function getAuditLogsByDateRange(
  startDate: Date,
  endDate: Date,
  action?: string
) {
  return prisma.auditLog.findMany({
    where: {
      timestamp: {
        gte: startDate,
        lte: endDate,
      },
      ...(action && { action }),
    },
    orderBy: { timestamp: 'desc' },
  });
}

/**
 * Get critical audit events (failed actions, deletions, etc.)
 */
export async function getCriticalAuditEvents(
  days: number = 7
) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  return prisma.auditLog.findMany({
    where: {
      timestamp: {
        gte: startDate,
      },
      OR: [
        { status: 'failed' },
        { action: { in: ['USER_DELETED', 'CREDENTIAL_REVOKED', 'INSTITUTION_SUSPENDED'] } },
      ],
    },
    orderBy: { timestamp: 'desc' },
  });
}
