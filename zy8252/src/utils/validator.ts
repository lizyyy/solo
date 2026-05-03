import dayjs from "dayjs";
import {
  Buoy,
  BatteryLog,
  Repair,
  WeatherRecord,
  LampRulesConfig,
  ValidationError,
  ValidationResult,
} from "../types";

function addError(
  errors: ValidationError[],
  file: string,
  row: number,
  field: string,
  message: string,
  severity: "error" | "warning" = "error"
): void {
  errors.push({
    file,
    row,
    field,
    message,
    severity,
  });
}

function isValidDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const date = dayjs(dateStr);
  return date.isValid();
}

function isValidCoordinate(lat: number | null, lon: number | null): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  if (lat === null || lon === null) {
    issues.push("坐标值为空");
    return { valid: false, issues };
  }

  if (lat < -90 || lat > 90) {
    issues.push(`纬度值 ${lat} 超出有效范围 [-90, 90]`);
  }

  if (lon < -180 || lon > 180) {
    issues.push(`经度值 ${lon} 超出有效范围 [-180, 180]`);
  }

  return { valid: issues.length === 0, issues };
}

export function validateBuoys(buoys: Buoy[]): ValidationError[] {
  const errors: ValidationError[] = [];

  const seenIds = new Set<string>();

  buoys.forEach((buoy, index) => {
    const rowNumber = index + 2;

    if (!buoy.id || buoy.id.trim() === "") {
      addError(errors, "buoys.csv", rowNumber, "id", "航标ID不能为空");
    } else if (seenIds.has(buoy.id)) {
      addError(errors, "buoys.csv", rowNumber, "id", `航标ID "${buoy.id}" 重复`);
    } else {
      seenIds.add(buoy.id);
    }

    if (!buoy.name || buoy.name.trim() === "") {
      addError(errors, "buoys.csv", rowNumber, "name", "航标名称不能为空");
    }

    if (buoy.latitude === null || buoy.longitude === null) {
      addError(
        errors,
        "buoys.csv",
        rowNumber,
        "coordinates",
        "航标坐标缺失，将使用默认位置进行后续计算",
        "warning"
      );
    } else {
      const coordCheck = isValidCoordinate(buoy.latitude, buoy.longitude);
      if (!coordCheck.valid) {
        addError(
          errors,
          "buoys.csv",
          rowNumber,
          "coordinates",
          coordCheck.issues.join("; "),
          "error"
        );
      }
    }

    if (!buoy.type || buoy.type.trim() === "") {
      addError(errors, "buoys.csv", rowNumber, "type", "航标类型不能为空", "warning");
    }

    if (buoy.battery_capacity <= 0) {
      addError(errors, "buoys.csv", rowNumber, "battery_capacity", "电池容量必须大于0");
    }

    if (!buoy.lamp_type || buoy.lamp_type.trim() === "") {
      addError(errors, "buoys.csv", rowNumber, "lamp_type", "灯质类型不能为空", "warning");
    }

    if (buoy.install_date && !isValidDate(buoy.install_date)) {
      addError(errors, "buoys.csv", rowNumber, "install_date", `无效的日期格式: ${buoy.install_date}`);
    }
  });

  return errors;
}

export function validateBatteryLogs(logs: BatteryLog[], buoyIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];

  logs.forEach((log, index) => {
    const rowNumber = index + 2;

    if (!log.buoy_id || log.buoy_id.trim() === "") {
      addError(errors, "battery_logs.jsonl", rowNumber, "buoy_id", "航标ID不能为空");
    } else if (!buoyIds.has(log.buoy_id)) {
      addError(
        errors,
        "battery_logs.jsonl",
        rowNumber,
        "buoy_id",
        `航标ID "${log.buoy_id}" 在 buoys.csv 中不存在`,
        "warning"
      );
    }

    if (!log.timestamp || log.timestamp.trim() === "") {
      addError(errors, "battery_logs.jsonl", rowNumber, "timestamp", "时间戳不能为空");
    } else if (!isValidDate(log.timestamp)) {
      addError(errors, "battery_logs.jsonl", rowNumber, "timestamp", `无效的日期时间格式: ${log.timestamp}`);
    }

    if (log.voltage < 0 || log.voltage > 50) {
      addError(errors, "battery_logs.jsonl", rowNumber, "voltage", `电压值 ${log.voltage} 超出合理范围 [0, 50]V`);
    }

    if (log.state_of_charge < 0 || log.state_of_charge > 100) {
      addError(
        errors,
        "battery_logs.jsonl",
        rowNumber,
        "state_of_charge",
        `电池电量 ${log.state_of_charge}% 超出有效范围 [0, 100]`
      );
    }
  });

  return errors;
}

export function validateRepairs(repairs: Repair[], buoyIds: Set<string>): ValidationError[] {
  const errors: ValidationError[] = [];

  repairs.forEach((repair, index) => {
    const rowNumber = index + 2;

    if (!repair.id || repair.id.trim() === "") {
      addError(errors, "repairs.csv", rowNumber, "id", "维修记录ID不能为空");
    }

    if (!repair.buoy_id || repair.buoy_id.trim() === "") {
      addError(errors, "repairs.csv", rowNumber, "buoy_id", "航标ID不能为空");
    } else if (!buoyIds.has(repair.buoy_id)) {
      addError(
        errors,
        "repairs.csv",
        rowNumber,
        "buoy_id",
        `航标ID "${repair.buoy_id}" 在 buoys.csv 中不存在`,
        "warning"
      );
    }

    if (!repair.repair_date || !isValidDate(repair.repair_date)) {
      addError(errors, "repairs.csv", rowNumber, "repair_date", `无效的维修日期: ${repair.repair_date}`);
    }

    if (repair.resolved && repair.resolution_date && !isValidDate(repair.resolution_date)) {
      addError(errors, "repairs.csv", rowNumber, "resolution_date", `无效的解决日期: ${repair.resolution_date}`);
    }

    if (repair.resolved && !repair.resolution_date) {
      addError(
        errors,
        "repairs.csv",
        rowNumber,
        "resolution_date",
        "标记为已解决但缺少解决日期",
        "warning"
      );
    }
  });

  return errors;
}

export function validateWeatherRecords(records: WeatherRecord[]): ValidationError[] {
  const errors: ValidationError[] = [];

  records.forEach((record, index) => {
    const rowNumber = index + 2;

    if (!record.date || !isValidDate(record.date)) {
      addError(errors, "weather.csv", rowNumber, "date", `无效的日期格式: ${record.date}`);
    }

    if (record.wind_speed < 0) {
      addError(errors, "weather.csv", rowNumber, "wind_speed", `风速不能为负值: ${record.wind_speed}`);
    }

    if (record.visibility < 0) {
      addError(errors, "weather.csv", rowNumber, "visibility", `能见度不能为负值: ${record.visibility}`);
    }

    if (record.wave_height < 0) {
      addError(errors, "weather.csv", rowNumber, "wave_height", `浪高不能为负值: ${record.wave_height}`);
    }
  });

  return errors;
}

export function validateLampRules(rules: LampRulesConfig): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!rules.default_rule) {
    addError(errors, "lamp_rules.yaml", 1, "default_rule", "缺少默认灯质规则");
  } else {
    const defaultRule = rules.default_rule;
    if (defaultRule.daily_consumption <= 0) {
      addError(errors, "lamp_rules.yaml", 1, "default_rule.daily_consumption", "每日耗电量必须大于0");
    }
    if (defaultRule.min_voltage >= defaultRule.max_voltage) {
      addError(errors, "lamp_rules.yaml", 1, "default_rule.voltage", "最小电压必须小于最大电压");
    }
    if (defaultRule.critical_soc <= 0 || defaultRule.critical_soc >= 100) {
      addError(errors, "lamp_rules.yaml", 1, "default_rule.critical_soc", "临界电量应在 (0, 100) 范围内");
    }
    if (defaultRule.inspection_interval_days <= 0) {
      addError(errors, "lamp_rules.yaml", 1, "default_rule.inspection_interval_days", "巡检间隔天数必须大于0");
    }
  }

  if (rules.rules && rules.rules.length > 0) {
    rules.rules.forEach((rule, index) => {
      const rowNumber = index + 2;
      if (!rule.lamp_type || rule.lamp_type.trim() === "") {
        addError(errors, "lamp_rules.yaml", rowNumber, "lamp_type", "灯质类型不能为空");
      }
      if (rule.daily_consumption <= 0) {
        addError(errors, "lamp_rules.yaml", rowNumber, "daily_consumption", "每日耗电量必须大于0");
      }
    });
  }

  return errors;
}

export function validateAll(
  buoys: Buoy[],
  batteryLogs: BatteryLog[],
  repairs: Repair[],
  weatherRecords: WeatherRecord[],
  lampRules: LampRulesConfig
): ValidationResult {
  const buoyIds = new Set(buoys.map((b) => b.id));

  const allErrors: ValidationError[] = [
    ...validateBuoys(buoys),
    ...validateBatteryLogs(batteryLogs, buoyIds),
    ...validateRepairs(repairs, buoyIds),
    ...validateWeatherRecords(weatherRecords),
    ...validateLampRules(lampRules),
  ];

  const errors = allErrors.filter((e) => e.severity === "error");
  const warnings = allErrors.filter((e) => e.severity === "warning");

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
