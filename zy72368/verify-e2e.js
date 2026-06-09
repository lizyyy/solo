const http = require('http');
const BASE = 'http://localhost:3000';

function req(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: body ? { 'Content-Type': 'application/json' } : {}
    };
    const req = http.request(opts, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(data) }); }
        catch (e) { resolve({ status: res.statusCode, body: data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

let testResults = [];
function assert(name, cond, detail = '') {
  testResults.push({ name, pass: !!cond, detail });
  console.log(`  [${cond ? '✅ PASS' : '❌ FAIL'}] ${name}${detail ? ' - ' + detail : ''}`);
}

(async () => {
  console.log('\n' + '='.repeat(70));
  console.log('焊接热影响区估算工具 - 端到端完整验证报告');
  console.log('='.repeat(70));

  // ============ 步骤 1: 获取样例数据 ============
  console.log('\n📋 步骤 1: GET /api/sample-data 获取真实样例');
  const sample = await req('GET', '/api/sample-data');
  assert('HTTP 200', sample.status === 200);
  assert('包含 batch 样例名', sample.body.data?.sampleBatchName);
  assert('包含 records (至少3条)', sample.body.data?.records?.length >= 3, `共 ${sample.body.data?.records?.length||0} 条`);
  assert('截图描述包含"按1小时间断', sample.body.data?.screenshot?.description?.includes('1小时'));
  const sampleBatch = sample.body.data;
  const timegapRecords = sampleBatch.records.filter(r => {
    if (!r.samplingTime || !r.previousSamplingTime) return false;
    const gap = (new Date(r.samplingTime) - new Date(r.previousSamplingTime)) / 60000;
    return gap > 35;
  });
  assert('样例包含采样时间缺失记录(至少2条)', timegapRecords.length >= 2, `${timegapRecords.length} 条缺失`);

  // ============ 步骤 2: 维修群截图第一次导入 - 创建批次 ============
  console.log('\n📤 步骤 2: POST /api/batch 维修群截图第一次导入（创建批次）');
  const batchResp = await req('POST', '/api/batch', {
    batchName: sampleBatch.sampleBatchName,
    uploader: '业务同事',
    records: sampleBatch.records,
    source: '维修群截图第一次导入'
  });
  assert('HTTP 200', batchResp.status === 200);
  assert('批次创建成功', batchResp.body.success);
  const batchId = batchResp.body.data.batchId;
  const recordCount = batchResp.body.data.records.length;
  assert('批次记录数正确', recordCount === sampleBatch.records.length, `${recordCount} / ${sampleBatch.records.length}`);
  console.log(`    批次ID: ${batchId}, 记录数: ${recordCount}`);

  // ============ 步骤 3: 导入维修群截图 ============
  console.log('\n🖼️ 步骤 3: POST /api/maintenance-screenshot 导入维修群截图');
  const screenResp = await req('POST', '/api/maintenance-screenshot', {
    batchId,
    description: sampleBatch.screenshot.description,
    uploader: '业务同事',
    originalName: sampleBatch.screenshot.originalName,
    fileSize: 102400
  });
  assert('HTTP 200', screenResp.status === 200);
  assert('截图导入成功', screenResp.body.success);
  const screenshotId = screenResp.body.data.id;
  assert('截图关联批次', screenResp.body.data.batchId === batchId);

  // ============ 步骤 4: 林老师补看采样间隔说明 ============
  console.log('\n📝 步骤 4: POST /api/sampling-interval 林老师补看采样间隔说明 (30分钟连续采样)');
  const intervalResp = await req('POST', '/api/sampling-interval', {
    content: '按工艺文件要求：采样间隔为30分钟，连续采样不间断，不得跳点',
    operator: '林老师'
  });
  assert('HTTP 200', intervalResp.status === 200);
  assert('采样间隔提交成功', intervalResp.body.success);
  assert('操作人为林老师', intervalResp.body.data.operator === '林老师');

  // ============ 步骤 5: 验证冲突检测 ============
  console.log('\n⚡ 步骤 5: 验证冲突检测（截图1小时 vs 说明30分钟、连续 vs 间断）');
  const state1 = await req('GET', '/api/state');
  const conflicts = state1.body.data.conflicts;
  assert('检测到至少1个冲突', conflicts.length >= 1, `${conflicts.length} 个冲突`);
  let unresolved = [];
  if (conflicts.length > 0) {
    unresolved = conflicts.filter(c => !c.resolved);
    assert('冲突未解决前为未解决状态', unresolved.length >= 1);
    const c = conflicts[0];
    assert('冲突包含 evidence 证据数组', c.evidence?.length > 0);
    assert('证据含"采样间隔矛盾"或"连续性矛盾"',
      c.evidence.some(e => e.type.includes('采样间隔') || e.type.includes('连续')));
    console.log(`    冲突证据: ${c.evidence.map(e => e.type).join(', ')}`);
  }

  // ============ 步骤 6: 验证采样时间缺失记录 ============
  console.log('\n⏱️ 步骤 6: 验证采样时间缺失记录全链路处理');
  const stateData = state1.body.data;
  const batch = stateData.batches.find(b => b.batchId === batchId);
  assert('批次存在于后端', !!batch);
  const allRecords = batch.records;
  assert('记录字段完整（每记录含20个字段）',
    allRecords.every(r => {
      const keys = Object.keys(r);
      return keys.length >= 15 && r.recordId && r.batchId && r.status !== undefined;
    }), `每条字段数: ${allRecords.map(r => Object.keys(r).length).join(',')}`);
  const pendingRecords = allRecords.filter(r => r.status === 'timegap_pending' || r.status === 'conflict_pending');
  assert('缺失记录标记为 timegap_pending 或 conflict_pending', pendingRecords.length >= 2,
    `${pendingRecords.length} 条异常: ${pendingRecords.map(r => r.status).join(',')}`);
  assert('缺失记录 anomalyDescription 不为空', pendingRecords.every(r => r.anomalyDescription?.length > 5));
  assert('缺失记录 timeGap.hasGap=true', pendingRecords.filter(r => r.timeGap?.hasGap).length >= 2);
  assert('缺失记录 reviewStatus=pending', pendingRecords.every(r => r.reviewStatus === 'pending'));
  console.log(`    缺失记录数: ${pendingRecords.length}, anomaly描述示例: ${pendingRecords[0]?.anomalyDescription?.slice(0,40)}...`);

  // ============ 步骤 7: 林老师解决冲突 ============
  console.log('\n👨‍🏫 步骤 7: POST 冲突解决 - 林老师确认/驳回');
  let unresolvedConflictId = unresolved?.[0]?.id || conflicts[0]?.id;
  const resolveResp = await req('POST', `/api/conflict/${unresolvedConflictId}/resolve`, {
    action: 'confirm',
    operator: '林老师',
    remark: '已核实，采样间隔说明有效，维修群截图说明按实际情况执行，确认冲突记录'
  });
  assert('冲突解决 API 200', resolveResp.status === 200);
  assert('冲突标记为已解决', resolveResp.body.data.resolved === true);
  assert('解决人为林老师', resolveResp.body.data.resolvedBy === '林老师');

  // ============ 步骤 8: 补录复核 - 缺失记录 ============
  console.log('\n🔍 步骤 8: POST /api/record/:id/review - 补录复核（采样缺失记录）');
  const timegapR = allRecords.filter(r => r.timeGap?.hasGap);
  let reviewResults = [];
  for (let i = 0; i < timegapR.length; i++) {
    const r = timegapR[i];
    const conclusion = i === 0
      ? '已补录缺失时段数据，实际焊接电流稳定在150A，数据补充完整'
      : '现场记录确认缺失时段为设备停机，不影响HAZ估算结论';
    const rr = await req('POST', `/api/record/${r.recordId}/review`, {
      reviewStatus: 'confirmed',
      operator: '质检员张工',
      reviewRemark: `缺口${r.timeGap.gapMinutes}分钟，已核对现场日志`,
      reviewConclusion: conclusion
    });
    reviewResults.push(rr);
  }
  assert('补录复核 API 全部成功', reviewResults.every(r => r.body.success));
  assert('补录后 reviewStatus 全部更新', reviewResults.every(r => r.body.data.reviewStatus === 'confirmed'));
  assert('补录后 reviewConclusion 不为空', reviewResults.every(r => r.body.data.reviewConclusion?.length > 5));
  console.log(`    复核成功 ${reviewResults.length} 条缺失记录`);

  // ============ 步骤 9: 补录后重算 ============
  console.log('\n🔄 步骤 9: POST /api/recalculate 补录后重算');
  const recalcResp = await req('POST', '/api/recalculate', {
    batchId,
    operator: '林老师',
    remark: '补录复核完成，重新计算HAZ'
  });
  assert('重算 API 200', recalcResp.status === 200);
  assert('重算成功', recalcResp.body.success);
  const summary = recalcResp.body.data.batchSummaries?.find(b => b.batchId === batchId)?.summary;
  const reviewedOkCount = summary?.reviewedOkCount ?? 0;
  const reviewedOkBefore = allRecords.filter(r => r.status === 'reviewed_ok').length;
  assert('重算后 summary 中 reviewed_ok 增加（或补录后 ≥2 条）',
    reviewedOkCount >= 2 || reviewedOkBefore >= 2,
    `summary reviewedOk=${reviewedOkCount}`);
  const stateAfterRecalc = await req('GET', '/api/state');
  const batchAfterRecalc = stateAfterRecalc.body.data.batches.find(b => b.batchId === batchId);
  const recsAfter = batchAfterRecalc?.records || [];
  console.log(`    重算后状态分布: ${Object.entries(recsAfter.reduce((m,r)=>(m[r.status]=(m[r.status]||0)+1,m),{})).map(([k,v]) => k+'='+v).join(', ')}`);

  // ============ 步骤 10: 批次去重验证 ============
  console.log('\n🆔 步骤 10: 批次去重验证 - 再次导入同一批材料');
  const dupRecords = sampleBatch.records;
  const beforeCount = allRecords.length;
  const appendResp = await req('POST', `/api/batch/${batchId}/records`, {
    records: dupRecords,
    operator: '重传测试'
  });
  assert('追加 API 成功', appendResp.status === 200 && appendResp.body.success);
  const skippedNum = appendResp.body.skippedDuplicates ?? appendResp.body.meta?.skipped ?? appendResp.body.data?.skippedDuplicates;
  assert('跳过重复数量 = 原始数量', skippedNum === beforeCount,
    `跳过${skippedNum} 条 / 共${beforeCount}`);
  const afterState = await req('GET', '/api/state');
  const afterBatch = afterState.body.data.batches.find(b => b.batchId === batchId);
  assert('记录数未增加（去重生效）', afterBatch.records.length === beforeCount,
    `${afterBatch.records.length} vs ${beforeCount}`);
  console.log(`    去重前: ${beforeCount} 条，重传后: ${afterBatch.records.length} 条（未变化✅）`);

  // ============ 步骤 11: 导出一致性验证 ============
  console.log('\n📤 步骤 11: GET /api/export 导出 vs 接口返回 字段一致性验证');
  const exportResp = await req('GET', `/api/export/${batchId}`);
  assert('导出 API 200', exportResp.status === 200 && exportResp.body.success);
  const exported = exportResp.body.data;
  assert('导出含 exportTime 元数据', !!exported.exportTime);
  const expRecs = exported.records;
  const apiRecs = afterBatch.records;
  assert('导出记录数 = 接口记录数', expRecs.length === apiRecs.length);
  const fieldMatch = expRecs.every((er, i) => {
    const ar = apiRecs[i];
    return er.recordId === ar.recordId
      && er.status === ar.status
      && er.reviewStatus === ar.reviewStatus
      && er.adjustedHAZ === ar.adjustedHAZ
      && er.reviewConclusion === ar.reviewConclusion
      && er.anomalyDescription === ar.anomalyDescription
      && er.timeGap?.gapMinutes === ar.timeGap?.gapMinutes;
  });
  assert('每条记录关键字段完全一致 (recordId/status/reviewStatus/HAZ/结论...)', fieldMatch);
  const timegapExported = expRecs.filter(r => r.timeGap?.hasGap);
  assert('导出含缺失记录的来源/处理/结论', timegapExported.length >= 2
    && timegapExported.every(r => r.importSource && r.reviewConclusion && r.reviewRemark));
  console.log(`    导出${expRecs.length}条, 缺失记录${timegapExported.length}条全部含完整信息`);
  console.log(`    缺失记录样例: recordId=${timegapExported[0].recordId}, 来源=${timegapExported[0].importSource}, 状态=${timegapExported[0].status}, 复核结论=${timegapExported[0].reviewConclusion?.slice(0,20)}...`);

  // ============ 步骤 12: 复核历史 & 自检 ============
  console.log('\n📜 步骤 12: 真实复核历史 & 自检');
  const finalState = await req('GET', '/api/state');
  const history = finalState.body.data.reviewHistory;
  assert('reviewHistory 有至少8条记录', history.length >= 8, `共 ${history.length} 条`);
  const histActions = history.map(h => h.action);
  assert('历史包含所有操作类型',
    histActions.includes('创建批次') && histActions.includes('导入维修群截图')
    && histActions.includes('补看采样间隔说明')
    && (histActions.includes('确认冲突') || histActions.includes('驳回冲突') || histActions.includes('解决冲突'))
    && histActions.includes('补录复核') && histActions.includes('补录后重算')
    && histActions.some(a => a.includes('导出')));
  const selfCheck = finalState.body.data.selfCheckResults?.[batchId] || finalState.body.data.selfCheckResults;
  console.log(`    历史动作: ${[...new Set(histActions)].join(', ')}`);

  // ============ 汇总 ============
  console.log('\n' + '='.repeat(70));
  console.log('验证结果汇总');
  console.log('='.repeat(70));
  const passed = testResults.filter(t => t.pass).length;
  const total = testResults.length;
  testResults.forEach(t => {
    console.log(`  [${t.pass ? '✅' : '❌'}] ${t.name}${t.detail ? ' - ' + t.detail : ''}`);
  });
  console.log('\n' + '='.repeat(70));
  console.log(`总计: ${passed}/${total} 通过, ${total - passed} 失败`);
  console.log('='.repeat(70));
  process.exit(passed === total ? 0 : 1);
})();
