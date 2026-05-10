import { ForecastReport } from '@prisma/client';
import prisma from '../db/prisma';
import { idempotencyService } from './idempotency';
import { NotFoundError, ValidationError } from '../utils/errors';

export interface GenerateReportParams {
  name: string;
  description?: string;
  budgetVersionId: string;
  submissionId?: string;
  type: string;
  data: Record<string, any>;
  affectsFinalResult?: boolean;
  actorId: string;
}

export class ForecastReportService {
  async generate(params: GenerateReportParams): Promise<ForecastReport> {
    const {
      name,
      description,
      budgetVersionId,
      submissionId,
      type,
      data,
      affectsFinalResult = true,
      actorId
    } = params;

    const budgetVersion = await prisma.budgetVersion.findUnique({
      where: { id: budgetVersionId }
    });

    if (!budgetVersion) {
      throw new NotFoundError(`未找到预算版本 ${budgetVersionId}`);
    }

    if (submissionId) {
      const submission = await prisma.departmentSubmission.findUnique({
        where: { id: submissionId }
      });

      if (!submission) {
        throw new NotFoundError(`未找到部门提交 ${submissionId}`);
      }

      if (submission.budgetVersionId !== budgetVersionId) {
        throw new ValidationError('部门提交不属于该预算版本');
      }
    }

    if (!name || name.trim().length === 0) {
      throw new ValidationError('报表名称不能为空');
    }

    if (!type || type.trim().length === 0) {
      throw new ValidationError('报表类型不能为空');
    }

    if (!data || Object.keys(data).length === 0) {
      throw new ValidationError('报表数据不能为空');
    }

    const key = idempotencyService.generateKey(
      'forecast_report',
      `${budgetVersionId}-${type}-${submissionId || 'global'}`,
      'generate_report'
    );

    return idempotencyService.executeWithIdempotency(key, 'generate_report', async () => {
      return await prisma.forecastReport.create({
        data: {
          name,
          description,
          budgetVersionId,
          submissionId,
          type,
          data,
          affectsFinalResult,
          generatedBy: actorId
        }
      });
    });
  }

  async getById(id: string): Promise<ForecastReport> {
    const report = await prisma.forecastReport.findUnique({
      where: { id },
      include: {
        budgetVersion: true,
        submission: {
          include: {
            department: true
          }
        }
      }
    });

    if (!report) {
      throw new NotFoundError(`未找到预测报表 ${id}`);
    }

    return report;
  }

  async list(filters?: {
    budgetVersionId?: string;
    submissionId?: string;
    type?: string;
    affectsFinalResult?: boolean;
  }): Promise<ForecastReport[]> {
    const where: any = {};

    if (filters?.budgetVersionId) where.budgetVersionId = filters.budgetVersionId;
    if (filters?.submissionId) where.submissionId = filters.submissionId;
    if (filters?.type) where.type = filters.type;
    if (filters?.affectsFinalResult !== undefined) {
      where.affectsFinalResult = filters.affectsFinalResult;
    }

    return await prisma.forecastReport.findMany({
      where,
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

  async getLatestAffectingReport(budgetVersionId: string): Promise<ForecastReport | null> {
    return await prisma.forecastReport.findFirst({
      where: {
        budgetVersionId,
        affectsFinalResult: true
      },
      orderBy: { createdAt: 'desc' },
      include: {
        submission: {
          include: {
            department: true
          }
        }
      }
    });
  }

  async getReportsAffectingResult(budgetVersionId: string): Promise<ForecastReport[]> {
    return await prisma.forecastReport.findMany({
      where: {
        budgetVersionId,
        affectsFinalResult: true
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

  async updateAffectsFinalResult(
    id: string,
    actorId: string,
    affectsFinalResult: boolean
  ): Promise<ForecastReport> {
    const report = await this.getById(id);

    if (report.budgetVersion.isLocked) {
      throw new ValidationError('预算版本已锁定，无法修改报表影响最终结果的设置');
    }

    return await prisma.forecastReport.update({
      where: { id },
      data: { affectsFinalResult }
    });
  }

  async delete(id: string, actorId: string): Promise<void> {
    const report = await this.getById(id);

    if (report.budgetVersion.isLocked) {
      throw new ValidationError('预算版本已锁定，无法删除报表');
    }

    await prisma.forecastReport.delete({
      where: { id }
    });
  }

  async getBudgetFinalResult(budgetVersionId: string): Promise<{
    budgetVersion: any;
    submissions: any[];
    reports: ForecastReport[];
    affectedByReports: boolean;
    summary: {
      totalBudget: number;
      totalApproved: number;
      totalLocked: number;
    };
  }> {
    const budgetVersion = await prisma.budgetVersion.findUnique({
      where: { id: budgetVersionId },
      include: {
        submissions: {
          include: {
            department: true,
            differenceNotes: true
          }
        }
      }
    });

    if (!budgetVersion) {
      throw new NotFoundError(`未找到预算版本 ${budgetVersionId}`);
    }

    const reports = await this.getReportsAffectingResult(budgetVersionId);
    const affectedByReports = reports.length > 0;

    const summary = {
      totalBudget: budgetVersion.submissions.length,
      totalApproved: budgetVersion.submissions.filter(
        s => s.status === 'APPROVED' || s.status === 'LOCKED'
      ).length,
      totalLocked: budgetVersion.submissions.filter(
        s => s.status === 'LOCKED'
      ).length
    };

    return {
      budgetVersion,
      submissions: budgetVersion.submissions,
      reports,
      affectedByReports,
      summary
    };
  }
}

export const forecastReportService = new ForecastReportService();
