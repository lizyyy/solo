#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const commander_1 = require("commander");
const utils_1 = require("./cli/utils");
const commands_1 = require("./cli/commands");
const program = new commander_1.Command();
program
    .name('invoice')
    .description('电子发票抬头纠错 CLI 工具 - 自动核对发票抬头、税号、金额与报销单一致性')
    .version('1.0.0');
program
    .command('init')
    .description('初始化项目数据目录')
    .option('--sample', '同时导入样例数据')
    .action((options) => {
    console.log(utils_1.colors.bold('\n🏢 电子发票抬头纠错 CLI\n'));
    (0, commands_1.cmdInit)(options.sample);
});
program
    .command('import-sample')
    .description('导入内置样例数据（餐饮、差旅、采购发票）')
    .action(() => {
    (0, commands_1.cmdImportSample)();
});
program
    .command('import <type> <file>')
    .description('从 JSON 文件导入数据')
    .addHelpText('after', `
类型说明:
  invoices       发票数据
  reimbursements 报销单数据
  headers        公司抬头库
  departments    部门表
  employees      员工表

示例:
  invoice import invoices ./data/invoices.json
  invoice import reimbursements ./data/reimbursements.json`)
    .action((type, file) => {
    (0, commands_1.cmdImport)(type, file);
});
program
    .command('check')
    .description('执行发票审核检查')
    .argument('[invoice-id]', '可选：指定发票ID或发票号检查单个发票')
    .action((invoiceId) => {
    (0, commands_1.cmdCheck)(invoiceId);
});
program
    .command('detail <id>')
    .description('查看发票详细信息和审核结果')
    .option('--history', '显示操作历史记录')
    .action((id, options) => {
    (0, commands_1.cmdDetail)(id, options.history);
});
program
    .command('report')
    .description('生成检查报告汇总')
    .argument('[filter]', '按结果类型筛选: auto_pass | needs_reissue | manual_review | correction_suggested')
    .action((filter) => {
    (0, commands_1.cmdReport)(filter);
});
program
    .command('list <type>')
    .description('列出数据列表')
    .addHelpText('after', `
类型说明:
  invoices       发票列表
  reimbursements 报销单列表
  headers        公司抬头库`)
    .action((type) => {
    (0, commands_1.cmdList)(type);
});
program
    .command('status')
    .description('查看系统状态和数据统计')
    .action(() => {
    (0, commands_1.cmdStatus)();
});
program.addHelpText('after', `
\${colors.bold('操作链路说明:')}
  1. init                    初始化项目
  2. import / import-sample  导入发票、报销单、抬头库等数据
  3. check                   执行自动审核检查
  4. detail                  查看单张发票详情和问题
  5. report                  查看整体报告和统计

\${colors.bold('审核结果类型:')}
  \${colors.success('✓ 自动通过')}       所有检查项通过，可自动进入下一流程
  \${colors.error('✗ 需补开')}         存在严重错误（抬头/税号不匹配），需重新开票
  \${colors.warning('⚠ 人工复核')}      存在异常情况，需财务人员人工判断
  \${colors.info('ℹ 纠错建议')}        存在潜在风险（抬头近似、金额拆分），建议核实

\${colors.bold('快速开始:')}
  invoice init --sample
  invoice check
  invoice report
`);
program.parse(process.argv);
