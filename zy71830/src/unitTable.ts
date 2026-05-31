import { Unit, UnitType, HexCoord, ValidationError } from './types.js';

const unitTypeNames: Record<UnitType, string> = {
  infantry: '步兵',
  cavalry: '骑兵',
  archer: '弓兵',
  siege: '攻城器械'
};

export class UnitTable {
  private units: Map<string, Unit> = new Map();

  addUnit(unit: Unit): ValidationError | null {
    const validation = this.validateUnit(unit);
    if (validation) {
      return validation;
    }
    
    if (this.units.has(unit.id)) {
      return {
        code: 'UNIT_DUPLICATE_ID',
        message: `Unit with id ${unit.id} already exists`,
        userMessage: `单位编号「${unit.id}」重复了，是不是刚才导入过？检查一下单位表有没有重名的单位。`,
        source: 'unit_table',
        field: 'id',
        actual: unit.id,
        suggestion: '换个唯一的单位编号，或者先删除已有同名单位',
        responsiblePerson: '数值策划'
      };
    }

    this.units.set(unit.id, unit);
    return null;
  }

  getUnit(id: string): Unit | undefined {
    return this.units.get(id);
  }

  getAllUnits(): Unit[] {
    return Array.from(this.units.values());
  }

  updateUnit(id: string, updates: Partial<Unit>): { success: boolean; error?: ValidationError } {
    const unit = this.units.get(id);
    if (!unit) {
      return {
        success: false,
        error: {
          code: 'UNIT_NOT_FOUND',
          message: `Unit ${id} not found`,
          userMessage: `找不到编号为「${id}」的单位，是不是编号写错了？`,
          source: 'unit_table',
          field: 'id',
          actual: id,
          suggestion: '核对单位表中的单位编号是否正确',
          responsiblePerson: '数值策划'
        }
      };
    }

    const updatedUnit = { ...unit, ...updates };
    const validation = this.validateUnit(updatedUnit);
    if (validation) {
      return { success: false, error: validation };
    }

    this.units.set(id, updatedUnit);
    return { success: true };
  }

  deleteUnit(id: string): boolean {
    return this.units.delete(id);
  }

  private validateUnit(unit: Unit): ValidationError | null {
    if (!unit.id || unit.id.trim() === '') {
      return {
        code: 'UNIT_ID_EMPTY',
        message: 'Unit id is empty',
        userMessage: '单位编号不能为空哦，得给每个单位一个唯一的标识',
        source: 'unit_table',
        field: 'id',
        suggestion: '按照「阵营_兵种_序号」的格式填写，比如 RED_INF_001',
        responsiblePerson: '数值策划'
      };
    }

    if (!unit.name || unit.name.trim() === '') {
      return {
        code: 'UNIT_NAME_EMPTY',
        message: 'Unit name is empty',
        userMessage: `单位「${unit.id}」还没有名字，得给它起个名字让大家认识`,
        source: 'unit_table',
        field: 'name',
        suggestion: '比如「赤焰军团步兵营」这样有辨识度的名字',
        responsiblePerson: '数值策划'
      };
    }

    if (!unit.type) {
      return {
        code: 'UNIT_TYPE_MISSING',
        message: 'Unit type is missing',
        userMessage: `单位「${unit.name || unit.id}」的兵种类型没填，我不知道它是什么兵`,
        source: 'unit_table',
        field: 'type',
        expected: Object.keys(unitTypeNames).join('、'),
        suggestion: '从下拉框选择：步兵、骑兵、弓兵、攻城器械',
        responsiblePerson: '数值策划'
      };
    }

    const validTypes: UnitType[] = ['infantry', 'cavalry', 'archer', 'siege'];
    if (!validTypes.includes(unit.type)) {
      return {
        code: 'UNIT_TYPE_INVALID',
        message: `Invalid unit type: ${unit.type}`,
        userMessage: `单位「${unit.name}」的兵种类型「${unit.type}」不对，系统不认识这个类型`,
        source: 'unit_table',
        field: 'type',
        expected: validTypes.join('、'),
        actual: unit.type,
        suggestion: '只支持这四种：步兵、骑兵、弓兵、攻城器械',
        responsiblePerson: '数值策划'
      };
    }

    if (unit.attack < 0 || unit.attack > 999) {
      return {
        code: 'UNIT_ATTACK_INVALID',
        message: `Invalid attack value: ${unit.attack}`,
        userMessage: `单位「${unit.name}」的攻击力${unit.attack}有点奇怪，应该在0-999之间`,
        source: 'unit_table',
        field: 'attack',
        expected: '0-999之间的整数',
        actual: String(unit.attack),
        suggestion: '检查是不是多打了个零或者小数点',
        responsiblePerson: '数值策划'
      };
    }

    if (unit.defense < 0 || unit.defense > 999) {
      return {
        code: 'UNIT_DEFENSE_INVALID',
        message: `Invalid defense value: ${unit.defense}`,
        userMessage: `单位「${unit.name}」的防御力${unit.defense}有点奇怪，应该在0-999之间`,
        source: 'unit_table',
        field: 'defense',
        expected: '0-999之间的整数',
        actual: String(unit.defense),
        suggestion: '防御力不会是负数的，再核对一下数值表',
        responsiblePerson: '数值策划'
      };
    }

    if (unit.speed <= 0 || unit.speed > 10) {
      return {
        code: 'UNIT_SPEED_INVALID',
        message: `Invalid speed value: ${unit.speed}`,
        userMessage: `单位「${unit.name}」的移动力${unit.speed}不对，应该在1-10之间`,
        source: 'unit_table',
        field: 'speed',
        expected: '1-10之间的整数',
        actual: String(unit.speed),
        suggestion: '跑得再快也不能超过10格，再看看数值表',
        responsiblePerson: '数值策划'
      };
    }

    if (unit.hp <= 0 || unit.hp > 9999) {
      return {
        code: 'UNIT_HP_INVALID',
        message: `Invalid hp value: ${unit.hp}`,
        userMessage: `单位「${unit.name}」的生命值${unit.hp}不对，应该在1-9999之间`,
        source: 'unit_table',
        field: 'hp',
        expected: '1-9999之间的整数',
        actual: String(unit.hp),
        suggestion: '生命值不能是0或者负数，不然单位一出场就没了',
        responsiblePerson: '数值策划'
      };
    }

    if (unit.initiative < 0 || unit.initiative > 100) {
      return {
        code: 'UNIT_INITIATIVE_INVALID',
        message: `Invalid initiative value: ${unit.initiative}`,
        userMessage: `单位「${unit.name}」的先手值${unit.initiative}不对，应该在0-100之间`,
        source: 'unit_table',
        field: 'initiative',
        expected: '0-100之间的整数',
        actual: String(unit.initiative),
        suggestion: '先手值越高越先行动，最高100',
        responsiblePerson: '数值策划'
      };
    }

    return null;
  }

  getUnitTypeName(type: UnitType): string {
    return unitTypeNames[type] || type;
  }

  validateAllUnits(): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const unit of this.units.values()) {
      const error = this.validateUnit(unit);
      if (error) {
        errors.push(error);
      }
    }
    return errors;
  }

  clear(): void {
    this.units.clear();
  }

  importUnits(units: Unit[]): { success: number; errors: ValidationError[] } {
    const errors: ValidationError[] = [];
    let success = 0;

    for (const unit of units) {
      const error = this.addUnit(unit);
      if (error) {
        errors.push(error);
      } else {
        success++;
      }
    }

    return { success, errors };
  }
}
