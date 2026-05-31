const { Command } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const Table = require('cli-table3');
const { Storage } = require('../utils/Storage');
const { ReviewHistory } = require('../models/ReviewHistory');

const fixCommand = new Command('fix')
  .description('修正工具: 去重、合并、边界处理、异常修复')
  .option('--check', '仅检查不修改')
  .option('--auto', '自动修复可修复问题')
  .action(async (options) => {
    const storage = new Storage();
    
    console.log(chalk.blue.bold('\n数据一致性检查与修正\n'));
    
    const issues = await analyzeIssues(storage);
    
    displayIssues(issues);
    
    if (options.check) {
      console.log(chalk.gray('\n仅检查模式，未执行修改'));
      return;
    }

    if (issues.total === 0) {
      console.log(chalk.green('\n✓ 没有发现问题'));
      return;
    }

    if (options.auto) {
      await autoFix(storage, issues);
    } else {
      await interactiveFix(storage, issues);
    }
  });

async function analyzeIssues(storage) {
  const defects = storage.getDefects();
  const annotations = storage.getAnnotations();
  const reviews = storage.getReviewHistory();
  
  const issues = {
    duplicates: [],
    missingImageRef: [],
    missingCoordinates: [],
    invalidIoU: [],
    statusMismatch: [],
    missingAnnotationRef: [],
    noGroundTruth: [],
    lowConfidence: [],
    total: 0
  };

  const imageTypeMap = {};
  defects.forEach(d => {
    const key = `${d.imageId || d.imagePath || 'unknown'}_${d.defectType}`;
    if (!imageTypeMap[key]) {
      imageTypeMap[key] = [];
    }
    imageTypeMap[key].push(d);
  });

  Object.entries(imageTypeMap).forEach(([key, list]) => {
    if (list.length > 1) {
      const iouPairs = [];
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const iou = calculateIoU(list[i].coordinates, list[j].coordinates);
          if (iou > 0.7) {
            iouPairs.push({ a: list[i], b: list[j], iou });
          }
        }
      }
      if (iouPairs.length > 0) {
        issues.duplicates.push({ key, items: list, pairs: iouPairs });
      }
    }
  });

  defects.forEach(d => {
    if (!d.imageId && !d.imagePath) {
      issues.missingImageRef.push(d);
    }
    if (!d.coordinates || d.coordinates.length === 0) {
      issues.missingCoordinates.push(d);
    }
    if (d.iou !== null && (d.iou < 0 || d.iou > 1)) {
      issues.invalidIoU.push(d);
    }
    if (d.reviewCount > 0) {
      const defectReviews = reviews.filter(r => r.defectId === d.id);
      if (defectReviews.length !== d.reviewCount) {
        issues.statusMismatch.push({ defect: d, expected: d.reviewCount, actual: defectReviews.length });
      }
    }
    if (d.sourceAnnotationId) {
      const ann = annotations.find(a => a.id === d.sourceAnnotationId);
      if (!ann) {
        issues.missingAnnotationRef.push(d);
      }
    }
    if (!d.groundTruth && d.source === 'evaluation') {
      issues.noGroundTruth.push(d);
    }
    if (d.confidence !== null && d.confidence < 0.3) {
      issues.lowConfidence.push(d);
    }
  });

  issues.total = 
    issues.duplicates.length +
    issues.missingImageRef.length +
    issues.missingCoordinates.length +
    issues.invalidIoU.length +
    issues.statusMismatch.length +
    issues.missingAnnotationRef.length +
    issues.noGroundTruth.length +
    issues.lowConfidence.length;

  return issues;
}

function calculateIoU(box1, box2) {
  if (!box1 || !box2 || box1.length < 4 || box2.length < 4) return 0;
  
  const [x1, y1, w1, h1] = box1;
  const [x2, y2, w2, h2] = box2;
  
  const xi1 = Math.max(x1, x2);
  const yi1 = Math.max(y1, y2);
  const xi2 = Math.min(x1 + w1, x2 + w2);
  const yi2 = Math.min(y1 + h1, y2 + h2);
  
  const interArea = Math.max(0, xi2 - xi1) * Math.max(0, yi2 - yi1);
  const box1Area = w1 * h1;
  const box2Area = w2 * h2;
  
  return interArea / (box1Area + box2Area - interArea);
}

function displayIssues(issues) {
  const table = new Table({
    head: ['问题类型', '数量', '说明'],
    style: { head: ['cyan'] }
  });

  table.push(['潜在重复', issues.duplicates.length, '同图同类缺陷高IoU重叠']);
  table.push(['缺少图片引用', issues.missingImageRef.length, '无imageId或imagePath']);
  table.push(['缺少坐标', issues.missingCoordinates.length, '无bbox信息']);
  table.push(['无效IoU', issues.invalidIoU.length, 'IoU值超出0-1范围']);
  table.push(['复核计数不匹配', issues.statusMismatch.length, '记录数与实际不一致']);
  table.push(['标注引用不存在', issues.missingAnnotationRef.length, '关联标注ID无效']);
  table.push(['缺少真值', issues.noGroundTruth.length, '评估结果无真值对照']);
  table.push(['低置信度', issues.lowConfidence.length, '置信度<0.3需确认']);

  console.log(table.toString());
  console.log(chalk.yellow(`\n总计: ${issues.total} 个问题`));
}

async function autoFix(storage, issues) {
  const fixed = { count: 0 };

  issues.invalidIoU.forEach(d => {
    d.iou = null;
    storage.saveDefect(d);
    fixed.count++;
  });

  issues.statusMismatch.forEach(({ defect, actual }) => {
    defect.reviewCount = actual;
    storage.saveDefect(defect);
    fixed.count++;
  });

  console.log(chalk.green(`\n✓ 自动修复完成: ${fixed.count} 项`));
}

async function interactiveFix(storage, issues) {
  console.log('');
  
  if (issues.duplicates.length > 0) {
    const { handleDup } = await inquirer.prompt([{
      type: 'confirm',
      name: 'handleDup',
      message: `发现 ${issues.duplicates.length} 组潜在重复，是否处理？`,
      default: true
    }]);

    if (handleDup) {
      await handleDuplicates(storage, issues.duplicates);
    }
  }

  if (issues.missingImageRef.length > 0) {
    const { handleMissing } = await inquirer.prompt([{
      type: 'confirm',
      name: 'handleMissing',
      message: `发现 ${issues.missingImageRef.length} 条缺少图片引用，是否标记为需复核？`,
      default: true
    }]);

    if (handleMissing) {
      issues.missingImageRef.forEach(d => {
        d.status = 'needs_review';
        d.addNote('缺少图片标识，需要人工确认', 'system');
        storage.saveDefect(d);
        
        const review = ReviewHistory.createCorrection(
          d.id, 'status', d.status, 'needs_review', 'system', '缺少图片引用'
        );
        storage.saveReview(review);
      });
      console.log(chalk.green(`✓ 已标记 ${issues.missingImageRef.length} 条为需复核`));
    }
  }

  if (issues.lowConfidence.length > 0) {
    const { handleLow } = await inquirer.prompt([{
      type: 'confirm',
      name: 'handleLow',
      message: `发现 ${issues.lowConfidence.length} 条低置信度(<0.3)，是否批量处理？`,
      default: false
    }]);

    if (handleLow) {
      const { action } = await inquirer.prompt([{
        type: 'list',
        name: 'action',
        message: '选择操作:',
        choices: [
          { name: '标记为需复核', value: 'review' },
          { name: '批量驳回', value: 'reject' },
          { name: '跳过', value: 'skip' }
        ]
      }]);

      if (action !== 'skip') {
        issues.lowConfidence.forEach(d => {
          const oldStatus = d.status;
          d.status = action === 'review' ? 'needs_review' : 'rejected';
          d.reviewCount++;
          storage.saveDefect(d);
          
          const review = ReviewHistory.createStatusChange(
            d.id, oldStatus, d.status, 'system', `低置信度(${d.confidence})批量处理`
          );
          storage.saveReview(review);
        });
        console.log(chalk.green(`✓ 已处理 ${issues.lowConfidence.length} 条`));
      }
    }
  }
}

async function handleDuplicates(storage, duplicates) {
  for (const dup of duplicates) {
    console.log(chalk.yellow(`\n处理: ${dup.key}`));
    
    const table = new Table({
      head: ['#', 'ID', '置信度', '来源', '状态'],
      style: { head: ['cyan'] }
    });
    dup.items.forEach((d, i) => {
      table.push([i + 1, d.id.substring(0, 8), d.confidence?.toFixed(3) || 'N/A', d.source, d.status]);
    });
    console.log(table.toString());

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: '选择操作:',
      choices: [
        { name: '保留第一个，其余标记重复', value: 'keep_first' },
        { name: '保留置信度最高的，其余标记重复', value: 'keep_best' },
        { name: '人工选择保留', value: 'manual' },
        { name: '跳过此组', value: 'skip' }
      ]
    }]);

    if (action === 'skip') continue;

    let keepIndex = 0;
    if (action === 'keep_best') {
      let bestScore = -1;
      dup.items.forEach((d, i) => {
        const score = (d.confidence || 0) + (d.status === 'confirmed' ? 1 : 0);
        if (score > bestScore) {
          bestScore = score;
          keepIndex = i;
        }
      });
    } else if (action === 'manual') {
      const { selected } = await inquirer.prompt([{
        type: 'number',
        name: 'selected',
        message: '输入要保留的序号:',
        validate: v => v >= 1 && v <= dup.items.length ? true : '无效序号'
      }]);
      keepIndex = selected - 1;
    }

    const kept = dup.items[keepIndex];
    
    for (let i = 0; i < dup.items.length; i++) {
      if (i !== keepIndex) {
        const d = dup.items[i];
        const oldStatus = d.status;
        d.markAsDuplicate(kept.id);
        storage.saveDefect(d);
        
        const review = ReviewHistory.createDuplicateMark(
          d.id, kept.id, 'system', `与 ${kept.id.substring(0, 8)} 重复`
        );
        storage.saveReview(review);
      }
    }

    console.log(chalk.green(`  ✓ 保留 ${kept.id.substring(0, 8)}，其余 ${dup.items.length - 1} 条标记为重复`));
  }
}

module.exports = { fixCommand };
