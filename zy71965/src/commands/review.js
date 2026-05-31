const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Storage } = require('../utils/Storage');
const { ReviewHistory, REVIEW_ACTION } = require('../models/ReviewHistory');
const { DEFECT_STATUS } = require('../models/Defect');

const reviewCommand = new Command('review')
  .description('缺陷复核: 列表、筛选、详情查看、状态标记')
  .option('-s, --status <status>', '按状态筛选: pending|confirmed|rejected|needs_review|duplicate')
  .option('-t, --type <type>', '按缺陷类型筛选')
  .option('-S, --severity <severity>', '按严重度筛选: critical|high|medium|low')
  .option('--source <source>', '按来源筛选: training_log|annotation|evaluation')
  .option('-i, --id <id>', '直接查看指定缺陷ID')
  .option('-a, --all', '显示全部(包含已处理)')
  .action(async (options) => {
    const storage = new Storage();
    
    if (options.id) {
      await showDefectDetail(storage, options.id);
      return;
    }
    
    await reviewWorkflow(storage, options);
  });

async function reviewWorkflow(storage, options) {
  let defects = storage.getDefects();
  
  if (options.status) {
    defects = defects.filter(d => d.status === options.status);
  } else if (!options.all) {
    defects = defects.filter(d => d.status === 'pending' || d.status === 'needs_review');
  }
  if (options.type) {
    defects = defects.filter(d => d.defectType === options.type);
  }
  if (options.severity) {
    defects = defects.filter(d => d.severity === options.severity);
  }
  if (options.source) {
    defects = defects.filter(d => d.source === options.source);
  }

  if (defects.length === 0) {
    console.log(chalk.yellow('没有找到符合条件的缺陷记录'));
    return;
  }

  let currentIndex = 0;
  let continueReview = true;

  while (continueReview && currentIndex < defects.length) {
    const defect = defects[currentIndex];
    
    console.clear();
    console.log(chalk.blue.bold(`\n缺陷复核 (${currentIndex + 1}/${defects.length})\n`));
    
    displayDefectSummary(defect);
    
    const choices = [
      { name: '✅ 确认 (confirmed)', value: 'confirmed' },
      { name: '❌ 驳回 (rejected)', value: 'rejected' },
      { name: '⏳ 需再看 (needs_review)', value: 'needs_review' },
      { name: '📝 查看详情', value: 'detail' },
      { name: '📜 查看历史', value: 'history' },
      { name: '💬 添加备注', value: 'note' },
      new inquirer.Separator(),
      { name: '⬅️  上一个', value: 'prev' },
      { name: '➡️  下一个', value: 'next' },
      { name: '🚪 退出', value: 'quit' }
    ];

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '选择操作:',
      choices,
      loop: false
    }]);

    switch (action) {
      case 'confirmed':
      case 'rejected':
      case 'needs_review':
        await updateDefectStatus(storage, defect, action);
        currentIndex++;
        break;
      case 'detail':
        await showDefectDetail(storage, defect.id);
        break;
      case 'history':
        await showDefectHistory(storage, defect.id);
        break;
      case 'note':
        await addDefectNote(storage, defect);
        break;
      case 'prev':
        if (currentIndex > 0) currentIndex--;
        break;
      case 'next':
        currentIndex++;
        break;
      case 'quit':
        continueReview = false;
        break;
    }
  }

  if (currentIndex >= defects.length) {
    console.log(chalk.green('\n🎉 全部复核完成!'));
  }
}

function displayDefectSummary(defect) {
  const statusColors = {
    pending: chalk.yellow,
    confirmed: chalk.green,
    rejected: chalk.red,
    needs_review: chalk.magenta,
    duplicate: chalk.gray,
    fixed: chalk.blue
  };
  
  const severityColors = {
    critical: chalk.red.bold,
    high: chalk.red,
    medium: chalk.yellow,
    low: chalk.gray,
    unknown: chalk.white
  };

  const table = new Table({
    colWidths: [15, 65],
    style: { head: [], border: [] }
  });

  table.push(
    ['缺陷ID', defect.id.substring(0, 12) + '...'],
    ['图片', defect.imagePath || defect.imageId || '未知'],
    ['类型', defect.defectType],
    ['状态', (statusColors[defect.status] || chalk.white)(defect.status)],
    ['严重度', (severityColors[defect.severity] || chalk.white)(defect.severity)],
    ['置信度', defect.confidence !== null ? defect.confidence.toFixed(3) : 'N/A'],
    ['来源', defect.source],
    ['坐标', defect.coordinates?.length ? `[${defect.coordinates.join(', ')}]` : '无'],
    ['复核次数', defect.reviewCount]
  );

  if (defect.iou !== null) {
    table.push(['IoU', defect.iou.toFixed(3)]);
  }

  console.log(table.toString());
  console.log('');
}

async function showDefectDetail(storage, defectId) {
  const defect = storage.getDefectById(defectId);
  if (!defect) {
    console.log(chalk.red(`缺陷不存在: ${defectId}`));
    return;
  }

  console.clear();
  console.log(chalk.blue.bold('\n缺陷详情\n'));

  console.log(chalk.bold('基本信息'));
  displayDefectSummary(defect);

  if (defect.prediction || defect.groundTruth) {
    console.log(chalk.bold('预测 vs 真值'));
    const compareTable = new Table({
      head: ['项目', '内容'],
      style: { head: ['cyan'] }
    });
    if (defect.prediction) {
      compareTable.push(['预测', JSON.stringify(defect.prediction, null, 0)]);
    }
    if (defect.groundTruth) {
      compareTable.push(['真值', JSON.stringify(defect.groundTruth, null, 0)]);
    }
    console.log(compareTable.toString());
  }

  if (defect.notes && defect.notes.length > 0) {
    console.log(chalk.bold('\n备注'));
    defect.notes.forEach((note, i) => {
      console.log(chalk.gray(`  ${i + 1}. [${note.createdAt}] ${note.author || '匿名'}: ${note.content}`));
    });
  }

  console.log('');
  await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
}

async function showDefectHistory(storage, defectId) {
  const reviews = storage.getReviewsByDefectId(defectId).sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
  );

  console.clear();
  console.log(chalk.blue.bold('\n复核历史\n'));

  if (reviews.length === 0) {
    console.log(chalk.gray('暂无复核记录'));
  } else {
    const table = new Table({
      head: ['时间', '操作', '变更', '备注'],
      colWidths: [25, 15, 25, 30]
    });

    reviews.forEach(r => {
      const change = r.oldValue !== null && r.newValue !== null 
        ? `${r.oldValue} → ${r.newValue}`
        : r.newValue || '-';
      table.push([
        new Date(r.timestamp).toLocaleString(),
        r.action,
        change,
        (r.comment || '').substring(0, 25)
      ]);
    });

    console.log(table.toString());
  }

  console.log('');
  await inquirer.prompt([{ type: 'input', name: 'continue', message: '按回车继续...' }]);
}

async function updateDefectStatus(storage, defect, newStatus) {
  const { note, reviewer } = await inquirer.prompt([
    { type: 'input', name: 'reviewer', message: '复核人 (可选):', default: process.env.USER || '' },
    { type: 'input', name: 'note', message: '备注说明 (可选):' }
  ]);

  const oldStatus = defect.status;
  const change = defect.updateStatus(newStatus, reviewer || null, note);
  storage.saveDefect(defect);

  const review = ReviewHistory.createStatusChange(defect.id, oldStatus, newStatus, reviewer || null, note);
  storage.saveReview(review);

  console.log(chalk.green(`\n✓ 状态已更新: ${oldStatus} → ${newStatus}`));
}

async function addDefectNote(storage, defect) {
  const { content, author } = await inquirer.prompt([
    { type: 'input', name: 'author', message: '作者 (可选):', default: process.env.USER || '' },
    { type: 'input', name: 'content', message: '备注内容:', validate: v => v.trim() ? true : '请输入内容' }
  ]);

  defect.addNote(content, author || null);
  storage.saveDefect(defect);

  const review = ReviewHistory.createNote(defect.id, content, author || null);
  storage.saveReview(review);

  console.log(chalk.green('\n✓ 备注已添加'));
}

module.exports = { reviewCommand };
