#!/usr/bin/env node

import { Command } from "commander";
import * as fs from "fs";
import * as path from "path";

import { DamageClassifier } from "./classifier";
import {
  ExitCode,
  DamageRecord,
  ClassifierConfig,
  ClassificationResult,
  ClassifierOptions,
} from "./types";
import { logger } from "./logger";

const program = new Command();

program
  .name("ski-damage")
  .description("滑雪装备租赁点雪具损伤归类 CLI 工具")
  .version("1.0.0");

program
  .command("classify")
  .description("对雪具损伤报告进行归类")
  .option("-i, --input <path>", "输入的损伤报告 JSON 文件路径")
  .option("-c, --config <path>", "规则配置文件路径")
  .option("-o, --output <path>", "输出结果的 JSON 文件路径（可选）")
  .option("-v, --verbose", "显示详细日志")
  .option("-r, --reproducible", "生成可复跑的输出格式")
  .action(async (options) => {
    try {
      const exitCode = await runClassification(options);
      process.exit(exitCode);
    } catch (error) {
      logger.error(`执行失败: ${(error as Error).message}`);
      process.exit(ExitCode.ERROR_PROCESSING_FAILED);
    }
  });

async function runClassification(
  options: ClassifierOptions & { input?: string; config?: string; output?: string }
): Promise<ExitCode> {
  if (options.verbose) {
    logger.setVerbose(true);
    logger.detail("启用详细日志模式");
  }

  if (!options.input) {
    logger.error("必须指定输入文件路径 (-i, --input)");
    return ExitCode.ERROR_INVALID_INPUT;
  }

  if (!options.config) {
    logger.error("必须指定规则配置文件路径 (-c, --config)");
    return ExitCode.ERROR_INVALID_INPUT;
  }

  const inputPath = path.resolve(options.input);
  const configPath = path.resolve(options.config);

  if (!fs.existsSync(inputPath)) {
    logger.error(`输入文件不存在: ${inputPath}`);
    return ExitCode.ERROR_INVALID_INPUT;
  }

  if (!fs.existsSync(configPath)) {
    logger.error(`配置文件不存在: ${configPath}`);
    return ExitCode.ERROR_CONFIG_NOT_FOUND;
  }

  logger.info(`读取输入文件: ${inputPath}`);
  const inputData = JSON.parse(fs.readFileSync(inputPath, "utf-8"));
  const records: DamageRecord[] = inputData.records || inputData;

  if (records.length === 0) {
    logger.error("输入文件中没有找到损伤记录");
    return ExitCode.ERROR_NO_RECORDS;
  }

  logger.info(`读取配置文件: ${configPath}`);
  const config: ClassifierConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));

  logger.info(`开始归类 ${records.length} 条损伤记录...`);

  const classifier = new DamageClassifier(config);
  const result = classifier.classify(records);

  logger.logSummary({
    total: result.totalRecords,
    success: result.successfullyClassified,
    partial: result.partiallyClassified,
    failed: result.failedRecords,
    oldDamageRecurrences: result.oldDamageRecurrences,
    missingPhotoAngles: result.missingPhotoAngleCases,
  });

  if (options.output) {
    const outputPath = path.resolve(options.output);
    const outputData = options.reproducible
      ? formatReproducibleOutput(result)
      : result;

    fs.writeFileSync(outputPath, JSON.stringify(outputData, null, 2), "utf-8");
    logger.success(`结果已保存到: ${outputPath}`);
  }

  if (result.errors.length > 0) {
    logger.error(`处理过程中发生 ${result.errors.length} 个错误`);
  }

  if (result.warnings.length > 0) {
    logger.warn(`处理过程中发生 ${result.warnings.length} 个警告`);
  }

  if (result.failedRecords > 0) {
    logger.error(`${result.failedRecords} 条记录处理失败`);
    return ExitCode.ERROR_PROCESSING_FAILED;
  }

  if (result.partiallyClassified > 0) {
    logger.warn(`${result.partiallyClassified} 条记录部分成功（存在旧伤复现或照片角度缺失）`);
    return ExitCode.PARTIAL_SUCCESS;
  }

  logger.success("所有损伤记录归类完成！");
  return ExitCode.SUCCESS;
}

function formatReproducibleOutput(result: ClassificationResult): any {
  return {
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    summary: {
      totalRecords: result.totalRecords,
      successfullyClassified: result.successfullyClassified,
      partiallyClassified: result.partiallyClassified,
      failedRecords: result.failedRecords,
      oldDamageRecurrences: result.oldDamageRecurrences,
      missingPhotoAngleCases: result.missingPhotoAngleCases,
    },
    results: result.results.map((r) => ({
      id: r.id,
      equipmentId: r.equipmentId,
      category: r.category,
      severity: r.severity,
      classificationConfidence: r.classificationConfidence,
      isOldDamageRecurrence: r.isOldDamageRecurrence,
      hasMissingPhotoAngles: r.hasMissingPhotoAngles,
      notes: r.notes,
    })),
    errors: result.errors,
    warnings: result.warnings,
  };
}

program.parseAsync(process.argv).catch((error) => {
  logger.error(`命令解析失败: ${error.message}`);
  process.exit(ExitCode.ERROR_PROCESSING_FAILED);
});
