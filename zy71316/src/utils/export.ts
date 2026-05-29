import { SimulationResult, SimulationParams, TraceRecord } from '../types';

const formatDate = (date: Date): string => {
  const yyyy = date.getFullYear().toString();
  const mm = (date.getMonth() + 1).toString().padStart(2, '0');
  const dd = date.getDate().toString().padStart(2, '0');
  const hh = date.getHours().toString().padStart(2, '0');
  const min = date.getMinutes().toString().padStart(2, '0');
  const ss = date.getSeconds().toString().padStart(2, '0');
  return `${yyyy}${mm}${dd}_${hh}${min}${ss}`;
};

export const generateFileName = (batchId: string, format: 'json' | 'csv'): string => {
  const timestamp = formatDate(new Date());
  return `火星降落伞试算报告_${batchId}_${timestamp}.${format}`;
};

export const exportToJSON = (result: SimulationResult): string => {
  const data = {
    batchId: result.params.batchId,
    operator: result.params.operator,
    timestamp: result.params.timestamp,
    finalVelocity: result.finalVelocity,
    totalTime: result.totalTime,
    landedSafely: result.landedSafely,
    params: {
      probeMass: result.params.probeMass,
      probeMassSource: result.params.probeMassSource,
      parachuteArea: result.params.parachuteArea,
      parachuteAreaSource: result.params.parachuteAreaSource,
      deploymentAltitude: result.params.deploymentAltitude,
      deploymentAltitudeSource: result.params.deploymentAltitudeSource,
      atmosphericDensity: result.params.atmosphericDensity,
      atmosphericDensitySource: result.params.atmosphericDensitySource,
      initialVelocity: result.params.initialVelocity,
      initialVelocitySource: result.params.initialVelocitySource,
      initialAltitude: result.params.initialAltitude,
      initialAltitudeSource: result.params.initialAltitudeSource,
    },
    risks: result.risks,
    trajectory: result.trajectory.map(p => ({
      time: p.time.toFixed(2),
      altitude: p.altitude.toFixed(2),
      velocity: p.velocity.toFixed(2),
      acceleration: p.acceleration.toFixed(4),
      dragForce: p.dragForce.toFixed(2),
      parachuteDeployed: p.parachuteDeployed,
      risks: p.risks
    }))
  };
  return JSON.stringify(data, null, 2);
};

export const exportToCSV = (result: SimulationResult): string => {
  const headers = [
    '批次号', result.params.batchId,
    '操作人员', result.params.operator,
    '模拟时间', new Date(result.params.timestamp).toLocaleString(),
    '最终速度(m/s)', result.finalVelocity.toFixed(2),
    '总时间(s)', result.totalTime.toFixed(2),
    '是否安全着陆', result.landedSafely ? '是' : '否',
    '', '',
    '=== 参数来源信息', '',
    '参数', '数值', '单位', '来源文档', '版本', '提供方', '备注',
    '探测器质量', result.params.probeMass, 'kg', 
      result.params.probeMassSource.documentName,
      result.params.probeMassSource.documentVersion,
      result.params.probeMassSource.provider,
      result.params.probeMassSource.remarks,
    '伞面积', result.params.parachuteArea, 'm²',
      result.params.parachuteAreaSource.documentName,
      result.params.parachuteAreaSource.documentVersion,
      result.params.parachuteAreaSource.provider,
      result.params.parachuteAreaSource.remarks,
    '开伞高度', result.params.deploymentAltitude, 'm',
      result.params.deploymentAltitudeSource.documentName,
      result.params.deploymentAltitudeSource.documentVersion,
      result.params.deploymentAltitudeSource.provider,
      result.params.deploymentAltitudeSource.remarks,
    '大气密度', result.params.atmosphericDensity, 'kg/m³',
      result.params.atmosphericDensitySource.documentName,
      result.params.atmosphericDensitySource.documentVersion,
      result.params.atmosphericDensitySource.provider,
      result.params.atmosphericDensitySource.remarks,
    '初始速度', result.params.initialVelocity, 'm/s',
      result.params.initialVelocitySource.documentName,
      result.params.initialVelocitySource.documentVersion,
      result.params.initialVelocitySource.provider,
      result.params.initialVelocitySource.remarks,
    '初始高度', result.params.initialAltitude, 'm',
      result.params.initialAltitudeSource.documentName,
      result.params.initialAltitudeSource.documentVersion,
      result.params.initialAltitudeSource.provider,
      result.params.initialAltitudeSource.remarks,
    '', '',
    '=== 风险点汇总', '',
    '风险类型', '描述', '影响', '缓解措施',
    ...result.risks.map(r => [
      r.riskType, '', '', '']).flat(),
    '', '',
    '=== 轨迹数据', '',
    '时间(s)', '高度(m)', '速度(m/s)', '加速度(m/s²)', '阻力(N)', '降落伞展开', '风险标记',
  ].join(',');

  const trajectoryRows = result.trajectory.map(p => [
    p.time.toFixed(2),
    p.altitude.toFixed(2),
    p.velocity.toFixed(2),
    p.acceleration.toFixed(4),
    p.dragForce.toFixed(2),
    p.parachuteDeployed ? '是' : '否',
    p.risks.join(';') || '-'
  ].join(','));

  return [headers, ...trajectoryRows].join('\n');
};

export const downloadFile = (content: string, filename: string, mimeType: string) => {
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

export const downloadJSON = (result: SimulationResult) => {
  const content = exportToJSON(result);
  const filename = generateFileName(result.params.batchId, 'json');
  downloadFile(content, filename, 'application/json');
};

export const downloadCSV = (result: SimulationResult) => {
  const content = exportToCSV(result);
  const filename = generateFileName(result.params.batchId, 'csv');
  downloadFile(content, filename, 'text/csv;charset=utf-8');
};
