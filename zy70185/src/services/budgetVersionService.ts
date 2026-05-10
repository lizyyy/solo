import { BudgetVersionStatus, BudgetVersion, Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { stateMachineService } from './stateMachine';
import { idempotencyService } from './idempotency';
import { NotFoundError, ValidationError, LockedError } from '../utils/errors';

export interface CreateBudgetVersionParams {
  year: number;
  quarter: number;
  description?: string;
  previousVersionId?: string;
  actorId: string;
}

export interface BudgetVersionWithDetails extends BudgetVersion {
  submissionCount?: number;
  approvedSubmissionCount?: number;
}

export class BudgetVersionService {
  async create(params: CreateBudgetVersionParams): Promise<BudgetVersion> {
    const { year, quarter, description, previousVersionId, actorId } = params;

    if (year < 2020 || year > 2100) {
      throw new ValidationError('年度必须在 2020 到 2100 之间');
    }

    if (quarter < 1 || quarter > 4) {
      throw new ValidationError('季度必须为 1-4');
    }

    let previousVersion: BudgetVersion | null = null;
    if (previousVersionId) {
      previousVersion = await prisma.budgetVersion.findUnique({
        where: { id: previousVersionId }
      });

      if (!previousVersion) {
        throw new NotFoundError(`未找到历史版本 ${previousVersionId}`);
      }

      if (previousVersion.year !== year || previousVersion.quarter !== quarter) {
        throw new ValidationError('历史版本必须与新版本年度季度一致');
      }
    }

    const maxVersion = await prisma.budgetVersion.aggregate({
      where: { year, quarter },
      _max: { version: true }
    });

    const nextVersion = (maxVersion._max.version || 0) + 1;

    const key = idempotencyService.generateKey(
      'budget_version',
      `${year}-${quarter}-${nextVersion}`,
      'create_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'create_budget_version', async () => {
      return await prisma.budgetVersion.create({
        data: {
          year,
          quarter,
          version: nextVersion,
          description: description || `第 ${nextVersion} 轮滚动预测`,
          previousVersionId: previousVersion?.id,
          status: BudgetVersionStatus.DRAFT
        }
      });
    });
  }

  async getById(id: string): Promise<BudgetVersionWithDetails> {
    const version = await prisma.budgetVersion.findUnique({
      where: { id },
      include: {
        submissions: {
          select: {
            id: true,
            status: true
          }
        }
      }
    });

    if (!version) {
      throw new NotFoundError(`未找到预算版本 ${id}`);
    }

    const { submissions, ...rest } = version;

    return {
      ...rest,
      submissionCount: submissions.length,
      approvedSubmissionCount: submissions.filter(
        s => s.status === 'APPROVED' || s.status === 'LOCKED'
      ).length
    };
  }

  async list(filters?: {
    year?: number;
    quarter?: number;
    status?: BudgetVersionStatus;
  }): Promise<BudgetVersionWithDetails[]> {
    const where: Prisma.BudgetVersionWhereInput = {};

    if (filters?.year) where.year = filters.year;
    if (filters?.quarter) where.quarter = filters.quarter;
    if (filters?.status) where.status = filters.status;

    const versions = await prisma.budgetVersion.findMany({
      where,
      include: {
        submissions: {
          select: {
            id: true,
            status: true
          }
        }
      },
      orderBy: [
        { year: 'desc' },
        { quarter: 'desc' },
        { version: 'desc' }
      ]
    });

    return versions.map(({ submissions, ...rest }) => ({
      ...rest,
      submissionCount: submissions.length,
      approvedSubmissionCount: submissions.filter(
        s => s.status === 'APPROVED' || s.status === 'LOCKED'
      ).length
    }));
  }

  async submit(id: string, actorId: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.SUBMITTED,
      '预算版本'
    );

    if (version.isLocked) {
      throw new LockedError('预算版本已锁定，无法提交');
    }

    const pendingSubmissions = await prisma.departmentSubmission.count({
      where: {
        budgetVersionId: id,
        status: {
          in: ['PENDING', 'REJECTED', 'RESUBMITTED']
        }
      }
    });

    if (pendingSubmissions > 0) {
      throw new ValidationError(
        `还有 ${pendingSubmissions} 个部门提交未完成审核，无法提交预算版本`
      );
    }

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'submit_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'submit_budget_version', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.SUBMITTED
        }
      });
    }, id);
  }

  async review(id: string, actorId: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.UNDER_REVIEW,
      '预算版本'
    );

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'review_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'review_budget_version', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.UNDER_REVIEW
        }
      });
    }, id);
  }

  async approve(id: string, actorId: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.APPROVED,
      '预算版本'
    );

    const pendingSubmissions = await prisma.departmentSubmission.count({
      where: {
        budgetVersionId: id,
        status: {
          not: 'LOCKED'
        }
      }
    });

    if (pendingSubmissions > 0) {
      throw new ValidationError(
        `还有 ${pendingSubmissions} 个部门提交未锁定，无法批准预算版本`
      );
    }

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'approve_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'approve_budget_version', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.APPROVED
        }
      });
    }, id);
  }

  async reject(id: string, actorId: string, reason?: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.REJECTED,
      '预算版本'
    );

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'reject_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'reject_budget_version', async () => {
      const updated = await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.REJECTED
        }
      });

      await prisma.departmentSubmission.updateMany({
        where: {
          budgetVersionId: id,
          status: {
            in: ['SUBMITTED', 'UNDER_REVIEW', 'APPROVED']
          }
        },
        data: {
          status: 'REJECTED'
        }
      });

      return updated;
    }, id);
  }

  async lock(id: string, actorId: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.LOCKED,
      '预算版本'
    );

    if (version.status !== BudgetVersionStatus.APPROVED) {
      throw new ValidationError('只有已批准的预算版本才能锁定');
    }

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'lock_budget_version'
    );

    return idempotencyService.executeWithIdempotency(key, 'lock_budget_version', async () => {
      const locked = await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.LOCKED,
          isLocked: true,
          lockedAt: new Date(),
          lockedBy: actorId
        }
      });

      await prisma.lockWindow.updateMany({
        where: {
          budgetVersionId: id,
          status: {
            in: ['OPEN', 'CLOSED']
          }
        },
        data: {
          status: 'LOCKED'
        }
      });

      await prisma.departmentSubmission.updateMany({
        where: {
          budgetVersionId: id,
          status: 'APPROVED'
        },
        data: {
          status: 'LOCKED',
          lockedAt: new Date()
        }
      });

      return locked;
    }, id);
  }

  async requestRollback(id: string, actorId: string, reason: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.ROLLBACK_REQUESTED,
      '预算版本'
    );

    if (!reason || reason.length < 10) {
      throw new ValidationError('回退原因必须至少 10 个字符');
    }

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'request_rollback'
    );

    return idempotencyService.executeWithIdempotency(key, 'request_rollback', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.ROLLBACK_REQUESTED
        }
      });
    }, id);
  }

  async approveRollback(id: string, actorId: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.ROLLBACK_APPROVED,
      '预算版本'
    );

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'approve_rollback'
    );

    return idempotencyService.executeWithIdempotency(key, 'approve_rollback', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.ROLLBACK_APPROVED,
          isLocked: false,
          lockedAt: null,
          lockedBy: null
        }
      });
    }, id);
  }

  async rejectRollback(id: string, actorId: string, reason?: string): Promise<BudgetVersion> {
    const version = await this.getById(id);

    stateMachineService.validateBudgetVersionTransition(
      version.status,
      BudgetVersionStatus.ROLLBACK_REJECTED,
      '预算版本'
    );

    const key = idempotencyService.generateKey(
      'budget_version',
      id,
      'reject_rollback'
    );

    return idempotencyService.executeWithIdempotency(key, 'reject_rollback', async () => {
      return await prisma.budgetVersion.update({
        where: { id },
        data: {
          status: BudgetVersionStatus.ROLLBACK_REJECTED
        }
      });
    }, id);
  }

  getStatusLabel(status: BudgetVersionStatus): string {
    return stateMachineService.getBudgetVersionStatusLabel(status);
  }
}

export const budgetVersionService = new BudgetVersionService();
