const chalk = require('chalk');
const Table = require('cli-table3');
const DataStore = require('../stores/DataStore');

function generateRoute(options) {
  const store = new DataStore(options.dataDir || './data');
  const toilets = store.getAllToilets();

  if (toilets.length === 0) {
    console.log(chalk.yellow('暂无公厕数据，请先导入点位数据。'));
    return;
  }

  console.log(chalk.bold.green('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.green('│              保洁路线生成结果                │'));
  console.log(chalk.bold.green('└─────────────────────────────────────────────┘\n'));

  const route = store.generateCleaningRoute();

  console.log(chalk.bold('📊 统计概况:'));
  const statsTable = new Table({
    head: [chalk.gray('优先级'), chalk.gray('数量'), chalk.gray('说明')],
    colWidths: [15, 10, 35]
  });
  statsTable.push(
    [chalk.red.bold('紧急 (Critical)'), chalk.red.bold(route.statistics.critical), '高人流(≥7) 或 高投诉(≥3)'],
    [chalk.yellow.bold('高 (High)'), chalk.yellow.bold(route.statistics.high), '中人流(≥4) 或 超12小时未清洁 或 低库存'],
    [chalk.green('正常 (Normal)'), chalk.green(route.statistics.normal), '常规保洁'],
    [chalk.white.bold('总计'), chalk.white.bold(route.statistics.total), `覆盖 ${route.statistics.districts} 个行政区`]
  );
  console.log(statsTable.toString());

  if (route.critical.length > 0) {
    console.log('\n' + chalk.red.bold('🔥 【第一优先级 - 紧急处理】建议2小时内到达:'));
    printRouteList(route.critical, 'critical');
  }

  if (route.high.length > 0) {
    console.log('\n' + chalk.yellow.bold('⚡ 【第二优先级 - 优先处理】建议4小时内到达:'));
    printRouteList(route.high, 'high');
  }

  if (route.normal.length > 0) {
    console.log('\n' + chalk.green.bold('✅ 【第三优先级 - 常规保洁】按班次处理:'));
    printRouteList(route.normal, 'normal');
  }

  if (options.byDistrict) {
    console.log('\n' + chalk.cyan.bold('📍 按行政区分组路线:'));
    Object.entries(route.byDistrict).forEach(([district, data]) => {
      const districtTotal = data.critical.length + data.high.length + data.normal.length;
      console.log(chalk.cyan(`\n  ${district} (${districtTotal} 个公厕):`));
      
      if (data.critical.length > 0) {
        console.log(chalk.red(`    紧急: ${data.critical.map(t => t.id).join(', ')}`));
      }
      if (data.high.length > 0) {
        console.log(chalk.yellow(`    优先: ${data.high.map(t => t.id).join(', ')}`));
      }
      if (data.normal.length > 0) {
        console.log(chalk.green(`    常规: ${data.normal.map(t => t.id).join(', ')}`));
      }
    });
  }

  console.log('\n' + chalk.gray('提示: 使用 "toilet-cli report" 命令生成详细报告文件'));
}

function printRouteList(toilets, level) {
  const table = new Table({
    head: [
      chalk.gray('序号'),
      chalk.gray('编号'),
      chalk.gray('名称'),
      chalk.gray('行政区'),
      chalk.gray('人流权重'),
      chalk.gray('投诉'),
      chalk.gray('库存'),
      chalk.gray('优先级分数')
    ],
    colWidths: [8, 12, 20, 10, 10, 8, 8, 12]
  });

  toilets.forEach((t, idx) => {
    table.push([
      chalk.white(idx + 1),
      chalk.white(t.id),
      chalk.white(t.name),
      chalk.white(t.district),
      chalk.blue(t.flowWeight),
      chalk.red(t.complaintCount),
      chalk.yellow(t.supplyStock),
      chalk.bold.white(t.priorityScore)
    ]);
  });

  console.log(table.toString());
}

function rerunCheck(options) {
  const store = new DataStore(options.dataDir || './data');
  const toilets = store.getAllToilets();
  const complaints = store.getAllComplaints();

  console.log(chalk.bold.magenta('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.magenta('│              重跑数据校验检查                │'));
  console.log(chalk.bold.magenta('└─────────────────────────────────────────────┘\n'));

  console.log(chalk.bold('📋 当前数据状态:'));
  const statusTable = new Table({
    head: [chalk.gray('数据类型'), chalk.gray('数量')],
    colWidths: [20, 15]
  });
  statusTable.push(
    [chalk.white('公厕点位总数'), chalk.white(toilets.length)],
    [chalk.white('投诉记录总数'), chalk.white(complaints.length)]
  );
  console.log(statusTable.toString());

  const { Toilet } = require('../models/Toilet');
  const { Complaint } = require('../models/Complaint');

  let updatedCount = 0;
  const issuesFound = [];

  for (const toilet of toilets) {
    const activeComplaints = complaints.filter(
      c => c.toiletId === toilet.id && (c.status === '待处理' || c.status === '处理中')
    ).length;

    if (activeComplaints !== (toilet.rawData?.complaintCount || 0)) {
      const updatedToilet = new Toilet({
        ...toilet.rawData,
        complaintCount: activeComplaints
      }, toilet.source);
      updatedToilet.validate();
      const summary = updatedToilet.getSummary();

      store.toilets.set(toilet.id, {
        ...summary,
        rawData: { ...toilet.rawData, complaintCount: activeComplaints },
        source: toilet.source,
        updatedAt: new Date().toISOString()
      });

      updatedCount++;
      issuesFound.push({
        type: 'complaint_sync',
        toiletId: toilet.id,
        toiletName: toilet.name,
        oldCount: toilet.rawData?.complaintCount || 0,
        newCount: activeComplaints
      });
    }
  }

  const complainValidationIssues = [];
  for (const complaint of complaints) {
    const comp = new Complaint(complaint.rawData, complaint.source);
    comp.validate();
    if (!comp.isValid) {
      complainValidationIssues.push({
        id: complaint.id,
        errors: comp.errors
      });
    }
  }

  store.save();

  console.log('\n' + chalk.bold('🔍 校验结果:'));
  const resultTable = new Table({
    head: [chalk.gray('检查项'), chalk.gray('结果')],
    colWidths: [25, 35]
  });
  resultTable.push(
    [chalk.cyan('投诉数据同步'), updatedCount > 0 ? chalk.yellow(`${updatedCount} 条已更新`) : chalk.green('无变化 ✓')],
    [chalk.cyan('投诉格式校验'), complainValidationIssues.length > 0 ? chalk.red(`${complainValidationIssues.length} 条异常`) : chalk.green('全部通过 ✓')]
  );
  console.log(resultTable.toString());

  if (issuesFound.length > 0) {
    console.log('\n' + chalk.yellow.bold('🔄 已同步更新以下公厕投诉数:'));
    issuesFound.forEach(issue => {
      console.log(chalk.yellow(`  - [${issue.toiletId}] ${issue.toiletName}: ${issue.oldCount} → ${issue.newCount}`));
    });
  }

  if (complainValidationIssues.length > 0) {
    console.log('\n' + chalk.red.bold('❌ 发现投诉数据异常:'));
    complainValidationIssues.forEach((issue, idx) => {
      console.log(chalk.red(`\n  ${idx + 1}. 投诉ID: ${issue.id}`));
      issue.errors.forEach(e => {
        console.log(chalk.red(`     - ${e.message}`));
      });
    });
  }

  console.log('\n' + chalk.green('✓ 重跑校验完成，数据已更新保存。'));
}

function showHistory(options) {
  const store = new DataStore(options.dataDir || './data');
  const history = store.getImportHistory();

  if (history.length === 0) {
    console.log(chalk.yellow('暂无导入历史记录。'));
    return;
  }

  console.log(chalk.bold.blue('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.blue('│              数据导入历史记录                │'));
  console.log(chalk.bold.blue('└─────────────────────────────────────────────┘\n'));

  const table = new Table({
    head: [
      chalk.gray('时间'),
      chalk.gray('类型'),
      chalk.gray('来源'),
      chalk.gray('总数'),
      chalk.gray('新增'),
      chalk.gray('重复'),
      chalk.gray('无效')
    ],
    colWidths: [25, 10, 15, 8, 8, 8, 8]
  });

  history.slice(-10).reverse().forEach(h => {
    const typeColor = h.type === 'toilets' ? chalk.green : chalk.magenta;
    table.push([
      chalk.gray(new Date(h.timestamp).toLocaleString()),
      typeColor(h.type === 'toilets' ? '公厕' : '投诉'),
      chalk.white(h.source),
      chalk.white(h.total),
      chalk.green(h.added),
      chalk.magenta((h.duplicates || []).length),
      chalk.red((h.invalid || []).length)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`\n显示最近 ${Math.min(history.length, 10)} 条记录`));
}

function clearData(options) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(chalk.red('⚠️  确认要清空所有数据吗？此操作不可恢复！(输入 yes 确认): '), (answer) => {
    rl.close();
    
    if (answer.trim().toLowerCase() === 'yes') {
      const store = new DataStore(options.dataDir || './data');
      store.clearAll();
      console.log(chalk.green('✓ 所有数据已清空。'));
    } else {
      console.log(chalk.yellow('操作已取消。'));
    }
  });
}

module.exports = {
  generateRoute,
  rerunCheck,
  showHistory,
  clearData
};
