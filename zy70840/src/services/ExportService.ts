import { createObjectCsvWriter } from 'csv-writer';
import { Op } from 'sequelize';
import * as fs from 'fs';
import * as path from 'path';
import Application, { ApplicationStatus } from '../models/Application';
import ProcessingLog from '../models/ProcessingLog';
import DepositFlow from '../models/DepositFlow';
import Certificate from '../models/Certificate';
import VenueSchedule from '../models/VenueSchedule';
import dayjs from 'dayjs';

export interface ExportFilters {
  batchId?: number;
  status?: ApplicationStatus;
  merchantName?: string;
  stallLocation?: string;
  startDate?: Date;
  endDate?: Date;
  certificateVersion?: string;
}

export interface ExportResult {
  totalCount: number;
  exportedCount: number;
  filePath: string;
  fileName: string;
}

class ExportService {
  private ensureExportDir() {
    const exportDir = path.join(process.cwd(), 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    return exportDir;
  }

  async exportApplications(
    filters: ExportFilters,
    includeDetails: boolean = false
  ): Promise<ExportResult> {
    const where: any = {};

    if (filters.batchId) {
      where.batchId = filters.batchId;
    }
    if (filters.status) {
      where.status = filters.status;
    }
    if (filters.merchantName) {
      where.merchantName = { [Op.like]: `%${filters.merchantName}%` };
    }
    if (filters.stallLocation) {
      where.stallLocation = { [Op.like]: `%${filters.stallLocation}%` };
    }
    if (filters.startDate && filters.endDate) {
      where.startDate = { [Op.lte]: filters.endDate };
      where.endDate = { [Op.gte]: filters.startDate };
    }
    if (filters.certificateVersion) {
      where.certificateVersion = { [Op.like]: `%${filters.certificateVersion}%` };
    }

    const applications = await Application.findAll({
      where,
      order: [['createdAt', 'DESC']],
      include: [
        { association: 'batch', attributes: ['batchNo', 'name'] },
        ...(includeDetails ? [
          { association: 'certificates' },
          { association: 'logs', order: [['operatedAt', 'DESC']] },
          { association: 'depositFlows', order: [['operatedAt', 'DESC']] },
        ] : []),
      ],
    });

    const exportDir = this.ensureExportDir();
    const fileName = `applications_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(exportDir, fileName);

    const statusMap: Record<string, string> = {
      [ApplicationStatus.PENDING]: '待处理',
      [ApplicationStatus.PROCESSING]: '处理中',
      [ApplicationStatus.APPROVED]: '已通过',
      [ApplicationStatus.REJECTED]: '已拒绝',
      [ApplicationStatus.RETURNED]: '已退回',
    };

    const records = applications.map(app => ({
      applicationNo: app.applicationNo,
      batchNo: (app as any).batch?.batchNo || '',
      merchantName: app.merchantName,
      contactPerson: app.contactPerson,
      contactPhone: app.contactPhone,
      stallType: app.stallType,
      stallLocation: app.stallLocation,
      startDate: dayjs(app.startDate).format('YYYY-MM-DD'),
      endDate: dayjs(app.endDate).format('YYYY-MM-DD'),
      depositAmount: app.depositAmount,
      status: statusMap[app.status] || app.status,
      certificateVersion: app.certificateVersion || '',
      processedBy: app.processedBy || '',
      processedAt: app.processedAt ? dayjs(app.processedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      importedAt: dayjs(app.importedAt).format('YYYY-MM-DD HH:mm:ss'),
      ...(includeDetails ? {
        issues: (app as any).logs
          ?.filter((l: any) => l.logType !== 'status_change')
          .map((l: any) => l.readableReason)
          .join('; ') || '',
        lastLog: (app as any).logs?.[0]?.readableReason || '',
      } : {}),
    }));

    const headers = [
      { id: 'applicationNo', title: '申请编号' },
      { id: 'batchNo', title: '批次编号' },
      { id: 'merchantName', title: '商户名称' },
      { id: 'contactPerson', title: '联系人' },
      { id: 'contactPhone', title: '联系电话' },
      { id: 'stallType', title: '摊位类型' },
      { id: 'stallLocation', title: '摊位位置' },
      { id: 'startDate', title: '开始日期' },
      { id: 'endDate', title: '结束日期' },
      { id: 'depositAmount', title: '押金余额' },
      { id: 'status', title: '状态' },
      { id: 'certificateVersion', title: '证照版本' },
      { id: 'processedBy', title: '处理人' },
      { id: 'processedAt', title: '处理时间' },
      { id: 'importedAt', title: '导入时间' },
      ...(includeDetails ? [
        { id: 'issues', title: '问题记录' },
        { id: 'lastLog', title: '最新处理记录' },
      ] : []),
    ];

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: headers,
      encoding: 'utf8',
    });

    await csvWriter.writeRecords(records);

    return {
      totalCount: applications.length,
      exportedCount: records.length,
      filePath,
      fileName,
    };
  }

  async exportLogs(
    applicationId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExportResult> {
    const where: any = {};
    if (applicationId) {
      where.applicationId = applicationId;
    }
    if (startDate && endDate) {
      where.operatedAt = { [Op.between]: [startDate, endDate] };
    }

    const logs = await ProcessingLog.findAll({
      where,
      order: [['operatedAt', 'DESC']],
      include: [{
        model: Application,
        as: 'application',
        attributes: ['applicationNo', 'merchantName'],
      }],
    });

    const logTypeMap: Record<string, string> = {
      status_change: '状态变更',
      certificate_issue: '证照问题',
      schedule_conflict: '档期冲突',
      deposit_deduction: '押金扣减',
      remark: '备注',
      returned: '退回修改',
    };

    const records = logs.map(log => ({
      applicationNo: (log as any).application?.applicationNo || '',
      merchantName: (log as any).application?.merchantName || '',
      logType: logTypeMap[log.logType] || log.logType,
      reason: log.reason,
      readableReason: log.readableReason,
      operator: log.operator,
      operatedAt: dayjs(log.operatedAt).format('YYYY-MM-DD HH:mm:ss'),
      oldStatus: log.oldStatus || '',
      newStatus: log.newStatus || '',
    }));

    const exportDir = this.ensureExportDir();
    const fileName = `processing_logs_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'applicationNo', title: '申请编号' },
        { id: 'merchantName', title: '商户名称' },
        { id: 'logType', title: '日志类型' },
        { id: 'reason', title: '原因' },
        { id: 'readableReason', title: '详细说明' },
        { id: 'operator', title: '操作人' },
        { id: 'operatedAt', title: '操作时间' },
        { id: 'oldStatus', title: '原状态' },
        { id: 'newStatus', title: '新状态' },
      ],
      encoding: 'utf8',
    });

    await csvWriter.writeRecords(records);

    return {
      totalCount: logs.length,
      exportedCount: records.length,
      filePath,
      fileName,
    };
  }

  async exportDepositFlows(
    applicationId?: number,
    startDate?: Date,
    endDate?: Date
  ): Promise<ExportResult> {
    const where: any = {};
    if (applicationId) {
      where.applicationId = applicationId;
    }
    if (startDate && endDate) {
      where.operatedAt = { [Op.between]: [startDate, endDate] };
    }

    const flows = await DepositFlow.findAll({
      where,
      order: [['operatedAt', 'DESC']],
      include: [{
        model: Application,
        as: 'application',
        attributes: ['applicationNo', 'merchantName'],
      }],
    });

    const flowTypeMap: Record<string, string> = {
      collect: '收取',
      deduct: '扣减',
      refund: '退还',
    };

    const records = flows.map(flow => ({
      flowNo: flow.flowNo,
      applicationNo: (flow as any).application?.applicationNo || '',
      merchantName: (flow as any).application?.merchantName || '',
      flowType: flowTypeMap[flow.flowType] || flow.flowType,
      amount: flow.amount,
      reason: flow.reason,
      readableReason: flow.readableReason,
      operator: flow.operator,
      operatedAt: dayjs(flow.operatedAt).format('YYYY-MM-DD HH:mm:ss'),
      balanceBefore: flow.balanceBefore,
      balanceAfter: flow.balanceAfter,
    }));

    const exportDir = this.ensureExportDir();
    const fileName = `deposit_flows_${dayjs().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'flowNo', title: '流水编号' },
        { id: 'applicationNo', title: '申请编号' },
        { id: 'merchantName', title: '商户名称' },
        { id: 'flowType', title: '流水类型' },
        { id: 'amount', title: '金额' },
        { id: 'reason', title: '原因' },
        { id: 'readableReason', title: '详细说明' },
        { id: 'operator', title: '操作人' },
        { id: 'operatedAt', title: '操作时间' },
        { id: 'balanceBefore', title: '操作前余额' },
        { id: 'balanceAfter', title: '操作后余额' },
      ],
      encoding: 'utf8',
    });

    await csvWriter.writeRecords(records);

    return {
      totalCount: flows.length,
      exportedCount: records.length,
      filePath,
      fileName,
    };
  }

  getExportFilePath(fileName: string): string {
    return path.join(this.ensureExportDir(), fileName);
  }
}

export default new ExportService();
