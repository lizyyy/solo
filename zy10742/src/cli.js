#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { diffLines } from 'diff';
import fs from 'fs/promises';
import { Rechecker } from './rechecker.js';

const program = new Command();

program
  .name('cs-recheck')
  .description('客服质检导出复议改分核对 CLI 工具')
  .version('1.0.0');

program
  .command('check')
  .description('核对质检复议改分数据')
  .argument('<file>', '质检数据文件 (JSON/CSV)')
  .option('-v, --verbose', '显示详细处理过程')
  .option('-o, --output <dir>', '输出结果目录')
  .option('--diff <baseFile>', '与基准文件做diff对比')
  .action(async (file, options) => {
    try {
      const rechecker = new Rechecker({ verbose: options.verbose });
      const count = await rechecker.load(file);

      console.log(chalk.blue(`\n━━━ 客服质检导出复议改分核对 ━━━`));
      console.log(chalk.gray(`文件: ${file}`));
      console.log(chalk.gray(`记录数: ${count}\n`));

      const results = rechecker.run();
      const summary = rechecker.summary;

      printSummary(summary, options.verbose);

      if (options.verbose) {
        printVerboseDetails(rechecker.getVerboseDetails());
      }

      if (options.output) {
        await writeOutput(options.output, rechecker);
      }

      if (options.diff) {
        await runDiff(options.diff, rechecker);
      }

      console.log('\n' + chalk.gray('━━━ 核对完成 ━━━'));

      process.exit(summary.未通过数 > 0 ? 1 : 0);
    } catch (err) {
      console.error(chalk.red('错误:'), err.message);
      if (options.verbose) console.error(err.stack);
      process.exit(1);
    }
  });

program
  .command('sample')
  .description('生成样例数据')
  .option('-o, --output <dir>', '输出目录', 'samples')
  .action(async (options) => {
    console.log(chalk.blue(`生成样例数据到: ${options.output}`));
    await generateSamples(options.output);
    console.log(chalk.green('样例数据生成完成!'));
  });

function printSummary(summary, verbose) {
  const status = summary.未通过数 === 0 ? chalk.green('✓ 通过') : chalk.red('✗ 未通过');

  console.log(status);
  console.log();
  console.log(`总记录数: ${chalk.cyan(summary.总记录数)}`);
  console.log(`通过数: ${chalk.green(summary.通过数)}`);
  console.log(`未通过数: ${chalk.red(summary.未通过数)}`);
  console.log(`通过率: ${chalk.yellow(summary.通过率)}`);
  console.log();
  console.log(`有复议记录数: ${chalk.magenta(summary.有复议记录数)}`);
  console.log(`多轮复议记录数: ${chalk.magenta(summary.多轮复议记录数)}`);
  console.log();
  console.log(chalk.underline('问题统计:'));
  console.log(`  得分不一致问题: ${chalk.red(summary.问题统计.得分不一致问题)}`);
  console.log(`  扣分项同步问题: ${chalk.red(summary.问题统计.扣分项同步问题)}`);
  console.log(`  轮次继承问题: ${chalk.red(summary.问题统计.轮次继承问题)}`);

  if (summary.未通过编号列表.length > 0) {
    console.log();
    console.log(chalk.red('未通过编号列表:'));
    summary.未通过编号列表.forEach(id => {
      console.log(`  - ${id}`);
    });
  }
}

function printVerboseDetails(details) {
  console.log('\n' + chalk.underline('详细处理记录:'));
  for (const d of details) {
    const status = d.通过 ? chalk.green('✓') : chalk.red('✗');
    console.log(`\n${status} 质检编号: ${chalk.cyan(d.质检编号)} | 客服工号: ${d.客服工号} | 轮次: ${d.复议轮次} | 状态: ${d.复议状态}`);

    if (d.得分问题?.length > 0) {
      console.log(`  ${chalk.red('得分问题:')}`);
      d.得分问题.forEach((issue, i) => {
        console.log(`    ${i + 1}. ${issue}`);
        const detail = d.得分详情[i];
        if (detail) {
          console.log(`       期望: ${detail.expectedSource}=${chalk.green(detail.expected)}`);
          console.log(`       实际: ${detail.actualSource}=${chalk.red(detail.actual)}`);
        }
      });
    }

    if (d.扣分项问题?.length > 0) {
      console.log(`  ${chalk.red('扣分项问题:')}`);
      d.扣分项问题.forEach((issue, i) => {
        console.log(`    ${i + 1}. ${issue}`);
        const detail = d.扣分项详情[i];
        if (detail) {
          console.log(`       变更类型: ${chalk.yellow(detail.changeType)}`);
        }
      });
    }

    if (d.轮次继承问题?.length > 0) {
      console.log(`  ${chalk.red('轮次继承问题:')}`);
      d.轮次继承问题.forEach(issue => {
        console.log(`    - ${issue}`);
      });
    }
  }
}

async function writeOutput(dir, rechecker) {
  await fs.mkdir(dir, { recursive: true });

  const summaryPath = `${dir}/summary.json`;
  const resultsPath = `${dir}/results.json`;
  const diffPath = `${dir}/diffable.json`;

  await fs.writeFile(summaryPath, JSON.stringify(rechecker.summary, null, 2));
  await fs.writeFile(resultsPath, JSON.stringify(rechecker.getVerboseDetails(), null, 2));
  await fs.writeFile(diffPath, JSON.stringify(rechecker.getDiffableResults(), null, 2));

  console.log(`\n${chalk.green('输出已写入:')}`);
  console.log(`  - ${summaryPath}`);
  console.log(`  - ${resultsPath}`);
  console.log(`  - ${diffPath}`);
}

async function runDiff(baseFile, currentRechecker) {
  const baseRechecker = new Rechecker();
  await baseRechecker.load(baseFile);
  baseRechecker.run();

  const base = JSON.stringify(baseRechecker.getDiffableResults(), null, 2);
  const current = JSON.stringify(currentRechecker.getDiffableResults(), null, 2);

  const diff = diffLines(base, current);

  console.log('\n' + chalk.underline('Diff 对比结果:'));
  let hasChanges = false;
  diff.forEach(part => {
    if (part.added) {
      hasChanges = true;
      console.log(chalk.green(`+ ${part.value.trim()}`));
    } else if (part.removed) {
      hasChanges = true;
      console.log(chalk.red(`- ${part.value.trim()}`));
    }
  });

  if (!hasChanges) {
    console.log(chalk.gray('  (无变化)'));
  }
}

async function generateSamples(outputDir) {
  await fs.mkdir(outputDir, { recursive: true });

  const samples = {
    'normal.json': [
      {
        质检编号: 'QC-2024-001',
        客服工号: 'CS001',
        质检日期: '2024-01-15',
        原始得分: 85,
        复议得分: 90,
        最终得分: 90,
        复议状态: 'approved',
        复议轮次: 1,
        原始扣分项: ['服务态度', '响应超时'],
        复议扣分项: ['服务态度'],
        最终扣分项: ['服务态度'],
        复议原因: '经核实响应超时为系统原因',
        处理人: '质检主管A',
        处理时间: '2024-01-16'
      },
      {
        质检编号: 'QC-2024-002',
        客服工号: 'CS002',
        质检日期: '2024-01-15',
        原始得分: 95,
        复议得分: null,
        最终得分: 95,
        复议状态: 'pending',
        复议轮次: 1,
        原始扣分项: [],
        复议扣分项: [],
        最终扣分项: [],
        复议原因: '',
        处理人: '',
        处理时间: ''
      }
    ],
    'abnormal.json': [
      {
        质检编号: 'QC-2024-003',
        客服工号: 'CS003',
        质检日期: '2024-01-15',
        原始得分: 80,
        复议得分: 88,
        最终得分: 80,
        复议状态: 'approved',
        复议轮次: 1,
        原始扣分项: ['话术不规范', '信息错误'],
        复议扣分项: ['话术不规范'],
        最终扣分项: ['话术不规范', '信息错误'],
        复议原因: '信息错误已修正',
        处理人: '质检主管B',
        处理时间: '2024-01-16'
      },
      {
        质检编号: 'QC-2024-004',
        客服工号: 'CS004',
        质检日期: '2024-01-15',
        原始得分: 75,
        复议得分: null,
        最终得分: 80,
        复议状态: 'pending',
        复议轮次: 1,
        原始扣分项: ['服务态度'],
        复议扣分项: [],
        最终扣分项: ['服务态度', '流程违规'],
        复议原因: '',
        处理人: '',
        处理时间: ''
      }
    ],
    'multi-round.json': [
      {
        质检编号: 'QC-2024-005',
        客服工号: 'CS005',
        质检日期: '2024-01-15',
        原始得分: 70,
        复议得分: 75,
        最终得分: 75,
        复议状态: 'partial',
        复议轮次: 1,
        原始扣分项: ['服务态度', '响应超时', '信息错误'],
        复议扣分项: ['服务态度', '信息错误'],
        最终扣分项: ['服务态度', '信息错误'],
        复议原因: '响应超时已核实为电话线路问题',
        处理人: '质检主管A',
        处理时间: '2024-01-16'
      },
      {
        质检编号: 'QC-2024-005',
        客服工号: 'CS005',
        质检日期: '2024-01-17',
        原始得分: 75,
        复议得分: 82,
        最终得分: 82,
        复议状态: 'approved',
        复议轮次: 2,
        原始扣分项: ['服务态度', '信息错误'],
        复议扣分项: ['服务态度'],
        最终扣分项: ['服务态度'],
        复议原因: '信息错误为客户提供资料有误',
        处理人: '质检主管B',
        处理时间: '2024-01-18'
      }
    ],
    'deduction-remove.json': [
      {
        质检编号: 'QC-2024-006',
        客服工号: 'CS006',
        质检日期: '2024-01-15',
        原始得分: 82,
        复议得分: 90,
        最终得分: 90,
        复议状态: 'approved',
        复议轮次: 1,
        原始扣分项: ['话术不规范', '流程违规', '服务态度'],
        复议扣分项: ['服务态度'],
        最终扣分项: ['服务态度'],
        复议原因: '话术不规范和流程违规为特殊业务场景允许',
        处理人: '质检主管A',
        处理时间: '2024-01-16'
      }
    ],
    'round-inherit-error.json': [
      {
        质检编号: 'QC-2024-007',
        客服工号: 'CS007',
        质检日期: '2024-01-15',
        原始得分: 70,
        复议得分: 78,
        最终得分: 78,
        复议状态: 'partial',
        复议轮次: 1,
        原始扣分项: ['流程违规', '信息错误'],
        复议扣分项: ['信息错误'],
        最终扣分项: ['信息错误'],
        复议原因: '流程违规属特殊情况允许',
        处理人: '质检主管A',
        处理时间: '2024-01-16'
      },
      {
        质检编号: 'QC-2024-007',
        客服工号: 'CS007',
        质检日期: '2024-01-17',
        原始得分: 70,
        复议得分: 85,
        最终得分: 85,
        复议状态: 'approved',
        复议轮次: 2,
        原始扣分项: ['信息错误'],
        复议扣分项: [],
        最终扣分项: [],
        复议原因: '信息错误为系统数据问题',
        处理人: '质检主管B',
        处理时间: '2024-01-18'
      }
    ]
  };

  for (const [name, data] of Object.entries(samples)) {
    await fs.writeFile(`${outputDir}/${name}`, JSON.stringify(data, null, 2));
  }

  const csvContent = `质检编号,客服工号,质检日期,原始得分,复议得分,最终得分,复议状态,复议轮次,原始扣分项,复议扣分项,最终扣分项,复议原因,处理人,处理时间
QC-2024-001,CS001,2024-01-15,85,90,90,approved,1,"服务态度,响应超时","服务态度","服务态度","经核实响应超时为系统原因",质检主管A,2024-01-16
QC-2024-002,CS002,2024-01-15,95,,95,pending,1,,,,"","",
`;
  await fs.writeFile(`${outputDir}/normal.csv`, csvContent);
}

program.parseAsync();
