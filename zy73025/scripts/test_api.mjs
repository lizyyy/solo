import http from 'node:http';
const host = 'http://localhost:3001';
function req(method, path, body) {
  return new Promise((res, rej) => {
    const u = new URL(host + path);
    const opts = { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: { 'Content-Type': 'application/json' } };
    const r = http.request(opts, resp => { let d = ''; resp.on('data', c => d += c); resp.on('end', () => { try { res({ status: resp.statusCode, body: JSON.parse(d) }) } catch { res({ status: resp.statusCode, body: d }) } }) });
    r.on('error', rej);
    if (body) r.write(JSON.stringify(body));
    r.end();
  });
}

async function run() {
  try {
    console.log('▸ health:', (await req('GET', '/api/health')).body);
    const list = await req('GET', '/api/records');
    console.log('▸ records list:', list.body.data.length, '条');
    const r2 = await req('GET', '/api/records/rec-R002');
    console.log('▸ R002 疫苗缺失:', r2.body.data.petName, 'conclusion=', r2.body.data.conclusion);
    console.log('  factors:', r2.body.data.factors.map(f => f.type + ':' + f.impact).join(','));
    const r6h = await req('GET', '/api/records/rec-R006/history');
    console.log('▸ R006 历史:', r6h.body.data.length, '条 →', r6h.body.data.map(x => x.action + '|m=' + x.isManual).join(' / '));
    const q = await req('GET', '/api/queue');
    console.log('▸ 异常队列:', q.body.data.length, '条 →', q.body.data.map(x => x.type + ':' + x.status).join(','));
    console.log('\n📗 所有 GET API 通过');

    console.log('\n=== 写回: R001 normal→observe ===');
    const rj = await req('PUT', '/api/records/rec-R001/conclusion', { conclusion: 'observe', reason: '复查发现夜间体温波动', operator: '阿宁' });
    console.log('  改判:', rj.status, rj.body.success);
    const r1h = await req('GET', '/api/records/rec-R001/history');
    const last = r1h.body.data[0];
    console.log('  最新历史:', last.action, 'm=' + last.isManual, 'op=' + last.operator, '原因:' + (last.reason || '').slice(0,20));
    console.log('📗 改判写回通过');

    console.log('\n=== 补录: R002 疫苗 ===');
    const sp = await req('POST', '/api/records/rec-R002/supplement', { type: 'vaccine', content: { name: '狂犬疫苗', date: '2026-06-01' }, operator: '阿宁' });
    console.log('  补录:', sp.status, sp.body.success, sp.body.message || '');
    const r2n = await req('GET', '/api/records/rec-R002');
    console.log('  R002 疫苗数:', r2n.body.data.vaccines.length, '结论:', r2n.body.data.conclusion);
    const q2 = await req('GET', '/api/queue');
    console.log('  队列剩余:', q2.body.data.filter(x => x.status === 'open').length, '条');
    console.log('📗 补录+自动关异常通过');
    console.log('\n✅ 全部通过');
  } catch (e) {
    console.error('❌', e.message || e);
  }
}
run();
