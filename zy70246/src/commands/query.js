const chalk = require('chalk');
const Table = require('cli-table3');
const DataStore = require('../stores/DataStore');

function queryToilets(options) {
  const store = new DataStore(options.dataDir || './data');
  const toilets = store.getAllToilets();

  if (toilets.length === 0) {
    console.log(chalk.yellow('暂无公厕数据，请先导入点位数据。'));
    return;
  }

  console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│              公厕点位查询结果                │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));

  let filtered = toilets;

  if (options.id) {
    const t = store.getToiletById(options.id);
    if (t) {
      filtered = [t];
      displayToiletDetail(t, store);
      return;
    } else {
      console.log(chalk.red(`未找到编号为 ${options.id} 的公厕`));
      return;
    }
  }

  if (options.district) {
    filtered = filtered.filter(t => t.district && t.district.includes(options.district));
  }

  if (options.priority) {
    filtered = filtered.filter(t => t.priorityLevel === options.priority);
  }

  if (options.onlyInvalid) {
    filtered = store.getToiletsWithErrors();
  }

  if (options.onlyWarnings) {
    filtered = store.getToiletsWithWarnings();
  }

  if (filtered.length === 0) {
    console.log(chalk.yellow('没有符合条件的公厕数据。'));
    return;
  }

  const table = new Table({
    head: [
      chalk.gray('编号'),
      chalk.gray('名称'),
      chalk.gray('行政区'),
      chalk.gray('人流权重'),
      chalk.gray('投诉数'),
      chalk.gray('库存'),
      chalk.gray('优先级'),
      chalk.gray('状态')
    ],
    colWidths: [12, 20, 10, 10, 8, 8, 10, 12]
  });

  filtered.sort((a, b) => (b.priorityScore || 0) - (a.priorityScore || 0));

  filtered.forEach(t => {
    const priorityColor = getPriorityColor(t.priorityLevel);
    const statusColor = t.isValid ? chalk.green : chalk.red;
    table.push([
      chalk.white(t.id),
      chalk.white(t.name),
      chalk.white(t.district || '-'),
      chalk.blue(t.flowWeight),
      chalk.red(t.complaintCount),
      chalk.yellow(t.supplyStock),
      priorityColor(t.priorityLevel),
      statusColor(t.isValid ? '✓ 有效' : '✗ 无效')
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`\n共 ${filtered.length} 条记录`));
}

function displayToiletDetail(toilet, store) {
  console.log(chalk.bold.white(`\n公厕详情 - ${toilet.name}`));
  console.log(chalk.gray('─'.repeat(50)));

  const infoTable = new Table({
    colWidths: [20, 40]
  });

  infoTable.push(
    [chalk.cyan('编号'), chalk.white(toilet.id)],
    [chalk.cyan('名称'), chalk.white(toilet.name)],
    [chalk.cyan('地址'), chalk.white(toilet.rawData?.address || '-')],
    [chalk.cyan('行政区'), chalk.white(toilet.district || '-')],
    [chalk.cyan('人流权重'), chalk.blue(toilet.flowWeight)],
    [chalk.cyan('投诉数量'), chalk.red(toilet.complaintCount)],
    [chalk.cyan('补给库存'), chalk.yellow(toilet.supplyStock)],
    [chalk.cyan('上次清洁'), chalk.white(toilet.lastCleanTime || '-')],
    [chalk.cyan('优先级分数'), chalk.bold.white(toilet.priorityScore)],
    [chalk.cyan('优先级'), getPriorityColor(toilet.priorityLevel)(toilet.priorityLevel)],
    [chalk.cyan('数据来源'), chalk.white(toilet.source)],
    [chalk.cyan('状态'), toilet.isValid ? chalk.green('有效') : chalk.red('无效')]
  );

  console.log(infoTable.toString());

  if (toilet.errors && toilet.errors.length > 0) {
    console.log(chalk.red.bold('\n❌ 数据错误:'));
    toilet.errors.forEach(e => {
      console.log(chalk.red(`  - ${e.message}`));
    });
  }

  if (toilet.warnings && toilet.warnings.length > 0) {
    console.log(chalk.yellow.bold('\n⚠️  业务预警:'));
    toilet.warnings.forEach(w => {
      console.log(chalk.yellow(`  - ${w.message}`));
    });
  }

  const complaints = store.getComplaintsByToiletId(toilet.id);
  if (complaints.length > 0) {
    console.log(chalk.magenta.bold('\n📋 关联投诉 (' + complaints.length + ' 条):'));
    const compTable = new Table({
      head: [chalk.gray('投诉ID'), chalk.gray('类型'), chalk.gray('状态'), chalk.gray('时间')],
      colWidths: [12, 12, 10, 25]
    });
    complaints.forEach(c => {
      compTable.push([c.id, c.complaintType, c.status, c.complaintTime]);
    });
    console.log(compTable.toString());
  }
}

function queryComplaints(options) {
  const store = new DataStore(options.dataDir || './data');
  let complaints = store.getAllComplaints();

  if (complaints.length === 0) {
    console.log(chalk.yellow('暂无投诉数据。'));
    return;
  }

  if (options.toiletId) {
    complaints = store.getComplaintsByToiletId(options.toiletId);
  }

  if (options.status) {
    complaints = complaints.filter(c => c.status === options.status);
  }

  if (complaints.length === 0) {
    console.log(chalk.yellow('没有符合条件的投诉数据。'));
    return;
  }

  console.log(chalk.bold.cyan('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.cyan('│              投诉数据查询结果                │'));
  console.log(chalk.bold.cyan('└─────────────────────────────────────────────┘\n'));

  const table = new Table({
    head: [
      chalk.gray('投诉ID'),
      chalk.gray('公厕编号'),
      chalk.gray('类型'),
      chalk.gray('状态'),
      chalk.gray('时间')
    ],
    colWidths: [12, 12, 12, 10, 25]
  });

  complaints.forEach(c => {
    const statusColor = getStatusColor(c.status);
    table.push([
      chalk.white(c.id),
      chalk.white(c.toiletId),
      chalk.cyan(c.complaintType),
      statusColor(c.status),
      chalk.gray(c.complaintTime)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray(`\n共 ${complaints.length} 条记录`));
}

function queryAnomalies(options) {
  const store = new DataStore(options.dataDir || './data');

  console.log(chalk.bold.red('\n┌─────────────────────────────────────────────┐'));
  console.log(chalk.bold.red('│              异常数据查询结果                │'));
  console.log(chalk.bold.red('└─────────────────────────────────────────────┘\n'));

  const invalidToilets = store.getToiletsWithErrors();
  const duplicateRecords = store.getDuplicates();
  const warnings = store.getToiletsWithWarnings();

  let hasAnomalies = false;

  if (options.type === 'all' || options.type === 'invalid' || !options.type) {
    if (invalidToilets.length > 0) {
      hasAnomalies = true;
      console.log(chalk.red.bold('\n❌ 无效数据 (' + invalidToilets.length + ' 条):'));
      const invTable = new Table({
        head: [chalk.gray('编号'), chalk.gray('名称'), chalk.gray('错误类型')],
        colWidths: [12, 20, 40]
      });
      invalidToilets.forEach(t => {
        const errorTypes = t.errors.map(e => e.type).join(', ');
        invTable.push([
          chalk.white(t.id || '?'),
          chalk.white(t.name || '?'),
          chalk.red(errorTypes)
        ]);
      });
      console.log(invTable.toString());
      
      console.log(chalk.gray('\n详细错误信息:'));
      invalidToilets.forEach((t, idx) => {
        console.log(chalk.white(`\n  ${idx + 1}. [${t.id || 'N/A'}] ${t.name || '未命名'}`));
        t.errors.forEach(e => {
          console.log(chalk.red(`     ${e.message}`));
        });
      });
    }
  }

  if (options.type === 'all' || options.type === 'duplicate' || !options.type) {
    if (duplicateRecords.length > 0) {
      hasAnomalies = true;
      console.log(chalk.magenta.bold('\n🔄 重复数据 (' + duplicateRecords.length + ' 条):'));
      const dupTable = new Table({
        head: [chalk.gray('类型'), chalk.gray('ID'), chalk.gray('已有来源'), chalk.gray('新来源')],
        colWidths: [10, 15, 20, 20]
      });
      duplicateRecords.forEach(d => {
        dupTable.push([
          chalk.white(d.type),
          chalk.white(d.id),
          chalk.yellow(d.existingSource),
          chalk.yellow(d.newSource)
        ]);
      });
      console.log(dupTable.toString());
    }
  }

  if (options.type === 'all' || options.type === 'warning' || !options.type) {
    if (warnings.length > 0) {
      hasAnomalies = true;
      console.log(chalk.yellow.bold('\n⚠️  业务预警 (' + warnings.length + ' 条):'));
      const warnTable = new Table({
        head: [chalk.gray('编号'), chalk.gray('名称'), chalk.gray('预警内容')],
        colWidths: [12, 20, 45]
      });
      warnings.forEach(t => {
        const warnMessages = t.warnings.map(w => w.message.substring(0, 30)).join('; ');
        warnTable.push([
          chalk.white(t.id),
          chalk.white(t.name),
          chalk.yellow(warnMessages)
        ]);
      });
      console.log(warnTable.toString());
    }
  }

  if (!hasAnomalies) {
    console.log(chalk.green('\n✓ 恭喜！未检测到异常数据。'));
  }
}

function getPriorityColor(level) {
  switch (level) {
    case 'critical': return chalk.red.bold;
    case 'high': return chalk.yellow.bold;
    case 'normal': return chalk.green;
    default: return chalk.gray;
  }
}

function getStatusColor(status) {
  switch (status) {
    case '待处理': return chalk.red;
    case '处理中': return chalk.yellow;
    case '已解决': return chalk.green;
    case '已关闭': return chalk.gray;
    default: return chalk.white;
  }
}

module.exports = {
  queryToilets,
  queryComplaints,
  queryAnomalies
};
