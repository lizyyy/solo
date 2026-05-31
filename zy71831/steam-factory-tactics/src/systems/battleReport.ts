import { BattleReport, Unit, ExportOptions, FilterCondition, FACTION_LABELS, TYPE_LABELS } from '../types';
import { filterReports, getAllReports } from '../store/localStorage';
import { calculateTurnOrder } from './turnOrder';

export function generateReportText(report: BattleReport): string {
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push(`  蒸汽工厂战棋 - 战报复盘`);
  lines.push('═══════════════════════════════════════');
  lines.push(`场景: ${report.scenarioName}`);
  lines.push(`生成时间: ${new Date(report.createdAt).toLocaleString('zh-CN')}`);
  lines.push(`已修正: ${report.corrected ? '是' : '否'}`);
  if (report.corrected && report.correctionNote) {
    lines.push(`修正说明: ${report.correctionNote}`);
  }
  lines.push(`版本: v${report.version}`);
  lines.push('');

  lines.push('【参战单位】');
  report.units.forEach(u => {
    lines.push(`  ${u.name} | ${FACTION_LABELS[u.faction] || u.faction} | ${TYPE_LABELS[u.type] || u.type} | HP ${u.hp}/${u.maxHp} | 先攻 ${u.init} | 速度 ${u.speed} | 位置 (${u.x},${u.y})`);
    if (u.statusEffects.length > 0) {
      lines.push(`    状态: ${u.statusEffects.join(', ')}`);
    }
  });
  lines.push('');

  lines.push('【回合顺序】');
  report.turnOrder.entries.forEach(e => {
    const unit = report.units.find(u => u.id === e.unitId);
    lines.push(`  ${e.order}. ${unit?.name || e.unitId}`);
  });
  lines.push('');

  lines.push('【判断理由】');
  lines.push(`  ${report.turnOrder.overallReason}`);
  lines.push('');
  report.turnOrder.entries.forEach(e => {
    const unit = report.units.find(u => u.id === e.unitId);
    lines.push(`  [${e.order}] ${unit?.name || e.unitId}: ${e.reason}`);
  });
  lines.push('');

  lines.push('【下一步建议】');
  lines.push(`  ${report.turnOrder.nextStepSuggestion}`);
  lines.push('');
  lines.push('═══════════════════════════════════════');

  return lines.join('\n');
}

export function generateCSV(reports: BattleReport[]): string {
  const header = '场景,单位名,阵营,类型,先攻,速度,HP,最大HP,回合顺序,判断理由';
  const rows: string[] = [header];
  reports.forEach(report => {
    report.turnOrder.entries.forEach(e => {
      const unit = report.units.find(u => u.id === e.unitId);
      if (unit) {
        rows.push([
          report.scenarioName,
          unit.name,
          FACTION_LABELS[unit.faction] || unit.faction,
          TYPE_LABELS[unit.type] || unit.type,
          unit.init,
          unit.speed,
          unit.hp,
          unit.maxHp,
          e.order,
          `"${e.reason.replace(/"/g, '""')}"`,
        ].join(','));
      }
    });
  });
  return rows.join('\n');
}

export function exportReports(options: ExportOptions): string {
  const reports = filterReports(getAllReports(), options.filter);

  if (options.format === 'json') {
    const data = reports.map(r => {
      const base = { ...r };
      if (!options.includeReasons) {
        base.turnOrder = { ...base.turnOrder, entries: base.turnOrder.entries.map(e => ({ ...e, reason: '' })), overallReason: '' };
      }
      if (!options.includeNextSteps) {
        base.turnOrder = { ...base.turnOrder, nextStepSuggestion: '' };
      }
      return base;
    });
    return JSON.stringify(data, null, 2);
  }

  if (options.format === 'csv') {
    return generateCSV(reports);
  }

  return reports.map(r => generateReportText(r)).join('\n\n');
}

export function recalculateReport(report: BattleReport): BattleReport {
  const newTurnOrder = calculateTurnOrder(report.units);
  return {
    ...report,
    turnOrder: newTurnOrder,
  };
}
