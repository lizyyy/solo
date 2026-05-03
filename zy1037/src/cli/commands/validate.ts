import * as path from 'path';
import chalk from 'chalk';
import { table } from 'table';
import { parseManifestFile } from '../../manifest/parser';
import { analyzeAudioFile } from '../../audio';
import { ValidationResult, ValidationIssue } from '../../types';
import {
  runValidation,
  ValidationContext,
} from '../../validation/validator';
import { LOUDNESS_DOCUMENTATION } from '../../audio/loudness';

export interface ValidateOptions {
  verbose?: boolean;
  json?: boolean;
  showLoudnessDoc?: boolean;
}

export async function runValidate(
  manifestPath: string,
  options: ValidateOptions = {}
): Promise<ValidationResult> {
  const { verbose = false, json = false, showLoudnessDoc = false } = options;

  const baseDir = path.dirname(path.resolve(manifestPath));

  if (!json) {
    console.log(chalk.blue('✅ 执行交付体检...'));
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

  const manifest = parseResult.data!;
  const audioInfos = new Map();

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
  }

  const context: ValidationContext = {
    manifest,
    baseDir,
    audioInfos,
  };

  const validationResult = await runValidation(context);

  if (json) {
    console.log(JSON.stringify(validationResult, null, 2));
  } else {
    printValidationResult(validationResult, verbose, showLoudnessDoc);
  }

  if (!validationResult.success && !json) {
    process.exit(1);
  }

  return validationResult;
}

function getSeverityColor(severity: ValidationIssue['severity']): chalk.Chalk {
  switch (severity) {
    case 'error': return chalk.red;
    case 'warning': return chalk.yellow;
    case 'info': return chalk.blue;
    default: return chalk.white;
  }
}

function getSeverityIcon(severity: ValidationIssue['severity']): string {
  switch (severity) {
    case 'error': return '❌';
    case 'warning': return '⚠️';
    case 'info': return 'ℹ️';
    default: return '•';
  }
}

function printValidationResult(
  result: ValidationResult,
  verbose: boolean,
  showLoudnessDoc: boolean
): void {
  const { success, totalIssues, errors, warnings, infos, issues } = result;

  const statusText = success
    ? (warnings > 0 ? chalk.yellow('⚠️  通过 (有警告)') : chalk.green('✅ 通过'))
    : chalk.red('❌ 失败');

  console.log(chalk.cyan('📋 检查结果'));
  console.log(`   状态: ${statusText}`);
  console.log(`   总问题数: ${totalIssues}`);
  if (errors > 0) console.log(`   ${chalk.red('错误:')} ${errors}`);
  if (warnings > 0) console.log(`   ${chalk.yellow('警告:')} ${warnings}`);
  if (infos > 0) console.log(`   ${chalk.blue('提示:')} ${infos}`);
  console.log('');

  if (issues.length === 0) {
    console.log(chalk.green('🎉 所有检查通过！没有发现问题。'));
    console.log('');
    return;
  }

  const issuesBySeverity = {
    error: issues.filter(i => i.severity === 'error'),
    warning: issues.filter(i => i.severity === 'warning'),
    info: issues.filter(i => i.severity === 'info'),
  };

  (['error', 'warning', 'info'] as const).forEach(severity => {
    const severityIssues = issuesBySeverity[severity];
    if (severityIssues.length === 0) return;

    const color = getSeverityColor(severity);
    const icon = getSeverityIcon(severity);
    const label = severity === 'error' ? '错误' : severity === 'warning' ? '警告' : '提示';

    console.log(color.bold(`${icon} ${label} (${severityIssues.length})`));
    console.log('');

    if (verbose) {
      severityIssues.forEach(issue => {
        console.log(color(`  [${issue.id}] ${issue.message}`));
        if (issue.detail) {
          console.log(chalk.gray(`      详情: ${issue.detail.replace(/\n/g, '\n           ')}`));
        }
        if (issue.suggestion) {
          console.log(chalk.green(`      💡 建议: ${issue.suggestion}`));
        }
        console.log('');
      });
    } else {
      const summaryTable: string[][] = [
        [
          chalk.bold('ID'),
          chalk.bold('类别'),
          chalk.bold('问题'),
          chalk.bold('建议'),
        ],
      ];

      severityIssues.forEach(issue => {
        const categoryLabels: Record<ValidationIssue['category'], string> = {
          file: '文件',
          naming: '命名',
          timing: '时间',
          loudness: '响度',
          silence: '静音',
          chapter: '章节',
          format: '格式',
        };

        summaryTable.push([
          issue.id,
          categoryLabels[issue.category] || issue.category,
          issue.message,
          issue.suggestion || '-',
        ]);
      });

      console.log(table(summaryTable, {
        columns: {
          0: { alignment: 'left', width: 10 },
          1: { alignment: 'left', width: 6 },
          2: { alignment: 'left', width: 40 },
          3: { alignment: 'left', width: 30 },
        },
      }));
    }
  });

  if (!success) {
    console.log(chalk.red('❌ 存在必须修复的错误，请解决后重新验证。'));
    console.log('');
  } else if (warnings > 0) {
    console.log(chalk.yellow('⚠️ 没有错误，但建议处理警告以提升交付质量。'));
    console.log('');
  }

  if (showLoudnessDoc && issues.some(i => i.category === 'loudness')) {
    console.log(chalk.gray('══════════════════════════════════════════════════════════════'));
    console.log(chalk.cyan('📚 响度说明'));
    console.log(chalk.gray(LOUDNESS_DOCUMENTATION.trim()));
    console.log(chalk.gray('══════════════════════════════════════════════════════════════'));
    console.log('');
  }

  console.log(chalk.gray('💡 提示: 使用 pdc report 导出详细报告'));
  if (!verbose) {
    console.log(chalk.gray('💡 提示: 使用 --verbose 查看详细问题信息'));
  }
}
