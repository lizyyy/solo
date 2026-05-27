import { PrismaClient, Registration } from "@prisma/client";
import { RegistrationStatus, ProcessingAction } from "../types/enums";
import { BusinessRulesService } from "./businessRules.service";

const prisma = new PrismaClient();
const rulesService = new BusinessRulesService();

export class ProcessingService {
  async requestMaterials(id: string, reason: string, operator: string) {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new Error("报名记录不存在");
    }

    if (registration.finalStatus !== RegistrationStatus.PENDING) {
      throw new Error("只有待审核状态的记录可以要求补充材料");
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { finalStatus: RegistrationStatus.NEEDS_MATERIALS },
    });

    await rulesService.createProcessingRecord(
      id,
      null,
      ProcessingAction.REQUEST_MATERIALS,
      RegistrationStatus.PENDING,
      RegistrationStatus.NEEDS_MATERIALS,
      reason,
      operator
    );

    return updated;
  }

  async approveRegistration(id: string, reason: string, operator: string) {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new Error("报名记录不存在");
    }

    if (registration.finalStatus !== RegistrationStatus.PENDING && 
        registration.finalStatus !== RegistrationStatus.NEEDS_MATERIALS) {
      throw new Error("只有待审核或待补充材料状态的记录可以审核通过");
    }

    const activity = await prisma.activity.findUnique({
      where: { id: registration.activityId },
    });
    if (!activity) {
      throw new Error("活动不存在");
    }

    const approvedCount = await rulesService.getApprovedCount(registration.activityId);
    if (approvedCount >= activity.totalQuota) {
      throw new Error(`活动名额已满，当前已通过 ${approvedCount} 人，总名额 ${activity.totalQuota} 人`);
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { finalStatus: RegistrationStatus.APPROVED },
    });

    await rulesService.createProcessingRecord(
      id,
      null,
      ProcessingAction.APPROVE,
      registration.finalStatus,
      RegistrationStatus.APPROVED,
      reason,
      operator
    );

    return updated;
  }

  async rejectRegistration(id: string, reason: string, operator: string) {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new Error("报名记录不存在");
    }

    if (registration.finalStatus !== RegistrationStatus.PENDING && 
        registration.finalStatus !== RegistrationStatus.NEEDS_MATERIALS) {
      throw new Error("只有待审核或待补充材料状态的记录可以拒绝");
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { finalStatus: RegistrationStatus.REJECTED },
    });

    await rulesService.createProcessingRecord(
      id,
      null,
      ProcessingAction.REJECT,
      registration.finalStatus,
      RegistrationStatus.REJECTED,
      reason,
      operator
    );

    return updated;
  }

  async cancelRegistration(id: string, reason: string, operator: string) {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new Error("报名记录不存在");
    }

    if (registration.finalStatus === RegistrationStatus.CANCELLED) {
      throw new Error("该记录已取消");
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { finalStatus: RegistrationStatus.CANCELLED },
    });

    await rulesService.createProcessingRecord(
      id,
      null,
      ProcessingAction.CANCEL,
      registration.finalStatus,
      RegistrationStatus.CANCELLED,
      reason,
      operator
    );

    return updated;
  }

  async reviewRegistration(id: string, reason: string, operator: string) {
    const registration = await prisma.registration.findUnique({ where: { id } });
    if (!registration) {
      throw new Error("报名记录不存在");
    }

    if (registration.finalStatus !== RegistrationStatus.NEEDS_MATERIALS) {
      throw new Error("只有待补充材料状态的记录可以提交审核");
    }

    const updated = await prisma.registration.update({
      where: { id },
      data: { finalStatus: RegistrationStatus.PENDING },
    });

    await rulesService.createProcessingRecord(
      id,
      null,
      ProcessingAction.REVIEW,
      RegistrationStatus.NEEDS_MATERIALS,
      RegistrationStatus.PENDING,
      reason,
      operator
    );

    return updated;
  }

  async getProcessingRecords(registrationId?: string, waitlistEntryId?: string) {
    const where: any = {};
    if (registrationId) where.registrationId = registrationId;
    if (waitlistEntryId) where.waitlistEntryId = waitlistEntryId;

    return prisma.processingRecord.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });
  }
}
