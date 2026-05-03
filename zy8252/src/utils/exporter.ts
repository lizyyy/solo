import * as fs from "fs";
import * as path from "path";
import dayjs from "dayjs";
import {
  Issue,
  BeaconReport,
  DailyBuoyStatus,
  Buoy,
  WeatherRecord,
  LampRulesConfig,
} from "../types";

function generateIssueId(): string {
  const timestamp = dayjs().format("YYYYMMDDHHmmss");
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ISSUE-${timestamp}-${random}`;
}

export function generateIssues(
  dailyStatuses: DailyBuoyStatus[],
  buoys: Buoy[]
): Issue[] {
  const issues: Issue[] = [];
  const buoyMap = new Map(buoys.map((b) => [b.id, b]));

  const uniqueIssues = new Map<string, Issue>();

  dailyStatuses.forEach((status) => {
    const buoy = buoyMap.get(status.buoy_id);
    if (!buoy) return;

    if (status.battery.is_critical) {
      const key = `${status.buoy_id}-battery-critical`;
      if (!uniqueIssues.has(key)) {
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: status.date,
          issue_type: "battery_critical",
          description: `电池电量临界 (${status.battery.state_of_charge}%)，需要立即更换或充电`,
          severity: "critical",
          status: "open",
          assigned_to: null,
        });
      }
    } else if (status.battery.is_low) {
      const key = `${status.buoy_id}-battery-low`;
      if (!uniqueIssues.has(key)) {
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: status.date,
          issue_type: "battery_low",
          description: `电池电量偏低 (${status.battery.state_of_charge}%)，建议近期检查`,
          severity: "medium",
          status: "open",
          assigned_to: null,
        });
      }
    }

    if (!status.lamp.operational) {
      const key = `${status.buoy_id}-lamp-fault`;
      if (!uniqueIssues.has(key)) {
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: status.date,
          issue_type: "lamp_fault",
          description: `灯质故障，故障代码: ${status.lamp.fault_code || "未知"}`,
          severity: "high",
          status: "open",
          assigned_to: null,
        });
      }
    }

    if (status.lamp.inspection_due) {
      const key = `${status.buoy_id}-inspection-due`;
      if (!uniqueIssues.has(key)) {
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: status.date,
          issue_type: "inspection_due",
          description: `灯质巡检到期，上次巡检: ${status.lamp.last_inspection || "未知"}`,
          severity: "low",
          status: "open",
          assigned_to: null,
        });
      }
    }

    status.active_alerts.forEach((alert) => {
      const key = `${status.buoy_id}-alert-${alert.alert_type}-${alert.date}`;
      if (!uniqueIssues.has(key) && !alert.resolved) {
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: alert.date,
          issue_type: alert.alert_type,
          description: alert.description,
          severity: "high",
          status: "open",
          assigned_to: alert.resolved_by,
        });
      }
    });

    if (status.weather_window && status.weather_window.status !== "completed") {
      const key = `${status.buoy_id}-reinspection-${status.weather_window.window_start}`;
      if (!uniqueIssues.has(key)) {
        const severity = status.weather_window.status === "missed" ? "high" : "medium";
        uniqueIssues.set(key, {
          id: generateIssueId(),
          buoy_id: status.buoy_id,
          buoy_name: buoy.name,
          date: status.weather_window.window_start,
          issue_type: "reinspection_required",
          description:
            status.weather_window.status === "missed"
              ? `恶劣天气复巡已错过，窗口: ${status.weather_window.window_start} 至 ${status.weather_window.window_end}`
              : `恶劣天气复巡待执行，窗口: ${status.weather_window.window_start} 至 ${status.weather_window.window_end}`,
          severity,
          status: "open",
          assigned_to: null,
        });
      }
    }
  });

  return Array.from(uniqueIssues.values());
}

export function generateBeaconReport(
  dailyStatuses: DailyBuoyStatus[],
  buoys: Buoy[],
  weatherRecords: WeatherRecord[],
  lampRules: LampRulesConfig,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs }
): BeaconReport {
  const issues = generateIssues(dailyStatuses, buoys);

  const latestStatusMap = new Map<string, DailyBuoyStatus>();
  dailyStatuses.forEach((status) => {
    const existing = latestStatusMap.get(status.buoy_id);
    if (!existing || dayjs(status.date).isAfter(dayjs(existing.date))) {
      latestStatusMap.set(status.buoy_id, status);
    }
  });
  const latestStatuses = Array.from(latestStatusMap.values());

  let criticalBatteries = 0;
  let lowBatteries = 0;
  let normalBatteries = 0;

  let operationalLamps = 0;
  let faultyLamps = 0;
  let inspectionDueLamps = 0;

  latestStatuses.forEach((status) => {
    if (status.battery.is_critical) {
      criticalBatteries++;
    } else if (status.battery.is_low) {
      lowBatteries++;
    } else {
      normalBatteries++;
    }

    if (status.lamp.operational) {
      operationalLamps++;
    } else {
      faultyLamps++;
    }

    if (status.lamp.inspection_due) {
      inspectionDueLamps++;
    }
  });

  const severeDays = new Set(
    weatherRecords.filter((r) => r.is_severe).map((r) => r.date)
  ).size;

  const reinspectionsNeeded = new Set(
    dailyStatuses
      .filter((s) => s.weather_window !== null)
      .map((s) => `${s.buoy_id}-${s.weather_window?.window_start}`)
  ).size;

  const reinspectionsCompleted = dailyStatuses.filter(
    (s) => s.weather_window?.status === "completed"
  ).length;

  const buoysWithIssues = new Set(issues.map((i) => i.buoy_id)).size;
  const criticalIssues = issues.filter((i) => i.severity === "critical").length;

  return {
    generated_at: dayjs().format("YYYY-MM-DD HH:mm:ss"),
    period_start: dateRange.start.format("YYYY-MM-DD"),
    period_end: dateRange.end.format("YYYY-MM-DD"),
    total_buoys: buoys.length,
    buoys_with_issues: buoysWithIssues,
    critical_issues: criticalIssues,
    battery_summary: {
      critical: criticalBatteries,
      low: lowBatteries,
      normal: normalBatteries,
    },
    lamp_summary: {
      operational: operationalLamps,
      faulty: faultyLamps,
      inspection_due: inspectionDueLamps,
    },
    weather_impact: {
      severe_days: severeDays,
      reinspections_needed: reinspectionsNeeded,
      reinspections_completed: reinspectionsCompleted,
    },
    issues,
    daily_statuses: dailyStatuses,
  };
}

export function writeIssuesCSV(issues: Issue[], outputPath: string): void {
  const headers = [
    "id",
    "buoy_id",
    "buoy_name",
    "date",
    "issue_type",
    "description",
    "severity",
    "status",
    "assigned_to",
  ];

  const lines = [headers.join(",")];

  issues.forEach((issue) => {
    const values = [
      issue.id,
      issue.buoy_id,
      `"${issue.buoy_name}"`,
      issue.date,
      issue.issue_type,
      `"${issue.description}"`,
      issue.severity,
      issue.status,
      issue.assigned_to || "",
    ];
    lines.push(values.join(","));
  });

  const content = lines.join("\n");
  fs.writeFileSync(outputPath, content, "utf-8");
}

export function writeBeaconReportMD(report: BeaconReport, outputPath: string): void {
  const severityColors: Record<string, string> = {
    critical: "🔴",
    high: "🟠",
    medium: "🟡",
    low: "🟢",
  };

  const statusIcons: Record<string, string> = {
    open: "🔓",
    in_progress: "🔄",
    resolved: "✅",
  };

  let md = `# 航标灯巡检复核报告

## 基本信息

| 项目 | 内容 |
|------|------|
| 生成时间 | ${report.generated_at} |
| 报告周期 | ${report.period_start} 至 ${report.period_end} |
| 航标总数 | ${report.total_buoys} |
| 存在问题航标 | ${report.buoys_with_issues} |
| 紧急问题数 | ${report.critical_issues} |

---

## 电池状态概览

| 状态 | 数量 | 比例 |
|------|------|------|
| 正常 | ${report.battery_summary.normal} | ${((report.battery_summary.normal / report.total_buoys) * 100).toFixed(1)}% |
| 偏低 | ${report.battery_summary.low} | ${((report.battery_summary.low / report.total_buoys) * 100).toFixed(1)}% |
| 临界 | ${report.battery_summary.critical} | ${((report.battery_summary.critical / report.total_buoys) * 100).toFixed(1)}% |

---

## 灯质状态概览

| 状态 | 数量 | 比例 |
|------|------|------|
| 正常运行 | ${report.lamp_summary.operational} | ${((report.lamp_summary.operational / report.total_buoys) * 100).toFixed(1)}% |
| 故障 | ${report.lamp_summary.faulty} | ${((report.lamp_summary.faulty / report.total_buoys) * 100).toFixed(1)}% |
| 巡检到期 | ${report.lamp_summary.inspection_due} | ${((report.lamp_summary.inspection_due / report.total_buoys) * 100).toFixed(1)}% |

---

## 天气影响分析

| 项目 | 数量 |
|------|------|
| 恶劣天气天数 | ${report.weather_impact.severe_days} |
| 需要复巡次数 | ${report.weather_impact.reinspections_needed} |
| 已完成复巡 | ${report.weather_impact.reinspections_completed} |

---

## 问题清单

共 **${report.issues.length}** 个问题需要关注：

`;

  const sortedIssues = [...report.issues].sort((a, b) => {
    const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (severityOrder[a.severity] || 99) - (severityOrder[b.severity] || 99);
  });

  sortedIssues.forEach((issue, index) => {
    md += `
### ${index + 1}. ${severityColors[issue.severity]} ${issue.buoy_name} (${issue.buoy_id})

| 字段 | 内容 |
|------|------|
| 问题类型 | ${issue.issue_type} |
| 严重程度 | ${issue.severity.toUpperCase()} |
| 状态 | ${statusIcons[issue.status]} ${issue.status} |
| 发现日期 | ${issue.date} |
| 负责人 | ${issue.assigned_to || "未分配"} |

**问题描述**: ${issue.description}

---
`;
  });

  md += `
## 附录

本报告由 beacon-inspector 工具自动生成。

- 数据校验时间: ${report.generated_at}
- 报告版本: v1.0.0
`;

  fs.writeFileSync(outputPath, md, "utf-8");
}

export async function exportAll(
  dailyStatuses: DailyBuoyStatus[],
  buoys: Buoy[],
  weatherRecords: WeatherRecord[],
  lampRules: LampRulesConfig,
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs },
  outputDir: string
): Promise<{ issuesPath: string; reportPath: string }> {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const beaconReport = generateBeaconReport(
    dailyStatuses,
    buoys,
    weatherRecords,
    lampRules,
    dateRange
  );

  const issuesPath = path.join(outputDir, "issues.csv");
  const reportPath = path.join(outputDir, "beacon_report.md");

  writeIssuesCSV(beaconReport.issues, issuesPath);
  writeBeaconReportMD(beaconReport, reportPath);

  return { issuesPath, reportPath };
}
