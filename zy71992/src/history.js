const { getLedger, getChangeOrder, ITEM_STATUS } = require('./models');

function formatDate(isoString) {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

function statusIcon(status) {
  const icons = {
    [ITEM_STATUS.SUCCESS]: '✅',
    [ITEM_STATUS.FAILED]: '❌',
    [ITEM_STATUS.SKIPPED]: '⏭️',
    [ITEM_STATUS.RUNNING]: '🔄',
    [ITEM_STATUS.ROLLED_BACK]: '↩️',
    [ITEM_STATUS.PENDING]: '⏳',
    [ITEM_STATUS.REVIEWED]: '👁️',
    [ITEM_STATUS.NEEDS_FIX]: '⚠️',
    'completed': '✅',
    'partial': '⚠️',
    'failed': '❌',
    'running': '🔄',
    'rolled_back': '↩️'
  };
  return icons[status] || '❓';
}

async function show(runId) {
  const ledger = getLedger();

  if (!ledger.runs || ledger.runs.length === 0) {
    console.log('暂无运行记录');
    return;
  }

  if (!runId) {
    console.log(`\n=== 运行账本（共 ${ledger.runs.length} 条记录） ===\n`);

    const maxIdLen = Math.max(...ledger.runs.map(r => r.id.length)) + 2;
    const maxBatchLen = Math.max(...ledger.runs.map(r => (r.changeOrderId || '').length)) + 2;

    console.log(`${'ID'.padEnd(maxIdLen)}${'变更单'.padEnd(maxBatchLen)}${'操作人'.padEnd(10)}${'状态'.padEnd(12)}${'时间'.padEnd(20)}成功/失败/跳过`);
    console.log('-'.repeat(maxIdLen + maxBatchLen + 10 + 12 + 20 + 20));

    ledger.runs.forEach(run => {
      const s = run.summary || { success: 0, failed: 0, skipped: 0, total: 0 };
      const summaryStr = `${s.success}/${s.failed}/${s.skipped}/${s.total}`;
      console.log(
        `${statusIcon(run.status)} ${run.id.padEnd(maxIdLen - 2)}` +
        `${(run.changeOrderId || '-').padEnd(maxBatchLen)}` +
        `${(run.operator || '-').padEnd(10)}` +
        `${run.status.padEnd(12)}` +
        `${formatDate(run.startedAt).padEnd(20)}` +
        `${summaryStr}`
      );
    });

    console.log(`\n使用 bir history <runId> 查看详细信息`);
    return;
  }

  const run = ledger.runs.find(r => r.id === runId);
  if (!run) {
    throw new Error(`找不到运行记录: ${runId}`);
  }

  console.log(`\n=== 运行记录详情 ===`);
  console.log(`运行ID: ${run.id}`);
  console.log(`变更单: ${run.changeOrderId}`);
  console.log(`操作人: ${run.operator}`);
  console.log(`状态: ${statusIcon(run.status)} ${run.status}`);
  console.log(`开始时间: ${formatDate(run.startedAt)}`);
  console.log(`结束时间: ${formatDate(run.completedAt)}`);

  if (run.status === 'rolled_back') {
    console.log(`回滚时间: ${formatDate(run.rolledBackAt)}`);
    if (run.rollbackSummary) {
      console.log(`回滚统计: 成功 ${run.rollbackSummary.success}, 失败 ${run.rollbackSummary.failed}, 总计 ${run.rollbackSummary.total}`);
    }
  }

  console.log(`\n执行统计:`);
  console.log(`  总计: ${run.summary.total}`);
  console.log(`  成功: ${run.summary.success}`);
  console.log(`  失败: ${run.summary.failed}`);
  console.log(`  跳过: ${run.summary.skipped}`);

  console.log(`\n详细条目 (${run.items.length} 条):\n`);

  const maxOrigLen = Math.max(...run.items.map(i => i.originalName.length)) + 2;
  const maxNewLen = Math.max(...run.items.map(i => i.newName.length)) + 2;

  run.items.forEach((item, idx) => {
    const seq = `[${idx + 1}]`.padEnd(6);
    const icon = statusIcon(item.status);
    const status = item.status.padEnd(14);
    const orig = item.originalName.padEnd(maxOrigLen);
    const arrow = '→'.padEnd(3);
    const target = item.newName.padEnd(maxNewLen);
    const time = item.completedAt ? formatDate(item.completedAt) : '-';

    console.log(`${seq}${icon} ${status}${orig}${arrow}${target}${time}`);

    if (item.error) {
      console.log(`       ❌ 错误: ${item.error}`);
    }

    if (item.rollbackInfo) {
      if (item.rollbackInfo.success) {
        console.log(`       ↩️  回滚: ${item.rollbackInfo.detail}`);
      } else {
        console.log(`       ❌ 回滚失败: ${item.rollbackInfo.error}`);
      }
    }
  });

  const co = getChangeOrder();
  if (co && co.id === run.changeOrderId) {
    console.log(`\n变更单条目历史记录:\n`);
    run.items.forEach(runItem => {
      const coItem = co.items.find(i => i.id === runItem.itemId);
      if (coItem && coItem.history && coItem.history.length > 1) {
        console.log(`#${coItem.seq} ${coItem.originalName} → ${coItem.newName}`);
        coItem.history.forEach((h, hIdx) => {
          console.log(`  ${hIdx + 1}. ${formatDate(h.timestamp)} | ${h.status} | ${h.detail}${h.error ? ' | ' + h.error : ''}`);
        });
        console.log('');
      }
    });
  }
}

module.exports = {
  show,
  formatDate,
  statusIcon
};
