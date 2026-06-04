import { ParameterRecord, ForecastResult, SelfCheckResult, SelfCheckItem } from '../../shared/types';
import { parseNumericValue } from './exponentialSmoothing';

function runSelfCheck(paramRecords: ParameterRecord[], results: ForecastResult[]): SelfCheckResult {
  const items: SelfCheckItem[] = [];

  items.push(checkParameterRecordsExist(paramRecords));
  items.push(checkForecastResultsExist(results));
  items.push(checkParameterFormat(paramRecords));
  items.push(checkMixedFormat(paramRecords));
  items.push(checkForecastValues(results));

  const overallStatus = items.some(i => i.status === 'fail')
    ? 'fail'
    : items.some(i => i.status === 'warning')
    ? 'warning'
    : 'pass';

  return {
    overallStatus,
    items,
    checkedAt: new Date().toISOString(),
  };
}

function checkParameterRecordsExist(paramRecords: ParameterRecord[]): SelfCheckItem {
  if (paramRecords.length === 0) {
    return {
      id: 'param_records_exist',
      name: '参数记录存在性检查',
      status: 'fail',
      message: '未找到参数记录',
      details: '请先导入参数调试表',
    };
  }
  return {
    id: 'param_records_exist',
    name: '参数记录存在性检查',
    status: 'pass',
    message: `找到 ${paramRecords.length} 条参数记录`,
    details: '参数记录已成功导入',
  };
}

function checkForecastResultsExist(results: ForecastResult[]): SelfCheckItem {
  if (results.length === 0) {
    return {
      id: 'forecast_results_exist',
      name: '预测结果存在性检查',
      status: 'fail',
      message: '未找到预测结果',
      details: '请先执行指数平滑计算',
    };
  }
  return {
    id: 'forecast_results_exist',
    name: '预测结果存在性检查',
    status: 'pass',
    message: `找到 ${results.length} 条预测结果`,
    details: '预测结果已生成',
  };
}

function checkParameterFormat(paramRecords: ParameterRecord[]): SelfCheckItem {
  const invalidRecords: string[] = [];

  for (const record of paramRecords) {
    try {
      parseNumericValue(record.alpha);
      parseNumericValue(record.beta);
      parseNumericValue(record.gamma);
    } catch {
      invalidRecords.push(`${record.productName} (${record.productId})`);
    }
  }

  if (invalidRecords.length > 0) {
    return {
      id: 'param_format',
      name: '参数格式有效性检查',
      status: 'fail',
      message: `${invalidRecords.length} 条记录参数格式无效`,
      details: `无效参数的产品：${invalidRecords.join('、')}`,
    };
  }

  return {
    id: 'param_format',
    name: '参数格式有效性检查',
    status: 'pass',
    message: '所有参数格式有效',
    details: 'alpha、beta、gamma 参数均可正常解析',
  };
}

function checkMixedFormat(paramRecords: ParameterRecord[]): SelfCheckItem {
  const mixedCount = paramRecords.filter(r => r.hasMixedFormat).length;

  if (mixedCount > 0) {
    const mixedProducts = paramRecords
      .filter(r => r.hasMixedFormat)
      .map(r => `${r.productName} (${r.productId})`)
      .join('、');

    return {
      id: 'mixed_format',
      name: '混合格式检查',
      status: 'warning',
      message: `${mixedCount} 条记录存在混合格式`,
      details: `包含混合格式的产品：${mixedProducts}。请确认参数格式是否正确`,
    };
  }

  return {
    id: 'mixed_format',
    name: '混合格式检查',
    status: 'pass',
    message: '无混合格式问题',
    details: '所有参数格式统一',
  };
}

function checkForecastValues(results: ForecastResult[]): SelfCheckItem {
  const pendingReview = results.filter(r => r.reviewStatus === 'pending_review').length;
  const negativeValues = results.filter(r => r.forecastValue < 0).length;

  if (negativeValues > 0) {
    return {
      id: 'forecast_values',
      name: '预测值合理性检查',
      status: 'warning',
      message: `${negativeValues} 条预测值为负数`,
      details: '预测值不应为负数，请检查数据是否正确',
    };
  }

  if (pendingReview > 0) {
    return {
      id: 'forecast_values',
      name: '预测值合理性检查',
      status: 'warning',
      message: `${pendingReview} 条结果待复核`,
      details: '请数据分析师确认冲突解决结果',
    };
  }

  return {
    id: 'forecast_values',
    name: '预测值合理性检查',
    status: 'pass',
    message: '所有预测值合理',
    details: '预测值均为正数且已完成复核',
  };
}

export { runSelfCheck };
