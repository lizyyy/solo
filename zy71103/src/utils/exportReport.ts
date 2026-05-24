import type { SceneData, ErrorItem } from '../types';

export const generateJSONReport = (sceneData: SceneData): string => {
  const report = {
    generatedAt: new Date().toISOString(),
    sceneName: sceneData.name,
    roomSize: sceneData.roomSize,
    summary: {
      totalElements: sceneData.elements.length,
      instrumentCarts: sceneData.elements.filter((e) => e.type === 'instrumentCart').length,
      sterileZones: sceneData.elements.filter((e) => e.type === 'sterileZone').length,
      recycleBins: sceneData.elements.filter((e) => e.type === 'recycleBin').length,
      staff: sceneData.elements.filter((e) => e.type === 'staff').length,
      totalErrors: sceneData.errors.length,
      criticalErrors: sceneData.errors.filter((e) => e.severity === 'error').length,
      warnings: sceneData.errors.filter((e) => e.severity === 'warning').length,
    },
    elements: sceneData.elements.map((e) => ({
      id: e.id,
      type: e.type,
      name: e.name,
      position: e.position,
    })),
    timeline: sceneData.timeline.map((step) => ({
      name: step.name,
      startTime: step.startTime,
      endTime: step.endTime,
      description: step.description,
    })),
    errors: sceneData.errors.map((e) => ({
      type: e.type,
      severity: e.severity,
      message: e.message,
      position: e.position,
      timestamp: e.timestamp,
    })),
  };

  return JSON.stringify(report, null, 2);
};

export const downloadJSON = (sceneData: SceneData, filename: string = 'report.json') => {
  const json = generateJSONReport(sceneData);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getErrorTypeLabel = (type: ErrorItem['type']): string => {
  switch (type) {
    case 'collision':
      return '器械车碰撞';
    case 'sterileCross':
      return '无菌区穿越';
    case 'routeCross':
      return '路径交叉';
    default:
      return type;
  }
};

export const generateTextReport = (sceneData: SceneData): string => {
  const errors = sceneData.errors;
  const criticalErrors = errors.filter((e) => e.severity === 'error');
  const warnings = errors.filter((e) => e.severity === 'warning');

  let report = `
═══════════════════════════════════════════════
          手术室器械动线排布报告
═══════════════════════════════════════════════

生成时间: ${new Date().toLocaleString('zh-CN')}
场景名称: ${sceneData.name}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【场景概览】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

手术间尺寸: ${sceneData.roomSize.width}m × ${sceneData.roomSize.depth}m

元素统计:
  • 器械车: ${sceneData.elements.filter((e) => e.type === 'instrumentCart').length} 台
  • 无菌区: ${sceneData.elements.filter((e) => e.type === 'sterileZone').length} 处
  • 回收桶: ${sceneData.elements.filter((e) => e.type === 'recycleBin').length} 个
  • 人员角色: ${sceneData.elements.filter((e) => e.type === 'staff').length} 人

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【检测结果】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

总问题数: ${errors.length}
  • 严重错误: ${criticalErrors.length} 项
  • 警告: ${warnings.length} 项

`;

  if (criticalErrors.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【严重错误】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    criticalErrors.forEach((e, i) => {
      report += `${i + 1}. [${getErrorTypeLabel(e.type)}] ${e.message}\n`;
      if (e.timestamp !== undefined) {
        report += `   发生时间: ${e.timestamp.toFixed(1)}秒\n`;
      }
      report += '\n';
    });
  }

  if (warnings.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【警告提示】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    warnings.forEach((e, i) => {
      report += `${i + 1}. [${getErrorTypeLabel(e.type)}] ${e.message}\n`;
      if (e.timestamp !== undefined) {
        report += `   发生时间: ${e.timestamp.toFixed(1)}秒\n`;
      }
      report += '\n';
    });
  }

  if (sceneData.timeline.length > 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【时间轴步骤】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    sceneData.timeline.forEach((step, i) => {
      report += `${i + 1}. ${step.name}\n`;
      report += `   时间: ${step.startTime.toFixed(1)}s - ${step.endTime.toFixed(1)}s\n`;
      report += `   说明: ${step.description}\n\n`;
    });
  }

  if (errors.length === 0) {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【评估结论】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✓ 动线排布符合规范，未检测到违规问题。
  可以用于培训演示。

`;
  } else {
    report += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
【评估结论】
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠ 存在 ${errors.length} 项问题需要整改。
  请根据上述错误提示调整布局和路径。

`;
  }

  report += `
═══════════════════════════════════════════════
                  报告结束
═══════════════════════════════════════════════
`;

  return report;
};

export const downloadTextReport = (sceneData: SceneData, filename: string = 'report.txt') => {
  const text = generateTextReport(sceneData);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
