import { UnitTable } from './unitTable.js';
import { TerrainRuleSystem } from './terrainRules.js';
import { BattleReportManager } from './battleReport.js';
import { TurnOrderEngine } from './turnOrderEngine.js';
import { ChangeAuditor } from './changeAuditor.js';
import { ErrorPresenter } from './errorPresenter.js';
import { 
  Unit, TerrainRule, TerrainHex, BattleReport, BattlePhase,
  TurnOrderItem, ValidationError, SimulationConfig
} from './types.js';

export interface SimulationResult {
  success: boolean;
  turnOrder?: TurnOrderItem[];
  errors?: ValidationError[];
  warnings?: ValidationError[];
  report?: BattleReport;
}

export class HexTerritorySimulator {
  unitTable: UnitTable;
  terrainSystem: TerrainRuleSystem;
  battleManager: BattleReportManager;
  turnEngine: TurnOrderEngine;
  changeAuditor: ChangeAuditor;
  errorPresenter: ErrorPresenter;
  config: SimulationConfig;

  constructor(config?: Partial<SimulationConfig>) {
    this.config = {
      unitTableSource: config?.unitTableSource || 'default',
      terrainRuleSource: config?.terrainRuleSource || 'default',
      maxTurns: config?.maxTurns || 10,
      strictMode: config?.strictMode ?? true
    };

    this.unitTable = new UnitTable();
    this.terrainSystem = new TerrainRuleSystem();
    this.battleManager = new BattleReportManager();
    this.turnEngine = new TurnOrderEngine(this.unitTable, this.terrainSystem);
    this.changeAuditor = new ChangeAuditor();
    this.errorPresenter = new ErrorPresenter();
  }

  importUnits(units: Unit[], author: string): { success: number; errors: ValidationError[] } {
    const result = this.unitTable.importUnits(units);
    
    if (result.success > 0) {
      this.changeAuditor.recordChange({
        category: 'unit_import',
        field: 'units',
        oldValue: '导入前',
        newValue: `导入${result.success}个单位`,
        description: `导入了${result.success}个单位`,
        source: 'unit_table',
        author
      });
    }

    return result;
  }

  importTerrainRules(rules: TerrainRule[], author: string): { success: number; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    let success = 0;

    for (const rule of rules) {
      const error = this.terrainSystem.addRule(rule);
      if (error) {
        errors.push(error);
      } else {
        success++;
      }
    }

    if (success > 0) {
      this.changeAuditor.recordChange({
        category: 'terrain_import',
        field: 'rules',
        oldValue: '导入前',
        newValue: `导入${success}条规则`,
        description: `导入了${success}条地形规则`,
        source: 'terrain_rule',
        author
      });
    }

    return { success, errors };
  }

  setTerrainMap(hexes: TerrainHex[], author: string): { success: number; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    let success = 0;

    for (const hex of hexes) {
      const error = this.terrainSystem.setTerrainHex(hex);
      if (error) {
        errors.push(error);
      } else {
        success++;
      }
    }

    if (success > 0) {
      this.changeAuditor.recordChange({
        category: 'terrain_map',
        field: 'terrainMap',
        oldValue: '设置前',
        newValue: `设置${success}个地形`,
        description: `设置了${success}个坐标的地形`,
        source: 'terrain_rule',
        author
      });
    }

    return { success, errors };
  }

  runSimulation(reportId: string, author: string): SimulationResult {
    const turnResult = this.turnEngine.calculateTurnOrder();

    if (!turnResult.success) {
      return {
        success: false,
        errors: turnResult.errors,
        warnings: turnResult.warnings
      };
    }

    const report: BattleReport = {
      id: reportId,
      title: `战役推演报告`,
      date: new Date().toISOString().split('T')[0],
      phases: [],
      summary: `本次推演共${turnResult.turnOrder!.length}个单位参与，回合顺序已确定`,
      isManuallyEdited: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    turnResult.turnOrder!.forEach((item, index) => {
      const phase: BattlePhase = {
        phaseNumber: index + 1,
        actingUnitId: item.unitId,
        action: `${item.unitName}行动`,
        timestamp: Date.now()
      };
      report.phases.push(phase);
    });

    const reportError = this.battleManager.createReport(report);
    if (reportError) {
      return {
        success: false,
        errors: [reportError]
      };
    }

    this.changeAuditor.recordChange({
      category: 'simulation',
      field: 'report',
      oldValue: '无',
      newValue: reportId,
      description: '完成一次战役推演',
      source: 'battle_report',
      author
    });

    return {
      success: true,
      turnOrder: turnResult.turnOrder,
      warnings: turnResult.warnings,
      report
    };
  }

  updateUnit(unitId: string, updates: Partial<Unit>, author: string): { success: boolean; errors?: ValidationError[] } {
    const result = this.unitTable.updateUnit(unitId, updates);
    
    if (!result.success) {
      return { success: false, errors: result.error ? [result.error] : undefined };
    }

    const oldUnit = this.unitTable.getUnit(unitId);
    this.changeAuditor.recordChange({
      category: 'unit_update',
      field: Object.keys(updates).join(', '),
      oldValue: '旧值',
      newValue: '新值',
      description: `更新了单位「${oldUnit?.name || unitId}」的属性`,
      source: 'unit_table',
      author
    });

    return { success: true };
  }

  updateTerrainRule(ruleId: string, updates: Partial<TerrainRule>, author: string): { success: boolean; errors?: ValidationError[] } {
    const result = this.terrainSystem.updateRule(ruleId, updates);
    
    if (!result.success) {
      return { success: false, errors: result.error ? [result.error] : undefined };
    }

    const oldRule = this.terrainSystem.getRule(ruleId);
    this.changeAuditor.recordChange({
      category: 'terrain_update',
      field: Object.keys(updates).join(', '),
      oldValue: '旧值',
      newValue: '新值',
      description: `更新了地形规则「${oldRule?.name || ruleId}」`,
      source: 'terrain_rule',
      author
    });

    return { success: true };
  }

  manuallyEditReport(
    reportId: string, updates: Partial<BattleReport>, author: string): { success: boolean; errors?: ValidationError[] } {
    const result = this.battleManager.updateReport(reportId, updates, author, true);
    
    if (!result.success) {
      return { success: false, errors: result.error ? [result.error] : undefined };
    }

    return { success: true };
  }

  getChangeSummary(): string {
    const analysis = this.changeAuditor.analyzeChanges();
    return analysis.summary;
  }

  hasConclusionChanged(): boolean {
    return this.changeAuditor.hasConclusionChanged();
  }

  explainTurnOrder(unitId: string): string | null {
    const explanation = this.turnEngine.explainTurnOrder(unitId);
    if (!explanation) return null;

    return `
【${explanation.unitName}】
坐标: (${explanation.position.q}, ${explanation.position.r})
排名: 第${explanation.rank}名
${explanation.breakdown}
主要来源: ${explanation.source}`;
  }

  validateAll(): { errors: ValidationError[]; warnings: ValidationError[] } {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    errors.push(...this.unitTable.validateAllUnits());
    errors.push(...this.terrainSystem.validateAllRules());

    return { errors, warnings };
  }

  formatErrors(errors: ValidationError[]): string {
    return this.errorPresenter.formatErrors(errors);
  }

  formatWarnings(warnings: ValidationError[]): string {
    return this.errorPresenter.formatWarnings(warnings);
  }

  getNextSteps(errors: ValidationError[]): string {
    return this.errorPresenter.getNextSteps(errors);
  }

  getReportHistory(reportId: string): string {
    const history = this.battleManager.getReportHistory(reportId);
    if (!history) {
      return '找不到该战报的历史记录';
    }

    const changes = this.battleManager.getChangeRecords(reportId);
    const manualEdits = this.battleManager.getManualEdits(reportId);

    let output = `战报「${reportId}」历史记录（共${history.length}个版本）\n`;
    output += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

    history.forEach((version, index) => {
      output += `\n📝 版本 ${index + 1}\n`;
      output += `   时间: ${new Date(version.updatedAt).toLocaleString('zh-CN')}\n`;
      output += `   标题: ${version.title}\n`;
      output += `   胜者: ${version.winner || '未决出'}\n`;
      output += `   阶段数: ${version.phases.length}\n`;
      if (version.isManuallyEdited && index === history.length - 1) {
        output += `   ⚠️  此版本包含手动修改\n`;
      }
    });

    if (manualEdits.length > 0) {
      output += `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
      output += `📋 手动修改记录（${manualEdits.length}条）:\n`;
      manualEdits.forEach((edit, index) => {
        output += `\n   ${index + 1}. ${edit.description} - ${edit.author}\n`;
      });
    }

    return output;
  }

  compareReportVersions(reportId: string, v1: number, v2: number): string {
    const differences = this.battleManager.compareVersions(reportId, v1, v2);
    if (!differences) {
      return '版本比较失败，请检查版本号是否正确';
    }

    if (differences.length === 0) {
      return '两个版本完全相同';
    }

    let output = `版本 ${v1 + 1} vs 版本 ${v2 + 1} 差异对比:\n`;
    output += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

    differences.forEach((diff) => {
      const marker = diff.affectsConclusion ? '🔴' : '🟡';
      output += `\n${marker} ${diff.field}:\n`;
      output += `   旧值: ${diff.oldValue}\n`;
      output += `   新值: ${diff.newValue}\n`;
      output += `   影响结论: ${diff.affectsConclusion ? '是' : '否'}\n`;
    });

    return output;
  }
}
