const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const utils = require('./utils');
const dataStore = require('./dataStore');
const validator = require('./validator');

function handleInit() {
  console.log(chalk.blue('正在初始化样例数据...'));
  utils.ensureDirs();
  
  const examplesDir = path.join(__dirname, '..', 'examples');
  
  const budgetSample = path.join(examplesDir, 'budgets-sample.json');
  const invoiceSample = path.join(examplesDir, 'invoices-sample.json');
  const approvalSample = path.join(examplesDir, 'approvals-sample.json');
  
  if (!fs.existsSync(budgetSample)) {
    console.log(chalk.red('样例数据文件不存在，使用内嵌样例数据...'));
    const defaultBudgets = [
      {
        activityId: 'ACT-2026-001',
        activityName: '春季校园文化节',
        clubName: '学生会',
        totalAmount: '15000.00',
        status: 'approved',
        submittedBy: '张三',
        submittedDate: '2026-03-01',
        approvedDate: '2026-03-05'
      }
    ];
    dataStore.saveBudgets(defaultBudgets);
  } else {
    const budgets = utils.readJsonFile(budgetSample) || [];
    dataStore.saveBudgets(budgets);
  }
  
  if (!fs.existsSync(invoiceSample)) {
    const defaultInvoices = [];
    dataStore.saveInvoices(defaultInvoices);
  } else {
    const invoices = utils.readJsonFile(invoiceSample) || [];
    dataStore.saveInvoices(invoices);
  }
  
  if (!fs.existsSync(approvalSample)) {
    const defaultApprovals = [];
    dataStore.saveApprovals(defaultApprovals);
  } else {
    const approvals = utils.readJsonFile(approvalSample) || [];
    dataStore.saveApprovals(approvals);
  }
  
  console.log(chalk.green('✓ 样例数据初始化完成！'));
  console.log(chalk.gray('工作目录: ') + utils.getWorkDir());
  console.log('');
  console.log(chalk.yellow('样例活动说明:'));
  console.log(chalk.cyan('  ACT-2026-001 - 春季校园文化节 (预算、票据、审批完整)'));
  console.log(chalk.cyan('  ACT-2026-002 - 编程大赛 (预算未审批，有票据但无审批)'));
  console.log(chalk.cyan('  ACT-2026-003 - 志愿者招募活动 (预算、票据、审批完整)'));
  console.log(chalk.cyan('  ACT-2026-004 - 演讲比赛 (预算审批通过，有票据但审批不完整)'));
}

async function handleImport(filePath, type) {
  if (!utils.isInitialized()) {
    console.log(chalk.red('错误: 工作目录未初始化，请先运行 init 命令'));
    return;
  }
  
  if (!fs.existsSync(filePath)) {
    console.log(chalk.red(`错误: 文件不存在: ${filePath}`));
    return;
  }
  
  const ext = path.extname(filePath).toLowerCase();
  let data;
  
  try {
    if (ext === '.json') {
      data = utils.readJsonFile(filePath);
    } else if (ext === '.csv') {
      data = await utils.readCsvFile(filePath);
    } else {
      console.log(chalk.red('错误: 不支持的文件格式，仅支持 .json 和 .csv'));
      return;
    }
    
    if (!data || !Array.isArray(data)) {
      console.log(chalk.red('错误: 文件格式错误，应为数组格式'));
      return;
    }
    
    const validTypes = ['budget', 'invoice', 'approval'];
    if (!validTypes.includes(type)) {
      console.log(chalk.red(`错误: 无效的类型 "${type}"，请使用: budget, invoice, approval`));
      return;
    }
    
    let existingData;
    let saveFunction;
    let typeName;
    
    switch (type) {
      case 'budget':
        existingData = dataStore.loadBudgets();
        saveFunction = dataStore.saveBudgets;
        typeName = '预算';
        break;
      case 'invoice':
        existingData = dataStore.loadInvoices();
        saveFunction = dataStore.saveInvoices;
        typeName = '票据';
        break;
      case 'approval':
        existingData = dataStore.loadApprovals();
        saveFunction = dataStore.saveApprovals;
        typeName = '审批';
        break;
    }
    
    const existingIds = new Set(existingData.map(d => d.activityId || d.id));
    const newRecords = [];
    const updatedRecords = [];
    
    data.forEach(record => {
      const id = record.activityId || record.id;
      if (existingIds.has(id)) {
        updatedRecords.push(record);
      } else {
        newRecords.push(record);
      }
    });
    
    const mergedData = [...existingData];
    
    data.forEach(record => {
      const id = record.activityId || record.id;
      const existingIndex = mergedData.findIndex(d => (d.activityId || d.id) === id);
      if (existingIndex !== -1) {
        mergedData[existingIndex] = { ...mergedData[existingIndex], ...record };
      } else {
        mergedData.push(record);
      }
    });
    
    saveFunction(mergedData);
    
    console.log(chalk.green(`✓ 成功导入 ${data.length} 条${typeName}记录`));
    console.log(`  - 新增: ${newRecords.length} 条`);
    console.log(`  - 更新: ${updatedRecords.length} 条`);
    
  } catch (error) {
    console.log(chalk.red(`导入失败: ${error.message}`));
  }
}

function handleCheck() {
  if (!utils.isInitialized()) {
    console.log(chalk.red('错误: 工作目录未初始化，请先运行 init 命令'));
    return;
  }
  
  console.log(chalk.blue('正在执行数据校验...'));
  console.log('');
  
  const result = validator.validateAll();
  
  console.log(chalk.bold('═══════════════════════════════════════'));
  console.log(chalk.bold('  校验结果汇总'));
  console.log(chalk.bold('═══════════════════════════════════════'));
  console.log('');
  
  console.log(`  活动总数: ${result.summary.total}`);
  console.log(`  ${chalk.green('✓ 通过 (PASS):')} ${result.summary.pass}`);
  console.log(`  ${chalk.yellow('⚠ 警告 (WARN):')} ${result.summary.warn}`);
  console.log(`  ${chalk.red('✗ 失败 (FAIL):')} ${result.summary.fail}`);
  console.log('');
  
  result.results.forEach(r => {
    const statusSymbol = r.status === validator.STATUS.PASS ? chalk.green('✓') :
                        r.status === validator.STATUS.WARN ? chalk.yellow('⚠') :
                        chalk.red('✗');
    const statusColor = r.status === validator.STATUS.PASS ? chalk.green :
                       r.status === validator.STATUS.WARN ? chalk.yellow :
                       chalk.red;
    
    console.log(`${statusSymbol} ${chalk.bold(r.summary.activityName)} (${r.activityId})`);
    console.log(`   状态: ${statusColor(r.status)}`);
    console.log(`   预算: ¥${r.summary.budgetAmount.toFixed(2)} [${r.summary.budgetStatus}]`);
    console.log(`   票据: ${r.summary.invoiceCount} 张, 总计 ¥${r.summary.totalInvoiceAmount.toFixed(2)}`);
    console.log(`   审批: [${r.summary.approvalStatus}], 审批金额 ¥${r.summary.approvedAmount.toFixed(2)}`);
    
    if (r.issues.length > 0) {
      console.log('   问题:');
      r.issues.forEach(issue => {
        const issueSymbol = issue.severity === validator.STATUS.WARN ? chalk.yellow('⚠') : chalk.red('✗');
        console.log(`     ${issueSymbol} ${issue.message}`);
      });
    }
    console.log('');
  });
  
  if (result.summary.fail > 0) {
    console.log(chalk.bold('═══════════════════════════════════════'));
    console.log(chalk.yellow('  存在需要处理的问题'));
    console.log(chalk.bold('═══════════════════════════════════════'));
    console.log('');
    console.log(chalk.red('✗ FAIL (失败)') + ' - 必须修复后才能报销');
    console.log(chalk.yellow('⚠ WARN (警告)') + ' - 建议检查，但不影响报销');
    console.log('');
  }
  
  console.log(chalk.gray('校验历史已保存到: ') + utils.getHistoryDir());
  
  return result;
}

function handleHistory(limit = 5) {
  const historyDir = utils.getHistoryDir();
  
  if (!fs.existsSync(historyDir)) {
    console.log(chalk.yellow('暂无历史记录'));
    return;
  }
  
  const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('check-') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a))
    .slice(0, limit);
  
  if (files.length === 0) {
    console.log(chalk.yellow('暂无校验历史记录'));
    return;
  }
  
  console.log(chalk.bold('═══════════════════════════════════════'));
  console.log(chalk.bold(`  最近 ${files.length} 次校验历史`));
  console.log(chalk.bold('═══════════════════════════════════════'));
  console.log('');
  
  files.forEach((file, index) => {
    const record = utils.readJsonFile(path.join(historyDir, file));
    
    if (record) {
      const date = new Date(record.timestamp);
      console.log(chalk.cyan(`[${index + 1}] ${date.toLocaleString('zh-CN')}`));
      console.log(`   ID: ${record.id}`);
      console.log(`   总数: ${record.summary.total}, 通过: ${chalk.green(record.summary.pass)}, 警告: ${chalk.yellow(record.summary.warn)}, 失败: ${chalk.red(record.summary.fail)}`);
      console.log('');
    }
  });
}

function handleExport(outputPath, format = 'json') {
  const historyDir = utils.getHistoryDir();
  
  if (!fs.existsSync(historyDir)) {
    console.log(chalk.red('错误: 暂无校验记录，请先运行 check 命令'));
    return;
  }
  
  const files = fs.readdirSync(historyDir)
    .filter(f => f.startsWith('check-') && f.endsWith('.json'))
    .sort((a, b) => b.localeCompare(a));
  
  if (files.length === 0) {
    console.log(chalk.red('错误: 暂无校验记录'));
    return;
  }
  
  const latestRecord = utils.readJsonFile(path.join(historyDir, files[0]));
  
  if (!latestRecord) {
    console.log(chalk.red('错误: 无法读取最新校验记录'));
    return;
  }
  
  try {
    if (format === 'json') {
      utils.writeJsonFile(outputPath, latestRecord);
    } else if (format === 'csv') {
      const summaryData = latestRecord.results.map(r => ({
        活动ID: r.activityId,
        活动名称: r.summary.activityName,
        校验状态: r.status,
        预算金额: r.summary.budgetAmount.toFixed(2),
        预算状态: r.summary.budgetStatus,
        票据数量: r.summary.invoiceCount,
        票据总金额: r.summary.totalInvoiceAmount.toFixed(2),
        审批状态: r.summary.approvalStatus,
        审批金额: r.summary.approvedAmount.toFixed(2),
        问题数量: r.issues.length
      }));
      utils.writeCsvFile(outputPath, summaryData);
    } else {
      console.log(chalk.red('错误: 不支持的导出格式'));
      return;
    }
    
    console.log(chalk.green(`✓ 成功导出到: ${outputPath}`));
  } catch (error) {
    console.log(chalk.red(`导出失败: ${error.message}`));
  }
}

module.exports = {
  handleInit,
  handleImport,
  handleCheck,
  handleHistory,
  handleExport
};
