import prisma from '../utils/prisma';
import secretService from './SecretService';
import type { CreateCorrectionInput } from '../utils/validation';

export class CorrectionService {
  async createCorrection(secretName: string, data: CreateCorrectionInput) {
    const secret = await secretService.getSecretByName(secretName);

    return prisma.correctionLog.create({
      data: {
        secret_id: secret.id,
        field_name: data.field_name,
        old_value: data.old_value,
        new_value: data.new_value,
        reason: data.reason,
        corrected_by: data.corrected_by,
      },
    });
  }

  async getCorrectionsBySecret(secretName: string) {
    const secret = await secretService.getSecretByName(secretName);

    return prisma.correctionLog.findMany({
      where: { secret_id: secret.id },
      orderBy: { corrected_at: 'desc' },
    });
  }
}

export default new CorrectionService();
