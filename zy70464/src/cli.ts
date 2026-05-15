#!/usr/bin/env node

import { Command } from 'commander';
import chalk = require('chalk');
import Table = require('cli-table3');
import * as path from 'path';
import { MeetingMinutesProcessor } from './core/processor';
import { ReportGenerator } from './core/report-generator';
import { QueryFilter } from './types';

const program = new Command();
const processor = new MeetingMinutesProcessor({ useStorage: true });
const reportGenerator = new ReportGenerator();

console.log(
  chalk.gray(`数据存储位置: ${processor.getStorage()?.getDataDir() || '未启用'}`)
);

program
  .name('mmp')
  .description('会议纪要附件补录处理工具 - Meeting Minutes Processor')
  .version('1.0.0');

program
  .command('create')
  .description('创建新的会议纪要')
  .option('-t, --title <title>', '会议标题')
  .option('-d, --date <date>', '会议日期 (YYYY-MM-DD)')
  .option('-de, --department <department>', '所属部门')
  .option('-a, --attendees <attendees...>', '参会人员列表')
  .action((options) => {
    const title = options.title || '未命名会议';
    const date = options.date || new Date().toISOString().split('T')[0];
    const department = options.department || '未分配部门';
    const attendees = options.attendees || ['待定'];

    const meeting = processor.createMeetingMinutes(
      title,
      date,
      department,
      attendees
    );

    console.log(chalk.green('✓ 会议纪要创建成功!'));
    console.log(`  ID: ${chalk.cyan(meeting.id)}`);
    console.log(`  标题: ${chalk.white(meeting.meetingTitle)}`);
    console.log(`  部门: ${chalk.white(meeting.department)}`);
  });

program
  .command('add-attachment')
  .description('添加会议纪要附件')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .requiredOption('-f, --file <filename>', '文件名')
  .option('-t, --type <filetype>', '文件类型', 'application/octet-stream')
  .option('-u, --uploader <uploader>', '上传人', 'system')
  .option('-c, --content <content>', '文件内容', 'sample content')
  .option(
    '-i, --input <json>',
    '原始输入(JSON格式)',
    '{"source":"manual","verified":true}'
  )
  .action((options) => {
    try {
      const originalInput = JSON.parse(options.input);
      const result = processor.addAttachment(
        options.meetingId,
        options.file,
        options.type,
        options.uploader,
        options.content,
        originalInput
      );

      if (result.success) {
        console.log(chalk.green('✓ 附件添加成功!'));
        console.log(`  证据链状态: ${chalk.cyan(result.evidenceChainStatus)}`);
        result.warnings.forEach((w) =>
          console.log(chalk.yellow(`  ⚠  ${w}`))
        );
      } else {
        console.log(chalk.red('✗ 附件添加失败!'));
        result.errors.forEach((e) => console.log(chalk.red(`  ${e}`)));
      }
    } catch (error) {
      console.log(chalk.red('✗ 参数解析错误!'));
      console.log(chalk.red(`  ${(error as Error).message}`));
    }
  });

program
  .command('correct')
  .description('人工修正字段（保留系统判断记录）')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .requiredOption('-f, --field <field>', '字段名 (支持嵌套, 如: meetingTitle)')
  .requiredOption('-v, --value <value>', '修正后的值')
  .requiredOption('-r, --reason <reason>', '修正原因')
  .requiredOption('-c, --corrector <corrector>', '修正人')
  .action((options) => {
    const result = processor.applyManualCorrection(
      options.meetingId,
      options.field,
      options.value,
      options.reason,
      options.corrector
    );

    if (result.success) {
      console.log(chalk.green('✓ 人工修正已应用!'));
      console.log(`  已保留系统判断记录`);
      console.log(`  累计修正数: ${chalk.cyan(result.correctionsApplied)}`);
      result.warnings.forEach((w) =>
        console.log(chalk.yellow(`  ⚠  ${w}`))
      );
    } else {
      console.log(chalk.red('✗ 修正失败!'));
      result.errors.forEach((e) => console.log(chalk.red(`  ${e}`)));
    }
  });

program
  .command('break-chain')
  .description('（测试用）模拟证据链断开')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .requiredOption('-r, --reason <reason>', '断开原因')
  .action((options) => {
    const result = processor.simulateBrokenEvidenceChain(
      options.meetingId,
      options.reason
    );

    if (result.success) {
      console.log(chalk.yellow('⚠ 证据链已模拟断开!'));
      console.log(`  断开原因: ${chalk.red(options.reason)}`);
      result.warnings.forEach((w) =>
        console.log(chalk.yellow(`  ${w}`))
      );
    } else {
      console.log(chalk.red('✗ 操作失败!'));
      result.errors.forEach((e) => console.log(chalk.red(`  ${e}`)));
    }
  });

program
  .command('query')
  .description('查询会议纪要（支持多种过滤条件）')
  .option('-m, --meeting-id <id>', '按会议ID过滤')
  .option('-d, --department <dept>', '按部门过滤')
  .option('-s, --status <status>', '按状态过滤')
  .option('-b, --broken-chain', '仅显示证据链断开的记录')
  .option('-c, --has-corrections', '仅显示有人工修正的记录')
  .option('-v, --verbose', '显示详细信息')
  .action((options) => {
    const filter: QueryFilter = {
      meetingId: options.meetingId,
      department: options.department,
      status: options.status,
      hasBrokenChain: options.brokenChain,
      hasCorrections: options.hasCorrections,
    };

    const meetings = processor.queryMeetings(filter);

    if (meetings.length === 0) {
      console.log(chalk.yellow('⚠ 未找到匹配的会议纪要'));
      return;
    }

    const table = new Table({
      head: [
        chalk.white('ID'),
        chalk.white('标题'),
        chalk.white('部门'),
        chalk.white('证据链'),
        chalk.white('附件数'),
        chalk.white('修正数'),
      ],
    });

    meetings.forEach((m) => {
      const chainStatus =
        m.evidenceChain.status === 'broken'
          ? chalk.red('断开')
          : chalk.green('完整');
      table.push([
        m.id.substring(0, 8) + '...',
        m.meetingTitle.substring(0, 20),
        m.department.substring(0, 15),
        chainStatus,
        m.attachments.length,
        m.corrections.length,
      ]);
    });

    console.log(table.toString());
    console.log(chalk.cyan(`共找到 ${meetings.length} 条记录`));

    if (options.verbose) {
      meetings.forEach((m) => {
        console.log('\n' + chalk.underline(`会议详情: ${m.id}`));
        console.log(reportGenerator.generateAuditTrail(m));
      });
    }
  });

program
  .command('report')
  .description('生成会议纪要报告')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    const meeting = processor.getMeeting(options.meetingId);
    if (!meeting) {
      console.log(chalk.red('✗ 未找到该会议纪要'));
      return;
    }

    const exportSummary = processor.generateExportSummary(options.meetingId);
    const report = reportGenerator.generateMeetingReport(meeting, exportSummary!);

    if (options.output) {
      const outputPath = path.resolve(options.output);
      reportGenerator.saveReport(report, outputPath);
      console.log(chalk.green(`✓ 报告已保存到: ${outputPath}`));
    } else {
      console.log(report);
    }
  });

program
  .command('summary')
  .description('生成汇总报告')
  .option('-o, --output <path>', '输出文件路径')
  .action((options) => {
    const meetings = processor.getAllMeetings();
    const report = reportGenerator.generateSummaryReport(meetings, '全部记录');

    if (options.output) {
      const outputPath = path.resolve(options.output);
      reportGenerator.saveReport(report, outputPath);
      console.log(chalk.green(`✓ 汇总报告已保存到: ${outputPath}`));
    } else {
      console.log(report);
    }
  });

program
  .command('show-original')
  .description('查看附件的原始输入（追溯用）')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .requiredOption('-a, --attachment-id <id>', '附件ID')
  .action((options) => {
    const originalInput = processor.getOriginalInput(
      options.meetingId,
      options.attachmentId
    );

    if (originalInput) {
      console.log(chalk.green('✓ 找到原始输入数据:'));
      console.log(JSON.stringify(originalInput, null, 2));
    } else {
      console.log(chalk.red('✗ 未找到该附件或原始输入'));
    }
  });

program
  .command('search-report')
  .description('生成搜索词报告')
  .requiredOption('-m, --meeting-id <id>', '会议ID')
  .requiredOption('-t, --term <term>', '搜索词')
  .option('-c, --content <content>', '待搜索内容', '默认会议内容...')
  .action((options) => {
    const report = processor.generateSearchTermReport(
      options.meetingId,
      options.term,
      options.content
    );

    if (report) {
      console.log(chalk.green('✓ 搜索词报告已生成:'));
      console.log(`  搜索词: "${chalk.cyan(report.searchTerm)}"`);
      console.log(`  出现次数: ${chalk.yellow(report.occurrences)}`);
      console.log(`  位置: ${report.locations.join(', ')}`);
      console.log('');
      console.log(chalk.underline('复核样例上下文:'));
      console.log(report.reviewSample.context);
    } else {
      console.log(chalk.red('✗ 未找到该会议纪要'));
    }
  });

program
  .command('demo')
  .description('运行演示流程（成功路径+异常路径）')
  .action(() => {
    console.log(chalk.bold.cyan('=== 会议纪要补录处理工具 - 完整演示 ===\n'));

    console.log(chalk.bold('【成功路径演示】'));
    const meeting1 = processor.createMeetingMinutes(
      '2024年Q1研发部门预算评审会议',
      '2024-03-15',
      '技术研发部',
      ['张三', '李四', '王五', '赵六']
    );
    console.log(chalk.green(`✓ 创建会议: ${meeting1.meetingTitle}`));
    console.log(`  ID: ${meeting1.id}\n`);

    const attachment1 = {
      fileName: 'Q1预算提案.pdf',
      fileType: 'application/pdf',
      uploader: '张三',
      content: '2024年Q1预算总额500万，其中研发人员成本300万，设备采购150万，其他50万...',
      originalInput: {
        source: 'OA系统审批',
        approvalId: 'OA-2024-0315-001',
        submitter: '张三',
        department: '技术研发部',
        budgetYear: 2024,
        budgetQuarter: 'Q1',
        totalAmount: 5000000,
        items: [
          { category: '人员成本', amount: 3000000 },
          { category: '设备采购', amount: 1500000 },
          { category: '其他', amount: 500000 },
        ],
      },
    };

    const result1 = processor.addAttachment(
      meeting1.id,
      attachment1.fileName,
      attachment1.fileType,
      attachment1.uploader,
      attachment1.content,
      attachment1.originalInput
    );
    console.log(chalk.green(`✓ 添加附件: ${attachment1.fileName}`));
    console.log(`  证据链状态: ${result1.evidenceChainStatus}\n`);

    const correction1 = processor.applyManualCorrection(
      meeting1.id,
      'meetingTitle',
      '2024年Q1研发部门预算评审会议（修订版）',
      '会议标题需要更准确，注明修订情况',
      '李四'
    );
    console.log(
      chalk.green(`✓ 人工修正: meetingTitle 已更新`)
    );
    console.log(`  原因: ${chalk.yellow('会议标题需要更准确，注明修订情况')}`);
    console.log(`  系统判断已保留\n`);

    processor.generateSearchTermReport(
      meeting1.id,
      '预算',
      attachment1.content
    );
    console.log(chalk.green(`✓ 搜索词报告已生成: "预算"\n`));

    console.log(chalk.bold('【异常路径演示】'));
    const meeting2 = processor.createMeetingMinutes(
      '市场推广方案讨论会',
      '2024-03-20',
      '市场营销部',
      ['钱七', '孙八']
    );
    console.log(chalk.green(`✓ 创建会议: ${meeting2.meetingTitle}`));
    console.log(`  ID: ${meeting2.id}\n`);

    processor.simulateBrokenEvidenceChain(
      meeting2.id,
      '关键审批文件缺失，无法追溯决策依据'
    );
    console.log(chalk.yellow(`⚠ 模拟证据链断开`));
    console.log(`  原因: ${chalk.red('关键审批文件缺失，无法追溯决策依据')}\n`);

    console.log(chalk.bold('【查询入口演示 - 查看所有记录】'));
    const allMeetings = processor.getAllMeetings();
    allMeetings.forEach((m) => {
      const status =
        m.evidenceChain.status === 'broken'
          ? chalk.red('证据链断开')
          : chalk.green('证据链完整');
      console.log(
        `  - ${m.meetingTitle} | ${m.department} | ${status} | 修正: ${m.corrections.length}次`
      );
    });

    console.log('\n' + chalk.bold.cyan('=== 演示完成 ==='));
    console.log(chalk.cyan('提示: 运行 "mmp report -m <会议ID>" 查看完整报告'));
  });

program.parse(process.argv);

if (process.argv.length <= 2) {
  program.help();
}
