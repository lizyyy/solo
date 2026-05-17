import { Between, FindOptionsWhere, Like, Raw } from 'typeorm';
import { AppDataSource } from '../data-source';
import { Appeal, AppealStatus } from '../entities/Appeal';
import { AppealHistory, OperationType } from '../entities/AppealHistory';
import { Tenant, TenantStatus } from '../entities/Tenant';
import { createObjectCsvStringifier } from 'csv-writer';
import { format } from 'date-fns';

export interface AppealFilter {
  startDate?: string;
  endDate?: string;
  status?: string;
  responsiblePerson?: string;
  businessObject?: string;
  tenantName?: string;
  appealCode?: string;
  includeBadRecords?: boolean;
}

export class AppealService {
  private appealRepo = AppDataSource.getRepository(Appeal);
  private historyRepo = AppDataSource.getRepository(AppealHistory);
  private tenantRepo = AppDataSource.getRepository(Tenant);

  async getAppealList(filter: AppealFilter, page = 1, pageSize = 20) {
    const where: FindOptionsWhere<Appeal> = {};

    if (filter.startDate && filter.endDate) {
      where.createdAt = Between(
        new Date(filter.startDate),
        new Date(filter.endDate + ' 23:59:59')
      );
    }

    if (filter.status) {
      where.status = filter.status as AppealStatus;
    }

    if (filter.appealCode) {
      where.appealCode = Like(`%${filter.appealCode}%`);
    }

    if (filter.includeBadRecords !== true) {
      where.isBadRecord = false;
    }

    const [appeals, total] = await this.appealRepo.findAndCount({
      where,
      relations: ['tenant'],
      order: { createdAt: 'DESC' },
      skip: (page - 1) * pageSize,
      take: pageSize
    });

    if (filter.responsiblePerson || filter.businessObject || filter.tenantName) {
      const filtered = appeals.filter(a => {
        let match = true;
        if (filter.responsiblePerson && a.tenant) {
          match = match && a.tenant.responsiblePerson?.includes(filter.responsiblePerson);
        }
        if (filter.businessObject && a.tenant) {
          match = match && a.tenant.businessObject?.includes(filter.businessObject);
        }
        if (filter.tenantName && a.tenant) {
          match = match && a.tenant.tenantName.includes(filter.tenantName);
        }
        return match;
      });
      return {
        data: filtered,
        total: filtered.length,
        page,
        pageSize
      };
    }

    return {
      data: appeals,
      total,
      page,
      pageSize
    };
  }

  async getAppealDetail(appealId: string) {
    const appeal = await this.appealRepo.findOne({
      where: { id: appealId },
      relations: ['tenant', 'overchargeRecords', 'overchargeRecords.package', 'histories']
    });

    if (!appeal) {
      throw new Error('申诉记录不存在');
    }

    appeal.histories = appeal.histories.sort((a, b) =>
      new Date(a.operatedAt).getTime() - new Date(b.operatedAt).getTime()
    );

    return appeal;
  }

  async getAppealHistories(appealId: string) {
    const histories = await this.historyRepo.find({
      where: { appealId },
      order: { operatedAt: 'ASC' }
    });
    return histories;
  }

  async submitRestorationRequest(appealId: string, operatorName: string, requestId: string) {
    const appeal = await this.appealRepo.findOne({
      where: { id: appealId },
      relations: ['tenant']
    });

    if (!appeal) {
      throw new Error('申诉记录不存在');
    }

    const recentHistory = await this.historyRepo.findOne({
      where: {
        appealId,
        operationType: OperationType.RESTORE,
        operatedAt: Raw((alias) => `${alias} >= datetime('now', '-5 minutes')`)
      },
      order: { operatedAt: 'DESC' }
    });

    const isDuplicate = !!recentHistory;

    const history = this.historyRepo.create({
      operationType: OperationType.RESTORE,
      operatorName,
      operationRemark: isDuplicate ? '重复提交的恢复请求' : '提交恢复申请',
      tenantStatusBefore: appeal.tenant?.status,
      tenantStatusAfter: appeal.tenant?.status,
      appealStatusBefore: appeal.status,
      appealStatusAfter: appeal.status,
      requestId,
      isDuplicateSubmission: isDuplicate,
      duplicateOfHistoryId: isDuplicate ? recentHistory?.id : undefined,
      appealId,
      tenantId: appeal.tenantId
    });

    await this.historyRepo.save(history);

    if (!isDuplicate) {
      await this.appealRepo.update(appealId, {
        submissionCount: appeal.submissionCount + 1,
        lastSubmissionId: requestId
      });
    }

    return {
      success: true,
      isDuplicate,
      historyId: history.id,
      message: isDuplicate ? '检测到重复提交，已记录但不重复处理' : '提交成功'
    };
  }

  async exportToCSV(filter: AppealFilter) {
    const { data } = await this.getAppealList(filter, 1, 10000);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'appealCode', title: '申诉编号' },
        { id: 'appealType', title: '申诉类型' },
        { id: 'status', title: '申诉状态' },
        { id: 'tenantName', title: '租户名称' },
        { id: 'tenantCode', title: '租户编号' },
        { id: 'tenantStatus', title: '租户状态' },
        { id: 'responsiblePerson', title: '负责人' },
        { id: 'businessObject', title: '业务对象' },
        { id: 'region', title: '区域' },
        { id: 'industry', title: '行业' },
        { id: 'reason', title: '申诉原因' },
        { id: 'disputeAmount', title: '争议金额' },
        { id: 'totalOverchargeAmount', title: '总超额金额' },
        { id: 'submitterName', title: '提交人' },
        { id: 'reviewerName', title: '审核人' },
        { id: 'submissionCount', title: '提交次数' },
        { id: 'hasDuplicateSubmission', title: '是否有重复提交' },
        { id: 'source', title: '来源' },
        { id: 'createdAt', title: '创建时间' },
        { id: 'isBadRecord', title: '是否坏行' },
        { id: 'badRecordReason', title: '坏行原因' }
      ]
    });

    const records = data.map(appeal => ({
      appealCode: appeal.appealCode,
      appealType: this.translateAppealType(appeal.appealType),
      status: this.translateAppealStatus(appeal.status),
      tenantName: appeal.tenant?.tenantName || '',
      tenantCode: appeal.tenant?.tenantCode || '',
      tenantStatus: this.translateTenantStatus(appeal.tenant?.status),
      responsiblePerson: appeal.tenant?.responsiblePerson || '',
      businessObject: appeal.tenant?.businessObject || '',
      region: appeal.tenant?.region || '',
      industry: appeal.tenant?.industry || '',
      reason: appeal.reason,
      disputeAmount: appeal.disputeAmount,
      totalOverchargeAmount: appeal.tenant?.totalOverchargeAmount || 0,
      submitterName: appeal.submitterName,
      reviewerName: appeal.reviewerName || '',
      submissionCount: appeal.submissionCount,
      hasDuplicateSubmission: appeal.submissionCount > 1 ? '是' : '否',
      source: appeal.source || '',
      createdAt: format(new Date(appeal.createdAt), 'yyyy-MM-dd HH:mm:ss'),
      isBadRecord: appeal.isBadRecord ? '是' : '否',
      badRecordReason: appeal.badRecordReason || ''
    }));

    return '\uFEFF' + csvStringifier.getHeaderString() + csvStringifier.stringifyRecords(records);
  }

  private translateAppealType(type: string) {
    const map: Record<string, string> = {
      overcharge_dispute: '超额争议',
      restoration_request: '恢复申请',
      adjustment_request: '调整申请'
    };
    return map[type] || type;
  }

  private translateAppealStatus(status: string) {
    const map: Record<string, string> = {
      pending: '待审核',
      reviewing: '审核中',
      approved: '已通过',
      rejected: '已拒绝',
      processing: '处理中',
      completed: '已完成'
    };
    return map[status] || status;
  }

  private translateTenantStatus(status?: TenantStatus) {
    if (!status) return '';
    const map: Record<TenantStatus, string> = {
      [TenantStatus.NORMAL]: '正常',
      [TenantStatus.FROZEN]: '冻结中',
      [TenantStatus.APPEALING]: '申诉中',
      [TenantStatus.RESTORED]: '已恢复'
    };
    return map[status] || status;
  }

  async getStatistics() {
    const statusCounts = await this.appealRepo
      .createQueryBuilder('appeal')
      .select('appeal.status, COUNT(*) as count')
      .groupBy('appeal.status')
      .getRawMany();

    const tenantStatusCounts = await this.tenantRepo
      .createQueryBuilder('tenant')
      .select('tenant.status, COUNT(*) as count')
      .groupBy('tenant.status')
      .getRawMany();

    const totalDuplicate = await this.historyRepo.count({
      where: { isDuplicateSubmission: true }
    });

    const badRecordCount = await this.appealRepo.count({
      where: { isBadRecord: true }
    });

    return {
      appealByStatus: statusCounts,
      tenantByStatus: tenantStatusCounts,
      totalDuplicateSubmissions: totalDuplicate,
      totalBadRecords: badRecordCount
    };
  }
}
