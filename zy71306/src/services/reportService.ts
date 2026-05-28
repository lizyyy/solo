import { CalibrationRecord, CalibrationError } from '../types/calibration';
import { getTrackById } from '../data/testTracks';
import {
  formatDate,
  formatPressure,
  formatAntiSkating,
  formatTonearmLength,
  formatRadius,
  formatTorque,
  formatWearLevel,
  getSeverityLabel,
} from '../utils/formatters';
import { getWearLevelDescription, getWearRecommendations } from './wearService';
import { getTorqueStatus } from './torqueService';

export interface ReportSection {
  title: string;
  content: string;
  type: 'text' | 'table' | 'image' | 'list';
  data?: unknown;
}

export interface GeneratedReport {
  title: string;
  subtitle: string;
  generatedAt: number;
  sections: ReportSection[];
  recordIds: string[];
  hasErrors: boolean;
  summary: string;
}

export const generateReport = (
  records: CalibrationRecord[],
  additionalNotes: string = ''
): GeneratedReport => {
  if (records.length === 0) {
    return {
      title: '黑胶唱针压力校准报告',
      subtitle: '无数据',
      generatedAt: Date.now(),
      sections: [],
      recordIds: [],
      hasErrors: false,
      summary: '未选择校准记录',
    };
  }

  const sections: ReportSection[] = [];
  const allErrors: CalibrationError[] = [];

  records.forEach((record) => {
    allErrors.push(...record.errors);
  });

  sections.push(createSummarySection(records, allErrors));

  records.forEach((record, index) => {
    sections.push(...createRecordSections(record, index + 1));
  });

  if (allErrors.length > 0) {
    sections.push(createErrorsSection(allErrors));
  }

  const recommendations = generateRecommendations(records);
  sections.push(createRecommendationsSection(recommendations));

  if (additionalNotes.trim()) {
    sections.push({
      title: '附加备注',
      content: additionalNotes,
      type: 'text',
    });
  }

  sections.push(createDisclaimerSection());

  const hasErrors = allErrors.some((e) => e.severity === 'high');
  const summary = generateSummary(records, allErrors);

  return {
    title: '黑胶唱针压力校准报告',
    subtitle: `共 ${records.length} 组校准数据`,
    generatedAt: Date.now(),
    sections,
    recordIds: records.map((r) => r.id),
    hasErrors,
    summary,
  };
};

const createSummarySection = (
  records: CalibrationRecord[],
  errors: CalibrationError[]
): ReportSection => {
  const avgPressure =
    records.reduce((sum, r) => sum + r.stylusPressure, 0) / records.length;
  const avgWear =
    records.reduce((sum, r) => sum + r.wearLevel, 0) / records.length;
  const avgTorque =
    records.reduce((sum, r) => sum + r.torque, 0) / records.length;

  const highErrors = errors.filter((e) => e.severity === 'high').length;
  const mediumErrors = errors.filter((e) => e.severity === 'medium').length;

  const content = `
报告生成时间：${formatDate(Date.now())}
校准记录数：${records.length} 组
时间跨度：${formatDate(records[records.length - 1].timestamp)} 至 ${formatDate(records[0].timestamp)}

平均唱针压力：${formatPressure(avgPressure)}
平均力矩：${formatTorque(avgTorque)}
平均磨损程度：${formatWearLevel(avgWear)} - ${getWearLevelDescription(avgWear)}

异常检测：${highErrors > 0 ? `发现 ${highErrors} 个严重问题` : '无严重问题'}
${mediumErrors > 0 ? `警告：${mediumErrors} 个` : ''}
  `.trim();

  return {
    title: '报告摘要',
    content,
    type: 'text',
  };
};

const createRecordSections = (
  record: CalibrationRecord,
  index: number
): ReportSection[] => {
  const sections: ReportSection[] = [];
  const track = getTrackById(record.testTrack);
  const torqueStatus = getTorqueStatus(record.torque, record.stylusPressure);

  const paramsContent = `
唱针压力：${formatPressure(record.stylusPressure)}
抗滑力：${formatAntiSkating(record.antiSkating)} ${record.antiSkatingDirection === 'reverse' ? '(方向错误！)' : ''}
唱臂长度：${formatTonearmLength(record.tonearmLength)}
唱片半径：${formatRadius(record.recordRadius, record.recordRadiusUnit)}
测试曲目：${track.name} (${track.difficulty === 'easy' ? '简单' : track.difficulty === 'medium' ? '中等' : '困难'})
  `.trim();

  sections.push({
    title: `校准记录 #${index} - 参数设置`,
    content: paramsContent,
    type: 'text',
  });

  const resultsContent = `
计算力矩：${formatTorque(record.torque)} - ${torqueStatus.message}
磨损程度：${formatWearLevel(record.wearLevel)} - ${getWearLevelDescription(record.wearLevel)}
校准时间：${formatDate(record.timestamp)}
  `.trim();

  sections.push({
    title: `校准记录 #${index} - 计算结果`,
    content: resultsContent,
    type: 'text',
  });

  if (record.screenshot) {
    sections.push({
      title: `校准记录 #${index} - 截图`,
      content: record.screenshot,
      type: 'image',
      data: { recordId: record.id },
    });
  }

  if (record.errors.length > 0) {
    const errorContent = record.errors
      .map(
        (e) =>
          `[${getSeverityLabel(e.severity)}] ${e.message}\n时间：${formatDate(e.timestamp)}`
      )
      .join('\n\n');

    sections.push({
      title: `校准记录 #${index} - 检测到的问题`,
      content: errorContent,
      type: 'text',
    });
  }

  if (record.notes) {
    sections.push({
      title: `校准记录 #${index} - 备注`,
      content: record.notes,
      type: 'text',
    });
  }

  if (record.manualCorrection) {
    sections.push({
      title: `校准记录 #${index} - 人工更正`,
      content: record.manualCorrection,
      type: 'text',
    });
  }

  return sections;
};

const createErrorsSection = (errors: CalibrationError[]): ReportSection => {
  const grouped = {
    high: errors.filter((e) => e.severity === 'high'),
    medium: errors.filter((e) => e.severity === 'medium'),
    low: errors.filter((e) => e.severity === 'low'),
  };

  const content = `
严重问题 (${grouped.high.length})：
${grouped.high.map((e) => `• ${e.message}`).join('\n')}

警告 (${grouped.medium.length})：
${grouped.medium.map((e) => `• ${e.message}`).join('\n')}

提示 (${grouped.low.length})：
${grouped.low.map((e) => `• ${e.message}`).join('\n')}
  `.trim();

  return {
    title: '问题汇总',
    content,
    type: 'list',
  };
};

const createRecommendationsSection = (
  recommendations: string[]
): ReportSection => {
  const content = recommendations.map((r) => `• ${r}`).join('\n');

  return {
    title: '调校建议',
    content,
    type: 'list',
  };
};

const createDisclaimerSection = (): ReportSection => {
  return {
    title: '免责声明',
    content: `
本报告基于物理模型计算得出，仅供参考。实际磨损程度受唱针磨损程度、唱片材质、使用环境等多种因素影响。
建议定期使用专业设备进行实际测量校准。本系统不承担因参数设置不当导致的任何损失。
    `.trim(),
    type: 'text',
  };
};

const generateRecommendations = (records: CalibrationRecord[]): string[] => {
  const recommendations: Set<string> = new Set();

  records.forEach((record) => {
    const wearRecs = getWearRecommendations({
      totalWear: record.wearLevel,
      pressureWear: record.stylusPressure * 15,
      antiSkatingWear: 0,
      lengthWear: 0,
      trackWear: 1,
      pressureFactor: 15,
      antiSkatingFactor: 20,
      lengthFactor: 0.5,
      trackFactor: 1.2,
      idealAntiSkating: 0,
      antiSkatingGap: 0,
      lengthDeviation: 0,
    });

    wearRecs.forEach((r) => recommendations.add(r));
  });

  if (records.some((r) => r.antiSkatingDirection === 'reverse')) {
    recommendations.add('请立即检查并修正抗滑方向，反向抗滑会严重损坏唱片');
  }

  if (records.some((r) => r.stylusPressure > 2.5)) {
    recommendations.add('存在压力过高的设置，强烈建议降低唱针压力至安全范围');
  }

  return Array.from(recommendations);
};

const generateSummary = (
  records: CalibrationRecord[],
  errors: CalibrationError[]
): string => {
  const highErrors = errors.filter((e) => e.severity === 'high').length;
  const avgWear =
    records.reduce((sum, r) => sum + r.wearLevel, 0) / records.length;

  if (highErrors > 0) {
    return `检测到 ${highErrors} 个严重问题，建议立即修正参数设置`;
  }
  if (avgWear > 60) {
    return '磨损程度较高，建议调整参数以减少唱片损耗';
  }
  if (avgWear > 30) {
    return '参数基本合理，磨损程度在可接受范围内';
  }
  return '参数设置良好，继续保持';
};

export const getReportAsPlainText = (report: GeneratedReport): string => {
  let text = `${report.title}\n${report.subtitle}\n${'='.repeat(50)}\n\n`;

  text += `生成时间：${formatDate(report.generatedAt)}\n`;
  text += `摘要：${report.summary}\n\n`;

  report.sections.forEach((section) => {
    text += `【${section.title}】\n`;
    if (section.type === 'image') {
      text += '[截图数据]\n';
    } else {
      text += `${section.content}\n`;
    }
    text += '\n';
  });

  return text;
};
