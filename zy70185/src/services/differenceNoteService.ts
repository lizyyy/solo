import { DifferenceNote } from '@prisma/client';
import prisma from '../db/prisma';
import { idempotencyService } from './idempotency';
import { NotFoundError, ValidationError, LockedError } from '../utils/errors';

export interface CreateDifferenceNoteParams {
  submissionId: string;
  category: string;
  description: string;
  amount: number;
  previousValue?: number;
  currentValue?: number;
  actorId: string;
}

export class DifferenceNoteService {
  async create(params: CreateDifferenceNoteParams): Promise<DifferenceNote> {
    const {
      submissionId,
      category,
      description,
      amount,
      previousValue,
      currentValue,
      actorId
    } = params;

    const submission = await prisma.departmentSubmission.findUnique({
      where: { id: submissionId },
      include: {
        budgetVersion: true
      }
    });

    if (!submission) {
      throw new NotFoundError(`未找到部门提交 ${submissionId}`);
    }

    if (submission.status === 'LOCKED') {
      throw new LockedError('部门提交已锁定，无法添加差异说明');
    }

    if (submission.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法添加差异说明');
    }

    if (!category || category.trim().length === 0) {
      throw new ValidationError('差异分类不能为空');
    }

    if (!description || description.length < 10) {
      throw new ValidationError('差异描述至少需要 10 个字符');
    }

    if (isNaN(amount)) {
      throw new ValidationError('差异金额必须是有效数字');
    }

    const key = idempotencyService.generateKey(
      'difference_note',
      `${submissionId}-${category}-${amount}`,
      'create_difference_note'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'create_difference_note',
      async () => {
        return await prisma.differenceNote.create({
          data: {
            submissionId,
            category: category.trim(),
            description,
            amount,
            previousValue,
            currentValue,
            createdBy: actorId
          }
        });
      }
    );
  }

  async getById(id: string): Promise<DifferenceNote> {
    const note = await prisma.differenceNote.findUnique({
      where: { id },
      include: {
        submission: {
          include: {
            department: true,
            budgetVersion: true
          }
        }
      }
    });

    if (!note) {
      throw new NotFoundError(`未找到差异说明 ${id}`);
    }

    return note;
  }

  async listBySubmission(submissionId: string): Promise<DifferenceNote[]> {
    return await prisma.differenceNote.findMany({
      where: { submissionId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async listByBudgetVersion(budgetVersionId: string): Promise<(DifferenceNote & { submission: any })[]> {
    const submissions = await prisma.departmentSubmission.findMany({
      where: { budgetVersionId },
      select: { id: true }
    });

    const submissionIds = submissions.map(s => s.id);

    return await prisma.differenceNote.findMany({
      where: {
        submissionId: { in: submissionIds }
      },
      include: {
        submission: {
          include: {
            department: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getSummary(budgetVersionId: string): Promise<{
    totalNotes: number;
    totalAmount: number;
    byCategory: Record<string, { count: number; amount: number }>;
  }> {
    const notes = await this.listByBudgetVersion(budgetVersionId);

    const summary = {
      totalNotes: notes.length,
      totalAmount: 0,
      byCategory: {} as Record<string, { count: number; amount: number }>
    };

    for (const note of notes) {
      const amount = Number(note.amount);
      summary.totalAmount += amount;

      if (!summary.byCategory[note.category]) {
        summary.byCategory[note.category] = { count: 0, amount: 0 };
      }
      summary.byCategory[note.category].count++;
      summary.byCategory[note.category].amount += amount;
    }

    return summary;
  }

  async delete(id: string, actorId: string): Promise<void> {
    const note = await this.getById(id);

    if (note.submission.status === 'LOCKED') {
      throw new LockedError('部门提交已锁定，无法删除差异说明');
    }

    if (note.submission.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法删除差异说明');
    }

    await prisma.differenceNote.delete({
      where: { id }
    });
  }
}

export const differenceNoteService = new DifferenceNoteService();
