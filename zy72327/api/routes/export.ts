import express from 'express';
import * as XLSX from 'xlsx';
import * as storage from '../services/storageService';

const router = express.Router();

const formatDate = (date: Date): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
};

const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const getReviewStatusText = (status: string): string => {
  const statusMap: Record<string, string> = {
    pending_review: '待复核',
    reviewed: '已复核',
    normal: '正常',
  };
  return statusMap[status] || status;
};

const getConflictStatusText = (status: string): string => {
  return status === 'pending' ? '待处理' : status === 'resolved' ? '已解决' : status;
};

const getResolutionText = (resolution: string | null): string => {
  if (!resolution) return '';
  return resolution === 'accept_example' ? '采纳手算值' : resolution === 'reject_example' ? '采纳参数值' : resolution;
};

const getValueFormatText = (format: string): string => {
  const formatMap: Record<string, string> = {
    decimal: '小数',
    percentage: '百分数',
    mixed: '混合',
  };
  return formatMap[format] || format;
};

router.get('/details', async (req: express.Request, res: express.Response): Promise<void> => {
  try {
    const [forecastResults, parameterRecords, conflicts] = await Promise.all([
      storage.getForecastResults(),
      storage.getParameterRecords(),
      storage.getConflicts(),
    ]);

    const wb = XLSX.utils.book_new();

    const forecastData = forecastResults.map((result) => ({
      '产品ID': result.productId,
      '产品名称': result.productName,
      '预测值': result.rawValue,
      '参数版本': result.parameterVersion,
      '计算明细': result.calculationDetail,
      '取舍理由': result.tradeoffReason,
      '是否混合格式': result.isMixedFormat ? '是' : '否',
      '复核状态': getReviewStatusText(result.reviewStatus),
      '复核人': result.reviewedBy || '',
      '创建时间': formatDateTime(result.createdAt),
    }));
    const forecastSheet = XLSX.utils.json_to_sheet(forecastData);
    XLSX.utils.book_append_sheet(wb, forecastSheet, '预测明细');

    const parameterData = parameterRecords.map((record) => ({
      '产品ID': record.productId,
      '产品名称': record.productName,
      'alpha': record.rawAlpha ?? record.alpha,
      'beta': record.rawBeta ?? record.beta,
      'gamma': record.rawGamma ?? record.gamma,
      '预测结论': record.forecastConclusion,
      '值格式': getValueFormatText(record.valueFormat),
      '是否混合格式': record.hasMixedFormat ? '是' : '否',
    }));
    const parameterSheet = XLSX.utils.json_to_sheet(parameterData);
    XLSX.utils.book_append_sheet(wb, parameterSheet, '参数记录');

    const conflictData = conflicts.map((conflict) => ({
      '产品ID': conflict.productId,
      '产品名称': conflict.productName,
      '参数值': conflict.parameterValue,
      '手算值': conflict.exampleValue,
      '差异百分比': `${conflict.diffPercentage}%`,
      '证据': conflict.evidence,
      '状态': getConflictStatusText(conflict.status),
      '解决方式': getResolutionText(conflict.resolution),
      '理由': conflict.resolutionReason || '',
      '处理人': conflict.resolvedBy || '',
    }));
    const conflictSheet = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, conflictSheet, '冲突记录');

    const today = new Date();
    const filename = `forecast_details_${formatDate(today)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.send(buffer);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({
      success: false,
      error: '导出失败，请稍后重试',
    });
  }
});

export default router;
