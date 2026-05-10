const chalk = require('chalk');
const Table = require('cli-table');
const { getDb, databaseExists } = require('../database');

function displayCheckRuns(runs) {
  if (runs.length === 0) {
    console.log(chalk.yellow('暂无检查记录。请先运行: vending-transfer check'));
    return;
  }

  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan('              历史检查记录'));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════\n'));

  const table = new Table({
    head: [
      chalk.cyan('ID'),
      chalk.cyan('检查日期'),
      chalk.cyan('点位'),
      chalk.cyan('商品'),
      chalk.cyan('临期'),
      chalk.cyan('紧急'),
      chalk.cyan('问题'),
      chalk.cyan('状态')
    ],
    colWidths: [6, 15, 8, 8, 8, 8, 8, 15]
  });

  runs.forEach(run => {
    let status;
    let statusColor;
    
    if (run.failed === 0 && run.issues_found === 0) {
      status = '通过';
      statusColor = chalk.green;
    } else if (run.critical_items > 0) {
      status = '失败';
      statusColor = chalk.red;
    } else {
      status = '警告';
      statusColor = chalk.yellow;
    }

    table.push([
      run.id,
      run.run_date,
      run.total_locations,
      run.total_products,
      run.expiring_items,
      run.critical_items,
      run.issues_found,
      statusColor(status)
    ]);
  });

  console.log(table.toString());
  console.log(chalk.gray('\n使用 --id <ID> 查看详细信息'));
}

function displayCheckDetails(run, issues) {
  console.log(chalk.cyan('\n═══════════════════════════════════════════════════════════'));
  console.log(chalk.cyan(`              检查记录详情 #${run.id}`));
  console.log(chalk.cyan('═══════════════════════════════════════════════════════════\n'));

  const summaryTable = new Table({
    head: [chalk.cyan('指标'), chalk.cyan('数值')],
    colWidths: [25, 25]
  });

  let overallStatus;
  let statusColor;
  if (run.failed === 0 && run.issues_found === 0) {
    overallStatus = '通过';
    statusColor = chalk.green;
  } else if (run.critical_items > 0) {
    overallStatus = '失败';
    statusColor = chalk.red;
  } else {
    overallStatus = '警告';
    statusColor = chalk.yellow;
  }

  summaryTable.push(
    ['检查日期', run.run_date],
    ['总点位数量', run.total_locations],
    ['总商品数量', run.total_products],
    ['临期商品数量', run.expiring_items],
    ['紧急临期数量', run.critical_items],
    ['调拨建议数量', run.transfer_suggestions],
    ['降价建议数量', run.price_adjustments],
    ['发现问题数量', run.issues_found],
    ['通过检查项', run.passed],
    ['失败检查项', run.failed],
    ['整体状态', statusColor(overallStatus)]
  );

  console.log(summaryTable.toString());

  if (issues.length > 0) {
    console.log(chalk.yellow('\n⚠ 问题详情:'));
    
    const critical = issues.filter(i => i.severity === 'critical');
    const warnings = issues.filter(i => i.severity === 'warning');
    const info = issues.filter(i => i.severity === 'info');

    if (critical.length > 0) {
      console.log(chalk.red(`\n  严重问题 (${critical.length}):`));
      critical.forEach(issue => {
        console.log(chalk.red(`    • [${issue.issue_type}] ${issue.message}`));
        if (issue.details) {
          const details = JSON.parse(issue.details);
          console.log(chalk.gray(`      详情: ${JSON.stringify(details)}`));
        }
      });
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow(`\n  警告 (${warnings.length}):`));
      warnings.forEach(issue => {
        console.log(chalk.yellow(`    • [${issue.issue_type}] ${issue.message}`));
        if (issue.details) {
          const details = JSON.parse(issue.details);
          console.log(chalk.gray(`      详情: ${JSON.stringify(details)}`));
        }
      });
    }

    if (info.length > 0) {
      console.log(chalk.blue(`\n  信息提示 (${info.length}):`));
      info.forEach(issue => {
        console.log(chalk.blue(`    • [${issue.issue_type}] ${issue.message}`));
      });
    }
  }

  console.log(chalk.cyan('\n───────────────────────────────────────────────────────────'));
}

async function historyCommand(options) {
  const { limit, all, id } = options;

  if (!databaseExists()) {
    console.log(chalk.yellow('数据库不存在，请先运行: vending-transfer init'));
    return;
  }

  const db = getDb();

  try {
    if (id) {
      const run = db.prepare('SELECT * FROM check_runs WHERE id = ?').get(id);
      
      if (!run) {
        console.log(chalk.red(`找不到检查记录 #${id}`));
        db.close();
        return;
      }

      const issues = db.prepare('SELECT * FROM check_issues WHERE check_run_id = ? ORDER BY severity DESC').all(id);
      displayCheckDetails(run, issues);
    } else {
      let query = 'SELECT * FROM check_runs ORDER BY id DESC';
      const params = [];

      if (!all) {
        query += ' LIMIT ?';
        params.push(parseInt(limit));
      }

      const runs = db.prepare(query).all(...params);
      displayCheckRuns(runs);
    }

    db.close();

  } catch (err) {
    db.close();
    console.log(chalk.red(`查询历史记录失败: ${err.message}`));
  }
}

module.exports = historyCommand;
