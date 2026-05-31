import { TerrainRule, TerrainType, TerrainHex, HexCoord, ValidationError } from './types.js';

const terrainTypeNames: Record<TerrainType, string> = {
  plain: '平原',
  mountain: '山地',
  forest: '森林',
  water: '水域',
  fortress: '要塞'
};

export class TerrainRuleSystem {
  private rules: Map<string, TerrainRule> = new Map();
  private terrainMap: Map<string, TerrainHex> = new Map();

  addRule(rule: TerrainRule): ValidationError | null {
    const validation = this.validateRule(rule);
    if (validation) {
      return validation;
    }

    if (this.rules.has(rule.id)) {
      return {
        code: 'TERRAIN_RULE_DUPLICATE_ID',
        message: `Terrain rule with id ${rule.id} already exists`,
        userMessage: `地形规则编号「${rule.id}」重复了，是不是刚才导入过？`,
        source: 'terrain_rule',
        field: 'id',
        actual: rule.id,
        suggestion: '换个唯一的规则编号，或者先删除已有同名规则',
        responsiblePerson: '关卡策划'
      };
    }

    this.rules.set(rule.id, rule);
    return null;
  }

  getRule(id: string): TerrainRule | undefined {
    return this.rules.get(id);
  }

  getRuleByTerrainType(terrainType: TerrainType): TerrainRule | undefined {
    return Array.from(this.rules.values()).find(r => r.terrainType === terrainType);
  }

  getAllRules(): TerrainRule[] {
    return Array.from(this.rules.values());
  }

  updateRule(id: string, updates: Partial<TerrainRule>): { success: boolean; error?: ValidationError } {
    const rule = this.rules.get(id);
    if (!rule) {
      return {
        success: false,
        error: {
          code: 'TERRAIN_RULE_NOT_FOUND',
          message: `Terrain rule ${id} not found`,
          userMessage: `找不到编号为「${id}」的地形规则，是不是编号写错了？`,
          source: 'terrain_rule',
          field: 'id',
          actual: id,
          suggestion: '核对地形规则表中的规则编号是否正确',
          responsiblePerson: '关卡策划'
        }
      };
    }

    const updatedRule = { ...rule, ...updates };
    const validation = this.validateRule(updatedRule);
    if (validation) {
      return { success: false, error: validation };
    }

    this.rules.set(id, updatedRule);
    return { success: true };
  }

  deleteRule(id: string): boolean {
    return this.rules.delete(id);
  }

  setTerrainHex(hex: TerrainHex): ValidationError | null {
    const validation = this.validateTerrainHex(hex);
    if (validation) {
      return validation;
    }

    const key = this.hexToKey(hex.coord);
    this.terrainMap.set(key, hex);
    return null;
  }

  getTerrainHex(coord: HexCoord): TerrainHex | undefined {
    const key = this.hexToKey(coord);
    return this.terrainMap.get(key);
  }

  getAllTerrainHexes(): TerrainHex[] {
    return Array.from(this.terrainMap.values());
  }

  private hexToKey(coord: HexCoord): string {
    return `${coord.q},${coord.r}`;
  }

  private validateRule(rule: TerrainRule): ValidationError | null {
    if (!rule.id || rule.id.trim() === '') {
      return {
        code: 'TERRAIN_RULE_ID_EMPTY',
        message: 'Terrain rule id is empty',
        userMessage: '地形规则编号不能为空哦，得给每个规则一个唯一的标识',
        source: 'terrain_rule',
        field: 'id',
        suggestion: '按照「地形类型_序号」的格式填写，比如 PLAIN_001',
        responsiblePerson: '关卡策划'
      };
    }

    if (!rule.name || rule.name.trim() === '') {
      return {
        code: 'TERRAIN_RULE_NAME_EMPTY',
        message: 'Terrain rule name is empty',
        userMessage: `地形规则「${rule.id}」还没有名字，得给它起个名字让大家认识`,
        source: 'terrain_rule',
        field: 'name',
        suggestion: '比如「开阔平原」「险峻山地」这样有辨识度的名字',
        responsiblePerson: '关卡策划'
      };
    }

    const validTypes: TerrainType[] = ['plain', 'mountain', 'forest', 'water', 'fortress'];
    if (!validTypes.includes(rule.terrainType)) {
      return {
        code: 'TERRAIN_TYPE_INVALID',
        message: `Invalid terrain type: ${rule.terrainType}`,
        userMessage: `地形规则「${rule.name}」的地形类型「${rule.terrainType}」不对，系统不认识这个类型`,
        source: 'terrain_rule',
        field: 'terrainType',
        expected: validTypes.join('、'),
        actual: rule.terrainType,
        suggestion: '只支持这五种：平原、山地、森林、水域、要塞',
        responsiblePerson: '关卡策划'
      };
    }

    if (rule.movementCost <= 0 || rule.movementCost > 10) {
      return {
        code: 'MOVEMENT_COST_INVALID',
        message: `Invalid movement cost: ${rule.movementCost}`,
        userMessage: `地形规则「${rule.name}」的移动消耗${rule.movementCost}不对，应该在1-10之间`,
        source: 'terrain_rule',
        field: 'movementCost',
        expected: '1-10之间的整数',
        actual: String(rule.movementCost),
        suggestion: '平原消耗1，山地消耗3，水域不可通行设为99',
        responsiblePerson: '关卡策划'
      };
    }

    if (rule.defenseBonus < 0 || rule.defenseBonus > 100) {
      return {
        code: 'DEFENSE_BONUS_INVALID',
        message: `Invalid defense bonus: ${rule.defenseBonus}`,
        userMessage: `地形规则「${rule.name}」的防御加成${rule.defenseBonus}不对，应该在0-100之间`,
        source: 'terrain_rule',
        field: 'defenseBonus',
        expected: '0-100之间的整数（百分比）',
        actual: String(rule.defenseBonus),
        suggestion: '防御加成是百分比，比如山地+30%防御',
        responsiblePerson: '关卡策划'
      };
    }

    if (rule.attackPenalty < 0 || rule.attackPenalty > 100) {
      return {
        code: 'ATTACK_PENALTY_INVALID',
        message: `Invalid attack penalty: ${rule.attackPenalty}`,
        userMessage: `地形规则「${rule.name}」的攻击惩罚${rule.attackPenalty}不对，应该在0-100之间`,
        source: 'terrain_rule',
        field: 'attackPenalty',
        expected: '0-100之间的整数（百分比）',
        actual: String(rule.attackPenalty),
        suggestion: '攻击惩罚是百分比，比如森林中远程-20%攻击',
        responsiblePerson: '关卡策划'
      };
    }

    return null;
  }

  private validateTerrainHex(hex: TerrainHex): ValidationError | null {
    const validTypes: TerrainType[] = ['plain', 'mountain', 'forest', 'water', 'fortress'];
    if (!validTypes.includes(hex.terrainType)) {
      return {
        code: 'HEX_TERRAIN_TYPE_INVALID',
        message: `Invalid hex terrain type: ${hex.terrainType}`,
        userMessage: `坐标(${hex.coord.q},${hex.coord.r})的地形类型「${hex.terrainType}」不对`,
        source: 'terrain_rule',
        field: 'terrainType',
        expected: validTypes.join('、'),
        actual: hex.terrainType,
        suggestion: '检查地形配置表中的地形类型是否正确',
        responsiblePerson: '关卡策划'
      };
    }

    return null;
  }

  getTerrainTypeName(type: TerrainType): string {
    return terrainTypeNames[type] || type;
  }

  validateAllRules(): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const rule of this.rules.values()) {
      const error = this.validateRule(rule);
      if (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  getDefenseBonus(coord: HexCoord): number {
    const hex = this.getTerrainHex(coord);
    if (!hex) return 0;
    
    const rule = this.getRuleByTerrainType(hex.terrainType);
    return rule?.defenseBonus || 0;
  }

  getAttackPenalty(coord: HexCoord): number {
    const hex = this.getTerrainHex(coord);
    if (!hex) return 0;
    
    const rule = this.getRuleByTerrainType(hex.terrainType);
    return rule?.attackPenalty || 0;
  }

  getMovementCost(coord: HexCoord): number {
    const hex = this.getTerrainHex(coord);
    if (!hex) return 1;
    
    const rule = this.getRuleByTerrainType(hex.terrainType);
    return rule?.movementCost || 1;
  }

  clear(): void {
    this.rules.clear();
    this.terrainMap.clear();
  }
}
