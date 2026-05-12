const { Command } = require('commander');
const { isInitialized, readData } = require('../utils/storage');
const { getAllHazards, getOverdueHazards } = require('../core/hazardService');
const { getAllTeams } = require('../core/teamService');
const { 
  getHazardById, 
  getTeamById,
  getRectificationsByHazard,
  getReviewsByHazard,
  getFinesByHazard,
  formatDate,
  colorizeLevel
} = require('../utils/helpers');
const { HAZARD_STATUS, HAZARD_LEVEL, FINE_AMOUNTS, LEVEL_LABELS } = require('../utils/constants');
const chalk = require('chalk');
const Table = require('cli-table3');

const command = new Command('report')
  .description('生成闭环报告（统计、未闭环原因、罚款建议）')
  .option('--team <teamId>', '按班组筛选')
  .option('--level <level>', '按等级筛选: minor|general|major|critical')
  .option('--output <file>', '输出到文件')
  .action((options) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    const report = generateReport(options);
    printReport(report);

    if (options.output) {
      saveReport(report, options.output);
    }
  });

function generateReport(options) {
  let hazards = getAllHazards();
  const teams = getAllTeams();
  const allFines = readData('fines');

  if (options.team) {
    hazards = hazards.filter(h => h.responsibleTeamId === options.team);
  }

  if (options.level) {
    hazards = hazards.filter(h => h.level === options.level);
  }

  const openHazards = hazards.filter(h => h.status !== HAZARD_STATUS.CLOSED);
  const overdueHazards = getOverdueHazards().filter(h => 
    hazards.some(oh => oh.id === h.id)
  );

  const report = {
    generatedAt: new Date().toISOString(),
    summary: {
      total: hazards.length,
      closed: hazards.filter(h => h.status === HAZARD_STATUS.CLOSED).length,
      open: openHazards.length,
      overdue: overdueHazards.length,
      byLevel: {
        minor: hazards.filter(h => h.level === HAZARD_LEVEL.MINOR).length,
        general: hazards.filter(h => h.level === HAZARD_LEVEL.GENERAL).length,
        major: hazards.filter(h => h.level === HAZARD_LEVEL.MAJOR).length,
        critical: hazards.filter(h => h.level === HAZARD_LEVEL.CRITICAL).length
      },
      byStatus: {
        discovered: hazards.filter(h => h.status === HAZARD_STATUS.DISCOVERED).length,
        rectifying: hazards.filter(h => h.status === HAZARD_STATUS.RECTIFYING).length,
        pending: hazards.filter(h => h.status === HAZARD_STATUS.PENDING_REVIEW).length,
        reopened: hazards.filter(h => h.status === HAZARD_STATUS.REOPENED).length
      }
    },
    openHazardDetails: [],
    fineRecommendations: [],
    teamSummary: []
  };

  report.summary.closeRate = report.summary.total > 0 
    ? Math.round((report.summary.closed / report.summary.total) * 100) 
    : 0;

  for (const hazard of openHazards) {
    const rectifications = getRectificationsByHazard(hazard.id);
    const reviews = getReviewsByHazard(hazard.id);
    const team = getTeamById(hazard.responsibleTeamId);
    const fines = getFinesByHazard(hazard.id);

    const isOverdue = hazard.rectifyDeadline && 
      new Date(hazard.rectifyDeadline) < new Date();

    const reasons = [];
    if (rectifications.length === 0) {
      reasons.push('无整改记录');
    }
    if (reviews.length === 0 && rectifications.length > 0) {
      reasons.push('有整改但无复查');
    }
    if (reviews.length > 0) {
      const lastReview = reviews[reviews.length - 1];
      if (lastReview.result === 'failed') {
        reasons.push(`复查不通过: ${lastReview.comment}`);
      }
    }
    if (isOverdue) {
      reasons.push('已逾期未整改');
    }

    report.openHazardDetails.push({
      id: hazard.id,
      type: hazard.type,
      level: hazard.level,
      location: hazard.location,
      description: hazard.description,
      status: hazard.status,
      team: team ? team.name : hazard.responsibleTeamId,
      teamId: hazard.responsibleTeamId,
      deadline: hazard.rectifyDeadline,
      isOverdue,
      rectificationCount: hazard.rectificationCount,
      reviewFailCount: hazard.reviewFailCount,
      reasons,
      discoveryImages: hazard.discoveryImages,
      rectificationImages: rectifications.flatMap(r => r.images)
    });

    if (hazard.reviewFailCount > 0 && fines.length === 0) {
      const recommendedFine = calculateRecommendedFine(hazard);
      report.fineRecommendations.push({
        hazardId: hazard.id,
        type: hazard.type,
        level: hazard.level,
        team: team ? team.name : hazard.responsibleTeamId,
        teamId: hazard.responsibleTeamId,
        reviewFailCount: hazard.reviewFailCount,
        recommendedAmount: recommendedFine,
        reason: `整改复查不通过累计${hazard.reviewFailCount}次`
      });
    }
  }

  for (const team of teams) {
    const teamHazards = hazards.filter(h => h.responsibleTeamId === team.id);
    const teamOpen = teamHazards.filter(h => h.status !== HAZARD_STATUS.CLOSED);
    const teamOverdue = overdueHazards.filter(h => h.responsibleTeamId === team.id);
    const teamFines = allFines.filter(f => f.teamId === team.id);
    const unpaidFines = teamFines.filter(f => !f.paid);

    if (options.team && options.team !== team.id) continue;

    report.teamSummary.push({
      teamId: team.id,
      teamName: team.name,
      leader: team.leader,
      total: teamHazards.length,
      closed: teamHazards.filter(h => h.status === HAZARD_STATUS.CLOSED).length,
      open: teamOpen.length,
      overdue: teamOverdue.length,
      totalFines: teamFines.reduce((sum, f) => sum + f.amount, 0),
      unpaidFines: unpaidFines.reduce((sum, f) => sum + f.amount, 0),
      recommendedFines: report.fineRecommendations
        .filter(r => r.teamId === team.id)
        .reduce((sum, r) => sum + r.recommendedAmount, 0)
    });
  }

  return report;
}

function calculateRecommendedFine(hazard) {
  const baseFine = FINE_AMOUNTS[hazard.level] || 0;
  const multiplier = 1 + (hazard.reviewFailCount - 1) * 0.5;
  return Math.floor(baseFine * multiplier);
}

function printReport(report) {
  console.log(chalk.bold.cyan('════════════════════════════════════════════════════════════════'));
  console.log(chalk.bold.cyan('                    施工隐患闭环管理报告'));
  console.log(chalk.bold.cyan('════════════════════════════════════════════════════════════════'));
  console.log(chalk.gray(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`));
  console.log();

  printSummary(report.summary);
  console.log();

  if (report.openHazardDetails.length > 0) {
    printOpenHazards(report.openHazardDetails);
    console.log();
  }

  if (report.fineRecommendations.length > 0) {
    printFineRecommendations(report.fineRecommendations);
    console.log();
  }

  if (report.teamSummary.length > 0) {
    printTeamSummary(report.teamSummary);
  }

  console.log(chalk.cyan('════════════════════════════════════════════════════════════════'));
}

function printSummary(summary) {
  console.log(chalk.bold.yellow('📊 统计概览'));
  
  const levelTable = new Table({
    head: [
      chalk.white('等级'),
      chalk.white('数量'),
      chalk.white('占比')
    ]
  });

  levelTable.push(
    [chalk.green('轻微'), summary.byLevel.minor, calcPercent(summary.byLevel.minor, summary.total)],
    [chalk.yellow('一般'), summary.byLevel.general, calcPercent(summary.byLevel.general, summary.total)],
    [chalk.red('重大'), summary.byLevel.major, calcPercent(summary.byLevel.major, summary.total)],
    [chalk.red.bold('特大'), summary.byLevel.critical, calcPercent(summary.byLevel.critical, summary.total)]
  );

  console.log(chalk.cyan('\n按隐患等级分布：'));
  console.log(levelTable.toString());

  const statusTable = new Table({
    head: [
      chalk.white('状态'),
      chalk.white('数量')
    ]
  });

  statusTable.push(
    [chalk.green('已闭环'), summary.closed],
    [chalk.yellow('已发现待整改'), summary.byStatus.discovered],
    [chalk.blue('整改中'), summary.byStatus.rectifying],
    [chalk.magenta('待复查'), summary.byStatus.pending],
    [chalk.red('需重新整改'), summary.byStatus.reopened]
  );

  console.log(chalk.cyan('\n按处理状态分布：'));
  console.log(statusTable.toString());

  console.log(`\n${chalk.cyan('闭环率:')} ${summary.closeRate}%`);
  if (summary.overdue > 0) {
    console.log(chalk.red.bold(`⚠️  逾期未整改: ${summary.overdue} 条`));
  }
}

function calcPercent(value, total) {
  if (total === 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
}

function printOpenHazards(hazards) {
  console.log(chalk.bold.yellow('⚠️  未闭环隐患明细'));

  const table = new Table({
    head: [
      chalk.white('ID'),
      chalk.white('类型'),
      chalk.white('等级'),
      chalk.white('位置'),
      chalk.white('责任班组'),
      chalk.white('未闭环原因'),
      chalk.white('证据索引')
    ],
    colWidths: [10, 10, 8, 18, 12, 25, 15]
  });

  for (const h of hazards) {
    const reasons = h.reasons.length > 0 
      ? h.reasons.join('; ') 
      : '待处理';
    
    const imageCount = h.discoveryImages.length + h.rectificationImages.length;

    table.push([
      h.id,
      h.type,
      colorizeLevel(h.level),
      h.location,
      h.team,
      reasons.length > 22 ? reasons.substring(0, 22) + '...' : reasons,
      `${imageCount} 张`
    ]);
  }

  console.log(table.toString());
}

function printFineRecommendations(recommendations) {
  console.log(chalk.bold.red('💰 罚款建议'));

  const table = new Table({
    head: [
      chalk.white('隐患ID'),
      chalk.white('类型'),
      chalk.white('等级'),
      chalk.white('责任班组'),
      chalk.white('复查失败'),
      chalk.white('建议罚款')
    ]
  });

  for (const r of recommendations) {
    table.push([
      r.hazardId,
      r.type,
      colorizeLevel(r.level),
      r.team,
      `${r.reviewFailCount} 次`,
      chalk.red.bold(`¥${r.recommendedAmount.toLocaleString()}`)
    ]);
  }

  console.log(table.toString());

  const total = recommendations.reduce((sum, r) => sum + r.recommendedAmount, 0);
  console.log(chalk.red.bold(`\n建议罚款总计: ¥${total.toLocaleString()}`));
}

function printTeamSummary(teams) {
  console.log(chalk.bold.yellow('👥 责任班组汇总'));

  const table = new Table({
    head: [
      chalk.white('班组'),
      chalk.white('负责人'),
      chalk.white('总隐患'),
      chalk.white('已闭环'),
      chalk.white('未闭环'),
      chalk.white('逾期'),
      chalk.white('已罚款'),
      chalk.white('未缴'),
      chalk.white('建议罚款')
    ]
  });

  for (const t of teams) {
    table.push([
      t.teamName,
      t.leader,
      t.total,
      t.closed,
      t.open,
      t.overdue > 0 ? chalk.red(t.overdue) : t.overdue,
      `¥${t.totalFines.toLocaleString()}`,
      t.unpaidFines > 0 ? chalk.red(`¥${t.unpaidFines.toLocaleString()}`) : '¥0',
      t.recommendedFines > 0 ? chalk.red(`¥${t.recommendedFines.toLocaleString()}`) : '¥0'
    ]);
  }

  console.log(table.toString());
}

function saveReport(report, filePath) {
  try {
    const json = JSON.stringify(report, null, 2);
    const fs = require('fs');
    const path = require('path');
    const fullPath = path.resolve(filePath);
    
    fs.writeFileSync(fullPath, json);
    console.log(chalk.green(`\n✅ 报告已保存到: ${fullPath}`));
  } catch (error) {
    console.log(chalk.red(`\n❌ 保存失败: ${error.message}`));
  }
}

module.exports = command;
