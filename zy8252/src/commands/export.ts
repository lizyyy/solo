import * as path from "path";
import { Command } from "commander";
import { readAllFiles } from "../utils/file-reader";
import { validateAll } from "../utils/validator";
import { processDailyStatuses } from "../utils/data-processor";
import { exportAll } from "../utils/exporter";

export interface ExportResult {
  success: boolean;
  issuesPath: string;
  reportPath: string;
}

export async function executeExport(
  dataDir: string,
  outputDir: string,
  skipValidation: boolean = false
): Promise<ExportResult> {
  const resolvedDataDir = path.resolve(dataDir);
  const resolvedOutputDir = path.resolve(outputDir);

  console.log(`\n📂 正在读取数据目录: ${resolvedDataDir}`);
  console.log(`📤 正在导出到: ${resolvedOutputDir}`);
  console.log("⚙️  正在执行数据处理和导出...\n");

  const inputFiles = await readAllFiles({ dataDir: resolvedDataDir });

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
      console.error("\n❌ 数据校验失败，无法继续导出:");
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

  console.log("📝 正在生成导出文件...");
  const result = await exportAll(
    dailyStatuses,
    inputFiles.buoys,
    inputFiles.weatherRecords,
    inputFiles.lampRules,
    dateRange,
    resolvedOutputDir
  );

  console.log("\n========================================");
  console.log("  导出完成");
  console.log("========================================\n");

  console.log("✅ 已成功导出以下文件:\n");
  console.log(`   📄 issues.csv: ${result.issuesPath}`);
  console.log(`   📄 beacon_report.md: ${result.reportPath}\n`);

  console.log("========================================\n");

  return {
    success: true,
    ...result,
  };
}

export function registerExportCommand(program: Command): void {
  program
    .command("export")
    .description("导出 issues.csv 与 beacon_report.md")
    .option("--data-dir <path>", "数据目录路径，包含所有输入文件", "./data")
    .option("--output-dir <path>", "输出目录路径", "./output")
    .option("--skip-validation", "跳过数据校验步骤", false)
    .action(async (options) => {
      try {
        await executeExport(options.dataDir, options.outputDir, options.skipValidation);
        process.exit(0);
      } catch (error) {
        console.error("\n❌ 导出过程中发生错误:");
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
