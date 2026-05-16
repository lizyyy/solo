import prisma from '../utils/prisma';
import { createError } from '../utils/errors';
import secretService from './SecretService';
import type { CreateReplacementInput, ApproveReplacementInput } from '../utils/validation';

export class ReplacementService {
  async createReplacement(secretName: string, data: CreateReplacementInput) {
    const secret = await secretService.getSecretByName(secretName);

    return prisma.replacementPlan.create({
      data: {
        secret_id: secret.id,
        new_secret_name: data.new_secret_name,
        planned_date: data.planned_date,
        created_by: data.created_by,
      },
    });
  }

  async getReplacementsBySecret(secretName: string) {
    const secret = await secretService.getSecretByName(secretName);

    return prisma.replacementPlan.findMany({
      where: { secret_id: secret.id },
      orderBy: { created_at: 'desc' },
    });
  }

  async approveReplacement(replacementId: string, data: ApproveReplacementInput) {
    const replacement = await prisma.replacementPlan.findUnique({
      where: { id: replacementId },
    });

    if (!replacement) {
      throw createError('REPLACEMENT_NOT_FOUND', 404, {
        raw_input: { replacementId, ...data },
        processing_basis: '数据库中未找到该替换计划',
        conclusion: '审批失败，替换计划不存在',
      });
    }

    if (replacement.status !== 'PENDING_APPROVAL') {
      throw createError('OPERATION_NOT_ALLOWED', 400, {
        raw_input: { replacementId, current_status: replacement.status },
        processing_basis: '审批规则：只有待审批状态的计划可以审批',
        conclusion: '审批被拒绝，当前状态不允许审批',
      });
    }

    return prisma.replacementPlan.update({
      where: { id: replacementId },
      data: {
        status: 'APPROVED',
        approver: data.approver,
        approval_comment: data.approval_comment,
        approval_date: new Date(),
      },
    });
  }

  async rejectReplacement(replacementId: string, data: ApproveReplacementInput) {
    const replacement = await prisma.replacementPlan.findUnique({
      where: { id: replacementId },
    });

    if (!replacement) {
      throw createError('REPLACEMENT_NOT_FOUND', 404, {
        raw_input: { replacementId, ...data },
        processing_basis: '数据库中未找到该替换计划',
        conclusion: '拒绝失败，替换计划不存在',
      });
    }

    return prisma.replacementPlan.update({
      where: { id: replacementId },
      data: {
        status: 'REJECTED',
        approver: data.approver,
        approval_comment: data.approval_comment,
        approval_date: new Date(),
      },
    });
  }

  async executeReplacement(replacementId: string) {
    const replacement = await prisma.replacementPlan.findUnique({
      where: { id: replacementId },
    });

    if (!replacement) {
      throw createError('REPLACEMENT_NOT_FOUND', 404, {
        raw_input: { replacementId },
        processing_basis: '数据库中未找到该替换计划',
        conclusion: '执行失败，替换计划不存在',
      });
    }

    if (replacement.status !== 'APPROVED') {
      throw createError('OPERATION_NOT_ALLOWED', 400, {
        raw_input: { replacementId, current_status: replacement.status },
        processing_basis: '执行规则：只有已审批通过的计划可以执行',
        conclusion: '执行被拒绝，当前状态不允许执行',
      });
    }

    return prisma.replacementPlan.update({
      where: { id: replacementId },
      data: { status: 'EXECUTED' },
    });
  }
}

export default new ReplacementService();
