import {
  PayloadPlan,
  FaultRecord,
  OrbitElement,
  Anomaly,
  AuditLog,
  StateSnapshot,
  TimeSystem
} from '../types';
import { calculateSHA256 } from './hash';
import { formatTimeWithSystem, parseTimeWithSystem } from './timeConverter';
import { calculateDailyBudget } from './budgetCalculator';
import { parseAnomalyReason, getAnomalyTypeLabel, getAnomalySeverityLabel } from './anomalyDetector';

export interface BriefingResult {
  content: string;
  hash: string;
}

function padRight(str: string, length: number): string {
  if (str.length >= length) return str.substring(0, length);
  return str + ' '.repeat(length - str.length);
}

function padLeft(str: string, length: number): string {
  if (str.length >= length) return str.substring(0, length);
  return ' '.repeat(length - str.length) + str;
}

function formatNumber(num: number, decimals: number = 1): string {
  return num.toFixed(decimals);
}

export async function generateBriefing(
  date: string,
  payloadPlans: PayloadPlan[],
  faultRecords: FaultRecord[],
  orbitElements: OrbitElement[],
  anomalies: Anomaly[],
  auditLogs: AuditLog[],
  displayTimeSystem: TimeSystem
): Promise<BriefingResult> {
  const budget = calculateDailyBudget(date, payloadPlans, faultRecords, orbitElements, anomalies);
  
  const dayPayloads = payloadPlans.filter(p => {
    const d = parseTimeWithSystem(p.startTime, p.timeSystem);
    return d.toISOString().split('T')[0] === date;
  });
  
  const dayFaults = faultRecords.filter(f => {
    const d = parseTimeWithSystem(f.faultTime, f.timeSystem);
    return d.toISOString().split('T')[0] === date;
  });
  
  const dayOrbits = orbitElements.filter(o => {
    const d = parseTimeWithSystem(o.effectiveTime, o.timeSystem);
    return d.toISOString().split('T')[0] === date;
  });
  
  const dayAnomalies = anomalies.filter(a => {
    return a.description.includes(date) || a.createdAt.split('T')[0] === date;
  });
  
  const pendingAnomalies = dayAnomalies.filter(a => a.status === 'PENDING');
  const confirmedAnomalies = dayAnomalies.filter(a => a.status === 'CONFIRMED');
  
  const dayLogs = auditLogs.filter(l => l.timestamp.split('T')[0] === date);
  const supplementLogs = dayLogs.filter(l => l.action === 'CREATE' && l.reason?.includes('补材料'));
  const realChangeLogs = dayLogs.filter(l => l.action === 'CREATE' && l.reason?.includes('真修改') || l.action === 'UPDATE');
  
  const lines: string[] = [];
  
  lines.push('='.repeat(78));
  lines.push(padRight(`电源预算日历 - 交接班任务简报`, 78));
  lines.push('='.repeat(78));
  lines.push(padRight(`日期: ${date}`, 78));
  lines.push(padRight(`时间制: ${displayTimeSystem}`, 78));
  lines.push(padRight(`生成时间: ${formatTimeWithSystem(new Date(), displayTimeSystem)} ${displayTimeSystem}`, 78));
  lines.push('');
  
  lines.push('-'.repeat(78));
  lines.push(padRight('【一、当日电源预算汇总】', 78));
  lines.push('-'.repeat(78));
  lines.push(padRight('  项目', 30) + padLeft('数值', 15) + padLeft('单位', 10) + padLeft('状态', 23));
  lines.push(padRight('  ──────────────────────────────', 30) + padLeft('───────────────', 15) + padLeft('──────────', 10) + padLeft('───────────────────────', 23));
  lines.push(padRight('  日预算阈值', 30) + padLeft(formatNumber(budget.totalBudget), 15) + padLeft('Wh', 10) + padLeft('─', 23));
  lines.push(padRight('  实际消耗', 30) + padLeft(formatNumber(budget.actualConsumption), 15) + padLeft('Wh', 10) + padLeft('─', 23));
  lines.push(padRight('  余量', 30) + padLeft(formatNumber(budget.margin), 15) + padLeft('Wh', 10) + padLeft(budget.status === 'NORMAL' ? '[正常]' : budget.status === 'WARNING' ? '[警告]' : '[越界]', 23));
  lines.push('');
  lines.push(padRight(`  载荷计划: ${dayPayloads.length} 项`, 78));
  lines.push(padRight(`  故障纪要: ${dayFaults.length} 项`, 78));
  lines.push(padRight(`  轨道改动: ${dayOrbits.length} 项`, 78));
  lines.push('');
  
  lines.push('-'.repeat(78));
  lines.push(padRight('【二、异常清单】', 78));
  lines.push('-'.repeat(78));
  lines.push(padRight(`  待复核: ${pendingAnomalies.length} 项`, 78));
  lines.push(padRight(`  已确认: ${confirmedAnomalies.length} 项`, 78));
  lines.push('');
  
  if (pendingAnomalies.length > 0) {
    lines.push('  ▶ 待复核异常:');
    pendingAnomalies.forEach((a, idx) => {
      const reason = parseAnomalyReason(a.reason);
      lines.push(`    [${idx + 1}] ${getAnomalySeverityLabel(a.severity)} - ${getAnomalyTypeLabel(a.type)}`);
      lines.push(`        ${a.description}`);
      if (reason) {
        lines.push(`        ▶ 可复核原因:`);
        lines.push(`          计算公式: ${reason.formula}`);
        lines.push(`          判定依据: ${reason.criteria}`);
        lines.push(`          结论: ${reason.conclusion}`);
      }
      lines.push('');
    });
  }
  
  if (confirmedAnomalies.length > 0) {
    lines.push('  ▶ 已确认异常:');
    confirmedAnomalies.forEach((a, idx) => {
      lines.push(`    [${idx + 1}] ${getAnomalySeverityLabel(a.severity)} - ${getAnomalyTypeLabel(a.type)}`);
      lines.push(`        ${a.description}`);
      lines.push(`        复核人: ${a.reviewer || '未记录'} | 复核时间: ${a.reviewedAt || '未记录'}`);
      lines.push(`        复核备注: ${a.reviewRemark || '无'}`);
      lines.push('');
    });
  }
  
  if (dayAnomalies.length === 0) {
    lines.push('  当日无异常记录');
    lines.push('');
  }
  
  lines.push('-'.repeat(78));
  lines.push(padRight('【三、修改轨迹】', 78));
  lines.push('-'.repeat(78));
  lines.push(padRight(`  补材料记录: ${supplementLogs.length} 项`, 78));
  lines.push(padRight(`  真修改记录: ${realChangeLogs.length} 项`, 78));
  lines.push('');
  
  if (dayLogs.length > 0) {
    lines.push('  ▶ 操作记录:');
    dayLogs.slice(-10).forEach((log, idx) => {
      const actionLabel = log.action === 'CREATE' ? '新增' : log.action === 'UPDATE' ? '修改' : '删除';
      const typeLabel = log.recordType === 'PAYLOAD' ? '载荷' : log.recordType === 'FAULT' ? '故障' : '轨道';
      lines.push(`    [${idx + 1}] ${log.timestamp.split('T')[1].substring(0, 8)} ${actionLabel} ${typeLabel}`);
      lines.push(`        操作人: ${log.operator}`);
      lines.push(`        原因: ${log.reason || '未填写'}`);
      lines.push('');
    });
  } else {
    lines.push('  当日无操作记录');
    lines.push('');
  }
  
  lines.push('-'.repeat(78));
  lines.push(padRight('【四、待办事项】', 78));
  lines.push('-'.repeat(78));
  
  let todoCount = 1;
  if (pendingAnomalies.length > 0) {
    lines.push(`  ${todoCount}. 复核 ${pendingAnomalies.length} 项待处理异常`);
    todoCount++;
  }
  if (budget.margin < 400) {
    lines.push(`  ${todoCount}. 关注电源余量(${formatNumber(budget.margin)}Wh)，评估后续计划调整`);
    todoCount++;
  }
  if (dayPayloads.some(p => p.recordType === 'SUPPLEMENT')) {
    lines.push(`  ${todoCount}. 确认补材料载荷计划的最终执行时间`);
    todoCount++;
  }
  if (todoCount === 1) {
    lines.push('  暂无待办事项');
  }
  lines.push('');
  
  lines.push('-'.repeat(78));
  lines.push(padRight('【五、数据校验】', 78));
  lines.push('-'.repeat(78));
  
  const dataForHash = JSON.stringify({
    date,
    budget,
    payloadPlans: dayPayloads,
    faultRecords: dayFaults,
    orbitElements: dayOrbits,
    anomalies: dayAnomalies,
    auditLogs: dayLogs,
    generatedAt: new Date().toISOString()
  });
  const hash = await calculateSHA256(dataForHash);
  
  lines.push(padRight(`  数据快照哈希: ${hash}`, 78));
  lines.push(padRight(`  校验说明: 此哈希值基于简报生成时的所有数据计算，用于验证简报内容与`, 78));
  lines.push(padRight(`          当时系统状态的一致性。如数据有改动，哈希值将不同。`, 78));
  lines.push('');
  
  lines.push('='.repeat(78));
  lines.push(padRight('【下一班请先确认待复核异常，再处理待办事项】', 78));
  lines.push('='.repeat(78));
  
  const content = lines.join('\n');
  
  return {
    content,
    hash
  };
}

export function downloadBriefing(content: string, date: string, hash: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `电源预算简报_${date}_${hash.substring(0, 8)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
