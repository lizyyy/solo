const { Command } = require('commander');
const { isInitialized } = require('../utils/storage');
const { 
  getHazardById, 
  getRectificationsByHazard, 
  getReviewsByHazard, 
  getFinesByHazard,
  getTeamById,
  formatDate,
  formatDateTime,
  colorizeStatus,
  colorizeLevel,
  colorizeReviewResult
} = require('../utils/helpers');
const { HAZARD_STATUS, HAZARD_LEVEL, STATUS_LABELS, LEVEL_LABELS } = require('../utils/constants');
const chalk = require('chalk');
const Table = require('cli-table3');

const command = new Command('detail')
  .description('查看隐患详情（含证据索引、历史记录）')
  .argument('<hazardId>', '隐患ID')
  .action((hazardId) => {
    if (!isInitialized()) {
      console.log(chalk.red('❌ 数据目录未初始化，请先执行: hazard init'));
      return;
    }

    const hazard = getHazardById(hazardId);
    
    if (!hazard) {
      console.log(chalk.red(`❌ 隐患不存在: ${hazardId}`));
      return;
    }

    const rectifications = getRectificationsByHazard(hazardId);
    const reviews = getReviewsByHazard(hazardId);
    const fines = getFinesByHazard(hazardId);
    const team = getTeamById(hazard.responsibleTeamId);

    showHazardDetail(hazard, team, rectifications, reviews, fines);
  });

function showHazardDetail(hazard, team, rectifications, reviews, fines) {
  console.log(chalk.bold.cyan(`📋 隐患详情 - ${hazard.id}`));
  console.log(chalk.gray('━'.repeat(80)));

  const infoTable = new Table({
    colWidths: [20, 56]
  });

  const isOverdue = hazard.status !== HAZARD_STATUS.CLOSED && 
    hazard.rectifyDeadline && 
    new Date(hazard.rectifyDeadline) < new Date();

  const deadline = isOverdue 
    ? chalk.red.bold(formatDate(hazard.rectifyDeadline) + ' ⚠️（已逾期）')
    : formatDate(hazard.rectifyDeadline);

  infoTable.push(
    [chalk.cyan('隐患类型'), hazard.type],
    [chalk.cyan('隐患等级'), colorizeLevel(hazard.level)],
    [chalk.cyan('当前状态'), colorizeStatus(hazard.status)],
    [chalk.cyan('发现位置'), hazard.location],
    [chalk.cyan('隐患描述'), hazard.description],
    [chalk.cyan('发现人'), hazard.discoverer],
    [chalk.cyan('发现日期'), formatDate(hazard.discoveryDate)],
    [chalk.cyan('责任班组'), team ? `${team.name} (${team.leader})` : hazard.responsibleTeamId],
    [chalk.cyan('整改截止日期'), deadline],
    [chalk.cyan('整改次数'), hazard.rectificationCount.toString()],
    [chalk.cyan('复查失败次数'), hazard.reviewFailCount.toString()]
  );

  console.log(infoTable.toString());
  console.log();

  if (hazard.discoveryImages && hazard.discoveryImages.length > 0) {
    showEvidenceIndex('发现时照片证据', hazard.discoveryImages);
    console.log();
  }

  if (rectifications.length > 0) {
    showRectifications(rectifications);
    console.log();
  }

  if (reviews.length > 0) {
    showReviews(reviews);
    console.log();
  }

  if (fines.length > 0) {
    showFines(fines);
    console.log();
  }

  if (hazard.status !== HAZARD_STATUS.CLOSED) {
    showClosureStatus(hazard, rectifications, reviews);
  }
}

function showEvidenceIndex(title, images) {
  console.log(chalk.bold.green(`📷 ${title}`));
  console.log(chalk.gray('─'.repeat(80)));
  
  images.forEach((img, index) => {
    console.log(chalk.gray(`  [${index + 1}] ${img}`));
  });
}

function showRectifications(rectifications) {
  console.log(chalk.bold.blue('🔧 整改记录'));
  console.log(chalk.gray('─'.repeat(80)));

  rectifications.forEach((rect, index) => {
    console.log(chalk.cyan(`\n  第 ${index + 1} 次整改`));
    console.log(chalk.gray(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(`    整改人: ${rect.rectifier}`);
    console.log(`    整改时间: ${formatDateTime(rect.rectificationDate)}`);
    console.log(`    整改描述: ${rect.description}`);
    console.log(`    整改照片: `);
    rect.images.forEach((img, i) => {
      console.log(chalk.gray(`      [${i + 1}] ${img}`));
    });
  });
}

function showReviews(reviews) {
  console.log(chalk.bold.magenta('🔍 复查记录'));
  console.log(chalk.gray('─'.repeat(80)));

  reviews.forEach((review, index) => {
    console.log(chalk.cyan(`\n  第 ${index + 1} 次复查`));
    console.log(chalk.gray(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(`    复查人: ${review.reviewer}`);
    console.log(`    复查时间: ${formatDateTime(review.reviewDate)}`);
    console.log(`    复查结果: ${colorizeReviewResult(review.result)}`);
    console.log(`    复查意见: ${review.comment || '无'}`);
    if (review.images && review.images.length > 0) {
      console.log(`    复查照片: `);
      review.images.forEach((img, i) => {
        console.log(chalk.gray(`      [${i + 1}] ${img}`));
      });
    }
  });
}

function showFines(fines) {
  console.log(chalk.bold.red('💰 罚款记录'));
  console.log(chalk.gray('─'.repeat(80)));

  fines.forEach((fine, index) => {
    const paidStatus = fine.paid 
      ? chalk.green('已缴纳') 
      : chalk.red('未缴纳');

    console.log(chalk.cyan(`\n  罚款记录 ${index + 1}`));
    console.log(chalk.gray(`  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`));
    console.log(`    罚款ID: ${fine.id}`);
    console.log(`    罚款金额: ¥${fine.amount.toLocaleString()}`);
    console.log(`    罚款原因: ${fine.reason}`);
    console.log(`    操作人: ${fine.operator}`);
    console.log(`    缴纳状态: ${paidStatus}`);
    console.log(`    罚款时间: ${formatDateTime(fine.createdAt)}`);
    if (fine.paidAt) {
      console.log(`    缴纳时间: ${formatDateTime(fine.paidAt)}`);
    }
  });
}

function showClosureStatus(hazard, rectifications, reviews) {
  console.log(chalk.bold.yellow('⚠️  闭环检查'));
  console.log(chalk.gray('─'.repeat(80)));

  const issues = [];

  if (rectifications.length === 0) {
    issues.push(chalk.red('❌ 无整改记录'));
  }

  if (reviews.length === 0) {
    issues.push(chalk.red('❌ 无复查记录'));
  } else {
    const lastReview = reviews[reviews.length - 1];
    if (lastReview.result === 'failed') {
      issues.push(chalk.red(`❌ 最后一次复查不通过: ${lastReview.comment}`));
    }
  }

  if (hazard.reviewFailCount > 0) {
    issues.push(chalk.yellow(`⚠️  累计复查失败 ${hazard.reviewFailCount} 次，建议罚款`));
  }

  if (issues.length === 0) {
    if (hazard.level === HAZARD_LEVEL.MAJOR || hazard.level === HAZARD_LEVEL.CRITICAL) {
      console.log(chalk.yellow('  ⚠️  重大/特大隐患需要多步验证才能闭环'));
    } else {
      console.log(chalk.green('  ✅ 所有条件已满足，可执行闭环'));
    }
  } else {
    console.log(`  未闭环原因：`);
    issues.forEach(issue => console.log(`    ${issue}`));
  }
}

module.exports = command;
