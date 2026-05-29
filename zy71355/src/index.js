#!/usr/bin/env node

const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table3');

const storage = require('./storage');
const checklist = require('./checklist');
const deposit = require('./deposit');
const report = require('./report');
const duplicate = require('./duplicate');

const program = new Command();

program
  .name('gear-return')
  .description('摄影棚器材归还管理CLI工具')
  .version('1.0.0');

program
  .command('new')
  .description('开始新的器材归还流程')
  .option('-r, --rental-id <rentalId>', '租借单号')
  .option('-c, --conflict <mode>', '冲突处理模式: skip|overwrite|append|prompt', 'prompt')
  .action(async (options) => {
    try {
      console.log(chalk.blue.bold('\n╔════════════════════════════════════════╗'));
      console.log(chalk.blue.bold('║       摄影棚器材归还管理系统            ║'));
      console.log(chalk.blue.bold('╚════════════════════════════════════════╝\n'));
      
      let rentalId = options.rentalId;
      if (!rentalId) {
        const answer = await inquirer.prompt([{
          type: 'input',
          name: 'rentalId',
          message: '请输入租借单号:',
          validate: v => v.length > 0 || '请输入有效的租借单号'
        }]);
        rentalId = answer.rentalId;
      }
      
      const existingReturns = storage.listReturns();
      const duplicateInfo = await duplicate.checkDuplicateReturn(rentalId, existingReturns);
      
      let resolution = { action: 'create_new' };
      if (duplicateInfo.isDuplicate) {
        resolution = await duplicate.handleDuplicateResolution(duplicateInfo, options.conflict);
        
        if (resolution.action === 'skip') {
          console.log(chalk.blue('已跳过，流程结束。'));
          return;
        }
        
        if (resolution.action === 'view_detail') {
          const existingData = storage.loadReturn(resolution.existing.id);
          report.printDetailedReport(existingData);
          console.log('\n');
          const { action } = await inquirer.prompt([{
            type: 'list',
            name: 'action',
            message: '接下来要做什么？',
            choices: [
              { name: '创建新记录', value: 'create_new' },
              { name: '覆盖此记录', value: 'overwrite' },
              { name: '取消', value: 'cancel' }
            ]
          }]);
          
          if (action === 'cancel') {
            console.log(chalk.blue('已取消。'));
            return;
          }
          resolution.action = action;
        }
      }
      
      const { customerName, depositAmount, photoRef } = await inquirer.prompt([
        { type: 'input', name: 'customerName', message: '客户名称:' },
        { type: 'input', name: 'depositAmount', message: '押金金额 (元):', default: '5000' },
        { type: 'input', name: 'photoRef', message: '归还照片参考编号/路径:' }
      ]);
      
      const rentalInfo = {
        customerName,
        depositAmount: parseFloat(depositAmount),
        photoRef
      };
      
      const expectedItems = [];
      const { hasRentalList } = await inquirer.prompt([{
        type: 'confirm',
        name: 'hasRentalList',
        message: '是否有租借单物品列表需要预先录入？',
        default: true
      }]);
      
      if (hasRentalList) {
        console.log(chalk.yellow('\n--- 录入租借单物品 ---\n'));
        await inputExpectedItems(expectedItems);
      }
      
      const checklistResult = await checklist.runChecklist(rentalId, expectedItems);
      
      const depositResult = await deposit.depositTrial(
        checklistResult.checkedItems,
        checklistResult.damages
      );
      
      if (depositResult.confirmed) {
        const { adjust } = await inquirer.prompt([{
          type: 'confirm',
          name: 'adjust',
          message: '是否需要调整扣款金额？',
          default: false
        }]);
        
        if (adjust) {
          depositResult.final = await deposit.adjustDeductions(depositResult);
        }
      }
      
      const manualCheck = await checklist.manualCheckSpace();
      
      const returnData = {
        rentalId,
        rentalInfo,
        expectedItems,
        checkedItems: checklistResult.checkedItems,
        damages: checklistResult.damages,
        missingItems: checklistResult.missingItems,
        depositResult: depositResult.final || depositResult,
        manualCheck,
        status: manualCheck.confirmed ? 'completed' : 'pending',
        importHash: duplicate.generateFileHash({ rentalId, items: checklistResult.checkedItems })
      };
      
      let savedData;
      if (resolution.action === 'overwrite' && resolution.existing) {
        returnData.id = resolution.existing.id;
        returnData.createdAt = resolution.existing.createdAt;
        savedData = storage.saveReturn(returnData);
        console.log(chalk.green(`\n✓ 已覆盖归还记录: ${savedData.id}`));
      } else {
        savedData = storage.saveReturn(returnData);
        console.log(chalk.green(`\n✓ 已创建归还记录: ${savedData.id}`));
      }
      
      const summary = report.generateSummary(savedData);
      report.printSummary(summary);
      
      const { exportFormat } = await inquirer.prompt([{
        type: 'list',
        name: 'exportFormat',
        message: '导出报告格式:',
        choices: [
          { name: 'JSON格式', value: 'json' },
          { name: 'TXT文本格式', value: 'txt' },
          { name: '全部格式', value: 'all' },
          { name: '暂不导出', value: 'none' }
        ]
      }]);
      
      if (exportFormat !== 'none') {
        const exportedPath = report.exportReport(savedData, exportFormat);
        console.log(chalk.green(`\n✓ 报告已导出到: ${exportedPath}`));
      }
      
      console.log(chalk.blue.bold('\n╔════════════════════════════════════════╗'));
      console.log(chalk.blue.bold('║           流程完成 感谢使用            ║'));
      console.log(chalk.blue.bold('╚════════════════════════════════════════╝\n'));
      
    } catch (error) {
      console.error(chalk.red('\n✗ 发生错误:'), error.message);
      if (process.env.DEBUG) console.error(error.stack);
      process.exit(1);
    }
  });

async function inputExpectedItems(items) {
  const categories = [
    { key: 'lens', name: '镜头' },
    { key: 'lightStand', name: '灯架' },
    { key: 'battery', name: '电池' },
    { key: 'accessory', name: '配件' }
  ];
  
  for (const cat of categories) {
    const { count } = await inquirer.prompt([{
      type: 'input',
      name: 'count',
      message: `${cat.name}数量:`,
      default: '0',
      validate: v => !isNaN(parseInt(v))
    }]);
    
    const num = parseInt(count);
    for (let i = 0; i < num; i++) {
      const { name, serialNumber } = await inquirer.prompt([
        { type: 'input', name: 'name', message: `${cat.name} #${i + 1} 名称:` },
        { type: 'input', name: 'serialNumber', message: `${cat.name} #${i + 1} 编号:` }
      ]);
      
      items.push({
        id: `exp-${Date.now()}-${i}`,
        category: cat.key,
        name,
        serialNumber
      });
    }
  }
}

program
  .command('list')
  .description('列出所有归还记录')
  .action(() => {
    const returns = storage.listReturns();
    
    if (returns.length === 0) {
      console.log(chalk.yellow('暂无归还记录。'));
      return;
    }
    
    const table = new Table({
      head: ['归还单号', '租借单号', '创建时间', '状态'],
      colWidths: [40, 20, 25, 12]
    });
    
    const statusColors = {
      completed: chalk.green,
      pending: chalk.yellow,
      draft: chalk.gray
    };
    
    returns.forEach(r => {
      const statusColor = statusColors[r.status] || chalk.white;
      table.push([
        r.id,
        r.rentalId,
        new Date(r.createdAt).toLocaleString('zh-CN'),
        statusColor(r.status || 'draft')
      ]);
    });
    
    console.log(table.toString());
  });

program
  .command('view <returnId>')
  .description('查看归还记录详情')
  .option('-d, --detail', '显示详细明细')
  .action((returnId, options) => {
    const returnData = storage.loadReturn(returnId);
    
    if (!returnData) {
      console.log(chalk.red(`未找到归还记录: ${returnId}`));
      return;
    }
    
    if (options.detail) {
      report.printDetailedReport(returnData);
    } else {
      const summary = report.generateSummary(returnData);
      report.printSummary(summary);
    }
  });

program
  .command('export <returnId>')
  .description('导出归还报告')
  .option('-f, --format <format>', '导出格式: json|txt|all', 'txt')
  .option('-o, --output <dir>', '输出目录', './reports')
  .action((returnId, options) => {
    const returnData = storage.loadReturn(returnId);
    
    if (!returnData) {
      console.log(chalk.red(`未找到归还记录: ${returnId}`));
      return;
    }
    
    const exportedPath = report.exportReport(returnData, options.format, options.output);
    console.log(chalk.green(`\n✓ 报告已导出: ${exportedPath}`));
  });

program
  .command('resume <returnId>')
  .description('继续未完成的归还流程')
  .action(async (returnId) => {
    const returnData = storage.loadReturn(returnId);
    
    if (!returnData) {
      console.log(chalk.red(`未找到归还记录: ${returnId}`));
      return;
    }
    
    console.log(chalk.blue(`\n继续归还记录: ${returnId}`));
    console.log(chalk.gray(`租借单号: ${returnData.rentalId}\n`));
    
    const { nextStep } = await inquirer.prompt([{
      type: 'list',
      name: 'nextStep',
      message: '选择要继续的步骤:',
      choices: [
        { name: '重新清点器材', value: 'checklist' },
        { name: '重新记录损伤', value: 'damage' },
        { name: '重新计算押金', value: 'deposit' },
        { name: '人工核对确认', value: 'verify' },
        { name: '导出报告', value: 'export' }
      ]
    }]);
    
    switch (nextStep) {
      case 'checklist':
        const checklistResult = await checklist.runChecklist(returnData.rentalId, returnData.expectedItems || []);
        returnData.checkedItems = checklistResult.checkedItems;
        returnData.damages = checklistResult.damages;
        returnData.missingItems = checklistResult.missingItems;
        storage.saveReturn(returnData);
        console.log(chalk.green('✓ 器材清点已更新'));
        break;
        
      case 'deposit':
        const depositResult = await deposit.depositTrial(returnData.checkedItems, returnData.damages);
        returnData.depositResult = depositResult;
        storage.saveReturn(returnData);
        console.log(chalk.green('✓ 押金计算已更新'));
        break;
        
      case 'verify':
        const manualCheck = await checklist.manualCheckSpace();
        returnData.manualCheck = manualCheck;
        returnData.status = manualCheck.confirmed ? 'completed' : 'pending';
        storage.saveReturn(returnData);
        console.log(chalk.green('✓ 人工核对已记录'));
        break;
        
      case 'export':
        const { format } = await inquirer.prompt([{
          type: 'list',
          name: 'format',
          message: '导出格式:',
          choices: ['json', 'txt', 'all']
        }]);
        report.exportReport(returnData, format);
        break;
    }
  });

program
  .command('import <file>')
  .description('从文件导入租借单数据')
  .option('-c, --conflict <mode>', '冲突处理: skip|overwrite|append', 'prompt')
  .action(async (filePath, options) => {
    const fs = require('fs');
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const importData = JSON.parse(content);
      
      console.log(chalk.green(`✓ 成功导入文件: ${filePath}`));
      console.log(chalk.gray(`租借单号: ${importData.rentalId || '未知'}`));
      console.log(chalk.gray(`物品数量: ${importData.items?.length || 0}\n`));
      
      const existingReturns = storage.listReturns();
      const fileHash = duplicate.generateFileHash(importData);
      
      const duplicateInfo = await duplicate.checkDuplicateReturn(
        importData.rentalId,
        existingReturns,
        importData
      );
      
      if (duplicateInfo.isDuplicate) {
        const resolution = await duplicate.handleDuplicateResolution(duplicateInfo, options.conflict);
        
        if (resolution.action === 'skip') {
          console.log(chalk.blue('已跳过导入。'));
          return;
        }
        
        if (resolution.action === 'overwrite' || resolution.action === 'append') {
          const existing = storage.loadReturn(resolution.existing.id);
          const result = await duplicate.handleImportConflict(existing, importData, resolution.action);
          storage.saveReturn(result.data);
          console.log(chalk.green(`✓ 已${result.action}现有记录`));
          return;
        }
      }
      
      console.log(chalk.blue('\n请使用 "gear-return new" 命令开始归还流程'));
      
    } catch (error) {
      console.error(chalk.red('✗ 导入失败:'), error.message);
      process.exit(1);
    }
  });

program.parseAsync(process.argv);
