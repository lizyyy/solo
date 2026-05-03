import {
  DataFiles,
  ValidationResult,
  ValidationError,
  Cabinet,
  SlotTemperature,
  SwapEvent,
  BatteryRegistry,
  AlertRule,
} from '../types';

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

function validateCabinets(cabinets: Cabinet[]): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const cabinetIds = new Set<string>();

  cabinets.forEach((cabinet, index) => {
    if (!cabinet.cabinetId || cabinet.cabinetId.trim() === '') {
      errors.push({
        field: 'cabinetId',
        message: 'cabinetId 不能为空',
        rowNumber: index + 1,
      });
    } else if (cabinetIds.has(cabinet.cabinetId)) {
      errors.push({
        field: 'cabinetId',
        message: `cabinetId ${cabinet.cabinetId} 重复`,
        value: cabinet.cabinetId,
        rowNumber: index + 1,
      });
    } else {
      cabinetIds.add(cabinet.cabinetId);
    }

    if (!cabinet.location || cabinet.location.trim() === '') {
      warnings.push({
        field: 'location',
        message: 'location 为空',
        rowNumber: index + 1,
      });
    }

    if (!cabinet.totalSlots || cabinet.totalSlots <= 0) {
      errors.push({
        field: 'totalSlots',
        message: 'totalSlots 必须大于 0',
        value: cabinet.totalSlots,
        rowNumber: index + 1,
      });
    }

    if (cabinet.installedAt && !isValidDate(cabinet.installedAt)) {
      errors.push({
        field: 'installedAt',
        message: 'installedAt 日期格式无效',
        value: cabinet.installedAt,
        rowNumber: index + 1,
      });
    }
  });

  return { errors, warnings };
}

function validateTemperatures(
  temperatures: SlotTemperature[],
  validCabinetIds: Set<string>
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  temperatures.forEach((temp, index) => {
    if (!temp.timestamp || !isValidDate(temp.timestamp)) {
      errors.push({
        field: 'timestamp',
        message: 'timestamp 日期格式无效',
        value: temp.timestamp,
        rowNumber: index + 1,
      });
    }

    if (!temp.cabinetId || temp.cabinetId.trim() === '') {
      errors.push({
        field: 'cabinetId',
        message: 'cabinetId 不能为空',
        rowNumber: index + 1,
      });
    } else if (!validCabinetIds.has(temp.cabinetId)) {
      warnings.push({
        field: 'cabinetId',
        message: `cabinetId ${temp.cabinetId} 不在 cabinets 配置中`,
        value: temp.cabinetId,
        rowNumber: index + 1,
      });
    }

    if (temp.slotId === undefined || temp.slotId === null || temp.slotId <= 0) {
      errors.push({
        field: 'slotId',
        message: 'slotId 必须大于 0',
        value: temp.slotId,
        rowNumber: index + 1,
      });
    }

    if (temp.temperature === null) {
      warnings.push({
        field: 'temperature',
        message: 'temperature 为空（可能是传感器断采）',
        rowNumber: index + 1,
      });
    } else if (temp.temperature !== undefined && (temp.temperature < -40 || temp.temperature > 100)) {
      warnings.push({
        field: 'temperature',
        message: `temperature 值 ${temp.temperature} 超出正常范围 (-40°C ~ 100°C)`,
        value: temp.temperature,
        rowNumber: index + 1,
      });
    }
  });

  return { errors, warnings };
}

function validateSwapEvents(
  events: SwapEvent[],
  validCabinetIds: Set<string>,
  validBatteryIds: Set<string>
): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const eventIds = new Set<string>();

  events.forEach((event, index) => {
    if (!event.eventId || event.eventId.trim() === '') {
      errors.push({
        field: 'eventId',
        message: 'eventId 不能为空',
        rowNumber: index + 1,
      });
    } else if (eventIds.has(event.eventId)) {
      errors.push({
        field: 'eventId',
        message: `eventId ${event.eventId} 重复`,
        value: event.eventId,
        rowNumber: index + 1,
      });
    } else {
      eventIds.add(event.eventId);
    }

    if (!event.timestamp || !isValidDate(event.timestamp)) {
      errors.push({
        field: 'timestamp',
        message: 'timestamp 日期格式无效',
        value: event.timestamp,
        rowNumber: index + 1,
      });
    }

    if (!event.cabinetId || event.cabinetId.trim() === '') {
      errors.push({
        field: 'cabinetId',
        message: 'cabinetId 不能为空',
        rowNumber: index + 1,
      });
    } else if (!validCabinetIds.has(event.cabinetId)) {
      warnings.push({
        field: 'cabinetId',
        message: `cabinetId ${event.cabinetId} 不在 cabinets 配置中`,
        value: event.cabinetId,
        rowNumber: index + 1,
      });
    }

    if (event.slotId === undefined || event.slotId === null || event.slotId <= 0) {
      errors.push({
        field: 'slotId',
        message: 'slotId 必须大于 0',
        value: event.slotId,
        rowNumber: index + 1,
      });
    }

    if (!event.batteryId || event.batteryId.trim() === '') {
      errors.push({
        field: 'batteryId',
        message: 'batteryId 不能为空',
        rowNumber: index + 1,
      });
    } else if (!validBatteryIds.has(event.batteryId)) {
      warnings.push({
        field: 'batteryId',
        message: `batteryId ${event.batteryId} 不在 battery_registry 中`,
        value: event.batteryId,
        rowNumber: index + 1,
      });
    }

    if (event.eventType !== 'in' && event.eventType !== 'out') {
      errors.push({
        field: 'eventType',
        message: 'eventType 必须是 "in" 或 "out"',
        value: event.eventType,
        rowNumber: index + 1,
      });
    }
  });

  return { errors, warnings };
}

function validateBatteryRegistry(batteries: BatteryRegistry[]): {
  errors: ValidationError[];
  warnings: ValidationError[];
} {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const batteryIds = new Set<string>();
  const validStatuses = ['active', 'retired', 'maintenance'];

  batteries.forEach((battery, index) => {
    if (!battery.batteryId || battery.batteryId.trim() === '') {
      errors.push({
        field: 'batteryId',
        message: 'batteryId 不能为空',
        rowNumber: index + 1,
      });
    } else if (batteryIds.has(battery.batteryId)) {
      errors.push({
        field: 'batteryId',
        message: `batteryId ${battery.batteryId} 重复`,
        value: battery.batteryId,
        rowNumber: index + 1,
      });
    } else {
      batteryIds.add(battery.batteryId);
    }

    if (!battery.model || battery.model.trim() === '') {
      warnings.push({
        field: 'model',
        message: 'model 为空',
        rowNumber: index + 1,
      });
    }

    if (!battery.manufacturer || battery.manufacturer.trim() === '') {
      warnings.push({
        field: 'manufacturer',
        message: 'manufacturer 为空',
        rowNumber: index + 1,
      });
    }

    if (battery.productionDate && !isValidDate(battery.productionDate)) {
      errors.push({
        field: 'productionDate',
        message: 'productionDate 日期格式无效',
        value: battery.productionDate,
        rowNumber: index + 1,
      });
    }

    if (!battery.capacity || battery.capacity <= 0) {
      errors.push({
        field: 'capacity',
        message: 'capacity 必须大于 0',
        value: battery.capacity,
        rowNumber: index + 1,
      });
    }

    if (!validStatuses.includes(battery.status)) {
      errors.push({
        field: 'status',
        message: `status 必须是 ${validStatuses.join(', ')} 之一`,
        value: battery.status,
        rowNumber: index + 1,
      });
    }
  });

  return { errors, warnings };
}

function validateRules(rules: AlertRule[]): { errors: ValidationError[]; warnings: ValidationError[] } {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const ruleIds = new Set<string>();
  const validTypes = ['temperature_slope', 'abnormal_swap', 'sensor_failure'];
  const validSeverities = ['low', 'medium', 'high', 'critical'];

  rules.forEach((rule, index) => {
    if (!rule.ruleId || rule.ruleId.trim() === '') {
      errors.push({
        field: 'ruleId',
        message: 'ruleId 不能为空',
        rowNumber: index + 1,
      });
    } else if (ruleIds.has(rule.ruleId)) {
      errors.push({
        field: 'ruleId',
        message: `ruleId ${rule.ruleId} 重复`,
        value: rule.ruleId,
        rowNumber: index + 1,
      });
    } else {
      ruleIds.add(rule.ruleId);
    }

    if (!rule.name || rule.name.trim() === '') {
      warnings.push({
        field: 'name',
        message: 'name 为空',
        rowNumber: index + 1,
      });
    }

    if (!validTypes.includes(rule.type)) {
      errors.push({
        field: 'type',
        message: `type 必须是 ${validTypes.join(', ')} 之一`,
        value: rule.type,
        rowNumber: index + 1,
      });
    }

    if (rule.threshold === undefined || rule.threshold === null) {
      errors.push({
        field: 'threshold',
        message: 'threshold 不能为空',
        rowNumber: index + 1,
      });
    }

    if (!rule.timeWindowMinutes || rule.timeWindowMinutes <= 0) {
      errors.push({
        field: 'timeWindowMinutes',
        message: 'timeWindowMinutes 必须大于 0',
        value: rule.timeWindowMinutes,
        rowNumber: index + 1,
      });
    }

    if (!validSeverities.includes(rule.severity)) {
      errors.push({
        field: 'severity',
        message: `severity 必须是 ${validSeverities.join(', ')} 之一`,
        value: rule.severity,
        rowNumber: index + 1,
      });
    }
  });

  return { errors, warnings };
}

export function validateData(data: DataFiles): ValidationResult {
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  const cabinetIds = new Set(data.cabinets.cabinets.map(c => c.cabinetId));
  const batteryIds = new Set(data.batteryRegistry.map(b => b.batteryId));

  const cabinetsResult = validateCabinets(data.cabinets.cabinets);
  allErrors.push(...cabinetsResult.errors);
  allWarnings.push(...cabinetsResult.warnings);

  const temperaturesResult = validateTemperatures(data.temperatures, cabinetIds);
  allErrors.push(...temperaturesResult.errors);
  allWarnings.push(...temperaturesResult.warnings);

  const swapEventsResult = validateSwapEvents(data.swapEvents, cabinetIds, batteryIds);
  allErrors.push(...swapEventsResult.errors);
  allWarnings.push(...swapEventsResult.warnings);

  const batteryRegistryResult = validateBatteryRegistry(data.batteryRegistry);
  allErrors.push(...batteryRegistryResult.errors);
  allWarnings.push(...batteryRegistryResult.warnings);

  const rulesResult = validateRules(data.rules.rules);
  allErrors.push(...rulesResult.errors);
  allWarnings.push(...rulesResult.warnings);

  return {
    isValid: allErrors.length === 0,
    errors: allErrors,
    warnings: allWarnings,
    stats: {
      totalCabinets: data.cabinets.cabinets.length,
      totalTemperatureRecords: data.temperatures.length,
      totalSwapEvents: data.swapEvents.length,
      totalBatteries: data.batteryRegistry.length,
      totalRules: data.rules.rules.length,
    },
  };
}
