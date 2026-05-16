import * as ticketScanDao from '../dao/ticketScan.dao';
import {
  TicketScanRecord,
  ScanStatus,
  RiskLevel,
  IsolationAction,
  ScanEngine,
  CreateScanRequest,
  UpdateStatusRequest,
  ManualCorrectionRequest,
  FailureRecord
} from '../types';

export async function createScanRequest(request: CreateScanRequest): Promise<TicketScanRecord> {
  if (!request.ticketId || !request.attachments || request.attachments.length === 0) {
    throw new Error('工单编号和附件清单不能为空');
  }

  const scanEngine = request.scanEngine || ScanEngine.CLAMAV;
  const record = await ticketScanDao.createTicketScanRecord(
    request.ticketId,
    request.attachments,
    scanEngine
  );

  await ticketScanDao.updateTicketScanStatus(record.id, ScanStatus.QUEUED, {
    processingSummary: '附件已进入扫描队列，等待扫描引擎处理'
  });

  return await ticketScanDao.getTicketScanRecordById(record.id) as TicketScanRecord;
}

export async function getScanRecordById(id: string): Promise<TicketScanRecord | null> {
  return await ticketScanDao.getTicketScanRecordById(id);
}

export async function getScanRecordsByTicketId(ticketId: string): Promise<TicketScanRecord[]> {
  return await ticketScanDao.getTicketScanRecordsByTicketId(ticketId);
}

export async function getAllScanRecords(page: number = 1, pageSize: number = 20) {
  return await ticketScanDao.getAllTicketScanRecords(page, pageSize);
}

export async function getScanRecordsByStatus(status: ScanStatus): Promise<TicketScanRecord[]> {
  return await ticketScanDao.getTicketScanRecordsByStatus(status);
}

export async function updateScanStatus(
  id: string,
  request: UpdateStatusRequest
): Promise<TicketScanRecord | null> {
  const existingRecord = await ticketScanDao.getTicketScanRecordById(id);
  if (!existingRecord) {
    throw new Error('扫描记录不存在');
  }

  const { status, scanReport, virusFound, riskLevel, processingSummary } = request;

  let isolationAction = existingRecord.isolationAction;

  if (virusFound && virusFound.length > 0) {
    if (riskLevel === RiskLevel.CRITICAL || riskLevel === RiskLevel.HIGH) {
      isolationAction = IsolationAction.QUARANTINE;
    } else if (riskLevel === RiskLevel.MEDIUM) {
      isolationAction = IsolationAction.HOLD;
    }
  }

  let finalSummary = processingSummary;
  if (!finalSummary) {
    if (status === ScanStatus.SUCCESS) {
      if (virusFound && virusFound.length > 0) {
        finalSummary = `扫描完成，发现 ${virusFound.length} 个病毒：${virusFound.join(', ')}`;
      } else {
        finalSummary = '扫描完成，未发现病毒威胁';
      }
    } else if (status === ScanStatus.SCANNING) {
      finalSummary = '正在执行病毒扫描...';
    } else if (status === ScanStatus.FAILED) {
      finalSummary = '扫描失败，需要重试或人工介入';
    }
  }

  return await ticketScanDao.updateTicketScanStatus(id, status, {
    scanReport,
    virusFound,
    riskLevel,
    isolationAction,
    processingSummary: finalSummary
  });
}

export async function handleScanFailure(
  id: string,
  errorMessage: string,
  rawInput: any
): Promise<TicketScanRecord | null> {
  const failureRecord: FailureRecord = {
    step: 'scan_execution',
    errorMessage,
    rawInput,
    processingBasis: '扫描引擎返回错误，无法完成病毒检测',
    finalConclusion: '扫描失败，已记录错误信息，等待人工处理或重试',
    timestamp: new Date()
  };

  await ticketScanDao.addFailureRecord(id, failureRecord);
  return await ticketScanDao.updateTicketScanStatus(id, ScanStatus.MANUAL_REVIEW, {
    processingSummary: `扫描失败：${errorMessage}，已进入人工审核队列`
  });
}

export async function manualCorrection(
  id: string,
  request: ManualCorrectionRequest
): Promise<TicketScanRecord | null> {
  const existingRecord = await ticketScanDao.getTicketScanRecordById(id);
  if (!existingRecord) {
    throw new Error('扫描记录不存在');
  }

  let newStatus: ScanStatus;
  let isolationAction: IsolationAction = existingRecord.isolationAction;
  let summary = request.processingSummary || '';

  switch (request.action) {
    case 'release':
      newStatus = ScanStatus.RELEASED;
      isolationAction = IsolationAction.NONE;
      if (!summary) {
        summary = `人工审核通过，由 ${request.reviewedBy} 放行。原因：${request.reviewComment}`;
      }
      break;
    case 'isolate':
      newStatus = ScanStatus.ISOLATED;
      isolationAction = IsolationAction.QUARANTINE;
      if (!summary) {
        summary = `人工审核确认隔离，由 ${request.reviewedBy} 执行。原因：${request.reviewComment}`;
      }
      break;
    case 'retry':
      newStatus = ScanStatus.QUEUED;
      if (!summary) {
        summary = `人工触发重试扫描，由 ${request.reviewedBy} 执行。原因：${request.reviewComment}`;
      }
      break;
    default:
      throw new Error('无效的操作类型');
  }

  return await ticketScanDao.manualCorrectRecord(id, request.reviewedBy, request.reviewComment, {
    status: newStatus,
    riskLevel: request.riskLevel,
    isolationAction,
    processingSummary: summary
  });
}

export async function exportScanRecords(filters?: {
  ticketId?: string;
  status?: ScanStatus;
  startDate?: string;
  endDate?: string;
}): Promise<TicketScanRecord[]> {
  let records: TicketScanRecord[];

  if (filters?.ticketId) {
    records = await ticketScanDao.getTicketScanRecordsByTicketId(filters.ticketId);
  } else if (filters?.status) {
    records = await ticketScanDao.getTicketScanRecordsByStatus(filters.status);
  } else {
    const result = await ticketScanDao.getAllTicketScanRecords(1, 1000);
    records = result.records;
  }

  if (filters?.startDate) {
    const start = new Date(filters.startDate);
    records = records.filter(r => r.createdAt >= start);
  }
  if (filters?.endDate) {
    const end = new Date(filters.endDate);
    records = records.filter(r => r.createdAt <= end);
  }

  return records;
}

export function generateExportSummary(records: TicketScanRecord[]): string {
  const total = records.length;
  const successCount = records.filter(r => r.status === ScanStatus.SUCCESS).length;
  const isolatedCount = records.filter(r => r.isolationAction === IsolationAction.QUARANTINE).length;
  const virusFoundCount = records.filter(r => r.virusFound && r.virusFound.length > 0).length;

  return `
工单附件病毒扫描导出报告
========================
导出时间: ${new Date().toISOString()}
记录总数: ${total}
扫描成功: ${successCount}
发现病毒: ${virusFoundCount}
隔离文件: ${isolatedCount}

风险等级分布:
- 安全: ${records.filter(r => r.riskLevel === RiskLevel.SAFE).length}
- 低危: ${records.filter(r => r.riskLevel === RiskLevel.LOW).length}
- 中危: ${records.filter(r => r.riskLevel === RiskLevel.MEDIUM).length}
- 高危: ${records.filter(r => r.riskLevel === RiskLevel.HIGH).length}
- 严重: ${records.filter(r => r.riskLevel === RiskLevel.CRITICAL).length}
  `.trim();
}
