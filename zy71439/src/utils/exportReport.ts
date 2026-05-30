import { TrainingRecord, BearingData, PositionMark, SelectedRoute, Scenario, Lighthouse, TriangleData, GeoPoint } from '../types';
import { formatDateTime, formatDistance, getStatusLabel, getRiskLabel, getDifficultyLabel, getOperationTypeLabel } from './formatters';
import { formatBearingDMS, formatBearingDecimal, dmsToDecimal, decimalToDMS } from './bearingConversion';
import { LIGHTHOUSES } from '../data/lighthouses';
import { getScenarioById } from '../data/scenarios';

export interface ReportData {
  record: TrainingRecord;
  scenario: Scenario | undefined;
  lighthouses: Lighthouse[];
  bearings: Record<string, BearingData>;
  positionMark: PositionMark | null;
  selectedRoute: SelectedRoute | null;
  triangleData: TriangleData | null;
  estimatedPosition: GeoPoint | null;
  finalError: number | null;
}

export function generateHTMLReport(data: ReportData): string {
  const { record, scenario, lighthouses, bearings, positionMark, selectedRoute, triangleData, estimatedPosition, finalError } = data;

  const lighthouseData = lighthouses.map(lh => ({
    ...lh,
    bearing: bearings[lh.id]
  }));

  const hasUnitErrors = Object.values(bearings).some(b => b.hasUnitError);

  return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>海上救援三角定位训练报告 - ${record.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Source Sans Pro', -apple-system, BlinkMacSystemFont, sans-serif; padding: 40px; background: #f5f5f5; color: #1a1a2e; }
    .report-container { max-width: 900px; margin: 0 auto; background: white; padding: 50px; border-radius: 8px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
    .header { border-bottom: 3px solid #0A2463; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-family: 'Playfair Display', serif; font-size: 28px; color: #0A2463; margin-bottom: 10px; }
    .header .meta { display: flex; gap: 30px; font-size: 14px; color: #666; }
    .section { margin-bottom: 30px; }
    .section h2 { font-size: 18px; color: #0A2463; margin-bottom: 15px; padding-left: 10px; border-left: 4px solid #0A2463; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .info-item { display: flex; justify-content: space-between; padding: 10px; background: #f8f9fa; border-radius: 4px; }
    .info-item .label { font-weight: 600; color: #495057; }
    .info-item .value { color: #1a1a2e; }
    .status-badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    .status-pending { background: #fff3cd; color: #856404; }
    .status-approved { background: #d4edda; color: #155724; }
    .status-returned { background: #f8d7da; color: #721c24; }
    .error-badge { background: #f8d7da; color: #721c24; padding: 2px 8px; border-radius: 4px; font-size: 11px; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th, td { padding: 12px; text-align: left; border-bottom: 1px solid #dee2e6; }
    th { background: #f8f9fa; font-weight: 600; color: #0A2463; }
    tr:hover { background: #f8f9fa; }
    .timeline { border-left: 2px solid #dee2e6; margin-left: 10px; padding-left: 20px; }
    .timeline-item { position: relative; padding: 15px 0; }
    .timeline-item::before { content: ''; position: absolute; left: -27px; top: 20px; width: 12px; height: 12px; border-radius: 50%; background: #0A2463; border: 2px solid white; box-shadow: 0 0 0 2px #0A2463; }
    .timeline-time { font-size: 12px; color: #6c757d; }
    .timeline-type { font-weight: 600; color: #0A2463; }
    .timeline-detail { color: #495057; margin-top: 4px; }
    .source-note { font-size: 12px; color: #6c757d; font-style: italic; }
    .data-trace { background: #fff3cd; padding: 8px; border-radius: 4px; margin-top: 5px; font-size: 12px; }
    .footer { margin-top: 50px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; font-size: 12px; color: #6c757d; }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="header">
      <h1>🚢 海上救援三角定位训练报告</h1>
      <div class="meta">
        <span>报告编号：${record.id}</span>
        <span>生成时间：${formatDateTime(new Date())}</span>
      </div>
    </div>

    <div class="section">
      <h2>📋 基本信息</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">学员姓名</span>
          <span class="value">${record.traineeName}</span>
        </div>
        <div class="info-item">
          <span class="label">训练场景</span>
          <span class="value">${scenario?.name || '未知'}</span>
        </div>
        <div class="info-item">
          <span class="label">难度等级</span>
          <span class="value">${scenario ? getDifficultyLabel(scenario.difficulty) : '未知'}</span>
        </div>
        <div class="info-item">
          <span class="label">当前状态</span>
          <span class="status-badge ${record.workflow.status === 'pending' ? 'status-pending' : record.workflow.status === 'approved' ? 'status-approved' : 'status-returned'}">
            ${getStatusLabel(record.workflow.status)}
          </span>
        </div>
        <div class="info-item">
          <span class="label">开始时间</span>
          <span class="value">${formatDateTime(new Date(record.startTime))}</span>
        </div>
        <div class="info-item">
          <span class="label">完成时间</span>
          <span class="value">${record.endTime ? formatDateTime(new Date(record.endTime)) : '未完成'}</span>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>🗼 灯塔方位角数据</h2>
      ${hasUnitErrors ? '<p><span class="error-badge">⚠️ 存在单位错误标记</span></p>' : ''}
      <table>
        <thead>
          <tr>
            <th>灯塔名称</th>
            <th>坐标位置</th>
            <th>信号特征</th>
            <th>输入方位角</th>
            <th>单位</th>
            <th>数据溯源</th>
          </tr>
        </thead>
        <tbody>
          ${lighthouseData.map(lh => `
            <tr>
              <td style="color: ${lh.color}; font-weight: 600;">${lh.name}</td>
              <td>${lh.position.lat.toFixed(4)}°N, ${lh.position.lng.toFixed(4)}°E</td>
              <td>${lh.signal}</td>
              <td>
                ${lh.bearing
                  ? (lh.bearing.unit === 'dms'
                    ? formatBearingDMS({ degrees: lh.bearing.degrees, minutes: lh.bearing.minutes, seconds: lh.bearing.seconds })
                    : formatBearingDecimal(lh.bearing.decimalDegrees))
                  : '未输入'
                }
                ${lh.bearing?.hasUnitError ? '<span class="error-badge">单位错误</span>' : ''}
              </td>
              <td>${lh.bearing?.unit === 'dms' ? '度分秒' : '十进制度'}</td>
              <td>
                ${lh.bearing
                  ? `<div class="source-note">输入时间：${formatDateTime(new Date(lh.bearing.inputTime))}<br>来源：${lh.bearing.source}</div>
                     ${lh.bearing.modifyHistory.length > 0
                        ? `<div class="data-trace">修改记录：${lh.bearing.modifyHistory.length}次<br>
                           ${lh.bearing.modifyHistory.map((h, i) =>
                             `第${i + 1}次：${formatDateTime(new Date(h.timestamp))} ${h.oldValue.toFixed(2)}° → ${h.newValue.toFixed(2)}°`
                           ).join('<br>')}
                          </div>`
                        : ''
                     }`
                  : '-'
                }
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h2>📍 定位结果</h2>
      <div class="info-grid">
        <div class="info-item">
          <span class="label">估算位置</span>
          <span class="value">${estimatedPosition ? `${estimatedPosition.lat.toFixed(4)}°N, ${estimatedPosition.lng.toFixed(4)}°E` : '未计算'}</span>
        </div>
        <div class="info-item">
          <span class="label">标注位置</span>
          <span class="value">${positionMark ? `${positionMark.position.lat.toFixed(4)}°N, ${positionMark.position.lng.toFixed(4)}°E` : '未标注'}</span>
        </div>
        <div class="info-item">
          <span class="label">真实位置</span>
          <span class="value">${scenario ? `${scenario.trueShipPosition.lat.toFixed(4)}°N, ${scenario.trueShipPosition.lng.toFixed(4)}°E` : '未知'}</span>
        </div>
        <div class="info-item">
          <span class="label">定位误差</span>
          <span class="value">${finalError !== null ? formatDistance(finalError) : '未计算'}</span>
        </div>
        ${triangleData ? `
          <div class="info-item">
            <span class="label">误差三角形面积</span>
            <span class="value">${triangleData.area.toFixed(6)}</span>
          </div>
          <div class="info-item">
            <span class="label">精度等级</span>
            <span class="value">${triangleData.errorLevel === 'excellent' ? '优秀' : triangleData.errorLevel === 'good' ? '良好' : triangleData.errorLevel === 'fair' ? '一般' : '较差'}</span>
          </div>
        ` : ''}
      </div>
    </div>

    <div class="section">
      <h2>🚤 救援路线选择</h2>
      ${selectedRoute ? `
        <div class="info-grid">
          <div class="info-item">
            <span class="label">选择路线</span>
            <span class="value">${selectedRoute.routeId === 'route-direct' ? '直达航线' : selectedRoute.routeId === 'route-safety' ? '安全航线' : '快速航线'}</span>
          </div>
          <div class="info-item">
            <span class="label">选择时间</span>
            <span class="value">${formatDateTime(new Date(selectedRoute.selectedTime))}</span>
          </div>
        </div>
        <div style="margin-top: 15px; padding: 15px; background: #f8f9fa; border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 8px;">决策说明：</div>
          <div>${selectedRoute.decisionReason}</div>
        </div>
      ` : '<p>未选择救援路线</p>'}
    </div>

    <div class="section">
      <h2>📝 操作时间线</h2>
      <div class="timeline">
        ${record.operations.map(op => `
          <div class="timeline-item">
            <div class="timeline-time">${formatDateTime(new Date(op.timestamp))} | 操作人：${op.operator}</div>
            <div class="timeline-type">${getOperationTypeLabel(op.actionType)}</div>
            <div class="timeline-detail">${op.actionDetail}</div>
          </div>
        `).join('')}
      </div>
    </div>

    ${record.workflow.reviewComment ? `
      <div class="section">
        <h2>💬 复核意见</h2>
        <div style="padding: 15px; background: ${record.workflow.status === 'approved' ? '#d4edda' : '#f8d7da'}; border-radius: 4px;">
          <div style="font-weight: 600; margin-bottom: 8px;">
            ${record.workflow.status === 'approved' ? '✅ 复核通过' : '❌ 退回补材料'}
            ${record.workflow.reviewTime ? ` - ${formatDateTime(new Date(record.workflow.reviewTime))}` : ''}
          </div>
          <div>${record.workflow.reviewComment}</div>
        </div>
      </div>
    ` : ''}

    <div class="footer">
      <p>本报告由海上救援三角定位训练系统自动生成</p>
      <p>报告编号：${record.id} | 生成时间：${formatDateTime(new Date())}</p>
    </div>
  </div>
</body>
</html>
  `;
}

export function downloadReport(reportHTML: string, filename: string): void {
  const blob = new Blob([reportHTML], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportRecordToJSON(data: ReportData): string {
  return JSON.stringify(data, null, 2);
}

export function prepareReportData(
  record: TrainingRecord,
  bearings: Record<string, BearingData>,
  positionMark: PositionMark | null,
  selectedRoute: SelectedRoute | null,
  triangleData: TriangleData | null,
  estimatedPosition: GeoPoint | null,
  finalError: number | null
): ReportData {
  const scenario = getScenarioById(record.scenarioId);
  const lighthouses = scenario
    ? LIGHTHOUSES.filter(lh => scenario.lighthouseIds.includes(lh.id))
    : [];

  return {
    record,
    scenario,
    lighthouses,
    bearings,
    positionMark,
    selectedRoute,
    triangleData,
    estimatedPosition,
    finalError
  };
}

export async function exportHTMLReport(
  record: TrainingRecord,
  scenario: Scenario,
  lighthouses: Lighthouse[]
): Promise<void> {
  const bearings = (record as any).bearings || {};
  const positionMark = (record as any).positionMark || null;
  const selectedRoute = (record as any).selectedRoute || null;
  const triangleData = (record as any).triangleData || null;
  const estimatedPosition = (record as any).estimatedPosition || null;
  const finalError = record.finalError !== undefined ? record.finalError : null;

  const reportData: ReportData = {
    record,
    scenario,
    lighthouses,
    bearings,
    positionMark,
    selectedRoute,
    triangleData,
    estimatedPosition,
    finalError
  };

  const html = generateHTMLReport(reportData);
  const filename = `三角定位训练报告-${record.traineeName}-${new Date().toISOString().slice(0, 10)}.html`;
  downloadReport(html, filename);
}
