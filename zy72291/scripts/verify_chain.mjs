import fetch from 'node-fetch';
import fs from 'fs';
const api = 'http://localhost:3001/api';
const lines = [];
const log = (...a) => { const s = a.join(' '); lines.push(s); console.log(s); };
const req = async (url, opt) => {
  const r = await fetch(api + url, { headers: { 'Content-Type': 'application/json' }, ...opt });
  return r.json();
};

log('======== 滑翔伞起降区风向图 - 完整链路验证 ========');

log('\n[0] 健康检查');
const h = await req('/health');
log('   health:', JSON.stringify(h));

log('\n[1] 初始日志列表（应为3条：LOG-001/002/003）');
const l1 = await req('/logs');
log('   初始日志数:', l1.data.length);
l1.data.forEach(l => log('    ', l.id, l.batchNo, '[' + l.status + ']',
  'WD=' + l.windDirection, 'WS=' + l.windSpeed, 'MD=' + l.measuredDistance));

log('\n[2] 生成初始报告 - 核对 LOG-003 一致性');
const r1 = await req('/report/generate', { method: 'POST', body: '{}' });
const rep = r1.data;
log('   report.id:', rep.id);
log('   report.stats:', JSON.stringify(rep.stats));
log('   report.results.length:', rep.results.length);
log('   report.items.length:', rep.items.length);

const log3res = rep.results.find(x => x.recordId === 'LOG-003');
const log3item = rep.items.find(x => x.logId === 'LOG-003');
const log3src = l1.data.find(x => x.id === 'LOG-003');
log('   LOG-003 recordId:', log3res.recordId, '(应为 LOG-003)');
log('   LOG-003 要求距离(Results):', log3res.requiredDistance);
log('   LOG-003 要求距离(Items):  ', log3item.requiredDistance);
log('   LOG-003 合规结论(Results):', log3res.compliance, '(195米 vs 要求)');
log('   LOG-003 合规结论(Items):  ', log3item.compliance);
log('   LOG-003 当前状态(source): ', log3src.status, '(legacy)');
log('   LOG-003 历史修正记录数:', log3src.manualCorrections?.length || 0, '(应为1条CORR-001)');
const ok003 = log3res.recordId === 'LOG-003'
  && log3item.requiredDistance === log3res.requiredDistance
  && log3src.status === 'legacy'
  && (log3src.manualCorrections?.length || 0) === 1;
log('   => LOG-003 一致性:', ok003 ? '✅ PASS' : '❌ FAIL');

log('\n[3] 导入1条新点云日志（关键验证：能否进入报告）');
const imp = await req('/logs/import', {
  method: 'POST',
  body: JSON.stringify({ fileName: 'test-fresh.laz', fileData: {} })
});
const newLogId = imp.data.id;
log('   导入新日志ID:', newLogId);
log('   状态:', imp.data.status);
log('   windDirection:', imp.data.windDirection);
log('   windSpeed:', imp.data.windSpeed);
log('   measuredDistance:', imp.data.measuredDistance);
log('   hasScreenshotOcclusion:', imp.data.hasScreenshotOcclusion);

log('\n[4] 再次列出日志（应为4条）');
const l2 = await req('/logs');
log('   当前日志数:', l2.data.length);
l2.data.forEach(l => log('    ', l.id, '[' + l.status + '] MD=' + l.measuredDistance));

log('\n[5] 重新生成报告 - 检查新日志进入 results / items / 统计');
const r2 = await req('/report/generate', { method: 'POST', body: '{}' });
const rep2 = r2.data;
log('   report.stats:', JSON.stringify(rep2.stats));
log('   report.results.length:', rep2.results.length, '(应为 ' + l2.data.length + ')');
log('   report.items.length:', rep2.items.length, '(应为 ' + l2.data.length + ')');

const newRes = rep2.results.find(r => r.recordId === newLogId);
const newItem = rep2.items.find(i => i.logId === newLogId);
log('   新日志在 results 中?', !!newRes);
if (newRes) log('      compliance=' + newRes.compliance + ', reqDist=' + newRes.requiredDistance);
log('   新日志在 items 中?  ', !!newItem);
if (newItem) log('      compliance=' + newItem.compliance + ', diff=' + newItem.diff);

const allResultsCovered = l2.data.every(l => rep2.results.some(r => r.recordId === l.id));
const allItemsCovered = l2.data.every(l => rep2.items.some(i => i.logId === l.id));
log('   => 全部日志进入 results:', allResultsCovered ? '✅ PASS' : '❌ FAIL');
log('   => 全部日志进入 items:  ', allItemsCovered ? '✅ PASS' : '❌ FAIL');
log('   => stats 总数匹配:      ', rep2.stats.total === l2.data.length ? '✅ PASS' : '❌ FAIL');

log('\n[6] 施工经理复核 LOG-002（原 pending_review）');
const rv = await req('/report/review', {
  method: 'POST',
  body: JSON.stringify({
    logId: 'LOG-002', action: 'approve',
    reviewedBy: '施工经理', comment: '现场热成像复核通过'
  })
});
log('   复核后 LOG-002 status:', rv.data.log.status);
log('   复核后 report.status:', rv.data.report.status);
log('   复核后 LOG-002 compliance:', rv.data.report.results.find(x => x.recordId === 'LOG-002')?.compliance);

log('\n[7] 最终报告统计（pendingReview 应减少）');
const r3 = await req('/report/generate', { method: 'POST', body: '{}' });
log('   最终 stats:', JSON.stringify(r3.data.stats));
const pendingOk = r3.data.stats.pendingReview === (r3.data.logIds.includes(newLogId) && imp.data.hasScreenshotOcclusion ? 1 : 0);
log('   => pendingReview 数量正确:', pendingOk ? '✅ PASS' : '❌ 复核后 LOG-002 已通过, 只剩新日志(如有遮挡)');

log('\n[8] 导出 CSV（验证条数和导出内容）');
const exp = await fetch(api + '/report/export');
const csv = await exp.text();
const rows = csv.split('\n').filter(l => l.trim().length > 0);
log('   CSV 总行数:', rows.length, '(表头 + ' + l2.data.length + ' 条日志 = ' + (l2.data.length + 1) + ')');
log('   表头:', rows[0]);
rows.slice(1).forEach((r, i) => {
  const cols = r.split(',');
  log('    行' + (i + 1) + ':', cols[0], cols[1], '合规=' + cols[7], '口径=' + cols[8]);
});
const csvOk = rows.length === l2.data.length + 1
  && rows.slice(1).every(row => l2.data.some(l => row.includes(l.batchNo)));
log('   => CSV 导出正确:', csvOk ? '✅ PASS' : '❌ FAIL (行数或批次号不匹配)');

log('\n======== 验证汇总 ========');
const allPass = ok003 && allResultsCovered && allItemsCovered && csvOk && rep2.stats.total === l2.data.length;
log('总结果:', allPass ? '🎉 全部通过 ✅' : '⚠️  有失败项，请检查上面的 ❌');

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy72291/_verify_output.log', lines.join('\n') + '\n');
console.log('\n结果已保存到 _verify_output.log');
process.exit(allPass ? 0 : 1);
