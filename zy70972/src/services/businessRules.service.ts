import { PrismaClient, Registration, WaitlistEntry } from '@prisma/client';
import { RegistrationStatus, ProcessingAction } from '../types/enums';
import { ProcessingRecord } from '@prisma/client';

const prisma = new PrismaClient();

export class BusinessRulesService {
  async checkDuplicate(idCard: string, activityId: string, excludeId?: string): Promise<Registration | null> {
    const where: any = {
      idCard,
      activityId,
      finalStatus: {
        notIn: [RegistrationStatus.REJECTED, RegistrationStatus.CANCELLED],
      },
    };
    
    if (excludeId) {
      where.id = { not: excludeId };
    }
    
    return await prisma.registration.findFirst({ where });
  }

  async checkBlacklist(idCard: string, activityId: string): Promise<boolean> {
    const blacklistEntry = await prisma.blacklistEntry.findFirst({
      where: {
        idCard,
        activityId,
        isActive: true,
      },
    });
    return !!blacklistEntry;
  }

  async getBlacklistEntry(idCard: string, activityId: string) {
    return await prisma.blacklistEntry.findFirst({
      where: {
        idCard,
        activityId,
        isActive: true,
      },
    });
  }

  async getApprovedCount(activityId: string): Promise<number> {
    return await prisma.registration.count({
      where: {
        activityId,
        finalStatus: RegistrationStatus.APPROVED,
      },
    });
  }

  async getActivityQuota(activityId: string): Promise<number> {
    const activity = await prisma.activity.findUnique({
      where: { id: activityId },
      select: { totalQuota: true },
    });
    return activity?.totalQuota || 0;
  }

  async processWaitlistPromotion(activityId: string, operator: string): Promise<WaitlistEntry[]> {
    const quota = await this.getActivityQuota(activityId);
    const approvedCount = await this.getApprovedCount(activityId);
    const availableSlots = quota - approvedCount;
    
    if (availableSlots <= 0) {
      return [];
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
      take: availableSlots,
    });

    const promotedEntries: WaitlistEntry[] = [];
    
    for (const entry of waitlistEntries) {
      const isBlacklisted = await this.checkBlacklist(entry.idCard, activityId);
      if (isBlacklisted) {
        await this.createProcessingRecord(
          null,
          entry.id,
          ProcessingAction.MARK_BLACKLISTED,
          null,
          RegistrationStatus.REJECTED,
          '候补递补时发现黑名单记录，不予通过',
          operator
        );
        continue;
      }

      const isDuplicate = await this.checkDuplicate(entry.idCard, activityId);
      if (isDuplicate) {
        await this.createProcessingRecord(
          null,
          entry.id,
          ProcessingAction.MARK_DUPLICATE,
          null,
          RegistrationStatus.REJECTED,
          '候补递补时发现重复报名记录，不予通过',
          operator
        );
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

      await this.createProcessingRecord(
        registration.id,
        entry.id,
        ProcessingAction.PROMOTE,
        null,
        RegistrationStatus.APPROVED,
        '候补递补成功，转为正式报名',
        operator
      );

      promotedEntries.push(entry);
    }

    return promotedEntries;
  }

  async createProcessingRecord(
    registrationId: string | null,
    waitlistEntryId: string | null,
    action: ProcessingAction,
    statusBefore: string | null,
    statusAfter: string | null,
    reason: string,
    processedBy: string
  ): Promise<ProcessingRecord> {
    return await prisma.processingRecord.create({
      data: {
        registrationId,
        waitlistEntryId,
        action,
        statusBefore,
        statusAfter,
        reason,
        processedBy,
      },
    });
  }
}
