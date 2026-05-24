import type { TrainingSession, CalculationResult } from '../types';

export const generateReportJSON = (session: TrainingSession): string => {
  const report = {
    id: session.id,
    basicInfo: {
      buildingName: session.buildingName,
      startTime: new Date(session.startTime).toLocaleString('zh-CN'),
      endTime: new Date(session.endTime).toLocaleString('zh-CN'),
      duration: Math.round((session.endTime - session.startTime) / 1000) + '秒',
    },
    path: {
      nodeCount: session.path.length,
      nodes: session.path.map((n) => ({
        type: n.type,
        position: n.position,
        time: new Date(n.timestamp).toLocaleTimeString('zh-CN'),
      })),
    },
    parameters: {
      hoseDiameter: session.params.hoseDiameter + 'mm',
      maxHoseLength: session.params.maxHoseLength + 'm',
      maxCorners: session.params.maxCorners + '个',
      minPressure: session.params.minPressure + 'MPa',
      flowRate: session.params.flowRate + 'L/s',
    },
    results: {
      totalLength: session.result.totalLength.toFixed(2) + 'm',
      cornerCount: session.result.cornerCount + '个',
      stairCount: session.result.stairCount + '处',
      verticalHeight: session.result.verticalHeight.toFixed(2) + 'm',
      pressureLoss: session.result.pressureLoss.toFixed(3) + 'MPa',
      remainingPressure: session.result.remainingPressure.toFixed(3) + 'MPa',
      initialPressure: session.result.initialPressure.toFixed(3) + 'MPa',
      isValid: session.result.isValid ? '合格' : '不合格',
    },
    warnings: session.result.warnings.map((w) => ({
      type: w.type,
      severity: w.severity,
      message: w.message,
    })),
    pressureCurve: session.result.pressureCurve.map((p) => ({
      distance: p.distance + 'm',
      pressure: p.pressure.toFixed(3) + 'MPa',
      nodeType: p.nodeType,
    })),
  };

  return JSON.stringify(report, null, 2);
};

export const downloadReport = (session: TrainingSession): void => {
  const json = generateReportJSON(session);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `消防水带演练报告_${session.buildingName}_${new Date(session.startTime).toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getReportSummary = (result: CalculationResult): string => {
  const lines = [];
  lines.push('=== 消防水带铺设演练评估报告 ===\n');
  lines.push(`总长度: ${result.totalLength.toFixed(2)}m`);
  lines.push(`转角数量: ${result.cornerCount}个`);
  lines.push(`垂直高度: ${result.verticalHeight.toFixed(2)}m`);
  lines.push(`压力损失: ${result.pressureLoss.toFixed(3)}MPa`);
  lines.push(`剩余压力: ${result.remainingPressure.toFixed(3)}MPa`);
  lines.push(`评估结果: ${result.isValid ? '✅ 合格' : '❌ 不合格'}`);

  if (result.warnings.length > 0) {
    lines.push('\n--- 警告信息 ---');
    result.warnings.forEach((w) => {
      const icon = w.severity === 'error' ? '❌' : '⚠️';
      lines.push(`${icon} ${w.message}`);
    });
  }

  return lines.join('\n');
};
