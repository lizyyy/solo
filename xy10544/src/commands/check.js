const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { 
  getAllHazards, 
  getHazardsByStatus, 
  getOverdueHazards 
} = require('../core/hazardService');
const { getAllTeams } = require('../core/teamService');
const { getHazardsByTeam, getFinesByTeam } = require('../core/fineService');
const { HAZARD_STATUS, STATUS_LABELS, LEVEL_LABELS } = require('../utils/constants');
const { colorizeStatus, colorizeLevel, getTeamById } = require('../utils/helpers');
const chalk = require('chalk');
const Table = require('cli-table3');

const command = new Command('check')
  .description('检查隐患状态和统计信息')
  .option('--status <status>', '按状态筛选: discovered|rectifying|pending_review|reopened|closed')
  .option('--team <teamId>', '按责任班组筛选')
  .option('--overdue', '仅显示逾期隐患')
  .option('--all', '显示所有隐患（包含已闭环）')
  .action((options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    let hazards = getAllHazards();

    if (!options.all && !options.status) {
      hazards = hazards.filter(h => h.status !== HAZARD_STATUS.CLOSED);
    }

    if (options.status) {
      hazards = getHazardsByStatus(options.status);
    }

    if (options.team) {
      hazards = hazards.filter(h => h.responsibleTeamId === options.team);
    }

    if (options.overdue) {
      hazards = getOverdueHazards();
    }

    showStatistics();
    console.log();

    if (hazards.length === 0) {
      console.log(chalk.yellow('ℹ️  未找到符合条件的隐患记录'));
      return;
    }

    showHazardList(hazards);
  });

function showStatistics() {
  const hazards = getAllHazards();
  const teams = getAllTeams();
  
  const stats = {
    total: hazards.length,
    closed: hazards.filter(h => h.status === HAZARD_STATUS.CLOSED).length,
    discovered: hazards.filter(h => h.status === HAZARD_STATUS.DISCOVERED).length,
    rectifying: hazards.filter(h => h.status === HAZARD_STATUS.RECTIFYING).length,
    pending: hazards.filter(h => h.status === HAZARD_STATUS.PENDING_REVIEW).length,
    reopened: hazards.filter(h => h.status === HAZARD_STATUS.REOPENED).length,
    overdue: getOverdueHazards().length
  };

  stats.open = stats.total - stats.closed;
  stats.closeRate = stats.total > 0 
    ? Math.round((stats.closed / stats.total) * 100) 
    : 0;

  console.log(chalk.bold.cyan('📊 隐患统计概览'));
  console.log(chalk.gray('━'.repeat(60)));
  
  const statTable = new Table({
    head: [
      chalk.white('指标'),
      chalk.white('数量')
    ],
    colWidths: [30, 15]
  });

  statTable.push(
    [chalk.cyan('总隐患数'), stats.total.toString()],
    [chalk.green('已闭环'), stats.closed.toString()],
    [chalk.yellow('已发现待整改'), stats.discovered.toString()],
    [chalk.blue('整改中'), stats.rectifying.toString()],
    [chalk.magenta('待复查'), stats.pending.toString()],
    [chalk.red('需重新整改'), stats.reopened.toString()],
    [chalk.red.bold('逾期未整改'), stats.overdue.toString()],
    [chalk.cyan('闭环率'), `${stats.closeRate}%`]
  );

  console.log(statTable.toString());

  if (stats.overdue > 0) {
    console.log(chalk.red.bold(`\n⚠️  警告: 有 ${stats.overdue} 条隐患已逾期未整改！`));
  }
}

function showHazardList(hazards) {
  console.log(chalk.bold.cyan('📋 隐患列表'));
  console.log(chalk.gray('━'.repeat(80)));

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('类型'),
      chalk.white('位置'),
      chalk.white('等级'),
      chalk.white('责任班组'),
      chalk.white('状态'),
      chalk.white('整改截止')
    ],
    colWidths: [10, 12, 20, 8, 12, 10, 12]
  });

  for (const hazard of hazards) {
    const team = getTeamById(hazard.responsibleTeamId);
    const teamName = team ? team.name : hazard.responsibleTeamId;
    
    const isOverdue = hazard.status !== HAZARD_STATUS.CLOSED && 
      hazard.rectifyDeadline && 
      new Date(hazard.rectifyDeadline) < new Date();

    const deadline = isOverdue 
      ? chalk.red.bold(formatDate(hazard.rectifyDeadline) + ' ⚠️')
      : formatDate(hazard.rectifyDeadline);

    table.push([
      hazard.id,
      hazard.type,
      hazard.location,
      colorizeLevel(hazard.level),
      teamName,
      colorizeStatus(hazard.status),
      deadline
    ]);
  }

  console.log(table.toString());
  console.log(chalk.gray(`\n共 ${hazards.length} 条记录`));
}

function formatDate(dateString) {
  if (!dateString) return '-';
  return new Date(dateString).toISOString().split('T')[0];
}

module.exports = command;
