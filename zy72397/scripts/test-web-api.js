#!/usr/bin/env node
const PORT = process.env.PORT || 3000;
const BASE = 'http://127.0.0.1:' + PORT;
const http = require('http');

function jsonReq(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
      hostname: '127.0.0.1', port: PORT, path
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, raw: data, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, raw: data, body: null }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function unwrap(resp, what) {
  if (!resp.body) { console.log(`   ⚠️  ${what} 返回非JSON或空: ${(resp.raw||'').slice(0,200)}`); return null; }
  if (resp.body.success === false) { console.log(`   ❌ ${what} 失败: ${resp.body.error || JSON.stringify(resp.body).slice(0,200)}`); return null; }
  return resp.body;
}

(async () => {
  const S = '='.repeat(66), D = '-'.repeat(66);
  console.log(S);
  console.log('🌐 Web API 层级验证（从导入到结果页的完整闭环）');
  console.log(S);

  console.log('\n' + D);
  console.log('[1/8] GET /api/consistency 初始自检:');
  const c1 = await jsonReq('GET', '/api/consistency');
  const u1 = unwrap(c1, '初始自检');
  if (u1 && u1.data) console.log('   ', u1.data.summary);

  console.log('\n' + D);
  console.log('[2/8] POST /api/import 导入样例（REC-002 采样时间缺半小时）:');
  const imp = await jsonReq('POST', '/api/import', {
    data: [
      {sensor_id:'SEN-2024-001',sensor_name:'1号水轮机进口',turbine_id:'TURBINE-A-01',sampling_time:'2024-06-15T08:00:00.000Z',sampling_start_time:'2024-06-15T08:00:00.000Z',sampling_end_time:'2024-06-15T09:00:00.000Z',efficiency:92.5,flow_rate:45.2,head:38.6,power:15800},
      {sensor_id:'SEN-2024-002',sensor_name:'1号水轮机出口【采样缺半小时】',turbine_id:'TURBINE-A-01',sampling_time:'2024-06-15T10:35:00.000Z',sampling_start_time:'2024-06-15T10:35:00.000Z',sampling_end_time:'2024-06-15T10:55:00.000Z',efficiency:91.8,flow_rate:44.8,head:38.2,power:15600}
    ],
    operator: '何工'
  });
  const uImp = unwrap(imp, '导入');
  if (uImp && uImp.data) console.log('   ', `batch=${uImp.data.batch_id} 记录=${uImp.data.records.join(',')}`);

  console.log('\n' + D);
  console.log('[3/8] GET /api/records/REC-002 （核心：qc_review_required=true + 边界问题 + 原始行号）:');
  const r002 = await jsonReq('GET', '/api/records/REC-002');
  const u002 = unwrap(r002, 'REC-002详情');
  const b = u002 ? u002.data : null;
  if (b) {
    console.log(`   id=${b.id}  status=${b.current_status}  qc_review_required=${b.qc_review_required}  original_line_no=${b.original_line_no}`);
    console.log(`   boundary_issues 数=${(b.boundary_issues||[]).length} 明细=${(b.boundary_issues||[]).map(i=>`[${i.issueType}]${i.message}`).join(' | ')}`);
    const pass3 = b.qc_review_required === true && b.current_status === 'NEED_QC_REVIEW' && b.original_line_no === 2 && (b.boundary_issues||[]).length === 2;
    console.log(`   ✅ 预期都命中？ ${pass3 ? '是' : '否 ⚠️'}`);
  }

  console.log('\n' + D);
  console.log('[4/8] 三步工作流：何工评审→提交QC→QC通过→终态');
  const eng = await jsonReq('POST', '/api/records/REC-002/engineer-review', { operator:'何工', notes:'采样缺半小时，等现场照片', photos:['p1.jpg','p2.jpg'] });
  const uEng = unwrap(eng, '何工评审');
  if (uEng) console.log(`   何工评审 ✅ HTTP 200  一致性=${uEng._post_action_consistency && uEng._post_action_consistency.summary}`);

  const subQc = await jsonReq('POST', '/api/records/REC-002/submit-qc', { operator:'何工', remark:'提交复核' });
  unwrap(subQc, '提交QC');

  const qc = await jsonReq('POST', '/api/records/REC-002/qc-approve', { operator:'质检员', remark:'现场照片确认过' });
  const uQc = unwrap(qc, 'QC通过');
  if (uQc) console.log(`   QC通过 ✅ HTTP 200  一致性=${uQc._post_action_consistency && uQc._post_action_consistency.summary}`);

  const fin = await jsonReq('POST', '/api/records/REC-002/finalize', { operator:'何工', conclusion:'REC-002 结论（待返工）' });
  const uFin = unwrap(fin, '终态');
  if (uFin) console.log(`   终态 ✅ HTTP 200  一致性=${uFin._post_action_consistency && uFin._post_action_consistency.summary}`);

  console.log('\n' + D);
  console.log('[5/8] POST /api/records/REC-002/rework （核心：旧记录必须 SUPERSEDED + superseded_by 写入）:');
  const rw = await jsonReq('POST', '/api/records/REC-002/rework', {
    operator:'何工',
    reason:'阀门开度证据补到，原结论被推翻',
    photoUrls:['vopen65pct.jpg','ev2.png']
  });
  const uRw = unwrap(rw, '返工');
  let OLD_ID = null, NEW_ID = null;
  if (uRw) {
    const d = uRw.data;
    OLD_ID = d.old_record_id; NEW_ID = d.new_record_id;
    const chain = uRw._rework_evidence_chain || {};
    console.log(`   OLD=${OLD_ID}  NEW=${NEW_ID}`);
    console.log(`   旧结论保留: status_after=${chain.old_status_after}  superseded_by=${chain.old_superseded_by}  结论="${(chain.old_conclusion_preserved||'').slice(0,30)}..."`);
    console.log(`   新记录关联: status=${chain.new_status}  new_rework_from_field=${(chain.new_rework_from_field||[]).length > 0 ? '已写入✅' : '缺失⚠️'}`);
    const pass5 = chain.old_status_after === 'SUPERSEDED' && chain.old_superseded_by === NEW_ID;
    console.log(`   ✅ 旧记录 SUPERSEDED + superseded_by 写入？ ${pass5 ? '是' : '否 ⚠️'}`);

    // 新记录走流程
    await jsonReq('POST', `/api/records/${NEW_ID}/submit-qc`, { operator:'何工', remark:'返工新结论需复核' });
    const qc2 = await jsonReq('POST', `/api/records/${NEW_ID}/qc-approve`, { operator:'质检员', remark:'通过返工' });
    unwrap(qc2, `NEW QC通过`);
    const fin2 = await jsonReq('POST', `/api/records/${NEW_ID}/finalize`, { operator:'何工', conclusion:'修正结论：阀门实际65%开度' });
    unwrap(fin2, `NEW 终态`);
  }

  console.log('\n' + D);
  console.log('[6/8] GET /api/export 核对导出含采样缺半小时的旧记录（不隐藏）:');
  const csvResp = await new Promise(res => {
    http.get({hostname:'127.0.0.1', port:PORT, path:'/api/export?format=csv'}, res2 => {
      let d = ''; res2.on('data', c=>d+=c); res2.on('end', ()=>res(d));
    }).on('error', res);
  });
  const csvStr = String(csvResp);
  console.log(`   导出CSV大小=${csvStr.length}字节`);
  console.log(`   包含OLD(${OLD_ID})? ${csvStr.includes(OLD_ID) ? '✅' : '❌ 丢失！'}`);
  console.log(`   包含NEW(${NEW_ID})? ${csvStr.includes(NEW_ID) ? '✅' : '❌ 丢失！'}`);
  console.log(`   CSV含 SUPERSEDED? ${csvStr.includes('SUPERSEDED') ? '✅' : '❌ 状态丢失！'}`);

  const expRaw = await jsonReq('GET', '/api/export?format=json');
  const uExp = unwrap(expRaw, 'JSON导出');
  const arr = uExp && uExp.data ? uExp.data : (Array.isArray(expRaw.body) ? expRaw.body : []);
  const oldInExport = arr.find(x=>x.id===OLD_ID);
  const newInExport = arr.find(x=>x.id===NEW_ID);
  console.log(`   JSON导出长度=${arr.length}`);
  if (oldInExport) {
    console.log(`   OLD导出: status=${oldInExport.current_status}  superseded_by=${oldInExport.superseded_by}  qc=${oldInExport.qc_review_required}  issues=${(oldInExport.boundary_issues||[]).length}`);
  }
  if (newInExport) {
    console.log(`   NEW导出: status=${newInExport.current_status}  superseded_by=${newInExport.superseded_by||'(空)'}  qc=${newInExport.qc_review_required}  issues=${(newInExport.boundary_issues||[]).length}`);
  }
  const exportPass = oldInExport && oldInExport.current_status === 'SUPERSEDED' && oldInExport.superseded_by === NEW_ID;
  console.log(`   ✅ 导出里旧记录完整（SUPERSEDED + 被哪条替代都有）？ ${exportPass ? '是' : '否 ⚠️'}`);

  console.log('\n' + D);
  console.log('[7/8] POST /api/records/REC-002/rollback 回滚旧记录到 NEED_QC_REVIEW（核心：派生字段同步）:');
  const det002Raw = await jsonReq('GET', `/api/records/${OLD_ID}`);
  const uDet = unwrap(det002Raw, `${OLD_ID}详情`);
  const det = uDet ? uDet.data : null;
  let needIdx = -1;
  if (det && det.status_history) {
    det.status_history.forEach((h,i) => { console.log(`   [${i}] ${h.status}${h.state_snapshot?` qc=${h.state_snapshot.qc_review_required}`:''}`); if (h.status === 'NEED_QC_REVIEW' && needIdx === -1) needIdx = i; });
  }
  console.log(`   需要回滚到索引=${needIdx}（NEED_QC_REVIEW）`);

  const rb = await jsonReq('POST', `/api/records/${OLD_ID}/rollback`, { operator:'质检员-撤销', version: needIdx });
  const uRb = unwrap(rb, '回滚');
  if (uRb) {
    const rr = uRb._rollback_report || {};
    const b = rr.before || {}, a = rr.after || {};
    console.log(`   BEFORE: status=${b.status}  qc=${b.qc}  boundary=${b.boundaryCount}`);
    console.log(`   AFTER : status=${a.status}   qc=${a.qc}    boundary=${a.boundaryCount}   问题=[${(a.boundaryMessages||[]).join('; ')}]`);
    console.log(`   ${rr.derived_fields_restored_note || ''}`);
    const ok = a.status === 'NEED_QC_REVIEW' && a.qc === true && a.boundaryCount >= 1;
    console.log(`   ✅ 回滚后 status+qc+boundary 三样都同步（不会页面成功接口读不到）？ ${ok ? '是' : '否 ⚠️'}`);

    // 最后再查一次导出 vs API 一致
    const afterRbRaw = await jsonReq('GET', `/api/records/${OLD_ID}`);
    const uARb = unwrap(afterRbRaw, '回滚后REC-002详情');
    const aDet = uARb ? uARb.data : null;
    const expAfterRaw = await jsonReq('GET', '/api/export?format=json');
    const expArr = (unwrap(expAfterRaw, '回滚后导出') || {}).data || (Array.isArray(expAfterRaw.body)?expAfterRaw.body:[]);
    const r002After = Array.isArray(expArr) ? expArr.find(x=>x.id===OLD_ID) : null;
    const exportMatches = r002After && r002After.current_status === aDet.current_status && r002After.qc_review_required === aDet.qc_review_required;
    console.log(`   ✅ 回滚后 API 与导出完全一致？ ${exportMatches ? `是（API: status=${aDet.current_status}/qc=${aDet.qc_review_required} == 导出: status=${r002After.current_status}/qc=${r002After.qc_review_required}）` : '否 ⚠️'}`);
  }

  console.log('\n' + D);
  console.log('[8/8] GET /api/consistency 最终三方一致性自检:');
  const c8 = await jsonReq('GET', '/api/consistency');
  const u8 = unwrap(c8, '最终一致性');
  if (u8 && u8.data) {
    console.log('   ', u8.data.summary);
    const pass8 = u8.data.passed === true;
    console.log(`   ✅ 最终一致性通过？ ${pass8 ? '是' : '否 ⚠️ 问题: ' + (u8.data.issues||[]).join('; ')}`);
  }

  console.log('\n' + S);
  console.log('🏁 Web API 层级验证完成。与命令行 npm run verify 是同一份逻辑与数据。');
  console.log('   页面 / API / 导出 三方共用 dataStore.getUnifiedView() + formatViewRecord() + UNIFIED_FIELDS');
  console.log(S);
})();
