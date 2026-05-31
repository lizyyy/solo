import { Unit, TurnOrderItem, ValidationError, HexCoord } from './types.js';
import { UnitTable } from './unitTable.js';
import { TerrainRuleSystem } from './terrainRules.js';

export interface TurnOrderResult {
  success: boolean;
  turnOrder?: TurnOrderItem[];
  errors?: ValidationError[];
  warnings?: ValidationError[];
}

export class TurnOrderEngine {
  private unitTable: UnitTable;
  private terrainSystem: TerrainRuleSystem;

  constructor(unitTable: UnitTable, terrainSystem: TerrainRuleSystem) {
    this.unitTable = unitTable;
    this.terrainSystem = terrainSystem;
  }

  calculateTurnOrder(): TurnOrderResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];
    const turnOrder: TurnOrderItem[] = [];

    const unitErrors = this.unitTable.validateAllUnits();
    if (unitErrors.length > 0) {
      errors.push(...unitErrors);
    }

    const terrainErrors = this.terrainSystem.validateAllRules();
    if (terrainErrors.length > 0) {
      errors.push(...terrainErrors);
    }

    const units = this.unitTable.getAllUnits();
    
    if (units.length === 0) {
      errors.push({
        code: 'NO_UNITS_FOR_TURN_ORDER',
        message: 'No units available to calculate turn order',
        userMessage: '单位表里还没有任何单位，没法计算回合顺序哦',
        source: 'unit_table',
        field: 'units',
        suggestion: '先导入或添加一些单位到单位表中，再计算回合顺序',
        responsiblePerson: '数值策划'
      });
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings };
    }

    for (const unit of units) {
      const { effectiveInitiative, source, warning } = this.calculateUnitInitiative(unit);
      
      if (warning) {
        warnings.push(warning);
      }

      turnOrder.push({
        unitId: unit.id,
        unitName: unit.name,
        initiative: effectiveInitiative,
        phase: 0,
        source
      });
    }

    turnOrder.sort((a, b) => b.initiative - a.initiative);

    turnOrder.forEach((item, index) => {
      item.phase = index + 1;
    });

    const { error: orderError } = this.verifyTurnOrderConsistency(turnOrder);
    if (orderError) {
      errors.push(orderError);
      return { success: false, errors, warnings };
    }

    return { success: true, turnOrder, warnings };
  }

  private calculateUnitInitiative(unit: Unit): {
    effectiveInitiative: number;
    source: 'unit_table' | 'terrain_bonus';
    warning?: ValidationError;
  } {
    const baseInitiative = unit.initiative;
    const terrainBonus = this.terrainSystem.getDefenseBonus(unit.position);
    const effectiveInitiative = baseInitiative + Math.floor(terrainBonus / 10);

    let source: 'unit_table' | 'terrain_bonus' = 'unit_table';
    let warning: ValidationError | undefined;

    if (terrainBonus > 0) {
      source = 'terrain_bonus';
      
      const hex = this.terrainSystem.getTerrainHex(unit.position);
      if (!hex) {
        warning = {
          code: 'TERRAIN_HEX_MISSING',
          message: `Terrain hex missing for unit ${unit.id} at position (${unit.position.q},${unit.position.r})`,
          userMessage: `单位「${unit.name}」所在的坐标(${unit.position.q},${unit.position.r})还没有配置地形，默认按平原处理`,
          source: 'terrain_rule',
          field: 'terrainMap',
          suggestion: '找关卡策划补上这个坐标的地形配置',
          responsiblePerson: '关卡策划'
        };
      }
    }

    if (effectiveInitiative > 100) {
      warning = {
        code: 'INITIATIVE_TOO_HIGH',
        message: `Unit ${unit.id} initiative exceeds 100: ${effectiveInitiative}`,
        userMessage: `单位「${unit.name}」的先手值${effectiveInitiative}超过了100上限，已自动修正为100`,
        source: baseInitiative > 100 ? 'unit_table' : 'terrain_rule',
        field: 'initiative',
        actual: String(effectiveInitiative),
        suggestion: baseInitiative > 100 
          ? '找数值策划调整单位基础先手值' 
          : '找关卡策划检查地形加成是否过高',
        responsiblePerson: baseInitiative > 100 ? '数值策划' : '关卡策划'
      };
      return { effectiveInitiative: 100, source, warning };
    }

    return { effectiveInitiative, source, warning };
  }

  private verifyTurnOrderConsistency(turnOrder: TurnOrderItem[]): {
    valid: boolean;
    error?: ValidationError;
  } {
    for (let i = 0; i < turnOrder.length - 1; i++) {
      const current = turnOrder[i];
      const next = turnOrder[i + 1];

      if (current.initiative === next.initiative) {
        return {
          valid: false,
          error: {
            code: 'TURN_ORDER_TIE',
            message: `Turn order tie between ${current.unitName} and ${next.unitName}`,
            userMessage: `单位「${current.unitName}」和「${next.unitName}」的先手值都是${current.initiative}，出现平局`,
            source: current.source === 'terrain_bonus' || next.source === 'terrain_bonus' ? 'terrain_rule' : 'unit_table',
            field: 'initiative',
            actual: `${current.unitName}(${current.initiative}) vs ${next.unitName}(${next.initiative})`,
            suggestion: current.source === 'terrain_bonus' || next.source === 'terrain_bonus'
              ? '找关卡策划调整地形加成，或找数值策划给其中一个单位加1点先手值'
              : '找数值策划微调其中一个单位的先手值来打破平局',
            responsiblePerson: current.source === 'terrain_bonus' || next.source === 'terrain_bonus' ? '关卡策划/数值策划' : '数值策划'
          }
        };
      }

      if (current.initiative < next.initiative) {
        return {
          valid: false,
          error: {
            code: 'TURN_ORDER_SORT_ERROR',
            message: `Turn order sorting error: ${current.unitName}(${current.initiative}) comes before ${next.unitName}(${next.initiative})`,
            userMessage: `回合顺序计算出错了：「${current.unitName}」(${current.initiative})居然排在「${next.unitName}」(${next.initiative})前面`,
            source: 'system',
            suggestion: '这是系统排序算法的问题，请联系技术人员排查',
            responsiblePerson: '技术开发'
          }
        };
      }
    }

    return { valid: true };
  }

  explainTurnOrder(unitId: string): {
    unitName: string;
    baseInitiative: number;
    terrainBonus: number;
    finalInitiative: number;
    position: HexCoord;
    rank: number;
    breakdown: string;
    source: string;
  } | null {
    const unit = this.unitTable.getUnit(unitId);
    if (!unit) return null;

    const result = this.calculateTurnOrder();
    if (!result.success || !result.turnOrder) return null;

    const turnItem = result.turnOrder.find(t => t.unitId === unitId);
    if (!turnItem) return null;

    const terrainBonus = Math.floor(this.terrainSystem.getDefenseBonus(unit.position) / 10);
    const sourceText = turnItem.source === 'terrain_bonus' ? '地形加成' : '单位基础值';

    return {
      unitName: unit.name,
      baseInitiative: unit.initiative,
      terrainBonus,
      finalInitiative: turnItem.initiative,
      position: unit.position,
      rank: turnItem.phase,
      breakdown: `基础先手值${unit.initiative} + 地形加成${terrainBonus} = 最终先手值${turnItem.initiative}`,
      source: sourceText
    };
  }

  getTurnOrderErrorSource(error: ValidationError): 'unit_table' | 'terrain_rule' | 'system' {
    return error.source;
  }

  getNextStepForError(error: ValidationError): string {
    return `下一步：请找「${error.responsiblePerson}」处理，建议：${error.suggestion}`;
  }
}
