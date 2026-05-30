import type { BalloonParams, LaunchWindowResult, ExportReport, ExperimentRecord } from '../types';

export function generateReport(params: BalloonParams, result: LaunchWindowResult): ExportReport {
  const statusText = {
    safe: '安全，可以升空',
    warning: '有风险，谨慎操作',
    danger: '危险，禁止升空',
    unknown: '数据不足，无法判断',
  };

  return {
    experimentName: params.experimentName || '未命名实验',
    timestamp: result.timestamp.toLocaleString('zh-CN'),
    parameters: {
      temperature: params.temperature !== null ? `${params.temperature} ${params.temperatureUnit || '°C'}` : '未填写',
      payload: params.payload !== null ? `${params.payload} ${params.payloadUnit || 'kg'}` : '未填写',
      windSpeed: params.windSpeed !== null ? `${params.windSpeed} ${params.windSpeedUnit || 'm/s'}` : '未填写',
      balloonVolume: params.balloonVolume !== null ? `${params.balloonVolume} ${params.volumeUnit || 'm³'}` : '未填写',
      safetyNotes: params.safetyNotes || '无',
    },
    launchStatus: statusText[result.status],
    buoyancyCalculation: result.buoyancy ? {
      buoyantForce: `${result.buoyancy.buoyantForce.toFixed(1)} N`,
      netLift: `${result.buoyancy.netLift.toFixed(1)} N`,
      airDensity: `${result.buoyancy.airDensity.toFixed(3)} kg/m³`,
    } : null,
    issues: {
      errors: result.errors.map(e => `[${e.step}] ${e.message}${e.actualValue ? ` (实际: ${e.actualValue})` : ''}`),
      warnings: result.warnings.map(w => `[${w.step}] ${w.message}${w.actualValue ? ` (实际: ${w.actualValue})` : ''}`),
    },
    recommendations: result.recommendations,
    conclusion: result.canLaunch 
      ? '本次实验条件满足升空要求，请在专业人员指导下进行操作。' 
      : '本次实验不满足升空条件，请根据上述问题调整参数后重试。',
  };
}

export function exportToJson(report: ExportReport): string {
  return JSON.stringify(report, null, 2);
}

export function exportToText(report: ExportReport): string {
  let text = '=' .repeat(50) + '\n';
  text += '        热气球升空实验报告\n';
  text += '='.repeat(50) + '\n\n';
  
  text += `实验名称: ${report.experimentName}\n`;
  text += `检测时间: ${report.timestamp}\n\n`;
  
  text += '-'.repeat(40) + '\n';
  text += '【参数记录】\n';
  text += '-'.repeat(40) + '\n';
  text += `  气温: ${report.parameters.temperature}\n`;
  text += `  载重: ${report.parameters.payload}\n`;
  text += `  风速: ${report.parameters.windSpeed}\n`;
  text += `  气囊体积: ${report.parameters.balloonVolume}\n`;
  text += `  安全备注: ${report.parameters.safetyNotes}\n\n`;
  
  text += '-'.repeat(40) + '\n';
  text += `【升空状态】 ${report.launchStatus}\n`;
  text += '-'.repeat(40) + '\n\n';
  
  if (report.buoyancyCalculation) {
    text += '【浮力计算】\n';
    text += `  浮力: ${report.buoyancyCalculation.buoyantForce}\n`;
    text += `  净升力: ${report.buoyancyCalculation.netLift}\n`;
    text += `  空气密度: ${report.buoyancyCalculation.airDensity}\n\n`;
  }
  
  if (report.issues.errors.length > 0) {
    text += '【问题清单 - 错误】\n';
    report.issues.errors.forEach((err, i) => {
      text += `  ${i + 1}. ${err}\n`;
    });
    text += '\n';
  }
  
  if (report.issues.warnings.length > 0) {
    text += '【问题清单 - 警告】\n';
    report.issues.warnings.forEach((warn, i) => {
      text += `  ${i + 1}. ${warn}\n`;
    });
    text += '\n';
  }
  
  if (report.recommendations.length > 0) {
    text += '【操作建议】\n';
    report.recommendations.forEach((rec, i) => {
      text += `  ${i + 1}. ${rec}\n`;
    });
    text += '\n';
  }
  
  text += '-'.repeat(40) + '\n';
  text += '【结论】\n';
  text += report.conclusion + '\n';
  text += '='.repeat(50) + '\n';
  
  return text;
}

export function downloadFile(content: string, filename: string, type: string = 'text/plain') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function saveToLocalStorage(record: ExperimentRecord) {
  const existing = localStorage.getItem('balloonExperiments');
  const records: ExperimentRecord[] = existing ? JSON.parse(existing) : [];
  records.unshift(record);
  if (records.length > 50) {
    records.pop();
  }
  localStorage.setItem('balloonExperiments', JSON.stringify(records));
}

export function loadFromLocalStorage(): ExperimentRecord[] {
  const existing = localStorage.getItem('balloonExperiments');
  return existing ? JSON.parse(existing) : [];
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
