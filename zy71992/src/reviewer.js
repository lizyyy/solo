const fs = require('fs');
const path = require('path');
const {
  getChangeOrder,
  saveChangeOrder,
  ITEM_STATUS,
  updateItemStatus
} = require('./models');

function explainError(type, details) {
  const explanations = {
    'file_not_found': `
      ❌ 文件不存在
      原因: 原始图片文件在指定路径下找不到
      可能原因:
        1. 文件路径错误
        2. 文件已被删除或移动
        3. 文件名大小写不匹配
      处理: 使用 bir fix 修正原始文件名或确认文件位置
    `,
    'target_exists': `
      ⚠️  目标文件名已存在
      原因: 要重命名到的新文件名已经被其他文件占用
      风险: 直接执行可能会覆盖已有文件
      处理:
        1. 使用 bir fix 修改新文件名
        2. 或手动确认可覆盖后，执行时会自动跳过或报错
    `,
    'duplicate_target': `
      ❌ 变更单内重复目标名
      原因: 多条记录要重命名到同一个新文件名
      风险: 后执行的会覆盖先执行的，造成文件丢失
      处理: 必须使用 bir fix 修正，确保每个新文件名唯一
    `,
    'duplicate_source': `
      ⚠️  变更单内重复原始名
      原因: 同一张原始图片被多次列出要重命名
      风险: 第一次重命名成功后，后续的会找不到文件
      处理: 删除重复条目，或使用 bir fix 调整
    `,
    'circular_rename': `
      ❌ 循环重命名检测
      原因: A→B, B→A 这种情况会造成冲突
      处理: 分两步执行，或使用中间名过渡
    `,
    'invalid_filename': `
      ❌ 文件名包含非法字符
      原因: 新文件名包含系统不允许的字符
      处理: 使用 bir fix 修正，移除非法字符 (/:*?"<>|)
    `,
    'same_name': `
      ⚠️  原始名与新名相同
      原因: 重命名前后文件名一样
      处理: 可忽略，执行时会自动跳过
    `,
    'already_processed': `
      ℹ️  该条目已在之前的运行中处理过
      状态: 可查看历史记录确认
      处理: 如需重新执行，使用 bir fix 重置状态
    `
  };

  let exp = explanations[type] || `
    ❌ 未知异常: ${type}
    详情: ${JSON.stringify(details)}
  `;

  return exp.split('\n').map(l => '  ' + l.trim()).join('\n');
}

function detectConflicts(changeOrder, imageDir) {
  const issues = [];
  const items = changeOrder.items;

  const targetMap = new Map();
  const sourceMap = new Map();

  items.forEach((item, idx) => {
    if (!targetMap.has(item.newName)) {
      targetMap.set(item.newName, []);
    }
    targetMap.get(item.newName).push(item);

    if (!sourceMap.has(item.originalName)) {
      sourceMap.set(item.originalName, []);
    }
    sourceMap.get(item.originalName).push(item);
  });

  for (const [targetName, targetItems] of targetMap.entries()) {
    if (targetItems.length > 1) {
      issues.push({
        type: 'duplicate_target',
        severity: 'error',
        items: targetItems,
        details: `目标名 "${targetName}" 被 ${targetItems.length} 条记录使用: ${targetItems.map(i => '#' + i.seq).join(', ')}`
      });
    }
  }

  for (const [sourceName, sourceItems] of sourceMap.entries()) {
    if (sourceItems.length > 1) {
      issues.push({
        type: 'duplicate_source',
        severity: 'warning',
        items: sourceItems,
        details: `原始名 "${sourceName}" 出现 ${sourceItems.length} 次: ${sourceItems.map(i => '#' + i.seq).join(', ')}`
      });
    }
  }

  const sourceToTarget = new Map();
  items.forEach(item => {
    sourceToTarget.set(item.originalName, item.newName);
  });

  items.forEach(item => {
    let current = item.newName;
    const visited = new Set([item.originalName]);
    while (sourceToTarget.has(current)) {
      if (visited.has(current)) {
        issues.push({
          type: 'circular_rename',
          severity: 'error',
          items: [item],
          details: `检测到循环重命名链: ${[...visited, current].join(' → ')}`
        });
        break;
      }
      visited.add(current);
      current = sourceToTarget.get(current);
    }
  });

  items.forEach(item => {
    const originalPath = path.join(imageDir, item.originalName);
    if (!fs.existsSync(originalPath)) {
      issues.push({
        type: 'file_not_found',
        severity: 'error',
        items: [item],
        details: `原始文件不存在: ${originalPath}`
      });
    }

    const targetPath = path.join(imageDir, item.newName);
    if (fs.existsSync(targetPath) && item.originalName !== item.newName) {
      issues.push({
        type: 'target_exists',
        severity: 'warning',
        items: [item],
        details: `目标文件已存在: ${targetPath}`
      });
    }

    if (item.originalName === item.newName) {
      issues.push({
        type: 'same_name',
        severity: 'info',
        items: [item],
        details: `原始名与新名相同`
      });
    }

    const invalidChars = /[\/:*?"<>|]/;
    if (invalidChars.test(item.newName)) {
      issues.push({
        type: 'invalid_filename',
        severity: 'error',
        items: [item],
        details: `新文件名包含非法字符`
      });
    }

    if (item.status === ITEM_STATUS.SUCCESS || item.status === ITEM_STATUS.FAILED) {
      issues.push({
        type: 'already_processed',
        severity: 'info',
        items: [item],
        details: `该条目已处理过，当前状态: ${item.status}`
      });
    }
  });

  return issues;
}

async function review() {
  const changeOrder = getChangeOrder();
  if (!changeOrder) {
    throw new Error('没有可复核的变更单，请先使用 bir import 导入');
  }

  const imageDir = process.cwd();

  console.log(`\n=== 变更单复核 ===`);
  console.log(`变更单: ${changeOrder.id}`);
  console.log(`批次: ${changeOrder.batchName}`);
  console.log(`条目数: ${changeOrder.items.length}`);
  console.log(`检查目录: ${imageDir}`);
  console.log(`\n正在检测异常...\n`);

  const issues = detectConflicts(changeOrder, imageDir);

  if (issues.length === 0) {
    console.log('✅ 未检测到异常，变更单可以执行');
    changeOrder.status = 'reviewed';
    changeOrder.items.forEach(item => {
      if (item.status === ITEM_STATUS.PENDING) {
        updateItemStatus(changeOrder, item.id, ITEM_STATUS.REVIEWED, '复核通过');
      }
    });
    saveChangeOrder(changeOrder);
    console.log(`\n下一步: 运行 bir run --operator=<姓名> 执行重命名`);
    return;
  }

  const errorCount = issues.filter(i => i.severity === 'error').length;
  const warningCount = issues.filter(i => i.severity === 'warning').length;
  const infoCount = issues.filter(i => i.severity === 'info').length;

  console.log(`检测结果: ${errorCount} 个错误, ${warningCount} 个警告, ${infoCount} 个提示\n`);

  const seenTypes = new Set();
  issues.forEach(issue => {
    const affectedItems = issue.items.map(i => `#${i.seq} ${i.originalName}→${i.newName}`).join(', ');
    console.log(`[${issue.severity.toUpperCase()}] ${issue.details}`);
    console.log(`  影响: ${affectedItems}`);

    if (!seenTypes.has(issue.type)) {
      console.log(explainError(issue.type, issue.details));
      seenTypes.add(issue.type);
    }

    issue.items.forEach(item => {
      if (issue.severity === 'error') {
        updateItemStatus(changeOrder, item.id, ITEM_STATUS.NEEDS_FIX, issue.details);
      }
    });

    console.log('');
  });

  changeOrder.status = errorCount > 0 ? 'needs_fix' : 'reviewed_with_warnings';
  saveChangeOrder(changeOrder);

  if (errorCount > 0) {
    console.log(`❌ 存在 ${errorCount} 个必须修正的错误`);
    console.log(`使用 bir fix [itemId] 修正指定条目，或 bir fix 批量修正`);
  } else {
    console.log(`⚠️  存在警告，确认可接受后可执行 bir run`);
    console.log(`如需要修正，使用 bir fix`);
  }
}

module.exports = {
  review,
  detectConflicts,
  explainError
};
