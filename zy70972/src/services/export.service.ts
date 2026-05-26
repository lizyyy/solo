import { PrismaClient, Registration } from '@prisma/client';
import { Parser } from 'json2csv';
import { QueryFilters } from '../types/interfaces';
import { QueryService } from './query.service';

const prisma = new PrismaClient();
const queryService = new QueryService();

export class ExportService {
  async exportRegistrations(filters: QueryFilters): Promise<string> {
    const where = this.buildWhereClause(filters);
    
    const registrations = await prisma.registration.findMany({
      where,
      orderBy: [
        { createdAt: 'asc' },
        { originalOrder: 'asc' },
      ],
      include: {
        activity: { select: { name: true } },
        batch: { select: { fileName: true, createdAt: true } },
        processingRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const data = registrations.map((reg) => ({
      活动名称: reg.activity?.name || '',
      批次文件: reg.batch?.fileName || '',
      导入时间: reg.batch?.createdAt ? new Date(reg.batch.createdAt).toLocaleString() : '',
      原始序号: reg.originalOrder,
      身份证号: reg.idCard,
      姓名: reg.name,
      手机号: reg.phone,
      住址: reg.address || '',
      社区: reg.community || '',
      报名来源: this.translateSource(reg.source),
      最终状态: this.translateStatus(reg.finalStatus),
      候补序号: reg.waitlistOrder || '',
      是否重复: reg.isDuplicate ? '是' : '否',
      是否黑名单: reg.isBlacklisted ? '是' : '否',
      是否候补递补: reg.isPromoted ? '是' : '否',
      最新处理原因: reg.processingRecords[0]?.reason || '',
      最新处理人: reg.processingRecords[0]?.processedBy || '',
      最新处理时间: reg.processingRecords[0]?.processedAt
        ? new Date(reg.processingRecords[0].processedAt).toLocaleString()
        : '',
      导入时间戳: reg.createdAt ? new Date(reg.createdAt).toLocaleString() : '',
    }));

    const fields = Object.keys(data[0] || {});
    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  async exportWaitlist(activityId: string, isPromoted?: boolean): Promise<string> {
    const where: any = { activityId };
    if (isPromoted !== undefined) where.isPromoted = isPromoted;

    const entries = await prisma.waitlistEntry.findMany({
      where,
      orderBy: [
        { priority: 'desc' },
        { waitlistOrder: 'asc' },
      ],
      include: {
        activity: { select: { name: true } },
        batch: { select: { fileName: true } },
        processingRecords: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
    });

    const data = entries.map((entry) => ({
      活动名称: entry.activity?.name || '',
      候补顺序: entry.waitlistOrder,
      优先级: entry.priority,
      身份证号: entry.idCard,
      姓名: entry.name,
      手机号: entry.phone,
      住址: entry.address || '',
      社区: entry.community || '',
      候补原因: entry.reason || '',
      是否已递补: entry.isPromoted ? '是' : '否',
      递补时间: entry.promotedAt ? new Date(entry.promotedAt).toLocaleString() : '',
      批次文件: entry.batch?.fileName || '',
      最新处理原因: entry.processingRecords[0]?.reason || '',
      最新处理人: entry.processingRecords[0]?.processedBy || '',
    }));

    const fields = Object.keys(data[0] || {});
    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  async exportAttendance(activityId: string, status?: string): Promise<string> {
    const where: any = { activityId };
    if (status) where.status = status;

    const records = await prisma.attendance.findMany({
      where,
      orderBy: { signInTime: 'asc' },
      include: {
        activity: { select: { name: true } },
        registration: {
          select: {
            phone: true,
            community: true,
            finalStatus: true,
          },
        },
        batch: { select: { fileName: true } },
      },
    });

    const data = records.map((record) => ({
      活动名称: record.activity?.name || '',
      身份证号: record.idCard,
      姓名: record.name,
      手机号: record.registration?.phone || '',
      社区: record.registration?.community || '',
      签到状态: this.translateAttendanceStatus(record.status),
      签到时间: record.signInTime ? new Date(record.signInTime).toLocaleString() : '',
      签退时间: record.signOutTime ? new Date(record.signOutTime).toLocaleString() : '',
      报名状态: record.registration?.finalStatus ? this.translateStatus(record.registration.finalStatus) : '',
      批次文件: record.batch?.fileName || '',
    }));

    const fields = Object.keys(data[0] || {});
    const parser = new Parser({ fields });
    return parser.parse(data);
  }

  async exportFullReport(activityId: string): Promise<{
    summary: any;
    registrationsCsv: string;
    waitlistCsv: string;
    attendanceCsv: string;
  }> {
    const [summary, registrationsCsv, waitlistCsv, attendanceCsv] = await Promise.all([
      queryService.getActivitySummary(activityId),
      this.exportRegistrations({ activityId }),
      this.exportWaitlist(activityId),
      this.exportAttendance(activityId),
    ]);

    return {
      summary,
      registrationsCsv,
      waitlistCsv,
      attendanceCsv,
    };
  }

  async getRegistrationExportCount(filters: QueryFilters): Promise<number> {
    const where = this.buildWhereClause(filters);
    return prisma.registration.count({ where });
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

  private translateSource(source: string): string {
    const map: Record<string, string> = {
      DIRECT: '直接报名',
      WAITLIST_PROMOTED: '候补递补',
      MANUAL: '手工录入',
    };
    return map[source] || source;
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      PENDING: '待处理',
      APPROVED: '已通过',
      REJECTED: '已拒绝',
      WAITLISTED: '候补中',
      PROMOTED: '已递补',
      CANCELLED: '已取消',
      NEEDS_MATERIALS: '需补材料',
    };
    return map[status] || status;
  }

  private translateAttendanceStatus(status: string): string {
    const map: Record<string, string> = {
      NOT_SIGNED: '未签到',
      SIGNED_IN: '已签到',
      SIGNED_OUT: '已签退',
      ABSENT: '缺席',
    };
    return map[status] || status;
  }
}
