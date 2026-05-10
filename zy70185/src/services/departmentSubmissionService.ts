import { DepartmentSubmissionStatus, DepartmentSubmission, Prisma } from '@prisma/client';
import prisma from '../db/prisma';
import { stateMachineService } from './stateMachine';
import { idempotencyService } from './idempotency';
import { NotFoundError, ValidationError, LockedError } from '../utils/errors';

export interface CreateDepartmentSubmissionParams {
  budgetVersionId: string;
  departmentId: string;
  actorId: string;
  data?: Record<string, any>;
}

export interface SubmitDepartmentSubmissionParams {
  id: string;
  actorId: string;
  data?: Record<string, any>;
}

export class DepartmentSubmissionService {
  async create(params: CreateDepartmentSubmissionParams): Promise<DepartmentSubmission> {
    const { budgetVersionId, departmentId, actorId, data } = params;

    const [budgetVersion, department] = await Promise.all([
      prisma.budgetVersion.findUnique({ where: { id: budgetVersionId } }),
      prisma.department.findUnique({ where: { id: departmentId } })
    ]);

    if (!budgetVersion) {
      throw new NotFoundError(`未找到预算版本 ${budgetVersionId}`);
    }

    if (!department) {
      throw new NotFoundError(`未找到部门 ${departmentId}`);
    }

    if (budgetVersion.status !== 'DRAFT' && budgetVersion.status !== 'SUBMITTED') {
      throw new ValidationError(
        `预算版本当前状态为「${stateMachineService.getBudgetVersionStatusLabel(budgetVersion.status)}」，无法创建部门提交`
      );
    }

    if (budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法创建部门提交');
    }

    const existing = await prisma.departmentSubmission.findFirst({
      where: {
        budgetVersionId,
        departmentId
      },
      orderBy: { version: 'desc' }
    });

    const nextVersion = (existing?.version || 0) + 1;

    const key = idempotencyService.generateKey(
      'department_submission',
      `${budgetVersionId}-${departmentId}-${nextVersion}`,
      'create_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'create_department_submission',
      async () => {
        return await prisma.departmentSubmission.create({
          data: {
            budgetVersionId,
            departmentId,
            version: nextVersion,
            status: DepartmentSubmissionStatus.PENDING,
            data: data || existing?.data || null
          }
        });
      }
    );
  }

  async getById(id: string): Promise<DepartmentSubmission> {
    const submission = await prisma.departmentSubmission.findUnique({
      where: { id },
      include: {
        department: true,
        budgetVersion: true,
        differenceNotes: true,
        approvalRecords: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!submission) {
      throw new NotFoundError(`未找到部门提交 ${id}`);
    }

    return submission;
  }

  async list(filters?: {
    budgetVersionId?: string;
    departmentId?: string;
    status?: DepartmentSubmissionStatus;
  }): Promise<DepartmentSubmission[]> {
    const where: Prisma.DepartmentSubmissionWhereInput = {};

    if (filters?.budgetVersionId) where.budgetVersionId = filters.budgetVersionId;
    if (filters?.departmentId) where.departmentId = filters.departmentId;
    if (filters?.status) where.status = filters.status;

    return await prisma.departmentSubmission.findMany({
      where,
      include: {
        department: true
      },
      orderBy: [
        { budgetVersionId: 'asc' },
        { departmentId: 'asc' },
        { version: 'desc' }
      ]
    });
  }

  async submit(params: SubmitDepartmentSubmissionParams): Promise<DepartmentSubmission> {
    const { id, actorId, data } = params;

    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.SUBMITTED,
      '部门提交'
    );

    if (submission.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法提交部门数据');
    }

    const lockWindows = await prisma.lockWindow.findMany({
      where: {
        budgetVersionId: submission.budgetVersionId,
        status: 'LOCKED'
      }
    });

    if (lockWindows.length > 0) {
      throw new LockedError('存在已锁定的窗口期，无法提交部门数据');
    }

    const activeWindows = await prisma.lockWindow.findMany({
      where: {
        budgetVersionId: submission.budgetVersionId,
        status: 'OPEN',
        startDate: { lte: new Date() },
        endDate: { gte: new Date() }
      }
    });

    if (activeWindows.length === 0) {
      throw new ValidationError('当前不在允许的提交窗口期内');
    }

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'submit_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'submit_department_submission',
      async () => {
        const updated = await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.SUBMITTED,
            submittedBy: actorId,
            submittedAt: new Date(),
            data: data || submission.data
          }
        });

        await prisma.approvalRecord.create({
          data: {
            submissionId: id,
            action: 'SUBMIT',
            actorId,
            comment: '部门提交数据'
          }
        });

        return updated;
      },
      id
    );
  }

  async review(id: string, actorId: string): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.UNDER_REVIEW,
      '部门提交'
    );

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'review_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'review_department_submission',
      async () => {
        const updated = await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.UNDER_REVIEW,
            reviewedBy: actorId,
            reviewedAt: new Date()
          }
        });

        await prisma.approvalRecord.create({
          data: {
            submissionId: id,
            action: 'REVIEW',
            actorId
          }
        });

        return updated;
      },
      id
    );
  }

  async approve(id: string, actorId: string): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.APPROVED,
      '部门提交'
    );

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'approve_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'approve_department_submission',
      async () => {
        const updated = await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.APPROVED,
            approvedBy: actorId,
            approvedAt: new Date()
          }
        });

        await prisma.approvalRecord.create({
          data: {
            submissionId: id,
            action: 'APPROVE',
            actorId
          }
        });

        return updated;
      },
      id
    );
  }

  async reject(
    id: string,
    actorId: string,
    reason?: string
  ): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.REJECTED,
      '部门提交'
    );

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'reject_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'reject_department_submission',
      async () => {
        const updated = await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.REJECTED
          }
        });

        await prisma.approvalRecord.create({
          data: {
            submissionId: id,
            action: 'REJECT',
            actorId,
            comment: reason || '驳回，需重新提交'
          }
        });

        return updated;
      },
      id
    );
  }

  async resubmit(
    id: string,
    actorId: string,
    data?: Record<string, any>
  ): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.RESUBMITTED,
      '部门提交'
    );

    if (submission.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法重新提交');
    }

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'resubmit_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'resubmit_department_submission',
      async () => {
        return await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.RESUBMITTED,
            data: data || submission.data
          }
        });
      },
      id
    );
  }

  async lock(id: string, actorId: string): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    stateMachineService.validateDepartmentSubmissionTransition(
      submission.status,
      DepartmentSubmissionStatus.LOCKED,
      '部门提交'
    );

    if (submission.status !== 'APPROVED') {
      throw new ValidationError('只有已批准的部门提交才能锁定');
    }

    const key = idempotencyService.generateKey(
      'department_submission',
      id,
      'lock_department_submission'
    );

    return idempotencyService.executeWithIdempotency(
      key,
      'lock_department_submission',
      async () => {
        return await prisma.departmentSubmission.update({
          where: { id },
          data: {
            status: DepartmentSubmissionStatus.LOCKED,
            lockedAt: new Date()
          }
        });
      },
      id
    );
  }

  async updateData(
    id: string,
    actorId: string,
    data: Record<string, any>
  ): Promise<DepartmentSubmission> {
    const submission = await this.getById(id);

    if (submission.status === 'LOCKED') {
      throw new LockedError('部门提交已锁定，无法修改数据');
    }

    if (submission.status === 'APPROVED') {
      throw new ValidationError('部门提交已批准，如需修改请先申请回退');
    }

    if (submission.budgetVersion.isLocked) {
      throw new LockedError('预算版本已锁定，无法修改部门数据');
    }

    return await prisma.departmentSubmission.update({
      where: { id },
      data: { data }
    });
  }

  getStatusLabel(status: DepartmentSubmissionStatus): string {
    return stateMachineService.getDepartmentSubmissionStatusLabel(status);
  }
}

export const departmentSubmissionService = new DepartmentSubmissionService();
