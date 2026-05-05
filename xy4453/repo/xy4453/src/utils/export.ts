import type { BedAnalysis, ApplicationState, Risk } from '../types';
import { getOverallRiskLevel } from './analysis';

const getRiskEmoji = (severity: 'low' | 'medium' | 'high'): string => {
  switch (severity) {
    case 'high': return '🔴';
    case 'medium': return '🟡';
    case 'low': return '🟢';
  }
};

const getStatusEmoji = (status: string): string => {
  switch (status) {
    case 'clogged': return '🚫';
    case 'leaking': return '💧';
    case 'normal': return '✅';
    default: return '❓';
  }
};

export const generateMarkdownReport = (
  analyses: BedAnalysis[],
  state: ApplicationState
): string => {
  const now = new Date().toLocaleString('zh-CN');
  const totalBeds = analyses.length;
  const highRiskBeds = analyses.filter(a => getOverallRiskLevel(a.risks) === 'high').length;
  const mediumRiskBeds = analyses.filter(a => getOverallRiskLevel(a.risks) === 'medium').length;
  const lowRiskBeds = analyses.filter(a => getOverallRiskLevel(a.risks) === 'low').length;

  let md = `# 温室育苗喷灌校准交接单

**生成时间**: ${now}

---

## 📊 总体概览

| 统计项 | 数量 |
|--------|------|
| 总苗床数 | ${totalBeds} |
| 高风险苗床 | ${highRiskBeds} |
| 中风险苗床 | ${mediumRiskBeds} |
| 低风险苗床 | ${lowRiskBeds} |

---

## 🌱 苗床详情

`;

  analyses.forEach(analysis => {
    const riskLevel = getOverallRiskLevel(analysis.risks);
    const riskEmoji = getRiskEmoji(riskLevel);
    
    md += `### ${riskEmoji} 苗床 ${analysis.bedId}

**种苗类型**: ${analysis.seedlingTypes.join(', ')}  
**苗盘数量**: ${analysis.trayCount} 盘  

#### 📈 状态数据

| 指标 | 当前值 | 目标值 | 状态 |
|------|--------|--------|------|
| 土壤湿度 | ${analysis.avgMoisture.toFixed(1)}% | ${analysis.targetMoisture.toFixed(1)}% | ${analysis.avgMoisture < analysis.targetMoisture ? '偏低' : analysis.avgMoisture > analysis.targetMoisture ? '偏高' : '正常'} |
| EC 值 | ${analysis.avgEc.toFixed(2)} mS/cm | ${analysis.targetEc.toFixed(2)} mS/cm | ${analysis.avgEc > analysis.targetEc ? '偏高' : '正常'} |

#### 💧 喷头状态

`;

    if (analysis.nozzles.length > 0) {
      analysis.nozzles.forEach(nozzleId => {
        const status = analysis.nozzleStatus[nozzleId] || 'normal';
        md += `- ${getStatusEmoji(status)} 喷头 ${nozzleId}: ${status === 'normal' ? '正常' : status === 'clogged' ? '堵塞' : '漏水'}\n`;
      });
    } else {
      md += `无喷头数据\n`;
    }

    if (analysis.risks.length > 0) {
      md += `\n#### ⚠️ 风险警告\n\n`;
      analysis.risks.forEach((risk: Risk) => {
        md += `${getRiskEmoji(risk.severity)} **${getRiskTypeDescription(risk.type)}**\n`;
        md += `   - 描述: ${risk.description}\n`;
        md += `   - 建议: ${risk.suggestion}\n\n`;
      });
    }

    if (analysis.suggestedWateringAmount > 0) {
      md += `\n#### 💧 建议用水量\n\n`;
      md += `- 建议补水量: ${analysis.suggestedWateringAmount.toFixed(1)} L\n`;
      md += `- 建议喷灌时长: ${analysis.suggestedWateringDuration} 秒\n\n`;
    }

    if (analysis.manualOverride?.isOverridden) {
      md += `\n#### 👷 人工改判\n\n`;
      md += `- 改判原因: ${analysis.manualOverride.overrideReason}\n`;
      md += `- 改判决定: ${getOverrideDecisionDescription(analysis.manualOverride.overrideDecision)}\n\n`;
    }

    if (analysis.notes) {
      md += `\n#### 📝 备注\n\n`;
      md += `${analysis.notes}\n\n`;
    }

    md += `---\n\n`;
  });

  md += `\n## 📋 交接信息

**数据来源**: ${state.isUsingSampleData ? '示例数据' : '导入数据'}  
**上次更新**: ${new Date(state.lastUpdated).toLocaleString('zh-CN')}

---

*此报告由温室育苗喷灌校准工具自动生成*
`;

  return md;
};

const getRiskTypeDescription = (type: string): string => {
  const descriptions: Record<string, string> = {
    'under_watering': '缺水警告',
    'over_watering': '过灌警告',
    'high_ec': 'EC 值偏高',
    'clogged_nozzle': '喷头堵塞',
    'multiple': '多种风险',
    'no_risk': '无风险'
  };
  return descriptions[type] || type;
};

const getOverrideDecisionDescription = (decision: string): string => {
  const descriptions: Record<string, string> = {
    'ignore': '忽略此风险',
    'mark_as_resolved': '标记为已解决',
    'assign_to_technician': '指派技术员处理'
  };
  return descriptions[decision] || decision;
};

export const generateJSONExport = (state: ApplicationState): string => {
  const exportData = {
    exportDate: new Date().toISOString(),
    isUsingSampleData: state.isUsingSampleData,
    data: {
      seedlingTrays: state.seedlingTrays,
      sensorData: state.sensorData,
      nozzleCalibrations: state.nozzleCalibrations,
      nutrientRecipes: state.nutrientRecipes,
      bedAnalyses: state.bedAnalyses
    },
    summary: {
      totalBeds: state.bedAnalyses.length,
      highRiskCount: state.bedAnalyses.filter(a => 
        a.risks.some(r => r.severity === 'high')
      ).length,
      mediumRiskCount: state.bedAnalyses.filter(a => 
        a.risks.some(r => r.severity === 'medium') && !a.risks.some(r => r.severity === 'high')
      ).length,
      lowRiskCount: state.bedAnalyses.filter(a => 
        a.risks.length === 0 || a.risks.every(r => r.severity === 'low')
      ).length
    }
  };
  
  return JSON.stringify(exportData, null, 2);
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
