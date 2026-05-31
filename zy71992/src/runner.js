const fs = require('fs');
const path = require('path');
const {
  getChangeOrder,
  saveChangeOrder,
  createRunRecord,
  addRunToLedger,
  updateRunInLedger,
  getLedger,
  saveLedger,
  ITEM_STATUS,
  RUN_STATUS,
  updateItemStatus,
  savePending,
  clearPending,
  getPending
} = require('./models');

function checkIdempotency(changeOrder, item, imageDir) {
  const originalPath = path.join(imageDir, item.originalName);
  const newPath = path.join(imageDir, item.newName);

  if (!fs.existsSync(originalPath) && fs.existsSync(newPath)) {
    return {
      alreadyDone: true,
      detail: '检测到幂等状态: 原始文件不存在，目标文件已存在，认为已重命名成功'
    };
  }

  if (fs.existsSync(originalPath) && fs.existsSync(newPath) && item.originalName === item.newName) {
    return {
      alreadyDone: true,
      detail: '原始名与新名相同，无需操作'
    };
  }

  return { alreadyDone: false };
}

async function performRename(item, imageDir, isDryRun) {
  const originalPath = path.join(imageDir, item.originalName);
  const newPath = path.join(imageDir, item.newName);

  if (!fs.existsSync(originalPath)) {
    throw new Error(`原始文件不存在: ${originalPath}`);
  }

  if (fs.existsSync(newPath) && item.originalName !== item.newName) {
    throw new Error(`目标文件已存在，为避免覆盖已中止: ${newPath}`);
  }

  if (item.originalName === item.newName) {
    return { skipped: true, detail: '原始名与新名相同，跳过' };
  }

  if (isDryRun) {
    return { dryRun: true, detail: `[DRY RUN] ${item.originalName} → ${item.newName}` };
  }

  fs.renameSync(originalPath, newPath);

  return {
    success: true,
    from: item.originalName,
    to: item.newName,
    detail: `重命名成功: ${item.originalName} → ${item.newName}`
  };
}

async function run(options = {}) {
  const changeOrder = getChangeOrder();
  if (!changeOrder) {
    throw new Error('没有可执行的变更单，请先使用 bir import 导入');
  }

  const isDryRun = options['dry-run'] === true;
  const operator = options.operator || process.env.USER || 'unknown';
  const imageDir = process.cwd();

  if (changeOrder.status === 'imported') {
    console.log('⚠️  变更单尚未复核，建议先运行 bir review');
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    await new Promise((resolve) => {
      rl.question('  仍然继续执行？(yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() !== 'yes') {
          console.log('已取消');
          process.exit(0);
        }
        resolve();
      });
    });
  }

  const itemsToRun = changeOrder.items.filter(item =>
    item.status === ITEM_STATUS.PENDING ||
    item.status === ITEM_STATUS.REVIEWED ||
    item.status === ITEM_STATUS.FAILED ||
    item.status === ITEM_STATUS.NEEDS_FIX ||
    item.status === ITEM_STATUS.ROLLED_BACK
  );

  if (itemsToRun.length === 0) {
    console.log('✅ 没有需要执行的条目');
    return;
  }

  console.log(`\n=== 执行重命名 ===`);
  console.log(`变更单: ${changeOrder.id}`);
  console.log(`操作人: ${operator}`);
  console.log(`执行模式: ${isDryRun ? '试运行（不实际修改）' : '正式执行'}`);
  console.log(`待执行: ${itemsToRun.length} / ${changeOrder.items.length} 条`);
  console.log(`工作目录: ${imageDir}\n`);

  const pending = getPending();
  if (pending && pending.runId) {
    console.log(`⚠️  检测到上次运行未完成: ${pending.runId}`);
    console.log(`  状态: ${pending.status}`);
    const readline = require('readline');
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    await new Promise((resolve) => {
      rl.question('  是否继续上次的执行？(yes/no): ', (answer) => {
        rl.close();
        if (answer.toLowerCase() === 'yes') {
          console.log('  继续执行...');
        } else {
          clearPending();
          console.log('  已清除未完成记录，重新开始');
        }
        resolve();
      });
    });
  }

  const runRecord = createRunRecord(changeOrder.id, operator, itemsToRun);

  if (!isDryRun) {
    addRunToLedger(runRecord);
    savePending({ runId: runRecord.id, status: 'running' });
  }

  for (let i = 0; i < runRecord.items.length; i++) {
    const runItem = runRecord.items[i];
    const item = changeOrder.items.find(ii => ii.id === runItem.itemId);
    if (!item) continue;

    runItem.startedAt = new Date().toISOString();
    const seq = `[${i + 1}/${runRecord.items.length}]`;

    try {
      const idempotencyCheck = checkIdempotency(changeOrder, item, imageDir);
      if (idempotencyCheck.alreadyDone) {
        runItem.status = ITEM_STATUS.SUCCESS;
        runItem.completedAt = new Date().toISOString();
        runRecord.summary.success++;
        updateItemStatus(changeOrder, item.id, ITEM_STATUS.SUCCESS, idempotencyCheck.detail);
        item.status = ITEM_STATUS.SUCCESS;
        console.log(`${seq} ✅ ${item.originalName} → ${item.newName}`);
        console.log(`     ${idempotencyCheck.detail}`);
        continue;
      }

      console.log(`${seq} 正在处理: ${item.originalName} → ${item.newName}`);
      const result = await performRename(item, imageDir, isDryRun);

      if (result.skipped) {
        runItem.status = ITEM_STATUS.SKIPPED;
        runItem.completedAt = new Date().toISOString();
        runRecord.summary.skipped++;
        updateItemStatus(changeOrder, item.id, ITEM_STATUS.SKIPPED, result.detail);
        item.status = ITEM_STATUS.SKIPPED;
        console.log(`     ⏭️  跳过: ${result.detail}`);
      } else if (result.dryRun) {
        runItem.status = ITEM_STATUS.SUCCESS;
        runItem.completedAt = new Date().toISOString();
        runRecord.summary.success++;
        console.log(`     ${result.detail}`);
      } else if (result.success) {
        runItem.status = ITEM_STATUS.SUCCESS;
        runItem.completedAt = new Date().toISOString();
        runRecord.summary.success++;
        updateItemStatus(changeOrder, item.id, ITEM_STATUS.SUCCESS, result.detail);
        item.status = ITEM_STATUS.SUCCESS;
        console.log(`     ✅ 成功: ${result.detail}`);
      }

    } catch (e) {
      runItem.status = ITEM_STATUS.FAILED;
      runItem.completedAt = new Date().toISOString();
      runItem.error = e.message;
      runRecord.summary.failed++;
      updateItemStatus(changeOrder, item.id, ITEM_STATUS.FAILED, '执行失败', e);
      item.status = ITEM_STATUS.FAILED;
      console.log(`     ❌ 失败: ${e.message}`);
    }

    if (!isDryRun) {
      updateRunInLedger(runRecord.id, {
        items: runRecord.items,
        summary: runRecord.summary
      });
      saveChangeOrder(changeOrder);
    }
  }

  if (!isDryRun) {
    if (runRecord.summary.failed === 0 && runRecord.summary.skipped === 0) {
      runRecord.status = RUN_STATUS.COMPLETED;
    } else if (runRecord.summary.success > 0) {
      runRecord.status = RUN_STATUS.PARTIAL;
    } else {
      runRecord.status = RUN_STATUS.FAILED;
    }
    runRecord.completedAt = new Date().toISOString();

    updateRunInLedger(runRecord.id, {
      status: runRecord.status,
      completedAt: runRecord.completedAt,
      summary: runRecord.summary
    });

    if (runRecord.summary.failed > 0) {
      changeOrder.status = 'needs_fix';
    } else {
      changeOrder.status = 'completed';
    }
    saveChangeOrder(changeOrder);
    clearPending();
  }

  console.log(`\n=== 执行完成 ===`);
  console.log(`运行ID: ${runRecord.id}`);
  console.log(`状态: ${runRecord.status}`);
  console.log(`总计: ${runRecord.summary.total}`);
  console.log(`成功: ${runRecord.summary.success}`);
  console.log(`失败: ${runRecord.summary.failed}`);
  console.log(`跳过: ${runRecord.summary.skipped}`);

  if (!isDryRun) {
    console.log(`\n下一步:`);
    if (runRecord.summary.failed > 0) {
      console.log(`  运行 bir fix 处理失败条目`);
    }
    console.log(`  运行 bir history 查看运行账本`);
    console.log(`  运行 bir export md 导出运行记录`);
  }
}

async function rollback(runId) {
  const ledger = getLedger();
  const runRecord = ledger.runs.find(r => r.id === runId);

  if (!runRecord) {
    throw new Error(`找不到运行记录: ${runId}`);
  }

  if (runRecord.status === RUN_STATUS.ROLLED_BACK) {
    console.log(`⚠️  该运行记录已回滚过`);
    return;
  }

  const imageDir = process.cwd();
  const changeOrder = getChangeOrder();

  console.log(`\n=== 回滚运行记录 ===`);
  console.log(`运行ID: ${runRecord.id}`);
  console.log(`变更单: ${runRecord.changeOrderId}`);
  console.log(`操作人: ${runRecord.operator}`);
  console.log(`执行时间: ${runRecord.startedAt}`);
  console.log(`当前状态: ${runRecord.status}\n`);

  const itemsToRollback = runRecord.items.filter(i => i.status === ITEM_STATUS.SUCCESS);

  if (itemsToRollback.length === 0) {
    console.log('没有需要回滚的成功条目');
    return;
  }

  console.log(`将回滚 ${itemsToRollback.length} 条成功记录:\n`);

  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await new Promise((resolve) => {
    rl.question('确认回滚？此操作会撤销重命名 (yes/no): ', (answer) => {
      rl.close();
      if (answer.toLowerCase() !== 'yes') {
        console.log('已取消');
        process.exit(0);
      }
      resolve();
    });
  });

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < itemsToRollback.length; i++) {
    const runItem = itemsToRollback[i];
    const seq = `[${i + 1}/${itemsToRollback.length}]`;

    try {
      const originalPath = path.join(imageDir, runItem.originalName);
      const newPath = path.join(imageDir, runItem.newName);

      console.log(`${seq} 回滚: ${runItem.newName} → ${runItem.originalName}`);

      if (!fs.existsSync(newPath)) {
        throw new Error(`目标文件不存在，可能已被移动或删除: ${newPath}`);
      }

      if (fs.existsSync(originalPath) && runItem.originalName !== runItem.newName) {
        throw new Error(`原始文件名已被占用: ${originalPath}`);
      }

      if (runItem.originalName !== runItem.newName) {
        fs.renameSync(newPath, originalPath);
      }

      runItem.rollbackInfo = {
        rolledBackAt: new Date().toISOString(),
        success: true,
        detail: `回滚成功: ${runItem.newName} → ${runItem.originalName}`
      };
      runItem.status = ITEM_STATUS.ROLLED_BACK;

      if (changeOrder) {
        const item = changeOrder.items.find(ii => ii.id === runItem.itemId);
        if (item) {
          item.status = ITEM_STATUS.ROLLED_BACK;
          updateItemStatus(changeOrder, item.id, ITEM_STATUS.ROLLED_BACK, runItem.rollbackInfo.detail);
        }
      }

      successCount++;
      console.log(`     ✅ 回滚成功`);

    } catch (e) {
      runItem.rollbackInfo = {
        rolledBackAt: new Date().toISOString(),
        success: false,
        error: e.message,
        detail: `回滚失败: ${e.message}`
      };
      failCount++;
      console.log(`     ❌ 回滚失败: ${e.message}`);
    }
  }

  runRecord.status = RUN_STATUS.ROLLED_BACK;
  runRecord.rolledBackAt = new Date().toISOString();
  runRecord.rollbackSummary = {
    total: itemsToRollback.length,
    success: successCount,
    failed: failCount
  };

  updateRunInLedger(runRecord.id, runRecord);
  if (changeOrder) {
    changeOrder.status = 'rolled_back';
    saveChangeOrder(changeOrder);
  }

  console.log(`\n=== 回滚完成 ===`);
  console.log(`总计: ${itemsToRollback.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`失败: ${failCount}`);
  console.log(`\n注意: 回滚失败的条目需要手动处理`);
}

module.exports = {
  run,
  rollback,
  performRename,
  checkIdempotency
};
