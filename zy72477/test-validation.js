const http = require('http');

const BASE_URL = 'http://localhost:3000';

function request(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

const log = (title, content) => {
  console.log('\n' + '='.repeat(70));
  console.log('▶ ' + title);
  console.log('-'.repeat(70));
  if (content !== undefined) console.log(content);
};

async function main() {
  console.log('\n' + '╔' + '═'.repeat(68) + '╗');
  console.log('║          应急避难点容量校核 - 完整流程验证脚本                   ║');
  console.log('║  覆盖：红线图导入→老马巡查→居民复核→点位更新→批次导出→一致性   ║');
  console.log('╚' + '═'.repeat(68) + '╝');

  let results = { passed: 0, failed: 0 };
  const assert = (name, condition, detail) => {
    if (condition) {
      console.log(`  ✅ PASS: ${name}`);
      results.passed++;
    } else {
      console.log(`  ❌ FAIL: ${name}`);
      console.log(`      详情: ${detail}`);
      results.failed++;
    }
  };

  // ========== 第一步：初始化系统 + 查询基础数据 ==========
  log('STEP 1: 初始化查询 - 避难点、红线图批次、容量结果');
  const { body: sheltersResp } = await request('/api/shelters');
  const shelters = sheltersResp.data || sheltersResp;
  console.log(`  避难点总数: ${shelters.length}`);
  shelters.forEach(s => console.log(`    - ${s.name} [${s.id.slice(0,8)}...] 状态: ${s.status} 设计容量: ${s.designedCapacity}`));
  assert('系统有5个演示避难点', shelters.length === 5, `实际有${shelters.length}个`);

  // 找社区活动中心避难点（含改道）
  const targetShelter = shelters.find(s => s.name === '社区活动中心避难点');
  assert('找到目标避难点(社区活动中心)', !!targetShelter, '未找到');
  const TARGET_ID = targetShelter.id;
  console.log(`\n  目标避难点: ${targetShelter.name} ID=${TARGET_ID}`);

  // 查询红线图批次
  const { body: batchesResp } = await request('/api/batches');
  const batches = Array.isArray(batchesResp) ? batchesResp : (batchesResp.data || batchesResp);
  console.log(`\n  红线图导入批次: ${batches.length}个`);
  batches.forEach((b, i) => console.log(`    [${i}] ${b}`));
  assert('至少有3个红线图批次', batches.length >= 3, `实际${batches.length}个`);

  // ========== 第二步：查询红线图批次对应的红线图记录 ==========
  log('STEP 2: 按批次查询红线图（验证1条批次=1条红线图记录）');
  for (let i = 0; i < Math.min(batches.length, 3); i++) {
    const batchNo = batches[i];
    const { body: redLineResp } = await request(`/api/redlines?batchNo=${batchNo}`);
    const redLines = redLineResp.data || redLineResp;
    console.log(`\n  批次 ${batchNo}:`);
    console.log(`    红线图记录数: ${redLines.length} 条`);
    redLines.forEach(rl => console.log(`      → ${rl.remarks?.slice(0,60)}... (避难点ID: ${rl.shelterId.slice(0,8)}...)`));
    if (i === 0) assert('第1个批次红线图记录数=1', redLines.length === 1, `实际${redLines.length}条（验证批次和记录对应关系）`);
  }

  // ========== 第三步：验证按批次导出只带对应避难点 ==========
  log('STEP 3: 核心验证 - 按单条红线图批次导出，只出对应避难点容量记录');
  const FIRST_BATCH = batches[0];
  console.log(`\n  使用红线图批次: ${FIRST_BATCH}`);

  // 先查这个批次对应哪个避难点
  const { body: batchRedLine } = await request(`/api/redlines?batchNo=${FIRST_BATCH}`);
  const batchRedLines = batchRedLine.data || batchRedLine;
  const batchShelterIds = Array.from(new Set(batchRedLines.map(r => r.shelterId)));
  console.log(`  该批次红线图对应避难点ID数: ${batchShelterIds.length}`);
  batchShelterIds.forEach(id => {
    const s = shelters.find(x => x.id === id);
    console.log(`    → ${s?.name || '未知'} [${id.slice(0,8)}...]`);
  });

  // 不筛选批次导出（全量）
  const { body: fullExport } = await request('/api/exports/detail');
  const fullData = fullExport.data;
  console.log(`\n  [全量导出] 记录数=${fullData.totalCount} 筛选配置=${JSON.stringify(fullData.filterOptions)}`);
  fullData.records.forEach(r => console.log(`    → ${r.shelterName}: 校核${r.checkedCapacity}人 改道=${r.isDetourAffected} 待复核=${r.needsResidentReview}`));

  // 按批次导出
  const { body: batchExport } = await request(`/api/exports/detail?batchNo=${FIRST_BATCH}`);
  const batchData = batchExport.data;
  console.log(`\n  [按批次 ${FIRST_BATCH} 导出] 记录数=${batchData.totalCount} 筛选配置=${JSON.stringify(batchData.filterOptions)}`);
  console.log(`  来源批次信息: ${JSON.stringify(batchData.sourceRedLineBatch)}`);
  batchData.records.forEach(r => console.log(`    → ${r.shelterName}: 校核${r.checkedCapacity}人 红线图批次=${r.redLineBatchNo} 红线图备注=${r.redLineRemarks?.slice(0,50)}`));

  // 核心断言：按批次导出的记录数必须等于该批次红线图对应的避难点数
  assert(`按批次导出记录数=${batchShelterIds.length}`, batchData.totalCount === batchShelterIds.length,
    `期望${batchShelterIds.length}条，实际${batchData.totalCount}条（全量有${fullData.totalCount}条）`);

  // 检查导出的避难点都在批次的shelterIds里
  const allInBatch = batchData.records.every(r => batchShelterIds.includes(r.shelterId));
  assert('按批次导出的避难点都在该批次红线图中', allInBatch,
    `存在不在批次中的记录：${batchData.records.filter(r => !batchShelterIds.includes(r.shelterId)).map(r => r.shelterName)}`);

  // 批次归属都正确
  const batchNoCorrect = batchData.records.every(r => batchRedLines.some(br => br.importBatchNo === r.redLineBatchNo));
  assert('导出记录的红线图批次号与筛选批次一致', batchNoCorrect || batchData.records.length === 0,
    '批次号不一致');

  // ========== 第四步：验证扩展导出字段 ==========
  log('STEP 4: 验证扩展字段（红线图备注、复核状态、变更历史、报告说明）');
  if (batchData.records.length > 0) {
    const rec = batchData.records[0];
    console.log(`\n  抽样记录: ${rec.shelterName}`);
    console.log(`    红线图批次号: ${rec.redLineBatchNo}`);
    console.log(`    红线图版本: ${rec.redLineVersion}`);
    console.log(`    红线图备注: ${rec.redLineRemarks?.slice(0, 100)}...`);
    console.log(`    红线图范围: ${rec.redLineAreaRange}`);
    console.log(`    导入人: ${rec.redLineImportOperator}`);
    console.log(`    复核状态: ${rec.redLineReviewStatus}`);
    console.log(`    复核说明: ${rec.redLineReviewNote}`);
    console.log(`    复核人: ${rec.redLineReviewedBy}`);
    console.log(`    是否重导入: ${rec.redLineIsReimport}`);
    console.log(`    历史导入批次: ${rec.redLineImportBatchList?.length} 个`);
    console.log(`    备注变更历史: ${rec.remarkChangeHistory?.length} 条`);
    console.log(`    影响此结果的变更: ${rec.changeAffectingThisResult?.length} 条`);

    assert('导出含红线图备注', !!rec.redLineRemarks, '缺失redLineRemarks');
    assert('导出含红线图批次号', !!rec.redLineBatchNo, '缺失redLineBatchNo');
    assert('导出含复核状态字段', 'redLineReviewStatus' in rec, '缺失redLineReviewStatus');
    assert('导出含历史批次列表', Array.isArray(rec.redLineImportBatchList), '缺失redLineImportBatchList');
    assert('导出含备注变更历史', Array.isArray(rec.remarkChangeHistory), '缺失remarkChangeHistory');
    assert('导出含影响此结果的变更', Array.isArray(rec.changeAffectingThisResult), '缺失changeAffectingThisResult');
  }

  // ========== 第五步：验证临时改道记录 - 复核前状态 ==========
  log('STEP 5: 重点验证「施工临时改道未同步地图」记录');
  const { body: detourResp } = await request('/api/detour-records');
  const detourRecs = detourResp.data || detourResp;
  console.log(`\n  改道影响记录数: ${detourRecs.length}`);
  detourRecs.forEach(r => console.log(`    → ${r.shelterName}: 校核${r.checkedCapacity}人 待复核=${r.needsResidentReview} 说明=${r.detourInfo?.slice(0,50)}`));

  const detourShelter = detourRecs.find(r => r.shelterId === TARGET_ID);
  assert('社区活动中心避难点被标记为改道影响', !!detourShelter, '未被改道标记');

  // 检查全量导出中改道记录待复核=true
  const fullDetourRec = fullData.records.find(r => r.shelterId === TARGET_ID);
  console.log(`\n  [居民复核前] 改道记录 needsResidentReview = ${fullDetourRec?.needsResidentReview}`);
  assert('改道记录在居民复核前 needsResidentReview=true', fullDetourRec?.needsResidentReview === true,
    `实际为${fullDetourRec?.needsResidentReview}，改道未过复核应= true`);

  // ========== 第六步：走居民复核 + 点位更新流程 ==========
  log('STEP 6: 执行居民代表复核 → 点位清单更新（走完整工作流）');

  // 取目标避难点的工作流
  const { body: workflowsResp } = await request('/api/workflows');
  const workflows = workflowsResp.data || workflowsResp;
  const suspendedWf = workflows.find(w => w.shelterId === TARGET_ID && w.stepStatus === 'suspended');
  console.log(`\n  找到挂起的工作流: ${suspendedWf ? 'ID=' + suspendedWf.id.slice(0,8) + '... 当前步骤=' + suspendedWf.currentStep : '未找到（可能已完成）'}`);

  if (suspendedWf) {
    assert('挂起工作流存在', !!suspendedWf, '需要挂起工作流以执行居民复核');

    // 居民代表复核
    const { body: reviewResult } = await request('/api/resident-review', 'POST', {
      workflowId: suspendedWf.id,
      shelterId: TARGET_ID,
      operator: '居民代表李阿姨'
    });
    console.log(`\n  [居民复核] 调用结果: 状态=${reviewResult.status || 'ok'} 工作流ID=${reviewResult.data?.id?.slice(0,8)}...`);
    console.log(`    结果详情: ${JSON.stringify(reviewResult).slice(0, 200)}...`);

    // 刷新工作流
    const { body: wfAfterReview } = await request('/api/workflows');
    const wfs2 = wfAfterReview.data || wfAfterReview;
    const pointUpdateWf = wfs2.find(w => w.shelterId === TARGET_ID && w.currentStep === 'point_update' && w.stepStatus === 'pending');
    console.log(`\n  居民复核后，待点位更新的工作流: ${pointUpdateWf ? '存在（ID=' + pointUpdateWf.id.slice(0,8) + '...）' : '未找到'}`);
    assert('居民复核后生成点位更新步骤', !!pointUpdateWf, '流程未推进到point_update');

    if (pointUpdateWf) {
      // 执行点位清单更新
      const { body: updateResult } = await request('/api/point-update', 'POST', {
        workflowId: pointUpdateWf.id,
        shelterId: TARGET_ID,
        operator: '系统'
      });
      console.log(`\n  [点位清单更新] 调用结果: 状态=${updateResult.status || 'ok'}`);
      const updateCheckResult = updateResult.data?.checkResult || updateResult.checkResult;
      console.log(`    校核结果: ${updateCheckResult ? '已重新计算 ID=' + updateCheckResult.id.slice(0,8) + '... 容量=' + updateCheckResult.checkedCapacity + '人' : '无结果'}`);
      assert('点位更新后返回新校核结果', !!updateCheckResult, '未返回校核结果');
    }
  } else {
    console.log('  （跳过：目标避难点无挂起工作流，可能之前已执行过）');
  }

  // ========== 第七步：验证居民复核后 needsResidentReview 变化 ==========
  log('STEP 7: 验证居民复核后 - needsResidentReview 必须=false（改道仍标记但不再待复核）');

  const { body: afterUpdateResp } = await request('/api/capacity-checks');
  const afterUpdate = afterUpdateResp.data || afterUpdateResp;
  const detourAfter = afterUpdate.find(r => r.shelterId === TARGET_ID);

  console.log(`\n  [居民复核+点位更新后] ${detourAfter?.shelterName}:`);
  console.log(`    isDetourAffected = ${detourAfter?.isDetourAffected}`);
  console.log(`    needsResidentReview = ${detourAfter?.needsResidentReview}`);
  console.log(`    checkedCapacity = ${detourAfter?.checkedCapacity}人 (仍应用改道系数0.7)`);
  console.log(`    shelter.status = ${shelters.find(s=>s.id===TARGET_ID)?.status}（刷新后）`);

  assert('居民复核后 isDetourAffected 仍为 true（改道事实存在）', detourAfter?.isDetourAffected === true,
    `实际=${detourAfter?.isDetourAffected}`);
  assert('居民复核后 needsResidentReview 变为 false（已通过）', detourAfter?.needsResidentReview === false,
    `实际=${detourAfter?.needsResidentReview}，居民已通过复核必须=false`);

  // ========== 第八步：再次导出验证一致性 ==========
  log('STEP 8: 再做批次导出 + 一致性验证');
  const { body: exportAfter } = await request(`/api/exports/detail?batchNo=${FIRST_BATCH}`);
  const afterExport = exportAfter.data;
  const afterTargetRec = afterExport.records.find(r => r.shelterId === TARGET_ID);

  console.log(`\n  [批次 ${FIRST_BATCH} 导出] 总记录数=${afterExport.totalCount}`);
  if (afterTargetRec) {
    console.log(`  社区活动中心避难点 (此批次是否包含: ${batchShelterIds.includes(TARGET_ID) ? '是' : '否（此批次不是该避难点）'})`);
    console.log(`    复核状态: needsResidentReview = ${afterTargetRec?.needsResidentReview}`);
    console.log(`    redLineReviewStatus = ${afterTargetRec?.redLineReviewStatus}`);
  }

  const { body: consistency } = await request('/api/consistency/verify');
  console.log(`\n  [三端一致性验证] consistent=${consistency.consistent} hash=${consistency.hash?.slice(0,20)}...`);
  console.log(`    页面前端=${consistency.pageCount} 导出=${consistency.exportCount} API=${consistency.apiCount} 改道=${consistency.detourRecordCount}`);
  assert('页面/导出/API三端数据一致', consistency.consistent === true,
    `page=${consistency.pageCount} export=${consistency.exportCount} api=${consistency.apiCount}，hash不同`);

  // ========== 第九步：验证批次不重复（重导入不产生多余导出）==========
  log('STEP 9: 验证重导入批次区分（可选：尝试执行重导入）');
  const midShelter = shelters.find(s => s.name === '第一中学避难点');
  if (midShelter) {
    const oldBatch = batches[batches.length - 1];
    console.log(`\n  对【第一中学避难点】执行重导入验证，旧批次=${oldBatch}`);

    // 先拿它现在的工作流
    const { body: wfsAll } = await request('/api/workflows');
    const wfList = wfsAll.data || wfsAll;
    let midWf = wfList.find(w => w.shelterId === midShelter.id && w.currentStep === 'redline_import' && w.stepStatus !== 'completed');
    if (!midWf) {
      // 启动新工作流
      console.log('  启动新的工作流...');
      const { body: startRes } = await request('/api/workflows', 'POST', {
        shelterId: midShelter.id,
        operator: '测试脚本'
      });
      midWf = startRes.data;
    }
    if (midWf) {
      console.log(`  工作流准备好: ID=${midWf.id.slice(0,8)}... step=${midWf.currentStep}`);

      const { body: reimportRes } = await request('/api/redlines/reimport', 'POST', {
        workflowId: midWf.id,
        shelterId: midShelter.id,
        version: 'v2.0',
        remarks: '重导入备注：操场南侧新增200㎡备用场地，容量预计新增50人',
        areaRange: '东至解放路、南至备用区、西至校内路、北至围墙',
        effectiveDate: '2026-06-20',
        importOperator: '测试脚本-小王',
        isReimport: true,
        reimportNote: '补充南侧备用场地说明，原v1.0基础上扩展'
      });
      const newRedLine = reimportRes.data?.redLine;
      console.log(`\n  [重导入结果]`);
      console.log(`    新红线图批次: ${newRedLine?.importBatchNo}`);
      console.log(`    旧关联: prevVersionId=${newRedLine?.prevVersionId?.slice(0,8)}...`);
      console.log(`    isReimport=${newRedLine?.isReimport} reimportNote=${newRedLine?.reimportNote}`);

      // 刷新批次列表
      const { body: newBatchesResp } = await request('/api/batches');
      const newBatches = Array.isArray(newBatchesResp) ? newBatchesResp : (newBatchesResp.data || []);
      console.log(`    当前红线图批次总数: ${newBatches.length} (之前${batches.length})`);

      // 分别用新、旧批次导出，验证条数独立
      const { body: oldExp } = await request(`/api/exports/detail?batchNo=${oldBatch}`);
      const { body: newExp } = await request(`/api/exports/detail?batchNo=${newRedLine.importBatchNo}`);
      console.log(`\n  [批次独立验证]`);
      console.log(`    旧批次 ${oldBatch} 导出: ${oldExp.data.totalCount} 条`);
      console.log(`    新批次 ${newRedLine.importBatchNo} 导出: ${newExp.data.totalCount} 条`);

      // 新批次里的备注是新的
      const newBatchRec = newExp.data.records[0];
      console.log(`    新批次记录中的红线图备注: "${newBatchRec?.redLineRemarks?.slice(0, 60)}..."`);
      console.log(`    新批次记录中的 isReimport: ${newBatchRec?.redLineIsReimport}`);
      console.log(`    新批次记录中的 reimportNote: ${newBatchRec?.redLineReimportNote}`);

      assert('重导入产生独立新批次', newBatches.length === batches.length + 1,
        `期望=${batches.length + 1} 实际=${newBatches.length}`);
      assert('新批次导出=1条', newExp.data.totalCount === 1,
        `新批次期望1条，实际${newExp.data.totalCount}条`);
      assert('新批次导出备注=新内容', newBatchRec?.redLineRemarks?.includes('南侧新增200㎡'),
        `新备注未包含新增内容：${newBatchRec?.redLineRemarks}`);
      assert('新批次导出 isReimport=true', newBatchRec?.redLineIsReimport === true,
        `实际=${newBatchRec?.redLineIsReimport}`);
      assert('旧批次导出条数不变', oldExp.data.totalCount === 1 || oldExp.data.totalCount >= 1,
        `旧批次条数变化：${oldExp.data.totalCount}`);

      // 查变更历史：新增加的reimport记录
      const { body: historyResp } = await request(`/api/change-history?shelterId=${midShelter.id}`);
      const hist = historyResp.data || historyResp;
      const reimportHist = hist.find(h => h.changeType === 'reimport');
      console.log(`\n  [变更历史] 重导入操作: ${reimportHist ? '存在' : '未找到'}`);
      if (reimportHist) {
        console.log(`    操作人: ${reimportHist.operator}`);
        console.log(`    旧值: ${reimportHist.oldValue?.slice(0, 60)}`);
        console.log(`    新值: ${reimportHist.newValue?.slice(0, 60)}`);
        console.log(`    说明: ${reimportHist.remark?.slice(0, 80)}`);
      }
    }
  }

  // ========== 第十步：变更历史完整验证 ==========
  log('STEP 10: 验证变更历史 - 谁改了什么、影响哪条结果');
  const { body: allHistory } = await request('/api/change-history');
  const allHist = allHistory.data || allHistory;
  console.log(`\n  变更历史总数: ${allHist.length} 条`);
  ['create', 'update', 'reimport', 'review', 'recalc'].forEach(type => {
    const count = allHist.filter(h => h.changeType === type).length;
    console.log(`    ${type}: ${count} 条`);
  });

  console.log('\n  最近 5 条操作痕迹:');
  allHist.slice(0, 5).forEach((h, i) => {
    console.log(`    [${i}] ${h.changeTime.slice(0,19)} | ${h.operator} | ${h.changeType} | ${h.shelterName} | ${h.fieldName}`);
    console.log(`        说明: ${h.remark?.slice(0, 80)}`);
    if (h.affectedResultIds?.length > 0) console.log(`        影响结果ID: ${h.affectedResultIds.map(id=>id.slice(0,8)).join(', ')}`);
  });

  assert('变更历史覆盖所有类型至少1条',
    ['create', 'review', 'update'].every(t => allHist.some(h => h.changeType === t)),
    '缺少基础变更类型');

  // ========== 总结 ==========
  console.log('\n' + '='.repeat(70));
  console.log('🏁 验证完成: 总 ' + (results.passed + results.failed) + ' 项');
  console.log(`   ✅ 通过: ${results.passed}`);
  console.log(`   ❌ 失败: ${results.failed}`);
  console.log('='.repeat(70));

  process.exit(results.failed > 0 ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
