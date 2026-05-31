import * as XLSX from 'xlsx';
import type { RefundItem, ExportVerification, RateTable } from '../types';
import { calculateDataHash, sha256 } from './hash';
import { formatDate, formatDateTime } from './date';
import { getAnomalyTypeLabel, getSeverityLabel } from './anomalyDetector';

function formatCurrency(amount: number): string {
  return amount.toFixed(2);
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    normal: '正常',
    pending: '待确认',
    anomaly: '异常',
  };
  return labels[status] || status;
}

function getFileTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    invoice: '发票',
    settlement: '结算单',
    proof: '凭证',
  };
  return labels[type] || type;
}

function getConclusionLabel(conclusion: string): string {
  const labels: Record<string, string> = {
    valid: '确认有效',
    invalid: '确认无效',
    adjusted: '已调整',
  };
  return labels[conclusion] || conclusion;
}

export function prepareExportData(
  refunds: RefundItem[],
  rates: RateTable[]
): {
  mainData: any[];
  anomaliesData: any[];
  attachmentsData: any[];
  confirmationsData: any[];
  ratesData: any[];
} {
  const mainData = refunds.map((refund) => {
    const rate = rates.find((r) => r.id === refund.rateId);
    const openAnomalies = refund.anomalies.filter((a) => a.status === 'open');
    
    return {
      '记录ID': refund.id,
      '流水号': refund.serialNo,
      '供应商ID': refund.supplierId,
      '供应商名称': refund.supplierName,
      '退款金额(元)': formatCurrency(refund.amount),
      '手续费金额(元)': formatCurrency(refund.feeAmount),
      '退款日期': formatDate(refund.refundDate),
      '归属期': refund.belongPeriod,
      '入账日期': formatDate(refund.entryDate),
      '核销日期': refund.writeOffDate ? formatDate(refund.writeOffDate) : '-',
      '状态': getStatusLabel(refund.status),
      '费率版本': rate?.version || '-',
      '适用费率': rate ? `${(rate.rate * 100).toFixed(1)}%` : '-',
      '待确认异常数': openAnomalies.length,
      '异常类型': openAnomalies.map((a) => getAnomalyTypeLabel(a.type)).join('; '),
      '附件数量': refund.attachments.length,
      '人工确认次数': refund.confirmations.length,
    };
  });

  const anomaliesData = refunds.flatMap((refund) =>
    refund.anomalies.map((anomaly) => ({
      '异常ID': anomaly.id,
      '关联记录ID': anomaly.refundId,
      '流水号': refund.serialNo,
      '供应商名称': refund.supplierName,
      '异常类型': getAnomalyTypeLabel(anomaly.type),
      '异常描述': anomaly.description,
      '严重程度': getSeverityLabel(anomaly.severity),
      '检测时间': formatDateTime(anomaly.detectedAt),
      '处理状态': anomaly.status === 'open' ? '待处理' : anomaly.status === 'confirmed' ? '已确认' : '已驳回',
      '跨期天数': anomaly.crossPeriodDays || '-',
      '挂账天数': anomaly.pendingDays || '-',
      '关联记录ID列表': anomaly.relatedRefundIds.join('; '),
    }))
  );

  const attachmentsData = refunds.flatMap((refund) =>
    refund.attachments.map((att) => ({
      '附件ID': att.id,
      '关联记录ID': att.refundId,
      '流水号': refund.serialNo,
      '文件名': att.fileName,
      '文件类型': getFileTypeLabel(att.fileType),
      '上传日期': formatDate(att.uploadDate),
      '复核截止日': formatDate(att.reviewDeadline),
      '是否晚到': att.isLate ? '是' : '否',
      '文件哈希': att.hash,
      '内容摘要': att.content.substring(0, 50),
    }))
  );

  const confirmationsData = refunds.flatMap((refund) =>
    refund.confirmations.map((conf) => ({
      '确认ID': conf.id,
      '关联记录ID': conf.refundId,
      '流水号': refund.serialNo,
      '操作人': conf.operator,
      '复核结论': getConclusionLabel(conf.conclusion),
      '异常说明': conf.explanation,
      '对账备注': conf.reconciliationNote,
      '确认时间': formatDateTime(conf.confirmedAt),
      '证据链哈希': conf.evidenceChainHash,
    }))
  );

  const ratesData = rates.map((rate) => ({
    '费率ID': rate.id,
    '供应商ID': rate.supplierId,
    '供应商名称': rate.supplierName,
    '费率类型': getAnomalyTypeLabel(rate.rateType as any),
    '费率(%)': (rate.rate * 100).toFixed(1),
    '生效日期': formatDate(rate.effectiveFrom),
    '截止日期': formatDate(rate.effectiveTo),
    '版本号': rate.version,
  }));

  return {
    mainData,
    anomaliesData,
    attachmentsData,
    confirmationsData,
    ratesData,
  };
}

export async function generateExportVerification(
  refunds: RefundItem[],
  operator: string
): Promise<ExportVerification> {
  const normalCount = refunds.filter((r) => r.status === 'normal').length;
  const pendingCount = refunds.filter((r) => r.status === 'pending').length;
  const anomalyCount = refunds.filter((r) => r.status === 'anomaly').length;

  const totalAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
  const totalFeeAmount = refunds.reduce((sum, r) => sum + r.feeAmount, 0);

  const dataHash = await calculateDataHash(refunds);
  const signature = await sha256(`${dataHash}_${operator}_${Date.now()}`);

  return {
    exportId: `exp_${Date.now()}`,
    exportTime: new Date().toISOString(),
    operator,
    recordCount: refunds.length,
    totalAmount,
    totalFeeAmount,
    statusBreakdown: {
      normal: normalCount,
      pending: pendingCount,
      anomaly: anomalyCount,
    },
    dataHash,
    signature,
  };
}

export async function exportToExcel(
  refunds: RefundItem[],
  rates: RateTable[],
  operator: string
): Promise<{
  excelBlob: Blob;
  verificationBlob: Blob;
  verification: ExportVerification;
}> {
  const { mainData, anomaliesData, attachmentsData, confirmationsData, ratesData } =
    prepareExportData(refunds, rates);

  const wb = XLSX.utils.book_new();

  const mainWs = XLSX.utils.json_to_sheet(mainData);
  XLSX.utils.book_append_sheet(wb, mainWs, '结算明细');

  const anomaliesWs = XLSX.utils.json_to_sheet(anomaliesData);
  XLSX.utils.book_append_sheet(wb, anomaliesWs, '异常记录');

  const attachmentsWs = XLSX.utils.json_to_sheet(attachmentsData);
  XLSX.utils.book_append_sheet(wb, attachmentsWs, '结算附件');

  const confirmationsWs = XLSX.utils.json_to_sheet(confirmationsData);
  XLSX.utils.book_append_sheet(wb, confirmationsWs, '人工确认');

  const ratesWs = XLSX.utils.json_to_sheet(ratesData);
  XLSX.utils.book_append_sheet(wb, ratesWs, '费率表');

  const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const excelBlob = new Blob([excelBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const verification = await generateExportVerification(refunds, operator);
  const verificationContent = JSON.stringify(verification, null, 2);
  const verificationBlob = new Blob([verificationContent], {
    type: 'application/json',
  });

  return { excelBlob, verificationBlob, verification };
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function verifyExport(
  refunds: RefundItem[],
  verification: ExportVerification
): Promise<{
  isValid: boolean;
  currentHash: string;
  storedHash: string;
  discrepancies: string[];
}> {
  const currentHash = await calculateDataHash(refunds);
  const discrepancies: string[] = [];

  const normalCount = refunds.filter((r) => r.status === 'normal').length;
  const pendingCount = refunds.filter((r) => r.status === 'pending').length;
  const anomalyCount = refunds.filter((r) => r.status === 'anomaly').length;
  const totalAmount = refunds.reduce((sum, r) => sum + r.amount, 0);
  const totalFeeAmount = refunds.reduce((sum, r) => sum + r.feeAmount, 0);

  if (refunds.length !== verification.recordCount) {
    discrepancies.push(
      `记录数量不一致：当前${refunds.length}条，导出时${verification.recordCount}条`
    );
  }

  if (Math.abs(totalAmount - verification.totalAmount) > 0.01) {
    discrepancies.push(
      `退款金额合计不一致：当前¥${formatCurrency(totalAmount)}，导出时¥${formatCurrency(verification.totalAmount)}`
    );
  }

  if (Math.abs(totalFeeAmount - verification.totalFeeAmount) > 0.01) {
    discrepancies.push(
      `手续费金额合计不一致：当前¥${formatCurrency(totalFeeAmount)}，导出时¥${formatCurrency(verification.totalFeeAmount)}`
    );
  }

  if (normalCount !== verification.statusBreakdown.normal) {
    discrepancies.push(
      `正常记录数量不一致：当前${normalCount}条，导出时${verification.statusBreakdown.normal}条`
    );
  }

  if (pendingCount !== verification.statusBreakdown.pending) {
    discrepancies.push(
      `待确认记录数量不一致：当前${pendingCount}条，导出时${verification.statusBreakdown.pending}条`
    );
  }

  return {
    isValid: currentHash === verification.dataHash && discrepancies.length === 0,
    currentHash,
    storedHash: verification.dataHash,
    discrepancies,
  };
}
