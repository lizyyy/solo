import { PrismaClient } from '@prisma/client';
import { QueryFilters } from '../types/interfaces';

const prisma = new PrismaClient();

export class QueryService {
  async getRegistrations(filters: QueryFilters, page: number = 1, pageSize: number = 50) {
    const where: any = this.buildWhereClause(filters);
    
    const [data, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        orderBy: [
          { createdAt: 'asc' },
          { originalOrder: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          batch: { select: { fileName: true, createdAt: true } },
          processingRecords: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          attendances: {
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
        },
      }),
      prisma.registration.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getRegistrationDetail(registrationId: string) {
    return prisma.registration.findUnique({
      where: { id: registrationId },
      include: {
        activity: true,
        batch: true,
        processingRecords: {
          orderBy: { createdAt: 'asc' },
        },
        attendances: true,
      },
    });
  }

  async getWaitlistEntries(
    activityId: string,
    isPromoted?: boolean,
    page: number = 1,
    pageSize: number = 50
  ) {
    const where: any = { activityId };
    if (isPromoted !== undefined) where.isPromoted = isPromoted;

    const [data, total] = await Promise.all([
      prisma.waitlistEntry.findMany({
        where,
        orderBy: [
          { priority: 'desc' },
          { waitlistOrder: 'asc' },
        ],
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          batch: { select: { fileName: true, createdAt: true } },
          processingRecords: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
        },
      }),
      prisma.waitlistEntry.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getAttendanceRecords(
    activityId: string,
    status?: string,
    page: number = 1,
    pageSize: number = 50
  ) {
    const where: any = { activityId };
    if (status) where.status = status;

    const [data, total] = await Promise.all([
      prisma.attendance.findMany({
        where,
        orderBy: { signInTime: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          registration: {
            select: {
              idCard: true,
              name: true,
              phone: true,
              community: true,
              finalStatus: true,
            },
          },
          batch: { select: { fileName: true } },
        },
      }),
      prisma.attendance.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getActivitySummary(activityId: string) {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      include: {
        _count: {
          select: {
            registrations: true,
            waitlist: true,
            attendances: true,
          },
        },
      },
    });

    if (!activity) return null;

    const [approvedCount, rejectedCount, waitlistedCount, duplicateCount, blacklistedCount] =
      await Promise.all([
        prisma.registration.count({
          where: { activityId, finalStatus: 'APPROVED' },
        }),
        prisma.registration.count({
          where: { activityId, finalStatus: 'REJECTED' },
        }),
        prisma.registration.count({
          where: { activityId, finalStatus: 'WAITLISTED' },
        }),
        prisma.registration.count({
          where: { activityId, isDuplicate: true },
        }),
        prisma.registration.count({
          where: { activityId, isBlacklisted: true },
        }),
      ]);

    const signedInCount = await prisma.attendance.count({
      where: { activityId, status: 'SIGNED_IN' },
    });

    const waitlistPromotedCount = await prisma.waitlistEntry.count({
      where: { activityId, isPromoted: true },
    });

    const waitlistPendingCount = await prisma.waitlistEntry.count({
      where: { activityId, isPromoted: false },
    });

    return {
      activity,
      summary: {
        totalQuota: activity.totalQuota,
        totalRegistrations: activity._count.registrations,
        approved: approvedCount,
        rejected: rejectedCount,
        waitlisted: waitlistedCount,
        duplicates: duplicateCount,
        blacklisted: blacklistedCount,
        signedIn: signedInCount,
        waitlist: {
          total: activity._count.waitlist,
          promoted: waitlistPromotedCount,
          pending: waitlistPendingCount,
        },
        attendance: {
          total: activity._count.attendances,
          signedIn: signedInCount,
        },
      },
    };
  }

  async getProcessingHistory(registrationId?: string, waitlistEntryId?: string) {
    const where: any = {};
    if (registrationId) where.registrationId = registrationId;
    if (waitlistEntryId) where.waitlistEntryId = waitlistEntryId;

    return prisma.processingRecord.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }

  async getAuditLogs(batchId?: string, page: number = 1, pageSize: number = 50) {
    const where: any = {};
    if (batchId) where.batchId = batchId;

    const [data, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  private buildWhereClause(filters: QueryFilters): any {
    const where: any = {};

    if (filters.activityId) {
      where.activityId = filters.activityId;
    }

    if (filters.status) {
      where.finalStatus = filters.status;
    }

    if (filters.isDuplicate !== undefined) {
      where.isDuplicate = filters.isDuplicate;
    }

    if (filters.isBlacklisted !== undefined) {
      where.isBlacklisted = filters.isBlacklisted;
    }

    if (filters.isPromoted !== undefined) {
      where.isPromoted = filters.isPromoted;
    }

    if (filters.community) {
      where.community = filters.community;
    }

    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate);
      }
    }

    return where;
  }
}
