import { RISK_TYPES, RISK_LEVELS, HIVE_STATUS } from '../models';

export const exportToMarkdown = (hives, riskAssessments, reviewNotes, options = {}) => {
  const { title = '蜂箱热害巡检报告', date = new Date().toLocaleDateString('zh-CN') } = options;
  
  let markdown = `# ${title}\n\n`;
  markdown += `**日期**: ${date}\n\n`;
  markdown += `---\n\n`;
  
  const summary = generateSummary(hives, riskAssessments);
  markdown += `## 概览\n\n`;
  markdown += summary;
  markdown += `\n\n`;
  
  const criticalHives = hives.filter(hive => {
    const assessment = riskAssessments.find(a => a.hiveId === hive.id);
    return assessment && assessment.overallStatus === HIVE_STATUS.CRITICAL;
  });
  
  const atRiskHives = hives.filter(hive => {
    const assessment = riskAssessments.find(a => a.hiveId === hive.id);
    return assessment && assessment.overallStatus === HIVE_STATUS.AT_RISK;
  });
  
  const healthyHives = hives.filter(hive => {
    const assessment = riskAssessments.find(a => a.hiveId === hive.id);
    return assessment && assessment.overallStatus === HIVE_STATUS.HEALTHY;
  });
  
  if (criticalHives.length > 0) {
    markdown += `## 🚨 紧急处理（${criticalHives.length}群）\n\n`;
    criticalHives.forEach(hive => {
      const assessment = riskAssessments.find(a => a.hiveId === hive.id);
      const note = reviewNotes[hive.id];
      markdown += generateHiveSection(hive, assessment, note);
    });
  }
  
  if (atRiskHives.length > 0) {
    markdown += `## ⚠️ 需要关注（${atRiskHives.length}群）\n\n`;
    atRiskHives.forEach(hive => {
      const assessment = riskAssessments.find(a => a.hiveId === hive.id);
      const note = reviewNotes[hive.id];
      markdown += generateHiveSection(hive, assessment, note);
    });
  }
  
  if (healthyHives.length > 0) {
    markdown += `## ✅ 正常蜂群（${healthyHives.length}群）\n\n`;
    healthyHives.forEach(hive => {
      const assessment = riskAssessments.find(a => a.hiveId === hive.id);
      const note = reviewNotes[hive.id];
      markdown += generateHiveSection(hive, assessment, note);
    });
  }
  
  markdown += `\n\n---\n\n`;
  markdown += `*本报告由蜂箱热害巡检系统自动生成*`;
  
  return markdown;
};

const generateSummary = (hives, riskAssessments) => {
  let summary = '';
  
  const totalHives = hives.length;
  const criticalCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.CRITICAL).length;
  const atRiskCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.AT_RISK).length;
  const healthyCount = riskAssessments.filter(a => a.overallStatus === HIVE_STATUS.HEALTHY).length;
  
  const highRiskCount = riskAssessments.reduce((sum, a) => sum + a.highRiskCount, 0);
  const mediumRiskCount = riskAssessments.reduce((sum, a) => sum + a.mediumRiskCount, 0);
  const lowRiskCount = riskAssessments.reduce((sum, a) => sum + a.lowRiskCount, 0);
  
  summary += `| 指标 | 数量 |\n`;
  summary += `|------|------|\n`;
  summary += `| 总蜂群数 | ${totalHives} |\n`;
  summary += `| 紧急处理 | ${criticalCount} |\n`;
  summary += `| 需要关注 | ${atRiskCount} |\n`;
  summary += `| 正常蜂群 | ${healthyCount} |\n\n`;
  
  summary += `### 风险类型统计\n\n`;
  summary += `| 风险类型 | 高风险 | 中风险 | 低风险 |\n`;
  summary += `|----------|--------|--------|--------|\n`;
  summary += `| 过热风险 | ${countRisksByType(riskAssessments, RISK_TYPES.OVERHEATING, RISK_LEVELS.HIGH)} | ${countRisksByType(riskAssessments, RISK_TYPES.OVERHEATING, RISK_LEVELS.MEDIUM)} | ${countRisksByType(riskAssessments, RISK_TYPES.OVERHEATING, RISK_LEVELS.LOW)} |\n`;
  summary += `| 缺水风险 | ${countRisksByType(riskAssessments, RISK_TYPES.WATER_SHORTAGE, RISK_LEVELS.HIGH)} | ${countRisksByType(riskAssessments, RISK_TYPES.WATER_SHORTAGE, RISK_LEVELS.MEDIUM)} | ${countRisksByType(riskAssessments, RISK_TYPES.WATER_SHORTAGE, RISK_LEVELS.LOW)} |\n`;
  summary += `| 蜂王异常 | ${countRisksByType(riskAssessments, RISK_TYPES.QUEEN_ABNORMALITY, RISK_LEVELS.HIGH)} | ${countRisksByType(riskAssessments, RISK_TYPES.QUEEN_ABNORMALITY, RISK_LEVELS.MEDIUM)} | ${countRisksByType(riskAssessments, RISK_TYPES.QUEEN_ABNORMALITY, RISK_LEVELS.LOW)} |\n`;
  summary += `| 盗蜂风险 | ${countRisksByType(riskAssessments, RISK_TYPES.ROBBING_RISK, RISK_LEVELS.HIGH)} | ${countRisksByType(riskAssessments, RISK_TYPES.ROBBING_RISK, RISK_LEVELS.MEDIUM)} | ${countRisksByType(riskAssessments, RISK_TYPES.ROBBING_RISK, RISK_LEVELS.LOW)} |\n`;
  
  return summary;
};

const countRisksByType = (riskAssessments, riskType, riskLevel) => {
  return riskAssessments.reduce((count, assessment) => {
    return count + assessment.risks.filter(r => r.type === riskType && r.level === riskLevel).length;
  }, 0);
};

const generateHiveSection = (hive, assessment, note) => {
  let section = `### 蜂箱 ${hive.id}\n\n`;
  
  section += `**位置**: (${hive.x}, ${hive.y})\n\n`;
  
  if (assessment && assessment.risks.length > 0) {
    section += `#### 检测到的风险\n\n`;
    assessment.risks.forEach(risk => {
      const riskIcon = getRiskIcon(risk.type);
      const levelIcon = getLevelIcon(risk.level);
      section += `- ${riskIcon} ${getRiskTypeName(risk.type)} (${levelIcon} ${getLevelName(risk.level)})\n`;
      section += `  - ${risk.description}\n`;
      section += `  - **建议**: ${risk.recommendations.join('、')}\n\n`;
    });
  } else {
    section += `✅ 暂无风险\n\n`;
  }
  
  if (note) {
    section += `#### 人工复核备注\n\n`;
    if (note.content) {
      section += `${note.content}\n\n`;
    }
    if (note.status) {
      section += `**状态**: ${note.status}\n\n`;
    }
    if (note.updatedAt) {
      section += `**更新时间**: ${new Date(note.updatedAt).toLocaleString('zh-CN')}\n\n`;
    }
  }
  
  section += `---\n\n`;
  return section;
};

const getRiskIcon = (riskType) => {
  switch (riskType) {
    case RISK_TYPES.OVERHEATING: return '🔥';
    case RISK_TYPES.WATER_SHORTAGE: return '💧';
    case RISK_TYPES.QUEEN_ABNORMALITY: return '👑';
    case RISK_TYPES.ROBBING_RISK: return '🐝';
    default: return '⚠️';
  }
};

const getLevelIcon = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH: return '🔴';
    case RISK_LEVELS.MEDIUM: return '🟡';
    case RISK_LEVELS.LOW: return '🟢';
    default: return '⚪';
  }
};

const getRiskTypeName = (riskType) => {
  switch (riskType) {
    case RISK_TYPES.OVERHEATING: return '过热风险';
    case RISK_TYPES.WATER_SHORTAGE: return '缺水风险';
    case RISK_TYPES.QUEEN_ABNORMALITY: return '蜂王异常';
    case RISK_TYPES.ROBBING_RISK: return '盗蜂风险';
    default: return '未知风险';
  }
};

const getLevelName = (level) => {
  switch (level) {
    case RISK_LEVELS.HIGH: return '高风险';
    case RISK_LEVELS.MEDIUM: return '中风险';
    case RISK_LEVELS.LOW: return '低风险';
    default: return '未知';
  }
};

export const exportToJSON = (hives, sensorData, inspectionRecords, wateringSchedules, riskAssessments, reviewNotes) => {
  const exportData = {
    exportTime: new Date().toISOString(),
    version: '1.0',
    hives: hives,
    sensorData: sensorData,
    inspectionRecords: inspectionRecords,
    wateringSchedules: wateringSchedules,
    riskAssessments: riskAssessments,
    reviewNotes: reviewNotes
  };
  
  return JSON.stringify(exportData, null, 2);
};

export const downloadFile = (content, filename, mimeType = 'text/plain') => {
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
