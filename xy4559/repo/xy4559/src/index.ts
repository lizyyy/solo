#!/usr/bin/env node

import { Command } from 'commander';
import { initDb, closeDb } from './db';
import { importData, ImportType } from './commands/import';
import { validateData } from './commands/validate';
import { reviewData } from './commands/review';
import { generateReport } from './commands/report';

const program = new Command();

program
  .name('puppet')
  .description('巡演木偶剧团出箱交接核验工具')
  .version('1.0.0')
  .hook('preAction', () => {
    initDb();
  })
  .hook('postAction', () => {
    closeDb();
  });

program
  .command('import')
  .description('导入数据：木偶道具清单、维修记录、装箱扫描、演出场次表、车辆计划')
  .requiredOption('-t, --type <type>', '数据类型: inventory|maintenance|packing|shows|vehicles')
  .requiredOption('-f, --file <path>', 'CSV 文件路径')
  .option('-b, --batch <batch>', '导入批次号（可选，自动生成）')
  .action(async (options) => {
    try {
      await importData({
        type: options.type as ImportType,
        file: options.file,
        batch: options.batch
      });
    } catch (error: any) {
      console.error('导入失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('validate')
  .description('验证数据：检查木偶缺件、易损件未修、箱号错装、场次道具不匹配、同车时段冲突')
  .option('-b, --batch <batch>', '验证批次号（可选）')
  .option('-c, --checks <checks...>', '指定检查项，用逗号分隔: missing-parts,unrepaired-items,wrong-box,show-mismatch,vehicle-conflict')
  .action(async (options) => {
    try {
      const checks = options.checks 
        ? options.checks[0].split(',').map((c: string) => c.trim())
        : undefined;
      await validateData({
        batch: options.batch,
        checks
      });
    } catch (error: any) {
      console.error('验证失败:', error.message);
      process.exit(1);
    }
  });

const reviewCmd = program
  .command('review')
  .description('审核验证问题：给风险项补充人工结论')
  .option('--list', '列出所有验证问题')
  .option('--unresolved', '只显示未审核的问题')
  .option('--batch <batch>', '按批次号筛选')
  .option('--issue-id <id>', '问题 ID')
  .option('--conclusion <text>', '人工结论内容')
  .option('--decision <type>', '决策类型: accept|reject|pending|resolved')
  .option('--reviewer <name>', '审核人姓名')
  .option('--notes <text>', '备注信息');

reviewCmd.action(async (options) => {
  try {
    await reviewData({
      list: options.list,
      unresolved: options.unresolved,
      batch: options.batch,
      issueId: options.issueId ? parseInt(options.issueId) : undefined,
      conclusion: options.conclusion,
      decision: options.decision,
      reviewer: options.reviewer,
      notes: options.notes
    });
  } catch (error: any) {
    console.error('操作失败:', error.message);
    process.exit(1);
  }
});

program
  .command('report')
  .description('生成报告：导出 Markdown 出箱交接单和 JSON 审计明细')
  .option('-f, --format <format>', '输出格式: markdown|json|both', 'both')
  .option('-o, --output <directory>', '输出目录', '.')
  .option('-b, --batch <batch>', '按验证批次号筛选（可选）')
  .option('-n, --name <name>', '报告文件名（不含扩展名）')
  .action(async (options) => {
    try {
      await generateReport({
        format: options.format as 'markdown' | 'json' | 'both',
        output: options.output,
        batch: options.batch,
        name: options.name
      });
    } catch (error: any) {
      console.error('报告生成失败:', error.message);
      process.exit(1);
    }
  });

program.addHelpText('after', `

命令说明:
  import    导入五类数据
    -t/--type      数据类型: inventory(木偶道具), maintenance(维修记录), packing(装箱扫描), shows(演出场次), vehicles(车辆计划)
    -f/--file      CSV 文件路径
    -b/--batch     可选，指定导入批次号

  validate  验证出箱风险
    -c/--checks    可选，指定检查项，逗号分隔
    -b/--batch     可选，验证批次号

  review    审核验证问题
    --list         列出所有验证问题
    --unresolved   只显示未审核的问题
    --batch        按批次筛选
    --issue-id     指定问题ID添加结论
    --conclusion   人工结论内容
    --decision     决策类型: accept(接受), reject(拒绝), pending(待定), resolved(解决)
    --reviewer     审核人姓名
    --notes        备注信息

  report    生成出箱交接单
    -f/--format    输出格式: markdown, json, 或 both
    -o/--output    输出目录
    -n/--name      报告文件名
    -b/--batch     按验证批次筛选

示例完整流程:
  puppet import -t inventory -f 木偶道具清单.csv
  puppet import -t maintenance -f 维修记录.csv
  puppet import -t packing -f 装箱扫描.csv
  puppet import -t shows -f 演出场次表.csv
  puppet import -t vehicles -f 车辆计划.csv
  puppet validate
  puppet review --list --unresolved
  puppet review --issue-id 1 --conclusion "已补充缺件，可出箱" --decision resolved --reviewer "张团长"
  puppet report -f both -o ./reports
`);

program.parse(process.argv);
