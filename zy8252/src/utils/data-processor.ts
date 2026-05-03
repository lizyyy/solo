import dayjs from "dayjs";
import isBetween from "dayjs/plugin/isBetween";
import {
  Buoy,
  BatteryLog,
  Repair,
  WeatherRecord,
  LampRulesConfig,
  LampRule,
  DailyBatteryStatus,
  DailyLampStatus,
  Alert,
  ReinspectionWindow,
  DailyBuoyStatus,
  InputFiles,
} from "../types";

dayjs.extend(isBetween);

function getLampRule(lampType: string, rules: LampRulesConfig): LampRule {
  const specificRule = rules.rules?.find((r) => r.lamp_type === lampType);
  return specificRule || rules.default_rule;
}

export function getDateRange(
  batteryLogs: BatteryLog[],
  weatherRecords: WeatherRecord[],
  repairs: Repair[]
): { start: dayjs.Dayjs; end: dayjs.Dayjs } {
  const allDates: dayjs.Dayjs[] = [];

  batteryLogs.forEach((log) => {
    if (log.timestamp) {
      allDates.push(dayjs(log.timestamp));
    }
  });

  weatherRecords.forEach((record) => {
    if (record.date) {
      allDates.push(dayjs(record.date));
    }
  });

  repairs.forEach((repair) => {
    if (repair.repair_date) {
      allDates.push(dayjs(repair.repair_date));
    }
    if (repair.resolution_date) {
      allDates.push(dayjs(repair.resolution_date));
    }
  });

  if (allDates.length === 0) {
    const today = dayjs();
    return { start: today.subtract(30, "day"), end: today };
  }

  const sortedDates = allDates.sort((a, b) => a.valueOf() - b.valueOf());
  return {
    start: sortedDates[0].startOf("day"),
    end: sortedDates[sortedDates.length - 1].endOf("day"),
  };
}

export function reconstructBatteryStatus(
  buoy: Buoy,
  batteryLogs: BatteryLog[],
  lampRule: LampRule,
  date: dayjs.Dayjs
): DailyBatteryStatus {
  const dateStr = date.format("YYYY-MM-DD");
  const buoyLogs = batteryLogs
    .filter((log) => log.buoy_id === buoy.id)
    .sort((a, b) => dayjs(a.timestamp).valueOf() - dayjs(b.timestamp).valueOf());

  const logsOnDate = buoyLogs.filter((log) => {
    const logDate = dayjs(log.timestamp).startOf("day");
    return logDate.isSame(date.startOf("day"));
  });

  let soc: number;
  let voltage: number;

  if (logsOnDate.length > 0) {
    const lastLog = logsOnDate[logsOnDate.length - 1];
    soc = lastLog.state_of_charge;
    voltage = lastLog.voltage;
  } else {
    const lastLogBefore = buoyLogs.find((log) => {
      const logDate = dayjs(log.timestamp).startOf("day");
      return logDate.isBefore(date.startOf("day"));
    });

    if (lastLogBefore) {
      const daysDiff = date.startOf("day").diff(dayjs(lastLogBefore.timestamp).startOf("day"), "day");
      soc = Math.max(0, lastLogBefore.state_of_charge - lampRule.daily_consumption * daysDiff);
      voltage = lastLogBefore.voltage - (12 - lastLogBefore.voltage) * (daysDiff * 0.05);
    } else {
      soc = 80;
      voltage = 12.5;
    }
  }

  const isCritical = soc <= lampRule.critical_soc;
  const isLow = soc <= lampRule.critical_soc * 1.5 && !isCritical;

  return {
    buoy_id: buoy.id,
    date: dateStr,
    state_of_charge: Math.round(soc * 100) / 100,
    voltage: Math.round(voltage * 100) / 100,
    is_low: isLow,
    is_critical: isCritical,
  };
}

export function reconstructLampStatus(
  buoy: Buoy,
  repairs: Repair[],
  lampRule: LampRule,
  date: dayjs.Dayjs
): DailyLampStatus {
  const dateStr = date.format("YYYY-MM-DD");

  const buoyRepairs = repairs
    .filter((r) => r.buoy_id === buoy.id)
    .sort((a, b) => dayjs(a.repair_date).valueOf() - dayjs(b.repair_date).valueOf());

  const lastRepair = buoyRepairs
    .filter((r) => dayjs(r.repair_date).isBefore(date) || dayjs(r.repair_date).isSame(date))
    .sort((a, b) => dayjs(b.repair_date).valueOf() - dayjs(a.repair_date).valueOf())[0];

  let operational = true;
  let faultCode: string | null = null;

  if (lastRepair && !lastRepair.resolved) {
    operational = false;
    faultCode = lastRepair.issue_type;
  }

  const lastInspection = buoyRepairs
    .filter((r) => r.issue_type === "inspection" || r.issue_type === "巡检")
    .filter((r) => dayjs(r.repair_date).isBefore(date) || dayjs(r.repair_date).isSame(date))
    .sort((a, b) => dayjs(b.repair_date).valueOf() - dayjs(a.repair_date).valueOf())[0];

  let inspectionDue = false;
  let lastInspectionDate: string | null = null;

  if (lastInspection) {
    lastInspectionDate = lastInspection.repair_date;
    const daysSinceInspection = date.diff(dayjs(lastInspection.repair_date), "day");
    inspectionDue = daysSinceInspection >= lampRule.inspection_interval_days;
  } else if (buoy.install_date) {
    const daysSinceInstall = date.diff(dayjs(buoy.install_date), "day");
    inspectionDue = daysSinceInstall >= lampRule.inspection_interval_days;
  }

  return {
    buoy_id: buoy.id,
    date: dateStr,
    operational,
    fault_code: faultCode,
    last_inspection: lastInspectionDate,
    inspection_due: inspectionDue,
  };
}

export function getActiveAlerts(
  buoy: Buoy,
  repairs: Repair[],
  date: dayjs.Dayjs
): Alert[] {
  const alerts: Alert[] = [];

  const buoyRepairs = repairs.filter((r) => r.buoy_id === buoy.id);

  buoyRepairs.forEach((repair) => {
    const repairDate = dayjs(repair.repair_date);

    if (repairDate.isAfter(date)) {
      return;
    }

    if (!repair.resolved || (repair.resolution_date && dayjs(repair.resolution_date).isAfter(date))) {
      alerts.push({
        buoy_id: buoy.id,
        date: repair.repair_date,
        alert_type: repair.issue_type,
        description: repair.description,
        resolved: repair.resolved && repair.resolution_date ? dayjs(repair.resolution_date).isBefore(date) : false,
        resolved_date: repair.resolution_date,
        resolved_by: repair.technician,
      });
    }
  });

  return alerts;
}

export function calculateReinspectionWindows(
  buoy: Buoy,
  weatherRecords: WeatherRecord[],
  repairs: Repair[],
  date: dayjs.Dayjs
): ReinspectionWindow | null {
  const severeWeather = weatherRecords.filter((r) => r.is_severe);

  if (severeWeather.length === 0) {
    return null;
  }

  const dateStr = date.format("YYYY-MM-DD");

  for (const weather of severeWeather) {
    const severeStart = dayjs(weather.date).startOf("day");
    const severeEnd = severeStart.add(1, "day").endOf("day");

    if (date.isBetween(severeStart, severeEnd, "day", "[]")) {
      const windowStart = severeEnd.add(1, "day");
      const windowEnd = windowStart.add(3, "day");

      const hasReinspection = repairs.some((r) => {
        if (r.buoy_id !== buoy.id) return false;
        if (r.issue_type !== "reinspection" && r.issue_type !== "复巡") return false;
        const repairDate = dayjs(r.repair_date);
        return repairDate.isBetween(windowStart, windowEnd, "day", "[]");
      });

      let status: "pending" | "completed" | "missed" = "pending";
      let completedDate: string | null = null;

      if (hasReinspection) {
        status = "completed";
        const reinspection = repairs.find((r) => {
          if (r.buoy_id !== buoy.id) return false;
          if (r.issue_type !== "reinspection" && r.issue_type !== "复巡") return false;
          const repairDate = dayjs(r.repair_date);
          return repairDate.isBetween(windowStart, windowEnd, "day", "[]");
        });
        completedDate = reinspection?.repair_date || null;
      } else if (date.isAfter(windowEnd)) {
        status = "missed";
      }

      return {
        buoy_id: buoy.id,
        window_start: windowStart.format("YYYY-MM-DD"),
        window_end: windowEnd.format("YYYY-MM-DD"),
        reason: `恶劣天气后复巡 (${weather.weather_condition})`,
        status,
        completed_date: completedDate,
      };
    }
  }

  return null;
}

export function processDailyStatuses(
  inputFiles: InputFiles
): {
  dailyStatuses: DailyBuoyStatus[];
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs };
} {
  const { buoys, batteryLogs, repairs, weatherRecords, lampRules } = inputFiles;

  const dateRange = getDateRange(batteryLogs, weatherRecords, repairs);
  const dailyStatuses: DailyBuoyStatus[] = [];

  let currentDate = dateRange.start.startOf("day");
  const endDate = dateRange.end.endOf("day");

  while (currentDate.isBefore(endDate) || currentDate.isSame(endDate)) {
    for (const buoy of buoys) {
      const lampRule = getLampRule(buoy.lamp_type, lampRules);

      const batteryStatus = reconstructBatteryStatus(buoy, batteryLogs, lampRule, currentDate);
      const lampStatus = reconstructLampStatus(buoy, repairs, lampRule, currentDate);
      const activeAlerts = getActiveAlerts(buoy, repairs, currentDate);
      const weatherWindow = calculateReinspectionWindows(buoy, weatherRecords, repairs, currentDate);

      const requiresAttention =
        batteryStatus.is_critical ||
        batteryStatus.is_low ||
        !lampStatus.operational ||
        lampStatus.inspection_due ||
        activeAlerts.length > 0 ||
        (weatherWindow !== null && weatherWindow.status !== "completed");

      dailyStatuses.push({
        buoy_id: buoy.id,
        date: currentDate.format("YYYY-MM-DD"),
        battery: batteryStatus,
        lamp: lampStatus,
        active_alerts: activeAlerts,
        weather_window: weatherWindow,
        requires_attention: requiresAttention,
      });
    }

    currentDate = currentDate.add(1, "day");
  }

  return { dailyStatuses, dateRange };
}
