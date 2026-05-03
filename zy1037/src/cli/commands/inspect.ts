import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { parseManifestFile } from '../../manifest/parser';
import { analyzeAudioFile } from '../../audio';
import {
  Manifest,
  InspectionResult,
  FileInspection,
  AudioInfo,
  LoudnessResult,
  SilenceDetection,
} from '../../types';
import { formatTime } from '../../utils/time';

export interface InspectOptions {
  verbose?: boolean;
  json?: boolean;
}

function formatDuration(seconds: number): string {
  if (seconds === 0) return '-';
  return formatTime(seconds);
}

function formatLoudness(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return '-';
  return `${value.toFixed(2)} dB`;
}

function formatSilenceDuration(seconds: number, isLong: boolean): string {
  const formatted = `${seconds.toFixed(3)}s`;
  return isLong ? chalk.red(formatted) : formatted;
}

export async function runInspect(
  manifestPath: string,
  options: InspectOptions = {}
): Promise<InspectionResult> {
  const { verbose = false, json = false } = options;

  const baseDir = path.dirname(path.resolve(manifestPath));

  if (!json) {
    console.log(chalk.blue('🔍 检查音频文件...'));
    console.log(chalk.gray(`Manifest: ${manifestPath}`));
    console.log('');
  }

  const parseResult = await parseManifestFile(manifestPath, { baseDir });

  if (!parseResult.success) {
    if (!json) {
      console.error(chalk.red('❌ Manifest 解析失败:'));
      parseResult.errors.forEach(err => {
        console.error(chalk.red(`  - ${err}`));
      });
      process.exit(1);
    }
    throw new Error(parseResult.errors.join('; '));
  }

  if (parseResult.warnings.length > 0 && !json) {
    console.log(chalk.yellow('⚠️ Manifest 警告:'));
    parseResult.warnings.forEach(warn => {
      console.log(chalk.yellow(`  - ${warn}`));
    });
    console.log('');
  }

  const manifest = parseResult.data!;
  const files: FileInspection[] = [];

  for (const audioFile of manifest.audioFiles) {
    const resolvedPath = path.isAbsolute(audioFile.path)
      ? audioFile.path
      : path.resolve(baseDir, audioFile.path);

    const analysis = await analyzeAudioFile(resolvedPath, {
      analyzeLoudness: true,
      analyzeSilence: true,
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

  const inspectionResult: InspectionResult = {
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

  if (json) {
    console.log(JSON.stringify(inspectionResult, null, 2));
  } else {
    printInspectionResult(inspectionResult, verbose);
  }

  return inspectionResult;
}

function printInspectionResult(result: InspectionResult, verbose: boolean): void {
  const { manifest, files, summary } = result;

  console.log(chalk.cyan('📋 项目信息'));
  console.log(`   播客: ${manifest.project.name}`);
  console.log(`   期数: ${manifest.project.episode}`);
  if (manifest.project.publishDate) {
    console.log(`   发布日期: ${manifest.project.publishDate}`);
  }
  console.log('');

  const fileTableData: string[][] = [
    [
      chalk.bold('ID'),
      chalk.bold('角色'),
      chalk.bold('文件'),
      chalk.bold('存在'),
      chalk.bold('时长'),
      chalk.bold('采样率'),
      chalk.bold('声道'),
    ],
  ];

  files.forEach(file => {
    const status = file.exists ? chalk.green('✅') : chalk.red('❌');
    const duration = file.info ? formatDuration(file.info.duration) : '-';
    const sampleRate = file.info && file.info.sampleRate > 0
      ? `${file.info.sampleRate} Hz`
      : '-';
    const channels = file.info && file.info.channels > 0
      ? `${file.info.channels}ch`
      : '-';

    fileTableData.push([
      file.id,
      file.role,
      path.basename(file.path),
      status,
      duration,
      sampleRate,
      channels,
    ]);
  });

  console.log(chalk.cyan('🎵 文件概览'));
  console.log(table(fileTableData, {
    columns: {
      0: { alignment: 'left' },
      1: { alignment: 'left' },
      2: { alignment: 'left' },
      3: { alignment: 'center' },
      4: { alignment: 'right' },
      5: { alignment: 'right' },
      6: { alignment: 'center' },
    },
  }));

  if (files.some(f => f.loudness || f.silence)) {
    const loudnessTableData: string[][] = [
      [
        chalk.bold('ID'),
        chalk.bold('角色'),
        chalk.bold('RMS 响度'),
        chalk.bold('峰值'),
        chalk.bold('开头静音'),
        chalk.bold('结尾静音'),
      ],
    ];

    files.forEach(file => {
      const rms = formatLoudness(file.loudness?.rmsDb);
      const peak = formatLoudness(file.loudness?.peakDb);
      const startSilence = file.silence
        ? formatSilenceDuration(file.silence.startSilenceDuration, file.silence.hasLongSilenceAtStart)
        : '-';
      const endSilence = file.silence
        ? formatSilenceDuration(file.silence.endSilenceDuration, file.silence.hasLongSilenceAtEnd)
        : '-';

      loudnessTableData.push([
        file.id,
        file.role,
        rms,
        peak,
        startSilence,
        endSilence,
      ]);
    });

    console.log(chalk.cyan('📊 响度与静音'));
    console.log(table(loudnessTableData, {
      columns: {
        0: { alignment: 'left' },
        1: { alignment: 'left' },
        2: { alignment: 'right' },
        3: { alignment: 'right' },
        4: { alignment: 'right' },
        5: { alignment: 'right' },
      },
    }));
  }

  console.log(chalk.cyan('📈 统计摘要'));
  console.log(`   总文件数: ${summary.totalFiles}`);
  console.log(`   存在文件: ${summary.existingFiles}`);
  
  if (summary.avgRmsDb !== undefined) {
    console.log(`   平均 RMS: ${summary.avgRmsDb.toFixed(2)} dB`);
  }
  if (summary.minRmsDb !== undefined && summary.maxRmsDb !== undefined) {
    console.log(`   RMS 范围: ${summary.minRmsDb.toFixed(2)} ~ ${summary.maxRmsDb.toFixed(2)} dB`);
  }
  console.log('');

  console.log(chalk.gray('💡 提示: 使用 pdc validate 执行完整验证'));
}
