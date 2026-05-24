#!/usr/bin/env node

import { Command, Option } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import chalk from 'chalk';

import { expandYaml, getValueByKeyPath, toYamlString } from './expander';
import {
  generateReport,
  printTerminalSummary,
  writeJsonReport,
  writeMarkdownReport,
  writeExpandedYaml,
  getOutputPaths,
  ensureOutputDir,
} from './reporter';
import { runSelfTests, printSelfTestResults } from './self-test';
import { CliOptions } from './types';

const VERSION = '1.0.0';

const program = new Command();

program
  .name('yaml-expand')
  .description('YAML Anchor 展开 CLI 工具 - 解析 anchor、merge key、环境覆盖，生成详细报告')
  .version(VERSION, '-v, --version', '显示版本号');

program
  .command('expand', { isDefault: true })
  .description('展开 YAML 文件中的 anchor 和 merge key（默认命令）')
  .argument('<input>', '输入 YAML 文件路径')
  .option('-o, --output <path>', '输出展开后的 YAML 文件路径')
  .option('-d, --output-dir <dir>', '输出目录（用于生成报告文件）')
  .option('-e, --env <files...>', '环境覆盖文件路径（按顺序应用）')
  .option('-k, --key-path <path>', '仅输出指定键路径的值（如：a.b.c.d）')
  .addOption(
    new Option('-f, --format <formats...>', '输出格式')
      .choices(['terminal', 'json', 'markdown', 'all'])
      .default(['terminal'])
  )
  .option('-V, --verbose', '显示详细信息')
  .option('-q, --quiet', '静默模式，仅输出错误')
  .action((input: string, options: Partial<CliOptions>) => {
    process.exit(handleExpandCommand(input, options));
  });

program
  .command('self-test')
  .description('运行自检，验证工具功能完整性')
  .action(() => {
    const results = runSelfTests();
    const { passed, total } = printSelfTestResults(results);
    process.exit(passed === total ? 0 : 1);
  });

program
  .command('validate <input>')
  .description('验证 YAML 文件语法和 anchor 引用完整性')
  .option('-e, --env <files...>', '环境覆盖文件路径')
  .action((input: string, options: { env?: string[] }) => {
    process.exit(handleValidateCommand(input, options.env));
  });

function validateInput(input: string, envFiles?: string[]): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!fs.existsSync(input)) {
    errors.push(`输入文件不存在: ${input}`);
    return { valid: false, errors };
  }

  if (!fs.statSync(input).isFile()) {
    errors.push(`输入不是文件: ${input}`);
    return { valid: false, errors };
  }

  const validExts = ['.yaml', '.yml'];
  const ext = path.extname(input).toLowerCase();
  if (!validExts.includes(ext)) {
    errors.push(`不支持的文件格式: ${ext}（支持: .yaml, .yml）`);
  }

  if (envFiles) {
    for (const envFile of envFiles) {
      if (!fs.existsSync(envFile)) {
        errors.push(`环境覆盖文件不存在: ${envFile}`);
      } else if (!fs.statSync(envFile).isFile()) {
        errors.push(`环境覆盖不是文件: ${envFile}`);
      }
    }
  }

  return { valid: errors.length === 0, errors };
}

function handleExpandCommand(input: string, options: Partial<CliOptions>): number {
  const { valid, errors } = validateInput(input, options.env);

  if (!valid) {
    console.error(chalk.red('输入验证失败:'));
    for (const err of errors) {
      console.error(chalk.red(`  ✗ ${err}`));
    }
    return 1;
  }

  try {
    const content = fs.readFileSync(input, 'utf8');
    const result = expandYaml(content, options.env);

    if (result.errors.length > 0) {
      console.error(chalk.red('解析错误:'));
      for (const err of result.errors) {
        console.error(chalk.red(`  ✗ ${err}`));
      }
      return 2;
    }

    if (options.keyPath) {
      const { value, found } = getValueByKeyPath(result.expanded, options.keyPath);
      if (!found) {
        console.error(chalk.red(`键路径不存在: ${options.keyPath}`));
        return 3;
      }
      if (typeof value === 'object') {
        console.log(toYamlString(value));
      } else {
        console.log(String(value));
      }
      return 0;
    }

    const report = generateReport(result, input, content);
    const formats = options.format || ['terminal'];
    const outputAll = formats.includes('all');
    const outputPaths = getOutputPaths(input, options.outputDir, options.output);

    if (options.outputDir) {
      ensureOutputDir(options.outputDir);
    }

    if (formats.includes('terminal') || outputAll) {
      if (!options.quiet) {
        printTerminalSummary(report, options.verbose || false);
      }
    }

    if (formats.includes('json') || outputAll) {
      writeJsonReport(report, outputPaths.json);
      if (!options.quiet) {
        console.log(chalk.green(`JSON 报告已写入: ${outputPaths.json}`));
      }
    }

    if (formats.includes('markdown') || outputAll) {
      writeMarkdownReport(report, outputPaths.markdown);
      if (!options.quiet) {
        console.log(chalk.green(`Markdown 报告已写入: ${outputPaths.markdown}`));
      }
    }

    if (options.output || outputAll) {
      const yamlPath = options.output || outputPaths.yaml;
      writeExpandedYaml(report, yamlPath);
      if (!options.quiet) {
        console.log(chalk.green(`展开后的 YAML 已写入: ${yamlPath}`));
      }
    }

    if (result.warnings.length > 0 && !options.quiet) {
      console.log(chalk.yellow(`\n⚠️  发现 ${result.warnings.length} 个警告:`));
      for (const w of result.warnings) {
        console.log(chalk.yellow(`   - ${w}`));
      }
    }

    return 0;
  } catch (e) {
    console.error(chalk.red(`处理失败: ${(e as Error).message}`));
    return 255;
  }
}

function handleValidateCommand(input: string, envFiles?: string[]): number {
  const { valid, errors } = validateInput(input, envFiles);

  if (!valid) {
    console.error(chalk.red('输入验证失败:'));
    for (const err of errors) {
      console.error(chalk.red(`  ✗ ${err}`));
    }
    return 1;
  }

  try {
    const content = fs.readFileSync(input, 'utf8');
    const result = expandYaml(content, envFiles);

    console.log('\n' + chalk.cyan('═'.repeat(50)));
    console.log(chalk.cyan.bold('  YAML 验证结果'));
    console.log(chalk.cyan('═'.repeat(50)) + '\n');

    if (result.errors.length > 0) {
      console.log(chalk.red('❌ 验证失败'));
      console.log(chalk.gray('─'.repeat(50)));
      for (const err of result.errors) {
        console.log(chalk.red(`  ✗ ${err}`));
      }
      console.log('');
      return 2;
    }

    console.log(chalk.green('✅ 语法验证通过'));
    console.log('');

    console.log(chalk.bold('📊 配置统计'));
    console.log(chalk.gray('─'.repeat(40)));
    console.log(`  Anchor 定义: ${result.anchors.filter(a => a.sourceType === 'anchor').length}`);
    console.log(`  Alias 引用: ${result.anchors.filter(a => a.sourceType === 'alias').length}`);
    console.log(`  Merge Key: ${result.mergeKeys.length}`);
    console.log(`  环境覆盖: ${result.overrides.length}`);

    if (result.cycleDetected) {
      console.log(chalk.red(`  循环引用: 检测到`));
    } else {
      console.log(chalk.green(`  循环引用: 无`));
    }

    if (result.warnings.length > 0) {
      console.log('');
      console.log(chalk.yellow(`⚠️  ${result.warnings.length} 个警告:`));
      for (const w of result.warnings) {
        console.log(chalk.yellow(`   - ${w}`));
      }
    }

    console.log('\n' + chalk.cyan('═'.repeat(50)) + '\n');

    return result.warnings.length > 0 ? 1 : 0;
  } catch (e) {
    console.error(chalk.red(`验证失败: ${(e as Error).message}`));
    return 255;
  }
}

if (require.main === module) {
  program.parse(process.argv);
}

export { program };
