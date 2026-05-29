const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const Table = require('cli-table3');
const { format } = require('date-fns');
const { zhCN } = require('date-fns/locale');

function formatDate(dateStr) {
  return format(new Date(dateStr), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
}

function generateSummary(returnData) {
  const { checkedItems, damages, missingItems, depositResult, rentalInfo } = returnData;
  
  const lensCount = checkedItems.filter(i => i.category === 'lens').length;
  const lightStandCount = checkedItems.filter(i => i.category === 'lightStand').length;
  const batteryCount = checkedItems.filter(i => i.category === 'battery').length;
  const accessoryCount = checkedItems.filter(i => i.category === 'accessory').length;
  
  const damagedItems = checkedItems.filter(i => i.status === 'damaged').length;
  const missingCount = missingItems.length;
  
  return {
    rentalId: returnData.rentalId,
    returnId: returnData.id,
    customerName: rentalInfo?.customerName || '未填写',
    returnDate: formatDate(returnData.createdAt),
    items: {
      total: checkedItems.length,
      lens: lensCount,
      lightStand: lightStandCount,
      battery: batteryCount,
      accessory: accessoryCount
    },
    issues: {
      damaged: damagedItems,
      missing: missingCount,
      totalIssues: damagedItems + missingCount
    },
    deposit: {
      total: depositResult?.depositAmount || 0,
      deduction: depositResult?.totalDeduction || 0,
      refund: depositResult?.refundAmount || 0
    },
    status: missingCount > 0 ? '待处理' : '已完成',
    manualVerified: returnData.manualCheck?.confirmed || false
  };
}

function printSummary(summary) {
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║         器材归还验收摘要                ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════╝\n'));
  
  const table = new Table({
    head: ['项目', '内容'],
    colWidths: [15, 35],
    wordWrap: true
  });
  
  table.push(
    ['租借单号', summary.rentalId],
    ['归还单号', summary.returnId],
    ['客户名称', summary.customerName],
    ['归还时间', summary.returnDate],
    ['器材总数', `${summary.items.total} 件`],
    ['  镜头', `${summary.items.lens} 件`],
    ['  灯架', `${summary.items.lightStand} 件`],
    ['  电池', `${summary.items.battery} 件`],
    ['  配件', `${summary.items.accessory} 件`],
    [chalk.yellow('异常数量'), chalk.yellow(`${summary.issues.totalIssues} 项`)],
    ['  损坏', `${summary.issues.damaged} 件`],
    ['  缺失', `${summary.issues.missing} 件`],
    [chalk.green('押金总额'), `${summary.deposit.total.toFixed(2)} 元`],
    [chalk.red('应扣金额'), `${summary.deposit.deduction.toFixed(2)} 元`],
    [chalk.cyan('退还金额'), `${summary.deposit.refund.toFixed(2)} 元`],
    ['人工核对', summary.manualVerified ? chalk.green('已确认') : chalk.red('未确认')],
    ['状态', summary.status === '已完成' ? chalk.green(summary.status) : chalk.yellow(summary.status)]
  );
  
  console.log(table.toString());
}

function printDetailedReport(returnData) {
  console.log(chalk.blue.bold('\n╔════════════════════════════════════════╗'));
  console.log(chalk.blue.bold('║         器材归还详细明细                ║'));
  console.log(chalk.blue.bold('╚════════════════════════════════════════╝\n'));
  
  console.log(chalk.yellow('--- 已归还器材明细 ---\n'));
  
  const itemsTable = new Table({
    head: ['分类', '名称', '编号', '状态', '核对时间'],
    colWidths: [10, 15, 15, 12, 20]
  });
  
  const categoryNames = {
    lens: '镜头',
    lightStand: '灯架',
    battery: '电池',
    accessory: '配件'
  };
  
  const statusColors = {
    returned: chalk.green,
    good: chalk.green,
    damaged: chalk.red,
    missing: chalk.red,
    checked: chalk.blue,
    found: chalk.magenta,
    not_rented: chalk.gray
  };
  
  const statusNames = {
    returned: '完好',
    good: '完好',
    damaged: '损坏',
    missing: '缺失',
    checked: '已点',
    found: '遗留',
    not_rented: '非租'
  };
  
  returnData.checkedItems.forEach(item => {
    const statusColor = statusColors[item.status] || chalk.white;
    itemsTable.push([
      categoryNames[item.category] || item.category,
      item.name,
      item.serialNumber,
      statusColor(statusNames[item.status] || item.status),
      formatDate(item.verifiedAt)
    ]);
  });
  
  console.log(itemsTable.toString());
  
  if (returnData.damages && returnData.damages.length > 0) {
    console.log(chalk.red('\n--- 损伤记录明细 ---\n'));
    
    const damageTable = new Table({
      head: ['器材名称', '编号', '严重程度', '部位', '预估费用'],
      colWidths: [15, 12, 10, 15, 12]
    });
    
    const severityColors = {
      minor: chalk.yellow,
      medium: chalk.orange || chalk.yellow,
      severe: chalk.red
    };
    
    const severityNames = {
      minor: '轻微',
      medium: '中等',
      severe: '严重'
    };
    
    returnData.damages.forEach(d => {
      const sevColor = severityColors[d.severity] || chalk.white;
      damageTable.push([
        d.itemName,
        d.itemSerialNumber,
        sevColor(severityNames[d.severity] || d.severity),
        d.location,
        `${d.estimatedCost.toFixed(2)} 元`
      ]);
    });
    
    console.log(damageTable.toString());
  }
  
  if (returnData.missingItems && returnData.missingItems.length > 0) {
    console.log(chalk.red('\n--- 缺失器材明细 ---\n'));
    
    const missingTable = new Table({
      head: ['分类', '名称', '编号'],
      colWidths: [10, 20, 20]
    });
    
    returnData.missingItems.forEach(item => {
      missingTable.push([
        categoryNames[item.category] || item.category,
        item.name,
        item.serialNumber
      ]);
    });
    
    console.log(missingTable.toString());
  }
  
  if (returnData.depositResult) {
    console.log(chalk.cyan('\n--- 押金明细 ---\n'));
    
    const depositTable = new Table({
      head: ['项目', '金额 (元)'],
      colWidths: [30, 20]
    });
    
    depositTable.push(
      [chalk.green('押金总额'), returnData.depositResult.depositAmount.toFixed(2)]
    );
    
    returnData.depositResult.deductions.forEach(d => {
      depositTable.push([
        chalk.red(`  扣款: ${d.item} (${d.reason})`),
        chalk.red(`-${d.amount.toFixed(2)}`)
      ]);
    });
    
    depositTable.push(
      [chalk.cyan.bold('应退还金额'), chalk.cyan.bold(returnData.depositResult.refundAmount.toFixed(2))]
    );
    
    console.log(depositTable.toString());
  }
}

function exportReport(returnData, format = 'json', outputDir = './reports') {
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const timestamp = format(new Date(), 'yyyyMMdd-HHmmss');
  const baseName = `归还报告-${returnData.rentalId || '未知'}-${timestamp}`;
  
  switch (format) {
    case 'json':
      return exportJSON(returnData, path.join(outputDir, `${baseName}.json`));
    case 'txt':
      return exportTXT(returnData, path.join(outputDir, `${baseName}.txt`));
    case 'all':
      exportJSON(returnData, path.join(outputDir, `${baseName}.json`));
      return exportTXT(returnData, path.join(outputDir, `${baseName}.txt`));
    default:
      throw new Error(`不支持的导出格式: ${format}`);
  }
}

function exportJSON(returnData, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(returnData, null, 2), 'utf8');
  console.log(chalk.green(`\n✓ JSON报告已导出: ${filePath}`));
  return filePath;
}

function exportTXT(returnData, filePath) {
  const summary = generateSummary(returnData);
  
  let content = '';
  content += '══════════════════════════════════════════════════\n';
  content += '              摄影棚器材归还验收报告                \n';
  content += '══════════════════════════════════════════════════\n\n';
  
  content += '【基本信息】\n';
  content += `  租借单号: ${summary.rentalId}\n`;
  content += `  归还单号: ${summary.returnId}\n`;
  content += `  客户名称: ${summary.customerName}\n`;
  content += `  归还时间: ${summary.returnDate}\n\n`;
  
  content += '【器材清点】\n';
  content += `  总计: ${summary.items.total} 件\n`;
  content += `    镜头: ${summary.items.lens} 件\n`;
  content += `    灯架: ${summary.items.lightStand} 件\n`;
  content += `    电池: ${summary.items.battery} 件\n`;
  content += `    配件: ${summary.items.accessory} 件\n\n`;
  
  content += '【异常记录】\n';
  content += `  损坏: ${summary.issues.damaged} 件\n`;
  content += `  缺失: ${summary.issues.missing} 件\n\n`;
  
  content += '【押金结算】\n';
  content += `  押金总额: ${summary.deposit.total.toFixed(2)} 元\n`;
  content += `  应扣金额: ${summary.deposit.deduction.toFixed(2)} 元\n`;
  content += `  退还金额: ${summary.deposit.refund.toFixed(2)} 元\n\n`;
  
  content += '【器材明细】\n';
  returnData.checkedItems.forEach((item, i) => {
    const statusMap = { returned: '完好', damaged: '损坏', missing: '缺失', good: '完好', checked: '已点', found: '遗留' };
    content += `  ${i + 1}. [${item.serialNumber}] ${item.name} - ${statusMap[item.status] || item.status}\n`;
  });
  
  if (returnData.damages && returnData.damages.length > 0) {
    content += '\n【损伤详情】\n';
    returnData.damages.forEach((d, i) => {
      const sevMap = { minor: '轻微', medium: '中等', severe: '严重' };
      content += `  ${i + 1}. ${d.itemName} (${d.itemSerialNumber})\n`;
      content += `     程度: ${sevMap[d.severity] || d.severity}\n`;
      content += `     部位: ${d.location}\n`;
      content += `     描述: ${d.description}\n`;
      content += `     预估费用: ${d.estimatedCost.toFixed(2)} 元\n`;
    });
  }
  
  content += '\n【人工核对区】\n';
  content += `  核对确认: ${returnData.manualCheck?.confirmed ? '是' : '否'}\n`;
  content += `  核对时间: ${returnData.manualCheck?.confirmedAt || '未核对'}\n`;
  content += '  核对人签名: _______________\n';
  content += '  备注: _______________\n\n';
  
  content += '══════════════════════════════════════════════════\n';
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(chalk.green(`✓ TXT报告已导出: ${filePath}`));
  return filePath;
}

module.exports = {
  generateSummary,
  printSummary,
  printDetailedReport,
  exportReport
};
