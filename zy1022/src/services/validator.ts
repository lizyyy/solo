import {
  LightingScenario,
  ValidationResult,
  ValidationError,
  ValidationWarning,
  HeatLevel,
  TimeSlot,
  LightFixture,
  PlantTray,
} from '../models/types.js';

export class ScenarioValidator {
  private errors: ValidationError[] = [];
  private warnings: ValidationWarning[] = [];

  validate(scenario: unknown): ValidationResult {
    this.errors = [];
    this.warnings = [];

    if (!scenario || typeof scenario !== 'object') {
      this.errors.push({
        field: 'scenario',
        message: '场景必须是一个对象',
      });
      return this.result();
    }

    const s = scenario as Partial<LightingScenario>;

    this.validateRequiredField('id', s.id, 'string');
    this.validateRequiredField('name', s.name, 'string');
    this.validateRoom(s.room);
    this.validatePlantTrays(s.plantTrays);
    this.validateLightModels(s.lightModels);
    this.validateLightFixtures(s.fixtures, s.lightModels, s.room);
    this.validateElectricity(s.electricity);

    if (this.errors.length === 0) {
      const fullScenario = scenario as LightingScenario;
      this.validateCrossFieldRules(fullScenario);
    }

    return this.result();
  }

  private validateRoom(room: unknown): void {
    if (!room || typeof room !== 'object') {
      this.errors.push({
        field: 'room',
        message: '房间信息缺失或不是有效对象',
      });
      return;
    }

    const r = room as Record<string, unknown>;

    this.validatePositiveNumber('room.width', r.width);
    this.validatePositiveNumber('room.depth', r.depth);
    this.validatePositiveNumber('room.height', r.height);
  }

  private validatePlantTrays(trays: unknown): void {
    if (!trays || !Array.isArray(trays)) {
      this.errors.push({
        field: 'plantTrays',
        message: '植物托盘列表缺失或不是数组',
      });
      return;
    }

    if (trays.length === 0) {
      this.warnings.push({
        field: 'plantTrays',
        message: '植物托盘列表为空，无法评估光照覆盖',
      });
    }

    for (let i = 0; i < trays.length; i++) {
      const tray = trays[i];
      const prefix = `plantTrays[${i}]`;

      if (!tray || typeof tray !== 'object') {
        this.errors.push({
          field: prefix,
          message: '植物托盘不是有效对象',
        });
        continue;
      }

      const t = tray as Record<string, unknown>;

      this.validateRequiredField(`${prefix}.id`, t.id, 'string');
      this.validatePositiveNumber(`${prefix}.minLuxRequired`, t.minLuxRequired);
      this.validatePositiveNumber(`${prefix}.height`, t.height);

      if (t.position && typeof t.position === 'object') {
        const pos = t.position as Record<string, unknown>;
        this.validateNonNegativeNumber(`${prefix}.position.x`, pos.x);
        this.validateNonNegativeNumber(`${prefix}.position.y`, pos.y);
        this.validatePositiveNumber(`${prefix}.position.width`, pos.width);
        this.validatePositiveNumber(`${prefix}.position.depth`, pos.depth);
      } else {
        this.errors.push({
          field: `${prefix}.position`,
          message: '位置信息缺失',
        });
      }
    }
  }

  private validateLightModels(models: unknown): void {
    if (!models || !Array.isArray(models)) {
      this.errors.push({
        field: 'lightModels',
        message: '灯具型号列表缺失或不是数组',
      });
      return;
    }

    if (models.length === 0) {
      this.warnings.push({
        field: 'lightModels',
        message: '灯具型号列表为空',
      });
    }

    const modelIds = new Set<string>();

    for (let i = 0; i < models.length; i++) {
      const model = models[i];
      const prefix = `lightModels[${i}]`;

      if (!model || typeof model !== 'object') {
        this.errors.push({
          field: prefix,
          message: '灯具型号不是有效对象',
        });
        continue;
      }

      const m = model as Record<string, unknown>;

      if (this.validateRequiredField(`${prefix}.id`, m.id, 'string')) {
        const id = m.id as string;
        if (modelIds.has(id)) {
          this.errors.push({
            field: `${prefix}.id`,
            message: `灯具型号 ID "${id}" 重复`,
          });
        } else {
          modelIds.add(id);
        }
      }

      this.validateRequiredField(`${prefix}.name`, m.name, 'string');
      this.validatePositiveNumber(`${prefix}.power`, m.power);
      this.validatePositiveNumber(`${prefix}.beamAngle`, m.beamAngle);
      this.validatePositiveNumber(`${prefix}.baseLux`, m.baseLux);

      if (m.heatLevel !== undefined) {
        const validHeatLevels = [HeatLevel.LOW, HeatLevel.MEDIUM, HeatLevel.HIGH];
        if (!validHeatLevels.includes(m.heatLevel as HeatLevel)) {
          this.errors.push({
            field: `${prefix}.heatLevel`,
            message: `发热等级必须是以下之一: ${validHeatLevels.join(', ')}`,
            value: m.heatLevel,
          });
        }
      } else {
        this.errors.push({
          field: `${prefix}.heatLevel`,
          message: '发热等级缺失',
        });
      }

      if (typeof m.beamAngle === 'number') {
        if (m.beamAngle <= 0 || m.beamAngle > 180) {
          this.errors.push({
            field: `${prefix}.beamAngle`,
            message: '光束角应在 1-180 度之间',
            value: m.beamAngle,
          });
        }
      }
    }
  }

  private validateLightFixtures(
    fixtures: unknown,
    models: unknown,
    room: unknown
  ): void {
    if (!fixtures || !Array.isArray(fixtures)) {
      this.errors.push({
        field: 'fixtures',
        message: '灯具列表缺失或不是数组',
      });
      return;
    }

    if (fixtures.length === 0) {
      this.warnings.push({
        field: 'fixtures',
        message: '灯具列表为空，无法评估光照',
      });
    }

    const modelSet = new Set<string>();
    if (Array.isArray(models)) {
      for (const m of models) {
        if (m && typeof m === 'object' && 'id' in m) {
          modelSet.add(String((m as { id: string }).id));
        }
      }
    }

    const fixtureIds = new Set<string>();

    for (let i = 0; i < fixtures.length; i++) {
      const fixture = fixtures[i];
      const prefix = `fixtures[${i}]`;

      if (!fixture || typeof fixture !== 'object') {
        this.errors.push({
          field: prefix,
          message: '灯具不是有效对象',
        });
        continue;
      }

      const f = fixture as Record<string, unknown>;

      if (this.validateRequiredField(`${prefix}.id`, f.id, 'string')) {
        const id = f.id as string;
        if (fixtureIds.has(id)) {
          this.errors.push({
            field: `${prefix}.id`,
            message: `灯具 ID "${id}" 重复`,
          });
        } else {
          fixtureIds.add(id);
        }
      }

      if (this.validateRequiredField(`${prefix}.modelId`, f.modelId, 'string')) {
        const modelId = f.modelId as string;
        if (!modelSet.has(modelId)) {
          this.errors.push({
            field: `${prefix}.modelId`,
            message: `灯具型号 "${modelId}" 未在 lightModels 中定义`,
          });
        }
      }

      if (f.position && typeof f.position === 'object') {
        const pos = f.position as Record<string, unknown>;
        this.validateNonNegativeNumber(`${prefix}.position.x`, pos.x);
        this.validateNonNegativeNumber(`${prefix}.position.y`, pos.y);
        this.validatePositiveNumber(`${prefix}.position.z`, pos.z);

        if (room && typeof room === 'object') {
          const r = room as Record<string, unknown>;
          if (typeof pos.x === 'number' && typeof r.width === 'number') {
            if (pos.x > r.width) {
              this.warnings.push({
                field: `${prefix}.position.x`,
                message: `灯具 X 坐标 (${pos.x}) 超出房间宽度 (${r.width})`,
              });
            }
          }
          if (typeof pos.y === 'number' && typeof r.depth === 'number') {
            if (pos.y > r.depth) {
              this.warnings.push({
                field: `${prefix}.position.y`,
                message: `灯具 Y 坐标 (${pos.y}) 超出房间深度 (${r.depth})`,
              });
            }
          }
          if (typeof pos.z === 'number' && typeof r.height === 'number') {
            if (pos.z > r.height) {
              this.warnings.push({
                field: `${prefix}.position.z`,
                message: `灯具 Z 坐标 (${pos.z}) 超出房间高度 (${r.height})`,
              });
            }
          }
        }
      } else {
        this.errors.push({
          field: `${prefix}.position`,
          message: '位置信息缺失',
        });
      }

      this.validateTimeSlots(`${prefix}.timeSlots`, f.timeSlots);
    }
  }

  private validateTimeSlots(field: string, slots: unknown): void {
    if (!slots || !Array.isArray(slots)) {
      this.errors.push({
        field,
        message: '时段列表缺失或不是数组',
      });
      return;
    }

    if (slots.length === 0) {
      this.warnings.push({
        field,
        message: '时段列表为空，灯具将不会开启',
      });
    }

    const parsedSlots: TimeSlot[] = [];

    for (let i = 0; i < slots.length; i++) {
      const slot = slots[i];
      const prefix = `${field}[${i}]`;

      if (!slot || typeof slot !== 'object') {
        this.errors.push({
          field: prefix,
          message: '时段不是有效对象',
        });
        continue;
      }

      const s = slot as Record<string, unknown>;

      let valid = true;
      if (!this.validateHour(`${prefix}.startHour`, s.startHour)) valid = false;
      if (!this.validateHour(`${prefix}.endHour`, s.endHour)) valid = false;

      if (valid && typeof s.startHour === 'number' && typeof s.endHour === 'number') {
        if (s.startHour >= s.endHour) {
          this.errors.push({
            field: prefix,
            message: `开始时间 (${s.startHour}) 必须早于结束时间 (${s.endHour})`,
          });
        } else {
          parsedSlots.push({
            startHour: s.startHour,
            endHour: s.endHour,
          });
        }
      }
    }

    if (parsedSlots.length > 1) {
      const overlaps = this.findTimeSlotOverlaps(parsedSlots);
      for (const overlap of overlaps) {
        this.warnings.push({
          field,
          message: `时段重叠: 第 ${overlap.index1 + 1} 个时段和第 ${overlap.index2 + 1} 个时段有重叠`,
        });
      }
    }
  }

  private validateHour(field: string, value: unknown): boolean {
    if (value === undefined) {
      this.errors.push({ field, message: '小时值缺失' });
      return false;
    }
    if (typeof value !== 'number') {
      this.errors.push({
        field,
        message: '小时值必须是数字',
        value,
      });
      return false;
    }
    if (value < 0 || value > 24) {
      this.errors.push({
        field,
        message: '小时值应在 0-24 之间',
        value,
      });
      return false;
    }
    return true;
  }

  private findTimeSlotOverlaps(slots: TimeSlot[]): Array<{ index1: number; index2: number }> {
    const overlaps: Array<{ index1: number; index2: number }> = [];

    for (let i = 0; i < slots.length; i++) {
      for (let j = i + 1; j < slots.length; j++) {
        if (this.doSlotsOverlap(slots[i], slots[j])) {
          overlaps.push({ index1: i, index2: j });
        }
      }
    }

    return overlaps;
  }

  private doSlotsOverlap(slot1: TimeSlot, slot2: TimeSlot): boolean {
    return !(slot1.endHour <= slot2.startHour || slot2.endHour <= slot1.startHour);
  }

  private validateElectricity(electricity: unknown): void {
    if (!electricity || typeof electricity !== 'object') {
      this.errors.push({
        field: 'electricity',
        message: '电费配置缺失或不是有效对象',
      });
      return;
    }

    const e = electricity as Record<string, unknown>;

    this.validatePositiveNumber('electricity.pricePerKwh', e.pricePerKwh);
    this.validatePositiveNumber('electricity.dailyBudget', e.dailyBudget);
  }

  private validateCrossFieldRules(scenario: LightingScenario): void {
    for (const fixture of scenario.fixtures) {
      const model = scenario.lightModels.find(m => m.id === fixture.modelId);
      if (!model) continue;

      for (const tray of scenario.plantTrays) {
        if (fixture.position.z <= tray.height) {
          this.warnings.push({
            field: `fixtures[${scenario.fixtures.indexOf(fixture)}].position.z`,
            message: `灯具 "${fixture.id}" 安装高度 (${fixture.position.z}m) 低于或等于植物托盘 "${tray.id}" 高度 (${tray.height}m)`,
          });
        }
      }
    }

    this.checkTrayPositionsInRoom(scenario);
  }

  private checkTrayPositionsInRoom(scenario: LightingScenario): void {
    for (let i = 0; i < scenario.plantTrays.length; i++) {
      const tray = scenario.plantTrays[i];
      const prefix = `plantTrays[${i}]`;

      const trayRight = tray.position.x + tray.position.width;
      const trayBack = tray.position.y + tray.position.depth;

      if (trayRight > scenario.room.width) {
        this.warnings.push({
          field: `${prefix}.position`,
          message: `托盘 "${tray.id}" 超出房间宽度 (右侧: ${trayRight}m > 房间宽度: ${scenario.room.width}m)`,
        });
      }

      if (trayBack > scenario.room.depth) {
        this.warnings.push({
          field: `${prefix}.position`,
          message: `托盘 "${tray.id}" 超出房间深度 (后侧: ${trayBack}m > 房间深度: ${scenario.room.depth}m)`,
        });
      }
    }
  }

  private validateRequiredField(
    field: string,
    value: unknown,
    expectedType: 'string' | 'number' | 'boolean'
  ): boolean {
    if (value === undefined || value === null) {
      this.errors.push({
        field,
        message: `必填字段缺失`,
      });
      return false;
    }

    if (typeof value !== expectedType) {
      this.errors.push({
        field,
        message: `期望类型为 "${expectedType}"，实际为 "${typeof value}"`,
        value,
      });
      return false;
    }

    if (expectedType === 'string' && (value as string).trim() === '') {
      this.errors.push({
        field,
        message: '字符串不能为空',
      });
      return false;
    }

    return true;
  }

  private validatePositiveNumber(field: string, value: unknown): boolean {
    if (value === undefined) {
      this.errors.push({ field, message: '字段缺失' });
      return false;
    }

    if (typeof value !== 'number') {
      this.errors.push({
        field,
        message: '必须是数字',
        value,
      });
      return false;
    }

    if (value <= 0) {
      this.errors.push({
        field,
        message: '必须大于 0',
        value,
      });
      return false;
    }

    return true;
  }

  private validateNonNegativeNumber(field: string, value: unknown): boolean {
    if (value === undefined) {
      this.errors.push({ field, message: '字段缺失' });
      return false;
    }

    if (typeof value !== 'number') {
      this.errors.push({
        field,
        message: '必须是数字',
        value,
      });
      return false;
    }

    if (value < 0) {
      this.errors.push({
        field,
        message: '必须大于或等于 0',
        value,
      });
      return false;
    }

    return true;
  }

  private result(): ValidationResult {
    return {
      valid: this.errors.length === 0,
      errors: [...this.errors],
      warnings: [...this.warnings],
    };
  }
}
