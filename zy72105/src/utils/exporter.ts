import { format } from 'date-fns';
import type { Batch, NoisePredictionResult } from '../types';
import {
  ASSESSMENT_LABELS,
  BATCH_STATUS_LABELS,
  CONFLICT_TYPE_LABELS,
  DIRECTION_LABELS,
  SEVERITY_LABELS,
  UNIT_LABELS,
} from '../types';

const formatDate = (timestamp: number): string => {
  return format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss');
};

export const generateReportContent = (batch: Batch): string => {
  const { experimentRecord, result, calculationChain, conflicts, anomalies, notes, operationConditions } = batch;

  let content = '';

  content += '═══════════════════════════════════════════════════════════════\n';
  content += '                    无人机旋翼噪声预测报告\n';
  content += '═══════════════════════════════════════════════════════════════\n\n';

  content += '【基本信息】\n';
  content += '───────────────────────────────────────────────────────────────\n';
  content += `批次号: ${batch.id}\n`;
  content += `批次名称: ${batch.name}\n`;
  content += `状态: ${BATCH_STATUS_LABELS[batch.status]}\n`;
  content += `创建时间: ${formatDate(batch.createdAt)}\n`;
  content += `更新时间: ${formatDate(batch.updatedAt)}\n\n`;

  content += '【实验信息】\n';
  content += '───────────────────────────────────────────────────────────────\n';
  content += `无人机型号: ${experimentRecord.droneModel}\n`;
  content += `旋翼型号: ${experimentRecord.rotorModel}\n`;
  content += `测试日期: ${experimentRecord.testDate}\n`;
  content += `环境温度: ${experimentRecord.temperature}°C\n`;
  content += `环境湿度: ${experimentRecord.humidity}%\n`;
  content += `大气压: ${experimentRecord.atmosphericPressure}Pa\n\n`;

  if (operationConditions.length > 0) {
    content += '【工况记录】\n';
    content += '───────────────────────────────────────────────────────────────\n';
    operationConditions.forEach((oc, idx) => {
      content += `${idx + 1}. ${oc.description}\n`;
      content += `   时间: ${formatDate(oc.timestamp)}\n`;
      if (oc.rotorSpeed) content += `   旋翼转速: ${oc.rotorSpeed} RPM\n`;
      if (oc.flightAltitude) content += `   飞行高度: ${oc.flightAltitude} m\n`;
      if (oc.payload) content += `   载荷: ${oc.payload} kg\n`;
      if (oc.weatherCondition) content += `   天气: ${oc.weatherCondition}\n`;
      content += '\n';
    });
  }

  if (result) {
    content += '【预测结果】\n';
    content += '───────────────────────────────────────────────────────────────\n';
    content += `总噪声级: ${result.overallNoiseLevel.toFixed(2)} ${UNIT_LABELS[result.unit]}\n`;
    content += `评估等级: ${ASSESSMENT_LABELS[result.assessment]}\n`;
    content += `主导频率: ${result.dominantFrequency.toFixed(2)} Hz\n`;
    content += `指向性指数: ${result.directionalityIndex.toFixed(2)}\n`;
    content += `置信度: ${(result.confidenceLevel * 100).toFixed(1)}%\n`;
    content += `谐波分量: ${result.harmonicComponents.map((h) => h.toFixed(1) + 'dB').join(', ')}\n\n`;

    content += '【建议措施】\n';
    result.recommendations.forEach((rec, idx) => {
      content += `  ${idx + 1}. ${rec}\n`;
    });
    content += '\n';
  }

  if (conflicts.length > 0) {
    content += '【数据冲突记录】\n';
    content += '───────────────────────────────────────────────────────────────\n';
    conflicts.forEach((c, idx) => {
      content += `${idx + 1}. ${CONFLICT_TYPE_LABELS[c.type]} [${SEVERITY_LABELS[c.severity]}]\n`;
      content += `   传感器数据: ${c.sensorData.value} ${UNIT_LABELS[c.sensorData.unit]}\n`;
      content += `   导入数据: ${c.importData.value} ${UNIT_LABELS[c.importData.unit]}\n`;
      content += `   建议: ${c.suggestedAction}\n`;
      if (c.resolution) {
        content += `   解决方案: ${c.resolution === 'use_sensor' ? '使用传感器数据' : c.resolution === 'use_import' ? '使用导入数据' : '手动处理'}\n`;
        content += `   处理人: ${c.resolvedBy}, 处理时间: ${c.resolvedAt ? formatDate(c.resolvedAt) : '-'}\n`;
      } else {
        content += `   ⚠️ 未处理\n`;
      }
      content += '\n';
    });
  }

  if (anomalies.length > 0) {
    content += '【异常记录】\n';
    content += '───────────────────────────────────────────────────────────────\n';
    anomalies.forEach((a, idx) => {
      content += `${idx + 1}. ${a.description}\n`;
      content += `   数值: ${a.value}, 阈值: ${a.threshold}\n`;
      content += `   时间: ${formatDate(a.timestamp)}\n\n`;
    });
  }

  content += '【计算决策链】\n';
  content += '───────────────────────────────────────────────────────────────\n';
  calculationChain.forEach((node) => {
    content += `步骤${node.step}: ${node.operation}\n`;
    content += `  时间: ${formatDate(node.timestamp)}\n`;
    if (node.formula) content += `  公式: ${node.formula}\n`;
    if (node.note) content += `  备注: ${node.note}\n`;
    content += `  操作人: ${node.operator || '系统'}\n\n`;
  });

  if (notes.length > 0) {
    content += '【维修师傅备注】\n';
    content += '───────────────────────────────────────────────────────────────\n';
    notes.forEach((note, idx) => {
      content += `${idx + 1}. [${formatDate(note.timestamp)}] ${note.author}:\n`;
      content += `   ${note.content}\n\n`;
    });
  }

  content += '═══════════════════════════════════════════════════════════════\n';
  content += '                    报告结束\n';
  content += '═══════════════════════════════════════════════════════════════\n';

  return content;
};

export const exportToCSV = (batch: Batch): string => {
  const { experimentRecord } = batch;
  let csv = '';

  csv += '数据点明细\n';
  csv += '时间戳,数值,单位,方向,数据源,置信度\n';
  experimentRecord.dataPoints.forEach((dp) => {
    csv += `${formatDate(dp.timestamp)},${dp.value},${dp.unit},${dp.direction ? DIRECTION_LABELS[dp.direction] : '-'},${dp.source},${(dp.confidence * 100).toFixed(0)}%\n`;
  });
  csv += '\n';

  csv += '传感器日志\n';
  csv += '时间戳,参数,数值,单位,原始日志\n';
  experimentRecord.sensorLogs.forEach((log) => {
    csv += `${formatDate(log.timestamp)},${log.parameter},${log.value},${log.unit},"${log.rawLog}"\n`;
  });

  return csv;
};

export const exportToJSON = (batch: Batch): string => {
  return JSON.stringify(batch, null, 2);
};

export const downloadFile = (content: string, filename: string, mimeType: string): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportReport = (batch: Batch, fmt: 'txt' | 'csv' | 'json'): void => {
  const timestamp = format(new Date(), 'yyyyMMdd_HHmmss');
  const baseName = `噪声预测报告_${batch.id}_${timestamp}`;

  switch (fmt) {
    case 'txt':
      downloadFile(generateReportContent(batch), `${baseName}.txt`, 'text/plain;charset=utf-8');
      break;
    case 'csv':
      downloadFile(exportToCSV(batch), `${baseName}.csv`, 'text/csv;charset=utf-8');
      break;
    case 'json':
      downloadFile(exportToJSON(batch), `${baseName}.json`, 'application/json;charset=utf-8');
      break;
  }
};
