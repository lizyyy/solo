import * as path from "path";
import { Command } from "commander";
import { readAllFiles } from "../utils/file-reader";
import { validateAll } from "../utils/validator";
import { ValidationResult } from "../types";

export function printValidationResult(result: ValidationResult): void {
  console.log("\n========================================");
  console.log("  数据校验结果");
  console.log("========================================\n");

  if (result.valid) {
    console.log("✅ 校验通过！所有数据格式正确。\n");
  } else {
    console.log(`❌ 校验失败！发现 ${result.errors.length} 个错误。\n`);

    console.log("--- 错误列表 ---\n");
    result.errors.forEach((error, index) => {
      console.log(`${index + 1}. [${error.file}:${error.row}]`);
      console.log(`   字段: ${error.field}`);
      console.log(`   问题: ${error.message}\n`);
    });
  }

  if (result.warnings.length > 0) {
    console.log(`⚠️  发现 ${result.warnings.length} 个警告：\n`);
    result.warnings.forEach((warning, index) => {
      console.log(`${index + 1}. [${warning.file}:${warning.row}]`);
      console.log(`   字段: ${warning.field}`);
      console.log(`   问题: ${warning.message}\n`);
    });
  }

  console.log("========================================\n");
}

export async function executeValidate(dataDir: string): Promise<ValidationResult> {
  const resolvedDir = path.resolve(dataDir);

  console.log(`\n📂 正在读取数据目录: ${resolvedDir}`);
  console.log("📋 正在校验输入文件...\n");

  const inputFiles = await readAllFiles({ dataDir: resolvedDir });

  console.log(`   ✅ 已读取 ${inputFiles.buoys.length} 个航标记录`);
  console.log(`   ✅ 已读取 ${inputFiles.batteryLogs.length} 条电池日志`);
  console.log(`   ✅ 已读取 ${inputFiles.repairs.length} 条维修记录`);
  console.log(`   ✅ 已读取 ${inputFiles.weatherRecords.length} 条天气记录`);
  console.log(`   ✅ 已读取 ${inputFiles.lampRules.rules?.length || 0} 个灯质规则`);

  const result = validateAll(
    inputFiles.buoys,
    inputFiles.batteryLogs,
    inputFiles.repairs,
    inputFiles.weatherRecords,
    inputFiles.lampRules
  );

  printValidationResult(result);

  return result;
}

export function registerValidateCommand(program: Command): void {
  program
    .command("validate")
    .description("校验输入数据文件的字段格式和坐标有效性")
    .option("--data-dir <path>", "数据目录路径，包含所有输入文件", "./data")
    .action(async (options) => {
      try {
        const result = await executeValidate(options.dataDir);
        process.exit(result.valid ? 0 : 1);
      } catch (error) {
        console.error("\n❌ 校验过程中发生错误:");
        console.error(error instanceof Error ? error.message : String(error));
        process.exit(1);
      }
    });
}
