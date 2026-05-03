import * as path from "path";
import * as fs from "fs";
import { Command } from "commander";
import dayjs from "dayjs";
import { readAllFiles } from "../utils/file-reader";
import { validateAll } from "../utils/validator";
import { processDailyStatuses } from "../utils/data-processor";
import {
  DailyBuoyStatus,
  InputFiles,
} from "../types";

export interface RunResult {
  success: boolean;
  dailyStatuses: DailyBuoyStatus[];
  inputFiles: InputFiles;
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs };
}

export function printRunSummary(
  dailyStatuses: DailyBuoyStatus[],
  dateRange: { start: dayjs.Dayjs; end: dayjs.Dayjs }
): void {
  console.log("\n========================================");
  console.log("  数据处理结果摘要");
  console.log("========================================\n");

  console.log(`📅 分析周期: ${dateRange.start.format("YYYY-MM-DD")} 至 ${dateRange.end.format("YYYY-MM-DD")}`);
  console.log(`📊 总计生成 ${dailyStatuses.length} 条日状态记录\n`);

  const uniqueBuoyIds = new Set(dailyStatuses.map((s) => s.buoy_id));
  console.log(`⚓ 涉及航标数量: ${uniqueBuoyIds.size} 个\n`);

  const latestDateMap = new Map<string, DailyBuoyStatus>();
  dailyStatuses.forEach((status) => {
    const existing = latestDateMap.get(status.buoy_id);
    if (!existing || dayjs(status.date).isAfter(dayjs(existing.date))) {
      latestDateMap.set(status.buoy_id, status);
    }
  });
  const latestStatuses = Array.from(latestDateMap.values());

  const criticalBatteries = latestStatuses.filter((s) => s.battery.is_critical).length;
  const lowBatteries = latestStatuses.filter((s) => s.battery.is_low).length;
  const faultyLamps = latestStatuses.filter((s) => !s.lamp.operational).length;
  const inspectionDue = latestStatuses.filter((s) => s.lamp.inspection_due).length;
  const activeAlerts = latestStatuses.filter((s) => s.active_alerts.length > 0).length;
  const pendingReinspections = latestStatuses.filter(
    (s) => s.weather_window && s.weather_window.status !== "completed"
  ).length;

  console.log("--- 最新状态汇总 ---");
  console.log(`  🔋 电池状态:`);
  console.log(`     - 临界: ${criticalBatteries} 个`);
  console.log(`     - 偏低: ${lowBatteries} 个`);
  console.log(`  💡 灯质状态:`);
  console.log(`     - 故障: ${faultyLamps} 个`);
  console.log(`     - 巡检到期: ${inspectionDue} 个`);
  console.log(`  🚨 告警状态:`);
  console.log(`     - 活跃告警: ${activeAlerts} 个`);
  console.log(`  🌧️  复巡状态:`);
  console.log(`     - 待执行/错过: ${pendingReinspections} 个\n`);

  const requiresAttention = latestStatuses.filter((s) => s.requires_attention).length;
  if (requiresAttention > 0) {
    console.log(`⚠️  有 ${requiresAttention} 个航标需要关注\n`);
  } else {
    console.log("✅ 所有航标状态正常\n");
  }

  console.log("========================================\n");
}

export async function executeRun(
  dataDir: string,
  skipValidation: boolean = false
): Promise<RunResult> {
  const resolvedDir = path.resolve(dataDir);

  console.log(`\n📂 正在读取数据目录: ${resolvedDir}`);
  console.log("⚙️  正在执行数据处理...\n");

  const inputFiles = await readAllFiles({ dataDir: resolvedDir });

  if (!skipValidation) {
    console.log("📋 正在校验数据...");
    const validationResult = validateAll(
      inputFiles.buoys,
      inputFiles.batteryLogs,
      inputFiles.repairs,
      inputFiles.weatherRecords,
      inputFiles.lampRules
    );

    if (!validationResult.valid) {
      console.error("\n❌ 数据校验失败，无法继续处理:");
      validationResult.errors.forEach((error) => {
        console.error(`   [${error.file}:${error.row}] ${error.field}: ${error.message}`);
      });
      throw new Error("数据校验失败");
    }

    if (validationResult.warnings.length > 0) {
      console.log(`\n⚠️  发现 ${validationResult.warnings.length} 个警告（继续处理）:`);
      validationResult.warnings.forEach((warning) => {
        console.log(`   [${warning.file}:${warning.row}] ${warning.field}: ${warning.message}`);
      });
    }
  }

  console.log("\n🔄 正在按天重建航标状态...");

  const { dailyStatuses, dateRange } = processDailyStatuses(inputFiles);

  printRunSummary(dailyStatuses, dateRange);

  return {
    success: true,
    dailyStatuses,
    inputFiles,
    dateRange,
  };
}

export function registerRunCommand(program: Command): void {
  program
    .command("run")
    .description("按天重建每个航标的电池余量、灯质状态、告警消缺和恶劣天气复巡窗口")
    .option("--data-dir <path>", "数据目录路径，包含所有输入文件", "./data")
    .option("--skip-validation", "跳过数据校验步骤", false)
    .option("--output <path>", "处理结果输出目录（用于后续导出）", "./output")
    .action(async (options) => {
      try {
        const result = await executeRun(options.dataDir, options.skipValidation);

        if (options.output) {
          const outputPath = path.resolve(options.output, "processed_data.json");
          const outputDir = path.dirname(outputPath);

          if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
          }

          const exportData = {
            generated_at: dayjs().toISOString(),
            date_range: {
              start: result.dateRange.start.format("YYYY-MM-DD"),
              end: result.dateRange.end.format("YYYY-MM-DD"),
            },
            daily_statuses: result.dailyStatuses,
          };

          fs.writeFileSync(outputPath, JSON.stringify(exportData, null, 2), "utf-8");
          console.log(`💾 处理结果已保存到: ${outputPath}`);
        }

        process.exit(0);
      } catch (error) {
        console.error("\n❌ 数据处理过程中发生错误:");
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
