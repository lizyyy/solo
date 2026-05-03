import * as path from 'path';
import * as fs from 'fs-extra';
import chalk from 'chalk';
import { parseManifestFile } from '../../manifest/parser';
import { analyzeAudioFile } from '../../audio';
import { ValidationResult, InspectionResult, FileInspection, ReportData } from '../../types';
import {
  runValidation,
  ValidationContext,
} from '../../validation/validator';
import {
  generateReportData,
  generateAllReports,
  writeReport,
  ReportFormat,
} from '../../report/generator';
import { formatTime } from '../../utils/time';

export interface ReportOptions {
  format?: ReportFormat | 'all';
  output?: string;
  name?: string;
}

async function performInspectionAndValidation(
  manifestPath: string
): Promise<{
  inspection: InspectionResult;
  validation: ValidationResult;
}> {
  const baseDir = path.dirname(path.resolve(manifestPath));

  const parseResult = await parseManifestFile(manifestPath, { baseDir });

  if (!parseResult.success) {
    console.error(chalk.red('❌ Manifest 解析失败:'));
    parseResult.errors.forEach(err => {
      console.error(chalk.red(`  - ${err}`));
    });
    process.exit(1);
  }

  const manifest = parseResult.data!;
  const audioInfos = new Map();
  const files: FileInspection[] = [];

  for (const audioFile of manifest.audioFiles) {
    const resolvedPath = path.isAbsolute(audioFile.path)
      ? audioFile.path
      : path.resolve(baseDir, audioFile.path);

    const analysis = await analyzeAudioFile(resolvedPath, {
      analyzeLoudness: true,
      analyzeSilence: true,
      silenceOptions: {
        maxLeadingSilence: manifest.settings.maxSilenceAtStart,
        maxTrailingSilence: manifest.settings.maxSilenceAtEnd,
      },
    });

    audioInfos.set(audioFile.id, {
      info: analysis.info,
      loudness: analysis.loudness,
      silence: analysis.silence,
    });

    const inspection: FileInspection = {
      id: audioFile.id,
      role: audioFile.role,
      path: resolvedPath,
      exists: analysis.info.exists,
      passed: analysis.info.exists,
    };

    if (analysis.info.exists) {
      inspection.info = analysis.info;
    }
    if (analysis.loudness) {
      inspection.loudness = analysis.loudness;
    }
    if (analysis.silence) {
      inspection.silence = analysis.silence;
    }

    files.push(inspection);
  }

  const existingFiles = files.filter(f => f.exists).length;
  const rmsValues = files
    .filter(f => f.loudness && Number.isFinite(f.loudness.rmsDb))
    .map(f => f.loudness!.rmsDb);

  const inspection: InspectionResult = {
    manifest,
    files,
    summary: {
      totalFiles: files.length,
      existingFiles,
      avgRmsDb: rmsValues.length > 0
        ? rmsValues.reduce((a, b) => a + b, 0) / rmsValues.length
        : undefined,
      minRmsDb: rmsValues.length > 0 ? Math.min(...rmsValues) : undefined,
      maxRmsDb: rmsValues.length > 0 ? Math.max(...rmsValues) : undefined,
    },
  };

  const context: ValidationContext = {
    manifest,
    baseDir,
    audioInfos,
  };

  const validation = await runValidation(context);

  return { inspection, validation };
}

export async function runReport(
  manifestPath: string,
  options: ReportOptions = {}
): Promise<void> {
  const {
    format = 'all',
    output,
    name = 'delivery-check-report',
  } = options;

  console.log(chalk.blue('📄 生成交付体检报告...'));
  console.log(chalk.gray(`Manifest: ${manifestPath}`));
  console.log('');

  const baseDir = path.dirname(path.resolve(manifestPath));

  let outputDir: string;
  if (output) {
    if (path.extname(output)) {
      outputDir = path.dirname(output);
    } else {
      outputDir = output;
    }
  } else {
    outputDir = path.join(baseDir, 'output');
  }

  outputDir = path.resolve(outputDir);
  await fs.ensureDir(outputDir);

  const { inspection, validation } = await performInspectionAndValidation(manifestPath);
  const reportData = generateReportData(inspection, validation);

  let generatedFiles: string[] = [];

  if (format === 'all') {
    const result = await generateAllReports(reportData, outputDir, name);
    generatedFiles = [result.json, result.markdown, result.html];
  } else {
    let outputPath: string;
    if (output && path.extname(output)) {
      outputPath = path.resolve(output);
    } else {
      const ext = format === 'json' ? 'json' : format === 'html' ? 'html' : 'md';
      outputPath = path.join(outputDir, `${name}.${ext}`);
    }

    const result = await writeReport(reportData, {
      format,
      outputPath,
    });
    generatedFiles = [result];
  }

  console.log(chalk.green('✅ 报告生成完成！'));
  console.log('');
  console.log(chalk.cyan('📁 生成的文件:'));
  generatedFiles.forEach(file => {
    const relative = path.relative(process.cwd(), file);
    console.log(chalk.gray(`   ${relative}`));
  });
  console.log('');

  const statusColor = reportData.summary.status === 'fail'
    ? chalk.red
    : reportData.summary.status === 'warn'
    ? chalk.yellow
    : chalk.green;

  console.log(chalk.cyan('📊 检查结果:'));
  console.log(`   状态: ${statusColor(reportData.summary.status.toUpperCase())}`);
  console.log(`   结论: ${reportData.summary.conclusion}`);
  console.log('');

  if (reportData.validation.errors > 0) {
    console.log(chalk.red(`   ❌ 错误: ${reportData.validation.errors}`));
  }
  if (reportData.validation.warnings > 0) {
    console.log(chalk.yellow(`   ⚠️ 警告: ${reportData.validation.warnings}`));
  }
  console.log('');

  if (reportData.summary.recommendations.length > 0) {
    console.log(chalk.cyan('💡 建议:'));
    reportData.summary.recommendations.forEach((rec, index) => {
      console.log(`   ${index + 1}. ${rec}`);
    });
    console.log('');
  }
}
