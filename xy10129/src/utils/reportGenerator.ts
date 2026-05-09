import { PathPlan, YardConfig, ValidationResult, ReportData, PathWaypoint, PathSegment } from '../types';

export const generateReportData = (
  planName: string,
  pathPlan: PathPlan,
  yard: YardConfig,
  validation: ValidationResult
): ReportData => {
  const coordinates = pathPlan.waypoints.map((wp: PathWaypoint, idx: number) => ({
    index: idx + 1,
    type: wp.type,
    x: Number(wp.position.x.toFixed(4)),
    y: Number(wp.position.y.toFixed(4)),
    z: Number(wp.position.z.toFixed(4))
  }));

  const segments = pathPlan.segments.map((seg: PathSegment, idx: number) => {
    const fromWp = pathPlan.waypoints.find(w => w.id === seg.from);
    const toWp = pathPlan.waypoints.find(w => w.id === seg.to);
    return {
      index: idx + 1,
      from: fromWp ? `航点${pathPlan.waypoints.indexOf(fromWp) + 1}` : seg.from,
      to: toWp ? `航点${pathPlan.waypoints.indexOf(toWp) + 1}` : seg.to,
      distance: Number(seg.distance.toFixed(4))
    };
  });

  const forbiddenZoneViolations = validation.errors
    .filter(e => e.type === 'forbidden' && e.zoneId)
    .map(e => {
      const zone = yard.forbiddenZones.find(z => z.id === e.zoneId);
      return zone ? zone.name : e.zoneId!;
    })
    .filter((v, i, a) => a.indexOf(v) === i);

  const collisionZones = validation.errors
    .filter(e => e.type === 'collision')
    .map(e => e.message.match(/货位 "([^"]+)"/)?.[1] || e.message)
    .filter((v, i, a) => a.indexOf(v) === i);

  const visitedZones = pathPlan.waypoints
    .map(wp => {
      const slot = yard.slots.find(s => 
        Math.abs(wp.position.x - s.position.x) < s.width / 2 + 2 &&
        Math.abs(wp.position.z - s.position.z) < s.length / 2 + 2
      );
      return slot?.name;
    })
    .filter(Boolean) as string[];

  return {
    planName,
    generatedAt: new Date().toLocaleString('zh-CN'),
    totalDistance: Number(pathPlan.totalDistance.toFixed(4)),
    waypointCount: pathPlan.waypoints.length,
    segmentCount: pathPlan.segments.length,
    coordinates,
    segments,
    validation: {
      isValid: validation.isValid,
      errorCount: validation.errors.filter(e => e.severity === 'error').length,
      warningCount: validation.warnings.length,
      errors: validation.errors.map(e => ({
        type: e.type,
        severity: e.severity,
        message: e.message,
        position: e.position ? `(${e.position.x.toFixed(2)}, ${e.position.y.toFixed(2)}, ${e.position.z.toFixed(2)})` : undefined
      })),
      warnings: validation.warnings.map(w => ({
        type: w.type,
        message: w.message
      }))
    },
    zoneAnalysis: {
      visitedZones: [...new Set(visitedZones)],
      forbiddenZoneViolations,
      collisionZones
    }
  };
};

export const generateTextReport = (data: ReportData): string => {
  const lines: string[] = [];
  
  lines.push('='.repeat(60));
  lines.push('堆场装卸路径规划报告');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`方案名称: ${data.planName}`);
  lines.push(`生成时间: ${data.generatedAt}`);
  lines.push('');
  
  lines.push('-'.repeat(40));
  lines.push('路径概览');
  lines.push('-'.repeat(40));
  lines.push(`总距离: ${data.totalDistance.toFixed(2)} 米`);
  lines.push(`航点数量: ${data.waypointCount}`);
  lines.push(`路径段数: ${data.segmentCount}`);
  lines.push('');
  
  lines.push('-'.repeat(40));
  lines.push('坐标信息');
  lines.push('-'.repeat(40));
  data.coordinates.forEach((coord, i) => {
    lines.push(`[${i + 1}] ${coord.type.toUpperCase()} (${coord.x}, ${coord.y}, ${coord.z})`);
  });
  lines.push('');
  
  lines.push('-'.repeat(40));
  lines.push('路径分段');
  lines.push('-'.repeat(40));
  data.segments.forEach((seg, i) => {
    lines.push(`[${i + 1}] ${seg.from} -> ${seg.to}: ${seg.distance.toFixed(2)}m`);
  });
  lines.push('');
  
  lines.push('-'.repeat(40));
  lines.push('验证结果');
  lines.push('-'.repeat(40));
  lines.push(`状态: ${data.validation.isValid ? '通过' : '未通过'}`);
  lines.push(`错误数: ${data.validation.errorCount}`);
  lines.push(`警告数: ${data.validation.warningCount}`);
  
  if (data.validation.errors.length > 0) {
    lines.push('');
    lines.push('错误详情:');
    data.validation.errors.forEach((e, i) => {
      lines.push(`  [${i + 1}] [${e.severity.toUpperCase()}] ${e.type}: ${e.message}`);
      if (e.position) lines.push(`       位置: ${e.position}`);
    });
  }
  
  if (data.validation.warnings.length > 0) {
    lines.push('');
    lines.push('警告详情:');
    data.validation.warnings.forEach((w, i) => {
      lines.push(`  [${i + 1}] ${w.type}: ${w.message}`);
    });
  }
  
  lines.push('');
  lines.push('-'.repeat(40));
  lines.push('区域分析');
  lines.push('-'.repeat(40));
  if (data.zoneAnalysis.visitedZones.length > 0) {
    lines.push(`经过货位: ${data.zoneAnalysis.visitedZones.join(', ')}`);
  }
  if (data.zoneAnalysis.forbiddenZoneViolations.length > 0) {
    lines.push(`禁行区违规: ${data.zoneAnalysis.forbiddenZoneViolations.join(', ')}`);
  }
  if (data.zoneAnalysis.collisionZones.length > 0) {
    lines.push(`碰撞区域: ${data.zoneAnalysis.collisionZones.join(', ')}`);
  }
  
  lines.push('');
  lines.push('='.repeat(60));
  
  return lines.join('\n');
};

export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const downloadReport = (data: ReportData): void => {
  const textReport = generateTextReport(data);
  const jsonReport = JSON.stringify(data, null, 2);
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  
  downloadFile(textReport, `路径报告_${data.planName}_${timestamp}.txt`, 'text/plain');
  downloadFile(jsonReport, `路径报告_${data.planName}_${timestamp}.json`, 'application/json');
};
