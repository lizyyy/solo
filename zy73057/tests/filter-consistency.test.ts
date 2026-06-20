import assert from 'node:assert/strict';
import { applyFilters } from '../api/services/scheduleService';
import { signFilters, retrieveBySignature, toCSV } from '../api/services/exportService';
import { store } from '../api/data/store';

function run() {
  console.log('\n[1] 日期 2026-06-08 筛选包含当天完整时间（dateFrom=dateTo 不应变成全量）');
  {
    // 模拟用户在页面选择当天 2026-06-08 当天范围
    const r = applyFilters({ dateFrom: '2026-06-08', dateTo: '2026-06-08' });
    console.log('  dateFrom=dateTo=2026-06-08 matchedBatches:', r.batches.map(b => `${b.batchId}@${b.createdAt}`));
    assert.ok(r.batches.length > 0, '至少命中当天创建的批次');
    // 确认全部命中批次的 createdAt 都在 2026-06-08 00:00 ~ 23:59 内
    for (const b of r.batches) {
      assert.ok(b.createdAt >= '2026-06-08', `${b.batchId} createdAt ${b.createdAt} 早于 2026-06-08`);
      assert.ok(b.createdAt <= '2026-06-08 23:59', `${b.batchId} createdAt ${b.createdAt} 晚于 2026-06-08 23:59`);
    }
    // 种子数据中只有 B-2026-06-W2 是 2026-06-08 创建的（10:15），如果日期直接字符串比较不加 23:59，就会 0 命中、退化成全量/空
    assert.equal(r.batches.length, 1, `按 2026-06-08 当天筛选应命中 1 个批次（B-2026-06-W2 10:15），实际 ${r.batches.length}`);
    console.log('  ✅ 日期归一化 OK，仅命中 2026-06-08 当天批次');

    // 再验证仅 dateTo=2026-06-08（历史所有到 06-08）包含全部 4 个批次
    const rToOnly = applyFilters({ dateTo: '2026-06-08' });
    assert.equal(rToOnly.batches.length, 4, `dateTo=2026-06-08 应命中所有不晚于该日的 4 个批次，实际 ${rToOnly.batches.length}`);
    console.log('  ✅ 仅 dateTo 时按"至某日"口径，全量历史批次全部命中');
  }

  console.log('\n[2] statuses=overridden 筛选导出只包含命中批次明细');
  {
    const r = applyFilters({ statuses: ['overridden'] });
    console.log('  overridden matchedBatches:', r.batches.map(b => b.batchId));
    console.log('  overridden matchedItems:', r.items.map(it => `${it.id}@${it.batchId}`));
    assert.equal(r.batches.length, 1, 'overridden 只应该命中 1 个批次');
    const overriddenBatchId = r.batches[0].batchId;
    for (const it of r.items) {
      assert.equal(it.batchId, overriddenBatchId, `明细 ${it.id} 不属于 overridden 命中的批次 ${overriddenBatchId}`);
    }
    assert.ok(r.items.length > 0, 'overridden 批次内应该有明细');
    console.log(`  ✅ overridden 批次 ${overriddenBatchId}，明细 ${r.items.length} 条全部属于该批次`);
  }

  console.log('\n[3] 签名追回记录数和导出一致');
  {
    // 场景 A：按 overridden 状态导出
    const filtersOverride = { statuses: ['overridden'] as const };
    const rOverride = applyFilters(filtersOverride);
    const sigOverride = signFilters(filtersOverride, rOverride.matchedItemIds, rOverride.matchedBatchIds);
    const decodedOverride = retrieveBySignature(sigOverride.signature);
    assert.ok(decodedOverride, '签名应能被追回');
    assert.equal(decodedOverride!.matchedItemIds.length, rOverride.matchedItemIds.length,
      `overridden 导出追回 items 记录数不一致`);
    assert.equal(decodedOverride!.matchedBatchIds.length, rOverride.matchedBatchIds.length,
      `overridden 导出追回 batches 记录数不一致`);
    assert.equal(decodedOverride!.filters.statuses?.[0], 'overridden', 'statuses 应还原为 overridden');

    // 场景 B：按日期导出
    const filtersDate = { dateTo: '2026-06-08' };
    const rDate = applyFilters(filtersDate);
    const sigDate = signFilters(filtersDate, rDate.matchedItemIds, rDate.matchedBatchIds);
    const decodedDate = retrieveBySignature(sigDate.signature);
    assert.ok(decodedDate, '日期签名应能被追回');
    assert.equal(decodedDate!.matchedItemIds.length, rDate.matchedItemIds.length,
      `日期导出追回 items 记录数不一致（签名保存 ${decodedDate!.matchedItemIds.length}，预期 ${rDate.matchedItemIds.length}）`);
    assert.equal(decodedDate!.matchedBatchIds.length, rDate.matchedBatchIds.length,
      `日期导出追回 batches 记录数不一致（签名保存 ${decodedDate!.matchedBatchIds.length}，预期 ${rDate.matchedBatchIds.length}）`);
    assert.equal(decodedDate!.filters.dateTo, '2026-06-08', 'dateTo 应还原为 2026-06-08');

    // 场景 C：导出 CSV 的行数与 matchedItems + header 一致；CSV 第一列是批次号、第三列是电梯号
    const csv = toCSV(rOverride.items, rOverride.batches);
    const csvRows = csv.split(/\r?\n/).filter(l => l.trim().length > 0);
    // header + 明细 + 空行+批次汇总，toCSV 只写 items + headers，rows 数应为 matchedItems.length + 1
    const expectedRows = rOverride.items.length + 1;
    assert.ok(csvRows.length >= expectedRows, `CSV 行数应 >= ${expectedRows}，实际 ${csvRows.length}`);
    for (const it of rOverride.items) {
      assert.ok(csv.includes(it.batchId), `CSV 缺少批次号 ${it.batchId}`);
      assert.ok(csv.includes(it.elevatorNo), `CSV 缺少电梯号 ${it.elevatorNo}`);
    }
    for (const b of rOverride.batches) {
      assert.ok(csv.includes(b.batchId), `CSV 缺少批次 ${b.batchId}`);
    }
    console.log(`  ✅ 签名追回 records 一致：overridden(${rOverride.matchedBatchIds.length}b/${rOverride.matchedItemIds.length}r) · dateTo(${rDate.matchedBatchIds.length}b/${rDate.matchedItemIds.length}r) · CSV ${csvRows.length} 行 (明细 ${rOverride.items.length}+表头)`);
  }

  console.log('\n[4] 边界：空筛选应返回全量 4 个批次 × 18 条明细');
  {
    const r = applyFilters({});
    assert.equal(r.batches.length, 4, `空筛选批次应为 4，实际 ${r.batches.length}`);
    assert.equal(r.items.length, 18, `空筛选明细应为 18，实际 ${r.items.length}`);
    assert.equal(r.matchedBatchIds.length, 4);
    assert.equal(r.matchedItemIds.length, 18);
    console.log('  ✅ 空筛选全量口径正确 (4 batches / 18 items)');
  }

  console.log('\n[5] 边界：按 isOverridden=true 筛选只命中有改判的批次与明细');
  {
    const r = applyFilters({ isOverridden: true });
    for (const b of r.batches) assert.ok(b.overrideCount > 0, `${b.batchId} 没有改判却被 isOverridden=true 命中`);
    for (const it of r.items) assert.ok(it.isOverridden, `${it.id} 不是改判明细却被 isOverridden=true 命中`);
    console.log(`  ✅ isOverridden=true 命中 ${r.batches.length} 批次 / ${r.items.length} 条明细，全部是改判数据`);
  }

  console.log('\n✅ 全部覆盖用例通过');
}

run();
