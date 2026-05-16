import prisma from '../utils/prisma';
import { createError } from '../utils/errors';
import secretService from './SecretService';
import type { CreateReferenceInput, RecordAccessInput } from '../utils/validation';

export class ReferenceService {
  async createReference(secretName: string, data: CreateReferenceInput) {
    const secret = await secretService.getSecretByName(secretName);

    const reference = await prisma.reference.create({
      data: {
        secret_id: secret.id,
        secret_name: secretName,
        service_name: data.service_name,
        environment: data.environment,
        file_path: data.file_path,
        line_number: data.line_number,
      },
    });

    await prisma.secret.update({
      where: { name: secretName },
      data: { last_access: new Date() },
    });

    return reference;
  }

  async getReferencesBySecret(secretName: string, includeInactive: boolean = false) {
    const secret = await secretService.getSecretByName(secretName);

    const where: any = { secret_id: secret.id };
    if (!includeInactive) {
      where.is_active = true;
    }

    return prisma.reference.findMany({
      where,
      orderBy: { created_at: 'desc' },
      include: {
        access_logs: { take: 5, orderBy: { accessed_at: 'desc' } },
      },
    });
  }

  async deactivateReference(referenceId: string) {
    const reference = await prisma.reference.findUnique({
      where: { id: referenceId },
    });

    if (!reference) {
      throw createError('REFERENCE_NOT_FOUND', 404, {
        raw_input: { referenceId },
        processing_basis: '数据库中未找到该引用',
        conclusion: '停用失败，引用不存在',
      });
    }

    return prisma.reference.update({
      where: { id: referenceId },
      data: { is_active: false },
    });
  }

  async recordAccess(secretName: string, data: RecordAccessInput) {
    const secret = await secretService.getSecretByName(secretName);

    if (data.reference_id) {
      const reference = await prisma.reference.findUnique({
        where: { id: data.reference_id },
      });

      if (!reference || reference.secret_id !== secret.id) {
        throw createError('REFERENCE_NOT_FOUND', 404, {
          raw_input: data,
          processing_basis: '引用不存在或不属于该Secret',
          conclusion: '访问记录失败',
        });
      }

      await prisma.reference.update({
        where: { id: data.reference_id },
        data: { last_access: new Date() },
      });
    }

    const accessLog = await prisma.accessLog.create({
      data: {
        secret_id: secret.id,
        reference_id: data.reference_id,
        accessed_by: data.accessed_by,
        access_source: data.access_source,
      },
    });

    await prisma.secret.update({
      where: { name: secretName },
      data: { last_access: new Date() },
    });

    return accessLog;
  }

  async getAccessLogs(secretName: string, limit: number = 50) {
    const secret = await secretService.getSecretByName(secretName);

    return prisma.accessLog.findMany({
      where: { secret_id: secret.id },
      take: limit,
      orderBy: { accessed_at: 'desc' },
    });
  }
}

export default new ReferenceService();
