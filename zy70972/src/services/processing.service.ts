import { PrismaClient, Registration } from '@prisma/client';
import { RegistrationStatus, ProcessingAction } from '../types/enums';

const prisma = new PrismaClient();

export class ProcessingService {
  async requestMaterials(registrationId: string, reason: string, operator: string): Promise<Registration> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new Error('报名记录不存在');
    }

    if (registration.finalStatus === RegistrationStatus.REJECTED ||
        registration.finalStatus === RegistrationStatus.CANCELLED) {
      throw new Error(`当前状态 ${registration.finalStatus} 不允许请求补材料`);
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        finalStatus: RegistrationStatus.NEEDS_MATERIALS,
      },
    });

    await prisma.processingRecord.create({
      data: {
        registrationId,
        action: ProcessingAction.REQUEST_MATERIALS,
        statusBefore: registration.finalStatus,
        statusAfter: RegistrationStatus.NEEDS_MATERIALS,
        reason,
        processedBy: operator,
      },
    });

    return updated;
  }

  async approveRegistration(registrationId: string, reason: string, operator: string): Promise<Registration> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new Error('报名记录不存在');
    }

    if (registration.finalStatus === RegistrationStatus.APPROVED) {
      throw new Error('该记录已通过，无需重复操作');
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        finalStatus: RegistrationStatus.APPROVED,
      },
    });

    await prisma.processingRecord.create({
      data: {
        registrationId,
        action: ProcessingAction.APPROVE,
        statusBefore: registration.finalStatus,
        statusAfter: RegistrationStatus.APPROVED,
        reason,
        processedBy: operator,
      },
    });

    return updated;
  }

  async rejectRegistration(registrationId: string, reason: string, operator: string): Promise<Registration> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new Error('报名记录不存在');
    }

    if (registration.finalStatus === RegistrationStatus.REJECTED) {
      throw new Error('该记录已拒绝，无需重复操作');
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        finalStatus: RegistrationStatus.REJECTED,
      },
    });

    await prisma.processingRecord.create({
      data: {
        registrationId,
        action: ProcessingAction.REJECT,
        statusBefore: registration.finalStatus,
        statusAfter: RegistrationStatus.REJECTED,
        reason,
        processedBy: operator,
      },
    });

    return updated;
  }

  async cancelRegistration(registrationId: string, reason: string, operator: string): Promise<Registration> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new Error('报名记录不存在');
    }

    if (registration.finalStatus === RegistrationStatus.CANCELLED) {
      throw new Error('该记录已取消，无需重复操作');
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        finalStatus: RegistrationStatus.CANCELLED,
      },
    });

    await prisma.processingRecord.create({
      data: {
        registrationId,
        action: ProcessingAction.CANCEL,
        statusBefore: registration.finalStatus,
        statusAfter: RegistrationStatus.CANCELLED,
        reason,
        processedBy: operator,
      },
    });

    return updated;
  }

  async reviewRegistration(registrationId: string, reason: string, operator: string): Promise<Registration> {
    const registration = await prisma.registration.findUnique({ where: { id: registrationId } });
    if (!registration) {
      throw new Error('报名记录不存在');
    }

    const updated = await prisma.registration.update({
      where: { id: registrationId },
      data: {
        finalStatus: RegistrationStatus.PENDING,
      },
    });

    await prisma.processingRecord.create({
      data: {
        registrationId,
        action: ProcessingAction.REVIEW,
        statusBefore: registration.finalStatus,
        statusAfter: RegistrationStatus.PENDING,
        reason,
        processedBy: operator,
      },
    });

    return updated;
  }

  async getProcessingRecords(registrationId?: string, waitlistEntryId?: string) {
    const where: any = {};
    if (registrationId) where.registrationId = registrationId;
    if (waitlistEntryId) where.waitlistEntryId = waitlistEntryId;

    return prisma.processingRecord.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });
  }
}
