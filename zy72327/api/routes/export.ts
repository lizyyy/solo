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
    pending_review: '待复核（未归入正常）',
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
    mixed: '混合（未自动归一化）',
  };
  return formatMap[format] || format;
};

const buildReviewChainText = (chain: Array<{
  action: string;
  originalValue?: string;
  updatedValue?: string;
  reason?: string;
  operator?: string;
  nextOwner?: string;
  timestamp: string;
}>): string => {
  if (!chain || chain.length === 0) return '';
  return chain.map((entry, idx) => {
    const parts = [`【步骤${idx + 1}】${entry.action}（${formatDateTime(entry.timestamp)}）`];
    if (entry.originalValue) parts.push(`  原始说法：${entry.originalValue}`);
    if (entry.updatedValue) parts.push(`  改后的值：${entry.updatedValue}`);
    if (entry.reason) parts.push(`  处理原因：${entry.reason}`);
    parts.push(`  经手人：${entry.operator || '系统'}；下一步找谁：→ ${entry.nextOwner || '业务确认'}`);
    return parts.join('\n');
  }).join('\n');
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
      '预测值（统一结果）': result.forecastValue,
      '参数表原始结论': typeof result.rawValue === 'string' ? result.rawValue : String(result.rawValue),
      '参数版本': result.parameterVersion,
      '值格式': getValueFormatText(result.valueFormat),
      '是否混合格式': result.isMixedFormat ? '是（未自动归入正常）' : '否',
      'alpha-原始值（展示/API/导出一致）': (result as any).rawAlpha ?? '',
      'beta-原始值（展示/API/导出一致）': (result as any).rawBeta ?? '',
      'gamma-原始值（展示/API/导出一致）': (result as any).rawGamma ?? '',
      'alpha-归一化后值': (result as any).parsedAlpha !== undefined ? Number((result as any).parsedAlpha).toFixed(4) : '',
      'beta-归一化后值': (result as any).parsedBeta !== undefined ? Number((result as any).parsedBeta).toFixed(4) : '',
      'gamma-归一化后值': (result as any).parsedGamma !== undefined ? Number((result as any).parsedGamma).toFixed(4) : '',
      '混合格式原始描述': (result as any).mixedFormatInfo?.originalDescription ?? '',
      '混合格式归一化描述': (result as any).mixedFormatInfo?.normalizedDescription ?? '',
      '混合格式下一步找谁': (result as any).mixedFormatInfo?.nextOwner ?? '',
      '冲突决策ID': (result as any).conflictDecision?.conflictId ?? '',
      '冲突决策结果': (result as any).conflictDecision?.resolution === 'accept_example' ? '采纳手算反例'
        : (result as any).conflictDecision?.resolution === 'reject_example' ? '驳回维持原参数'
        : '',
      '冲突-原始说法（参数表）': (result as any).conflictDecision?.originalStatement ?? '',
      '冲突-改后的值': (result as any).conflictDecision?.updatedValue ?? '',
      '冲突-处理原因': (result as any).conflictDecision?.changeReason ?? '',
      '冲突-下一步找谁': (result as any).conflictDecision?.nextOwner ?? '',
      '取舍理由': result.tradeoffReason,
      '计算明细': result.calculationDetail,
      '复核状态': getReviewStatusText(result.reviewStatus),
      '复核人': result.reviewedBy || '',
      '复核链路（原始→改后→原因→找谁）': buildReviewChainText((result as any).reviewChain || []),
      '创建时间': formatDateTime(result.createdAt),
    }));
    const forecastSheet = XLSX.utils.json_to_sheet(forecastData);
    const colWidths = Object.keys(forecastData[0] || {}).map(() => ({ wch: 24 }));
    (forecastSheet as any)['!cols'] = colWidths;
    XLSX.utils.book_append_sheet(wb, forecastSheet, '预测明细（含复核链路）');

    const parameterData = parameterRecords.map((record) => ({
      '产品ID': record.productId,
      '产品名称': record.productName,
      'alpha-原始': record.rawAlpha ?? String(record.alpha),
      'beta-原始': record.rawBeta ?? String(record.beta),
      'gamma-原始': record.rawGamma ?? String(record.gamma),
      '预测结论': record.forecastConclusion,
      '值格式': getValueFormatText(record.valueFormat),
      '是否混合格式': record.hasMixedFormat ? '是（未自动归一化）' : '否',
      '导入时间': formatDateTime(record.createdAt),
    }));
    const parameterSheet = XLSX.utils.json_to_sheet(parameterData);
    XLSX.utils.book_append_sheet(wb, parameterSheet, '参数记录（原始值）');

    const conflictData = conflicts.map((conflict) => ({
      '产品ID': conflict.productId,
      '产品名称': conflict.productName,
      '参数表值': conflict.parameterValue,
      '手算反例值': conflict.exampleValue,
      '差异百分比': `${Number(conflict.diffPercentage).toFixed(2)}%`,
      '冲突证据': conflict.evidence,
      '状态': getConflictStatusText(conflict.status),
      '解决方式': getResolutionText(conflict.resolution),
      '处理理由': conflict.resolutionReason || '',
      '处理人': conflict.resolvedBy || '',
      '处理时间': formatDateTime(conflict.resolvedAt),
    }));
    const conflictSheet = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, conflictSheet, '冲突记录（含决策）');

    const consistency = [
      {
        '说明': '本导出文件所有数据均从 results.json / parameters.json / conflicts.json 读取',
        '数据一致性': '页面展示 与 接口返回 与 导出文件：三者使用同一份数据源，字段值完全一致',
        '特别说明_混合格式': '百分数与小数混合的记录保留原始值和归一化值，标注 待活动负责人复核，不自动归为正常结果',
      },
    ];
    const consistencySheet = XLSX.utils.json_to_sheet(consistency);
    XLSX.utils.book_append_sheet(wb, consistencySheet, '数据一致性说明');

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
