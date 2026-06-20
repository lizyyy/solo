// 在 node 里模拟 localStorage
class MemoryStorage {
  constructor() { this._d = new Map(); }
  getItem(k) { return this._d.has(k) ? this._d.get(k) : null; }
  setItem(k, v) { this._d.set(k, String(v)); }
  removeItem(k) { this._d.delete(k); }
  clear() { this._d.clear(); }
  get length() { return this._d.size; }
  key(i) { return Array.from(this._d.keys())[i] ?? null; }
}
globalThis.localStorage = new MemoryStorage();
globalThis.window = globalThis; // 某些库可能检查 window

async function main() {
  const { runFullE2ETest } = await import('./src/utils/runE2ETest.ts');
  const r = await runFullE2ETest();
  console.log('\n========== E2E 测试结果 ==========');
  console.log('PASS:', r.pass);
  console.log('导出日志ID:', r.exportedLogId);
  console.log('接口核对:', JSON.stringify(r.apiCheck, null, 2));
  console.log('一致性校验:', r.consistency
    ? `consistent=${r.consistency!.consistent}, `
        + `${r.consistency!.matchedRecordCount}/${r.consistency!.recordCount}条一致, `
        + `共${r.consistency!.totalMismatches}处差异`
    : '未执行');
  console.log('--- 步骤明细 ---');
  r.logs.forEach(l => {
    const mark = l.ok ? '✅' : '❌';
    console.log(`${mark} [${l.step}] ${l.description}`);
    if (l.details) console.log('    详情:', JSON.stringify(l.details).slice(0, 140));
  });
  process.exit(r.pass ? 0 : 1);
}

main().catch(e => { console.error('❌ 执行异常:', e); process.exit(2); });
