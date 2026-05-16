import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { Parser } from 'json2csv';
import {
  FilingRecord,
  FilingReport,
  CreateFilingRequest,
  HandleExceptionRequest,
  ManualCorrectionRequest,
  FilingStatus
} from '../types';
import { db } from '../database';
import { stateMachineService } from './StateMachineService';

dayjs.extend(duration);

export class FilingService {
  async createFiling(request: CreateFilingRequest): Promise<FilingRecord> {
    this.validateOpenWindow(request.openWindow);
    return db.createFiling(request);
  }

  async getFiling(id: string): Promise<FilingRecord | null> {
    return db.getFiling(id);
  }

  async listFilings(filters?: { status?: FilingStatus; serviceName?: string }): Promise<FilingRecord[]> {
    return db.listFilings(filters);
  }

  async advanceStatus(
    id: string,
    targetStatus: FilingStatus,
    operator?: string,
    reason?: string
  ): Promise<FilingRecord> {
    return stateMachineService.advanceStatus(id, targetStatus, operator, reason);
  }

  async approveFiling(id: string, approver: string): Promise<FilingRecord> {
    return stateMachineService.approveFiling(id, approver);
  }

  async rejectFiling(id: string, approver: string, reason: string): Promise<FilingRecord> {
    return stateMachineService.rejectFiling(id, approver, reason);
  }

  async handleException(
    filingId: string,
    request: HandleExceptionRequest
  ): Promise<void> {
    await db.recordException(filingId, request);
  }

  async getExceptions(filingId: string) {
    return db.getExceptions(filingId);
  }

  async manualCorrection(
    filingId: string,
    request: ManualCorrectionRequest
  ): Promise<void> {
    const filing = await db.getFiling(filingId);
    if (!filing) {
      throw new Error('备案记录不存在');
    }

    const editableFields = ['serviceName', 'egressAddress', 'purpose'];
    if (!editableFields.includes(request.field)) {
      throw new Error(`字段 ${request.field} 不允许人工修正`);
    }

    await db.recordManualCorrection(
      filingId,
      request.field,
      request.oldValue,
      request.newValue,
      request.operator,
      request.reason
    );
  }

  async closeFiling(id: string, closer: string, reason: string): Promise<void> {
    await db.closeFiling(id, closer, reason);
  }

  async recordAccess(
    filingId: string,
    sourceIp: string,
    destination: string,
    action: string,
    result: string
  ): Promise<void> {
    await db.recordAccessLog(filingId, sourceIp, destination, action, result);
  }

  async generateReport(filingId: string): Promise<FilingReport> {
    const filing = await db.getFiling(filingId);
    if (!filing) {
      throw new Error('备案记录不存在');
    }

    const [statusHistory, accessLogs, exceptions] = await Promise.all([
      db.getStatusHistory(filingId),
      db.getAccessLogs(filingId),
      db.getExceptions(filingId)
    ]);

    const startTime = dayjs(filing.openWindow.startTime);
    const endTime = dayjs(filing.closedAt || filing.openWindow.endTime);
    const openDuration = dayjs.duration(endTime.diff(startTime)).asMinutes();

    const report: FilingReport = {
      filingId,
      generatedAt: dayjs().toISOString(),
      summary: {
        serviceName: filing.serviceName,
        openDuration: Math.round(openDuration),
        accessCount: accessLogs.length,
        statusChanges: statusHistory.length
      },
      details: {
        statusHistory,
        accessLogs,
        exceptions
      },
      conclusion: this.generateConclusion(filing, exceptions)
    };

    return report;
  }

  async exportToCSV(filingId: string): Promise<string> {
    const report = await this.generateReport(filingId);
    
    const fields = [
      'filingId',
      'generatedAt',
      'summary.serviceName',
      'summary.openDuration',
      'summary.accessCount',
      'summary.statusChanges',
      'conclusion'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(report);

    return csv;
  }

  async checkExpiredWindows(): Promise<string[]> {
    const now = dayjs();
    const filings = await db.listFilings({ status: FilingStatus.CONFIRMED });
    
    const expiredIds: string[] = [];

    for (const filing of filings) {
      const endTime = dayjs(filing.openWindow.endTime);
      if (now.isAfter(endTime)) {
        await stateMachineService.advanceStatus(
          filing.id,
          FilingStatus.EXPIRED,
          'system',
          '开放窗口已到期'
        );
        expiredIds.push(filing.id);
      }
    }

    return expiredIds;
  }

  private validateOpenWindow(openWindow: { startTime: string; endTime: string }): void {
    const startTime = dayjs(openWindow.startTime);
    const endTime = dayjs(openWindow.endTime);

    if (!startTime.isValid() || !endTime.isValid()) {
      throw new Error('时间格式无效');
    }

    if (endTime.isBefore(startTime)) {
      throw new Error('结束时间不能早于开始时间');
    }

    const maxDuration = dayjs.duration(7, 'day');
    const duration = dayjs.duration(endTime.diff(startTime));

    if (duration.asMilliseconds() > maxDuration.asMilliseconds()) {
      throw new Error('开放窗口最长为7天');
    }
  }

  private generateConclusion(
    filing: FilingRecord,
    exceptions: any[]
  ): string {
    const conclusions: string[] = [];

    conclusions.push(`服务 ${filing.serviceName} 备案最终状态为 ${filing.status}`);

    if (exceptions.length > 0) {
      conclusions.push(`处理过程中发生 ${exceptions.length} 次异常`);
      const blockedException = exceptions.find(e => e.step === 'security_check');
      if (blockedException) {
        conclusions.push(`安全检查拦截原因: ${blockedException.conclusion}`);
      }
    }

    if (filing.closedAt) {
      conclusions.push(`关闭原因: ${filing.closeReason || '未记录'}`);
    }

    return conclusions.join('；');
  }
}

export const filingService = new FilingService();
