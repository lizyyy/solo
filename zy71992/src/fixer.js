const readline = require('readline');
const {
  getChangeOrder,
  saveChangeOrder,
  ITEM_STATUS,
  updateItemStatus
} = require('./models');

function askQuestion(rl, question, defaultValue = '') {
  return new Promise((resolve) => {
    rl.question(`${question} ${defaultValue ? `[${defaultValue}]` : ''}: `, (answer) => {
      resolve(answer.trim() || defaultValue);
    });
  });
}

async function fixItem(item, rl) {
  console.log(`\n--- 修正条目 #${item.seq} ---`);
  console.log(`  ID: ${item.id}`);
  console.log(`  当前状态: ${item.status}`);
  const lastHistory = item.history[item.history.length - 1];
  console.log(`  问题: ${lastHistory.detail || lastHistory.error || '未知'}`);
  console.log(`  当前: ${item.originalName} → ${item.newName}`);
  if (item.note) console.log(`  备注: ${item.note}`);

  console.log(`\n  操作选项:`);
  console.log(`    1) 修改原始文件名`);
  console.log(`    2) 修改目标文件名`);
  console.log(`    3) 添加/修改备注`);
  console.log(`    4) 重置为待复核状态`);
  console.log(`    5) 标记为跳过`);
  console.log(`    6) 跳过此条目`);

  const choice = await askQuestion(rl, `  请选择操作`, '6');

  switch (choice) {
    case '1':
      const newOriginal = await askQuestion(rl, `  输入新的原始文件名`, item.originalName);
      item.originalName = newOriginal;
      updateItemStatus(getChangeOrder(), item.id, ITEM_STATUS.PENDING, `修正原始文件名: ${item.originalName} → ${newOriginal}`);
      item.status = ITEM_STATUS.PENDING;
      console.log(`  ✅ 已更新原始文件名`);
      break;

    case '2':
      const newTarget = await askQuestion(rl, `  输入新的目标文件名`, item.newName);
      item.newName = newTarget;
      updateItemStatus(getChangeOrder(), item.id, ITEM_STATUS.PENDING, `修正目标文件名: ${item.newName} → ${newTarget}`);
      item.status = ITEM_STATUS.PENDING;
      console.log(`  ✅ 已更新目标文件名`);
      break;

    case '3':
      const note = await askQuestion(rl, `  输入备注`, item.note);
      item.note = note;
      updateItemStatus(getChangeOrder(), item.id, item.status, `更新备注: ${note}`);
      console.log(`  ✅ 已更新备注`);
      break;

    case '4':
      item.status = ITEM_STATUS.PENDING;
      updateItemStatus(getChangeOrder(), item.id, ITEM_STATUS.PENDING, '手动重置为待复核状态');
      console.log(`  ✅ 已重置状态`);
      break;

    case '5':
      item.status = ITEM_STATUS.SKIPPED;
      updateItemStatus(getChangeOrder(), item.id, ITEM_STATUS.SKIPPED, '手动标记跳过');
      console.log(`  ✅ 已标记为跳过`);
      break;

    case '6':
      console.log(`  已跳过此条目`);
      return item;

    default:
      console.log(`  无效选项，已跳过`);
  }

  return item;
}

async function fix(itemId) {
  const changeOrder = getChangeOrder();
  if (!changeOrder) {
    throw new Error('没有可修正的变更单，请先使用 bir import 导入');
  }

  let itemsToFix = [];

  if (itemId) {
    const item = changeOrder.items.find(i => i.id === itemId || i.seq === parseInt(itemId));
    if (!item) {
      throw new Error(`找不到条目: ${itemId}`);
    }
    itemsToFix = [item];
  } else {
    itemsToFix = changeOrder.items.filter(i =>
      i.status === ITEM_STATUS.NEEDS_FIX ||
      i.status === ITEM_STATUS.FAILED
    );

    if (itemsToFix.length === 0) {
      console.log('✅ 没有需要修正的条目');
      return;
    }

    console.log(`找到 ${itemsToFix.length} 条需要修正的记录:\n`);
    itemsToFix.forEach(item => {
      const lastHistory = item.history[item.history.length - 1];
      console.log(`  #${item.seq} [${item.status}] ${item.originalName} → ${item.newName}`);
      console.log(`    问题: ${lastHistory.detail || lastHistory.error || '未知'}`);
    });
  }

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    for (let i = 0; i < itemsToFix.length; i++) {
      console.log(`\n=== ${i + 1}/${itemsToFix.length} ===`);
      const item = itemsToFix[i];
      const idx = changeOrder.items.findIndex(ii => ii.id === item.id);
      if (idx !== -1) {
        changeOrder.items[idx] = await fixItem(item, rl);
      }
    }

    const stillNeedsFix = changeOrder.items.filter(i =>
      i.status === ITEM_STATUS.NEEDS_FIX ||
      i.status === ITEM_STATUS.FAILED
    ).length;

    changeOrder.status = stillNeedsFix > 0 ? 'needs_fix' : 'reviewed';
    saveChangeOrder(changeOrder);

    console.log(`\n✅ 修正完成`);
    console.log(`  仍需修正: ${stillNeedsFix} 条`);
    console.log(`  建议运行 bir review 重新复核`);
  } finally {
    rl.close();
  }
}

module.exports = {
  fix
};
