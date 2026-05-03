import type { SimulationResult, ShootingSchedule, Risk, RiskType, TimePoint } from '../types';
import { formatTime, timeToMinutes } from './time';

export function exportToJSON(schedule: ShootingSchedule, result?: SimulationResult): string {
  const data = {
    schedule,
    simulation: result
      ? {
          config: result.config,
          allRisks: result.allRisks,
          isMidnightCrossing: result.isMidnightCrossing,
        }
      : undefined,
    exportedAt: new Date().toISOString(),
  };
  return JSON.stringify(data, null, 2);
}

function getRiskTypeLabel(type: RiskType): string {
  const labels: Record<RiskType, string> = {
    battery_critical: '电量危急',
    battery_low: '电量低',
    port_conflict: '充电口冲突',
    cross_scene_late: '跨场景延迟',
    simultaneous_use: '电池冲突',
    battery_depleted: '电量耗尽',
  };
  return labels[type] || type;
}

function getSeverityLabel(severity: string): string {
  const labels: Record<string, string> = {
    low: '低',
    medium: '中',
    high: '高',
    critical: '危急',
  };
  return labels[severity] || severity;
}

function getSeverityEmoji(severity: string): string {
  const emojis: Record<string, string> = {
    low: '🟢',
    medium: '🟡',
    high: '🟠',
    critical: '🔴',
  };
  return emojis[severity] || '⚪';
}

function sortRisksByTime(risks: Risk[]): Risk[] {
  return [...risks].sort((a, b) => {
    const timeA = timeToMinutes(a.time);
    const timeB = timeToMinutes(b.time);
    
    const aCrosses = a.type === 'simultaneous_use' || a.type === 'cross_scene_late';
    const bCrosses = b.type === 'simultaneous_use' || b.type === 'cross_scene_late';
    
    if (aCrosses && !bCrosses) return -1;
    if (!aCrosses && bCrosses) return 1;
    
    return timeA - timeB;
  });
}

function groupRisksByType(risks: Risk[]): Record<RiskType, Risk[]> {
  const grouped: Record<string, Risk[]> = {};
  for (const risk of risks) {
    if (!grouped[risk.type]) {
      grouped[risk.type] = [];
    }
    grouped[risk.type].push(risk);
  }
  return grouped as Record<RiskType, Risk[]>;
}

function generateRiskSummary(risks: Risk[]): {
  critical: number;
  high: number;
  medium: number;
  low: number;
} {
  const summary = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const risk of risks) {
    summary[risk.severity]++;
  }
  return summary;
}

export function generateRiskReport(result: SimulationResult): string {
  const { schedule, allRisks, isMidnightCrossing } = result;
  const sortedRisks = sortRisksByTime(allRisks);
  const groupedRisks = groupRisksByType(sortedRisks);
  const summary = generateRiskSummary(allRisks);
  const totalRisks = allRisks.length;

  const lines: string[] = [];

  lines.push(`# 电池轮换风险报告`);
  lines.push('');
  lines.push(`**拍摄计划**: ${schedule.name}`);
  lines.push(`**日期**: ${schedule.date}`);
  lines.push(`**生成时间**: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');

  lines.push('## 📊 风险概览');
  lines.push('');
  
  const total = summary.critical + summary.high + summary.medium + summary.low;
  if (total === 0) {
    lines.push('✅ **无风险** - 所有电池分配看起来很合理！');
  } else {
    lines.push(`| 严重程度 | 数量 |`);
    lines.push(`|----------|------|`);
    lines.push(`| 🔴 危急 | ${summary.critical} |`);
    lines.push(`| 🟠 高   | ${summary.high} |`);
    lines.push(`| 🟡 中   | ${summary.medium} |`);
    lines.push(`| 🟢 低   | ${summary.low} |`);
    lines.push(`| **总计** | **${total}** |`);
  }
  lines.push('');

  if (isMidnightCrossing) {
    lines.push('## ⚠️ 特殊情况');
    lines.push('');
    lines.push('🔄 **跨午夜拍摄** - 本次拍摄计划包含跨越午夜的场景。');
    lines.push('');
  }

  lines.push('## 📋 风险详情');
  lines.push('');

  const riskTypeOrder: RiskType[] = [
    'simultaneous_use',
    'battery_depleted',
    'battery_critical',
    'cross_scene_late',
    'battery_low',
    'port_conflict',
  ];

  for (const type of riskTypeOrder) {
    const risks = groupedRisks[type];
    if (!risks || risks.length === 0) continue;

    lines.push(`### ${getSeverityEmoji(risks[0].severity)} ${getRiskTypeLabel(type)} (${risks.length})`);
    lines.push('');

    for (const risk of risks) {
      lines.push(`**时间**: ${formatTime(risk.time)}`);
      lines.push(`**描述**: ${risk.description}`);
      
      if (risk.details && Object.keys(risk.details).length > 0) {
        lines.push('**详情**:');
        for (const [key, value] of Object.entries(risk.details)) {
          const displayKey = key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, (s) => s.toUpperCase());
          lines.push(`- ${displayKey}: ${JSON.stringify(value)}`);
        }
      }
      lines.push('');
    }
  }

  lines.push('## 🎬 场景列表');
  lines.push('');
  lines.push(`| 场景 | 时间 | 相机数 | 备注 |`);
  lines.push(`|------|------|--------|------|`);

  for (const scene of schedule.scenes) {
    const timeStr = `${formatTime(scene.timeRange.start)} - ${formatTime(scene.timeRange.end)}`;
    const crossesMidnight = timeToMinutes(scene.timeRange.start) > timeToMinutes(scene.timeRange.end);
    const displayTime = crossesMidnight ? `🔄 ${timeStr}` : timeStr;
    const notes = scene.notes || '-';
    lines.push(`| ${scene.name} | ${displayTime} | ${scene.cameras.length} | ${notes} |`);
  }
  lines.push('');

  lines.push('## 🔋 设备清单');
  lines.push('');

  lines.push('### 相机');
  lines.push(`| 名称 | 功耗/小时 | 兼容电池类型 |`);
  lines.push(`|------|-----------|--------------|`);
  for (const camera of schedule.cameras) {
    lines.push(`| ${camera.name} | ${camera.powerConsumption}% | ${camera.compatibleBatteryTypes.join(', ')} |`);
  }
  lines.push('');

  lines.push('### 电池');
  lines.push(`| 名称 | 类型 | 初始电量 | 容量 |`);
  lines.push(`|------|------|----------|------|`);
  for (const battery of schedule.batteries) {
    lines.push(`| ${battery.name} | ${battery.type} | ${battery.initialCharge}% | ${battery.capacity}% |`);
  }
  lines.push('');

  lines.push('### 充电器');
  lines.push(`| 名称 | 端口 | 充电速度 | 兼容电池 |`);
  lines.push(`|------|------|----------|----------|`);
  for (const charger of schedule.chargers) {
    for (const port of charger.ports) {
      lines.push(`| ${charger.name} | ${port.name} | ${port.chargingSpeed}%/小时 | ${port.compatibleBatteryTypes.join(', ')} |`);
    }
  }
  lines.push('');

  lines.push('---');
  lines.push('');
  lines.push('*此报告由电池轮换调度工具自动生成*');

  return lines.join('\n');
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadJSON(schedule: ShootingSchedule, result?: SimulationResult): void {
  const content = exportToJSON(schedule, result);
  const filename = `schedule-${schedule.id}-${Date.now()}.json`;
  downloadFile(content, filename, 'application/json');
}

export function downloadRiskReport(result: SimulationResult): void {
  const content = generateRiskReport(result);
  const filename = `risk_report-${result.schedule.id}-${Date.now()}.md`;
  downloadFile(content, filename, 'text/markdown');
}
