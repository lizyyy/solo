import { PrismaClient, Batch } from '@prisma/client';
import { BatchType, BatchStatus, RegistrationStatus, ProcessingAction } from '../types/enums';
import { FileParserService } from './fileParser.service';
import { BusinessRulesService } from './businessRules.service';

const prisma = new PrismaClient();
const fileParser = new FileParserService();
const rulesService = new BusinessRulesService();

export class BatchService {
  async createBatch(
    activityId: string,
    batchType: BatchType,
    fileName: string,
    filePath: string,
    operator: string
  ): Promise<Batch> {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new Error('活动不存在');
    }

    const batch = await prisma.batch.create({
      data: {
        activityId,
        batchType,
        fileName,
        status: BatchStatus.PENDING,
      },
    });

    await this.logAudit(batch.id, 'BATCH_CREATED', operator, `创建批次: ${fileName}`);

    return batch;
  }

  async processBatch(batchId: string, operator: string): Promise<any> {
    const batch = await prisma.batch.findUnique({ where: { id: batchId } });
    if (!batch) {
      throw new Error('批次不存在');
    }

    if (batch.status === BatchStatus.PROCESSED) {
      throw new Error('批次已处理，不能重复处理');
    }

    await prisma.batch.update({
      where: { id: batchId },
      data: { status: BatchStatus.PROCESSING },
    });

    const filePath = `src/uploads/${batch.fileName}`;
    let result: any;

    try {
      switch (batch.batchType) {
        case BatchType.REGISTRATION_CSV:
          result = await this.processRegistrationBatch(batch, filePath, operator);
          break;
        case BatchType.WAITLIST_JSON:
          result = await this.processWaitlistBatch(batch, filePath, operator);
          break;
        case BatchType.ATTENDANCE_CSV:
          result = await this.processAttendanceBatch(batch, filePath, operator);
          break;
        case BatchType.BLACKLIST_CSV:
          result = await this.processBlacklistBatch(batch, filePath, operator);
          break;
        default:
          throw new Error('未知的批次类型');
      }

      await prisma.batch.update({
        where: { id: batchId },
        data: {
          status: BatchStatus.PROCESSED,
          processedBy: operator,
          processedAt: new Date(),
        },
      });

      await this.logAudit(batchId, 'BATCH_PROCESSED', operator, `批次处理完成`);

      return result;
    } catch (error) {
      await prisma.batch.update({
        where: { id: batchId },
        data: { status: BatchStatus.NEEDS_REVIEW },
      });
      throw error;
    }
  }

  private async processRegistrationBatch(batch: Batch, filePath: string, operator: string) {
    const rows = await fileParser.parseRegistrationCSV(filePath);
    const quota = await rulesService.getActivityQuota(batch.activityId);
    const approvedCount = await rulesService.getApprovedCount(batch.activityId);
    let currentApproved = approvedCount;

    const results = {
      total: rows.length,
      approved: 0,
      duplicates: 0,
      blacklisted: 0,
      waitlisted: 0,
      errors: [] as any[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const order = i + 1;

      if (!row.idCard || !row.name || !row.phone) {
        results.errors.push({ order, reason: '缺少必填字段' });
        continue;
      }

      const isDuplicate = await rulesService.checkDuplicate(row.idCard, batch.activityId);
      if (isDuplicate) {
        const registration = await prisma.registration.create({
          data: {
            batchId: batch.id,
            activityId: batch.activityId,
            idCard: row.idCard,
            name: row.name,
            phone: row.phone,
            address: row.address,
            community: row.community,
            source: 'DIRECT',
            originalOrder: order,
            finalStatus: RegistrationStatus.REJECTED,
            isDuplicate: true,
          },
        });

        await rulesService.createProcessingRecord(
          registration.id,
          null,
          ProcessingAction.MARK_DUPLICATE,
          RegistrationStatus.PENDING,
          RegistrationStatus.REJECTED,
          `与已有报名记录重复，已有记录ID: ${isDuplicate.id}`,
          operator
        );

        results.duplicates++;
        continue;
      }

      const isBlacklisted = await rulesService.checkBlacklist(row.idCard, batch.activityId);
      if (isBlacklisted) {
        const blacklistEntry = await rulesService.getBlacklistEntry(row.idCard, batch.activityId);
        const registration = await prisma.registration.create({
          data: {
            batchId: batch.id,
            activityId: batch.activityId,
            idCard: row.idCard,
            name: row.name,
            phone: row.phone,
            address: row.address,
            community: row.community,
            source: 'DIRECT',
            originalOrder: order,
            finalStatus: RegistrationStatus.REJECTED,
            isBlacklisted: true,
          },
        });

        await rulesService.createProcessingRecord(
          registration.id,
          null,
          ProcessingAction.MARK_BLACKLISTED,
          RegistrationStatus.PENDING,
          RegistrationStatus.REJECTED,
          `黑名单人员，原因: ${blacklistEntry?.reason || '无详细原因'}`,
          operator
        );

        results.blacklisted++;
        continue;
      }

      let status = RegistrationStatus.APPROVED;
      let waitlistOrder: number | null = null;

      if (currentApproved >= quota) {
        status = RegistrationStatus.WAITLISTED;
        waitlistOrder = currentApproved - quota + 1;
        results.waitlisted++;
      } else {
        currentApproved++;
        results.approved++;
      }

      const registration = await prisma.registration.create({
        data: {
          batchId: batch.id,
          activityId: batch.activityId,
          idCard: row.idCard,
          name: row.name,
          phone: row.phone,
          address: row.address,
          community: row.community,
          source: 'DIRECT',
          originalOrder: order,
          finalStatus: status,
          waitlistOrder,
        },
      });

      await rulesService.createProcessingRecord(
        registration.id,
        null,
        status === RegistrationStatus.APPROVED ? ProcessingAction.APPROVE : ProcessingAction.REVIEW,
        RegistrationStatus.PENDING,
        status,
        status === RegistrationStatus.APPROVED ? '报名成功' : '名额已满，进入候补',
        operator
      );
    }

    return results;
  }

  private async processWaitlistBatch(batch: Batch, filePath: string, operator: string) {
    const rows = await fileParser.parseWaitlistJSON(filePath);
    const results = {
      total: rows.length,
      imported: 0,
      duplicates: 0,
      errors: [] as any[],
    };

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (!row.idCard || !row.name || !row.phone) {
        results.errors.push({ order: i + 1, reason: '缺少必填字段' });
        continue;
      }

      const existing = await prisma.waitlistEntry.findFirst({
        where: {
          idCard: row.idCard,
          activityId: batch.activityId,
          isPromoted: false,
        },
      });

      if (existing) {
        results.duplicates++;
        continue;
      }

      await prisma.waitlistEntry.create({
        data: {
          batchId: batch.id,
          activityId: batch.activityId,
          idCard: row.idCard,
          name: row.name,
          phone: row.phone,
          address: row.address,
          community: row.community,
          waitlistOrder: row.waitlistOrder,
          priority: row.priority,
          reason: row.reason,
        },
      });

      results.imported++;
    }

    return results;
  }

  private async processAttendanceBatch(batch: Batch, filePath: string, operator: string) {
    const rows = await fileParser.parseAttendanceCSV(filePath);
    const results = {
      total: rows.length,
      matched: 0,
      unmatched: 0,
      signedIn: 0,
      absent: 0,
    };

    for (const row of rows) {
      const registration = await prisma.registration.findFirst({
        where: {
          idCard: row.idCard,
          activityId: batch.activityId,
          finalStatus: RegistrationStatus.APPROVED,
        },
      });

      let status = row.status || 'NOT_SIGNED';
      if (row.signInTime && status === 'NOT_SIGNED') {
        status = 'SIGNED_IN';
      }

      if (registration) {
        results.matched++;
        if (status === 'SIGNED_IN') results.signedIn++;
        if (status === 'ABSENT') results.absent++;
      } else {
        results.unmatched++;
      }

      await prisma.attendance.create({
        data: {
          batchId: batch.id,
          activityId: batch.activityId,
          registrationId: registration?.id,
          idCard: row.idCard,
          name: row.name,
          signInTime: row.signInTime ? new Date(row.signInTime) : null,
          signOutTime: row.signOutTime ? new Date(row.signOutTime) : null,
          status,
        },
      });
    }

    return results;
  }

  private async processBlacklistBatch(batch: Batch, filePath: string, operator: string) {
    const rows = await fileParser.parseBlacklistCSV(filePath);
    const results = {
      total: rows.length,
      added: 0,
      updated: 0,
    };

    for (const row of rows) {
      const existing = await prisma.blacklistEntry.findFirst({
        where: {
          idCard: row.idCard,
          activityId: batch.activityId,
        },
      });

      if (existing) {
        await prisma.blacklistEntry.update({
          where: { id: existing.id },
          data: {
            reason: row.reason,
            isActive: true,
          },
        });
        results.updated++;
      } else {
        await prisma.blacklistEntry.create({
          data: {
            activityId: batch.activityId,
            idCard: row.idCard,
            name: row.name,
            reason: row.reason,
            addedBy: row.addedBy || operator,
          },
        });
        results.added++;
      }
    }

    return results;
  }

  async rejectBatch(batchId: string, operator: string, remark: string) {
    const batch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.REJECTED,
        remark,
        processedBy: operator,
        processedAt: new Date(),
      },
    });

    await this.logAudit(batchId, 'BATCH_REJECTED', operator, `批次被拒绝: ${remark}`);

    return batch;
  }

  async markBatchForReview(batchId: string, operator: string, remark: string) {
    const batch = await prisma.batch.update({
      where: { id: batchId },
      data: {
        status: BatchStatus.NEEDS_REVIEW,
        remark,
        processedBy: operator,
        processedAt: new Date(),
      },
    });

    await this.logAudit(batchId, 'BATCH_NEEDS_REVIEW', operator, `批次需要修改: ${remark}`);

    return batch;
  }

  async getBatch(batchId: string) {
    return prisma.batch.findUnique({
      where: { id: batchId },
      include: {
        registrations: { take: 100 },
        waitlist: { take: 100 },
        attendances: { take: 100 },
        auditLogs: true,
      },
    });
  }

  async listBatches(activityId?: string, status?: string) {
    const where: any = {};
    if (activityId) where.activityId = activityId;
    if (status) where.status = status;

    return prisma.batch.findMany({
      where,
      orderBy: { createdAt: 'desc' },
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
  }

  async promoteWaitlist(activityId: string, operator: string) {
    const activity = await prisma.activity.findUnique({ where: { id: activityId } });
    if (!activity) {
      throw new Error('活动不存在');
    }

    const quota = await rulesService.getActivityQuota(activityId);
    const approvedCount = await rulesService.getApprovedCount(activityId);
    const availableSlots = quota - approvedCount;

    if (availableSlots <= 0) {
      return {
        promoted: [],
        skipped: [],
        message: `当前已通过人数 ${approvedCount} 已达名额 ${quota}，无空缺席位可递补`,
      };
    }

    const waitlistEntries = await prisma.waitlistEntry.findMany({
      where: {
        activityId,
        isPromoted: false,
      },
      orderBy: [
        { priority: 'desc' },
        { waitlistOrder: 'asc' },
      ],
    });

    if (waitlistEntries.length === 0) {
      return {
        promoted: [],
        skipped: [],
        message: `候补队列为空，有 ${availableSlots} 个空缺席位但无人可递补`,
      };
    }

    const promoted: any[] = [];
    const skipped: any[] = [];

    for (const entry of waitlistEntries) {
      if (promoted.length >= availableSlots) {
        break;
      }
      const isBlacklisted = await rulesService.checkBlacklist(entry.idCard, activityId);
      if (isBlacklisted) {
        const blacklistEntry = await rulesService.getBlacklistEntry(entry.idCard, activityId);
        await rulesService.createProcessingRecord(
          null,
          entry.id,
          ProcessingAction.MARK_BLACKLISTED,
          null,
          RegistrationStatus.REJECTED,
          `候补递补时发现黑名单记录，不予递补。黑名单原因: ${blacklistEntry?.reason || '无详细原因'}`,
          operator
        );
        skipped.push({
          id: entry.id,
          name: entry.name,
          idCard: entry.idCard,
          waitlistOrder: entry.waitlistOrder,
          reason: '黑名单人员，不予递补',
        });
        continue;
      }

      const isDuplicate = await rulesService.checkDuplicate(entry.idCard, activityId);
      if (isDuplicate) {
        await rulesService.createProcessingRecord(
          null,
          entry.id,
          ProcessingAction.MARK_DUPLICATE,
          null,
          RegistrationStatus.REJECTED,
          `候补递补时发现已有报名记录(ID: ${isDuplicate.id})，不予递补`,
          operator
        );
        skipped.push({
          id: entry.id,
          name: entry.name,
          idCard: entry.idCard,
          waitlistOrder: entry.waitlistOrder,
          reason: '已有报名记录，不予递补',
        });
        continue;
      }

      const registration = await prisma.registration.create({
        data: {
          batchId: entry.batchId,
          activityId: entry.activityId,
          idCard: entry.idCard,
          name: entry.name,
          phone: entry.phone,
          address: entry.address,
          community: entry.community,
          source: 'WAITLIST_PROMOTED',
          originalOrder: entry.waitlistOrder,
          finalStatus: RegistrationStatus.APPROVED,
          waitlistOrder: entry.waitlistOrder,
          isPromoted: true,
        },
      });

      await prisma.waitlistEntry.update({
        where: { id: entry.id },
        data: {
          isPromoted: true,
          promotedAt: new Date(),
        },
      });

      await rulesService.createProcessingRecord(
        registration.id,
        entry.id,
        ProcessingAction.PROMOTE,
        null,
        RegistrationStatus.APPROVED,
        `候补递补成功：候补顺序 ${entry.waitlistOrder}，优先级 ${entry.priority}，转为正式报名`,
        operator
      );

      promoted.push({
        id: registration.id,
        name: entry.name,
        idCard: entry.idCard,
        waitlistOrder: entry.waitlistOrder,
        priority: entry.priority,
      });
    }

    await this.logAudit(
      null as any,
      'WAITLIST_PROMOTED',
      operator,
      `候补递补完成：递补 ${promoted.length} 人，跳过 ${skipped.length} 人`
    );

    return {
      promoted,
      skipped,
      availableSlots,
      totalPromoted: promoted.length,
      totalSkipped: skipped.length,
    };
  }

  private async logAudit(batchId: string | null, action: string, operator: string, details: string) {
    await prisma.auditLog.create({
      data: {
        batchId,
        action,
        operator,
        details,
      },
    });
  }
}
