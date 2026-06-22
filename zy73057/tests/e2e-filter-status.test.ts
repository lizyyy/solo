import assert from 'node:assert/strict';

const BASE = 'http://localhost:3001/api';

async function json<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = await res.json();
  if (body && typeof body === 'object' && 'success' in body && 'data' in body) return body.data as T;
  return body as T;
}

async function run() {
  console.log('\n[E2E-1] 用户在筛选抽屉选"已改判" → 列表批次收窄 → 明细只属命中批次');
  {
    const list = await json<{ batches: any[]; items: any[]; matchedBatchIds: string[]; matchedItemIds: string[] }>(
      '/schedules?statuses=overridden',
    );
    assert.equal(list.batches.length, 1, `页面应只展示 1 个 overridden 批次，实际 ${list.batches.length}`);
    assert.equal(list.batches[0].status, 'overridden', '命中的批次状态应为 overridden');
    assert.equal(list.items.length, 6, `页面应只展示 6 条明细，实际 ${list.items.length}`);
    const batchId = list.batches[0].batchId;
    for (const it of list.items) {
      assert.equal(it.batchId, batchId, `明细 ${it.id} 不属于 overridden 批次 ${batchId}`);
    }
    assert.equal(list.matchedBatchIds.length, 1, `matchedBatchIds 应有 1 个，实际 ${list.matchedBatchIds.length}`);
    assert.equal(list.matchedItemIds.length, 6, `matchedItemIds 应有 6 个，实际 ${list.matchedItemIds.length}`);
    console.log(`  ✅ 页面: ${list.batches.length} 批次 / ${list.items.length} 排程，全部属于 ${batchId}`);
  }

  console.log('\n[E2E-2] 用户点"导出 CSV 并生成筛选签名" → CSV 明细只含命中批次行 → 签名含 statuses');
  {
    const res = await fetch(BASE + '/export/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statuses: ['overridden'] }),
    });
    const csv = await res.text();
    const sig = res.headers.get('x-filter-signature') || '';
    const metaRaw = res.headers.get('x-filter-signature-meta') || '';
    assert.ok(sig.length > 0, '签名不能为空');
    assert.ok(csv.includes('B-2026-06-W2'), 'CSV 必须包含 overridden 批次号 B-2026-06-W2');
    assert.ok(!csv.includes('B-2026-05-W4'), 'CSV 不能包含非 overridden 批次 B-2026-05-W4');
    assert.ok(!csv.includes('B-2026-06-W1'), 'CSV 不能包含非 overridden 批次 B-2026-06-W1');
    const meta = JSON.parse(decodeURIComponent(metaRaw));
    assert.equal(meta.matchedBatchCount, 1, `meta.matchedBatchCount 应为 1，实际 ${meta.matchedBatchCount}`);
    assert.equal(meta.matchedItemCount, 6, `meta.matchedItemCount 应为 6，实际 ${meta.matchedItemCount}`);
    console.log(`  ✅ 导出: CSV 含 B-2026-06-W2 不含其他批次，签名 ${sig.slice(0, 12)}...，meta ${meta.matchedBatchCount}b/${meta.matchedItemCount}r`);
  }

  console.log('\n[E2E-3] 复核人用导出签名追回 → 记录数与导出一致');
  {
    const exportRes = await fetch(BASE + '/export/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ statuses: ['overridden'] }),
    });
    const sig = exportRes.headers.get('x-filter-signature') || '';
    assert.ok(sig, '需要先获取签名');

    const retrieve = await json<{
      signature: string;
      filters: any;
      matchedItemIds: string[];
      matchedBatchIds: string[];
      exportedAt: string;
    }>('/retrieve', {
      method: 'POST',
      body: JSON.stringify({ signature: sig }),
    });

    assert.equal(retrieve.filters.statuses?.[0], 'overridden', '追回应还原 statuses=["overridden"]');
    assert.equal(retrieve.matchedBatchIds.length, 1, `追回 matchedBatchIds 应有 1 个，实际 ${retrieve.matchedBatchIds.length}`);
    assert.equal(retrieve.matchedBatchIds[0], 'B-2026-06-W2', '追回 matchedBatchIds[0] 应为 B-2026-06-W2');
    assert.equal(retrieve.matchedItemIds.length, 6, `追回 matchedItemIds 应有 6 个，实际 ${retrieve.matchedItemIds.length}`);
    assert.ok(retrieve.exportedAt.length > 0, 'exportedAt 不能为空');

    const reList = await json<{ batches: any[]; items: any[]; matchedBatchIds: string[]; matchedItemIds: string[] }>(
      '/schedules?statuses=overridden',
    );
    assert.equal(reList.matchedBatchIds.length, retrieve.matchedBatchIds.length,
      `页面批次数 ${reList.matchedBatchIds.length} 与签名保存 ${retrieve.matchedBatchIds.length} 不一致`);
    assert.equal(reList.matchedItemIds.length, retrieve.matchedItemIds.length,
      `页面明细数 ${reList.matchedItemIds.length} 与签名保存 ${retrieve.matchedItemIds.length} 不一致`);

    console.log(`  ✅ 追回: 签名保存 ${retrieve.matchedBatchIds.length}b/${retrieve.matchedItemIds.length}r，页面当前 ${reList.matchedBatchIds.length}b/${reList.matchedItemIds.length}r，记录数一致`);
  }

  console.log('\n[E2E-4] 按日期筛选导出不全量（dateFrom=dateTo=2026-06-08）');
  {
    const list = await json<{ batches: any[]; items: any[]; matchedBatchIds: string[] }>(
      '/schedules?dateFrom=2026-06-08&dateTo=2026-06-08',
    );
    assert.equal(list.batches.length, 1, `dateFrom=dateTo=2026-06-08 应只命中当天 1 个批次，实际 ${list.batches.length}`);
    assert.equal(list.batches[0].batchId, 'B-2026-06-W2', '当天批次应为 B-2026-06-W2');

    const exportRes = await fetch(BASE + '/export/schedules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ dateFrom: '2026-06-08', dateTo: '2026-06-08' }),
    });
    const metaRaw = exportRes.headers.get('x-filter-signature-meta') || '';
    const meta = JSON.parse(decodeURIComponent(metaRaw));
    assert.equal(meta.matchedBatchCount, 1, `日期筛选导出 matchedBatchCount 应为 1，实际 ${meta.matchedBatchCount}`);
    assert.equal(meta.matchedItemCount, 6, `日期筛选导出 matchedItemCount 应为 6，实际 ${meta.matchedItemCount}`);
    console.log('  ✅ 日期 2026-06-08 筛选导出: 1b/6r，不全量');
  }

  console.log('\n✅ 全部 E2E 用例通过');
}

run().catch((e) => {
  console.error('E2E 测试失败:', e);
  process.exit(1);
});
