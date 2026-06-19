#!/usr/bin/env node
// ========================================================================
// 指数平滑销量预测系统 - 端到端可复现验证脚本
// 覆盖：真实 CSV 上传 → 第一次导入 → 重复导入 → 补录/修正 → 保存
//       → 刷新（重读接口） → 重算 → 结果展示 → 历史记录 → 导出明细
// 重点断言：
//   1. 同一条 productId (REAL-003) 贯穿全链路（不再落回 PROD-DEMO-xxx）
//   2. 混合格式原始值（70%、0.4、25%）在 展示/接口/导出 三处一致
//   3. 自检 4 项状态由真实事件驱动（初始 pending、导入后变化）
//   4. 导出明细内容哈希与当前结果一致、无演示数据
// ========================================================================

import http from 'node:http';
import { writeFileSync, mkdirSync, existsSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = 'http://127.0.0.1:3001/api';
const OUT_DIR = path.join(__dirname, '..', 'e2e_output');
if (!existsSync(OUT_DIR)) mkdirSync(OUT_DIR, { recursive: true });

// ================ 断言工具 ================
let passed = 0;
let failed = 0;
function assert(cond, name, detail = '') {
  if (cond) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.log(`  ❌ ${name}`);
    if (detail) console.log(`       详情：${detail}`);
    failed++;
  }
}
function section(title) {
  console.log(`\n${'='.repeat(70)}\n📋 ${title}\n${'='.repeat(70)}`);
}

// ================ HTTP 工具 ================
function request(method, urlPath, { body, form, headers = {} } = {}) {
  return new Promise((resolve, reject) => {
    let payload;
    let hdrs = { ...headers };
    if (form) {
      payload = form.buffer;
      hdrs = { ...hdrs, ...form.headers };
    } else if (body !== undefined) {
      payload = JSON.stringify(body);
      hdrs['Content-Type'] = 'application/json';
    }
    const u = new URL(BASE + urlPath);
    const req = http.request(
      { method, hostname: u.hostname, port: u.port, path: u.pathname + u.search, headers: hdrs },
      (res) => {
        const chunks = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const buf = Buffer.concat(chunks);
          const isJson = (res.headers['content-type'] || '').includes('application/json');
          resolve({
            status: res.statusCode,
            headers: res.headers,
            json: isJson ? JSON.parse(buf.toString('utf8')) : null,
            buffer: buf,
            text: buf.toString('utf8'),
          });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// 构造 multipart/form-data
function buildFormData(fields, files) {
  const boundary = '----E2EBoundary' + Date.now().toString(36);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`
    );
  }
  for (const { field, filename, mime, content } of files) {
    parts.push(
      `--${boundary}\r\nContent-Disposition: form-data; name="${field}"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`
    );
    parts.push(Buffer.isBuffer(content) ? content : Buffer.from(content, 'utf8'));
    parts.push('\r\n');
  }
  parts.push(`--${boundary}--\r\n`);
  const all = parts.map((p) => (Buffer.isBuffer(p) ? p : Buffer.from(p, 'utf8')));
  return {
    buffer: Buffer.concat(all),
    headers: { 'Content-Type': `multipart/form-data; boundary=${boundary}` },
  };
}

// ================ 样例 CSV 生成 ================
// 关键点：REAL-003 混合格式（70% 百分数、0.4 小数、25% 百分数）
const SAMPLE_CSV_V1 = `\ufeff产品ID,产品名称,alpha,beta,gamma,预测结论
REAL-001,春季薄款卫衣,0.3,0.2,0.15,1100
REAL-002,纯棉印花T恤,0.5,0.3,0.2,950
REAL-003,户外速干短裤,70%,0.4,25%,720
REAL-004,防紫外线遮阳帽,0.6,0.4,0.3,580
REAL-005,冰丝凉感防晒衣,0.45,0.25,0.2,1850
`;

// 第二次导入：REAL-003 覆盖修正、REAL-002 重复、新增 REAL-006
const SAMPLE_CSV_V2 = `\ufeffproductId,productName,α,β,γ,forecastConclusion
REAL-001,春季薄款卫衣,0.32,0.2,0.15,1150
REAL-002,纯棉印花T恤,0.55,0.3,0.2,980
REAL-003,户外速干短裤,75%,0.45,30%,760
REAL-004,防紫外线遮阳帽,0.6,0.4,0.3,580
REAL-005,冰丝凉感防晒衣,0.45,0.25,0.2,1850
REAL-006,轻便透气跑鞋,0.5,0.35,0.25,2400
`;

// 手算反例 CSV（与参数表冲突，REAL-002、REAL-003、REAL-006）
const COUNTER_CSV = `\ufeffsku,商品名,手算反例,理由
REAL-002,纯棉印花T恤,1150,618预热期抖音种草点击率超预期，加权上调21%
REAL-003,户外速干短裤,680,南方雨季推迟、户外场景占比下降约5%，重新核算
REAL-006,轻便透气跑鞋,2100,竞品同期上新导致分流，原参数预测偏乐观
`;

// ================ 主流程 ================
async function main() {
  console.log('\n🚀 指数平滑销量预测 - E2E 全流程验证');
  console.log(`   基准 API: ${BASE}`);
  console.log(`   样例关键 productId: REAL-003（混合 70% / 0.4 / 25%）`);

  // --- 前置检查：服务是否启动 ---
  section('前置：服务健康检查');
  try {
    const r = await request('GET', '/forecast/metadata');
    assert(r.status === 200, '后端服务响应正常', `status=${r.status}`);
  } catch (e) {
    console.log(`  ❌ 无法连接到 ${BASE}，请先执行 npm run dev 或单独启动后端`);
    console.log(`       错误：${e.message}`);
    process.exit(1);
  }

  // --- 阶段 0：初始状态自检（应全部 pending） ---
  section('阶段 0：初始状态自检 - 全部 pending（未触发不可判定）');
  const initial = await request('GET', '/forecast/self-check');
  const initItems = initial.json?.data?.items || [];
  const initOverall = initial.json?.data?.overallStatus;
  assert(initOverall === 'pending', `总体状态 = pending（实际 ${initOverall}）`);
  for (const id of ['duplicate-imports', 'mixed-format', 'recalculation', 'export-consistency']) {
    const it = initItems.find((i) => i.id === id);
    assert(it?.status === 'pending', `[${id}] status = pending（实际 ${it?.status}）`, it?.message);
  }
  writeFileSync(path.join(OUT_DIR, '00_initial_selfcheck.json'), JSON.stringify(initial.json, null, 2));

  // --- 阶段 1：第一次导入参数 ---
  section('阶段 1：第一次导入参数（CSV，含 REAL-003 混合格式）');
  const up1 = buildFormData(
    { strategy: 'overwrite', importedBy: 'E2E-测试脚本' },
    [{ field: 'file', filename: 'params-v1.csv', mime: 'text/csv', content: SAMPLE_CSV_V1 }]
  );
  const r1 = await request('POST', '/forecast/parameters/upload', { form: up1 });
  assert(r1.status === 200 && r1.json?.success, '上传接口 200 且 success=true', r1.json?.error || r1.text.slice(0, 200));
  const d1 = r1.json.data;
  assert(d1.importedCount === 5, `成功导入 5 条（实际 ${d1.importedCount}）`);
  assert(d1.duplicateCount === 0, `重复数据 = 0（实际 ${d1.duplicateCount}）`);
  assert(d1.mixedFormatCount === 1, `混合格式 = 1（实际 ${d1.mixedFormatCount}）`);
  assert(Array.isArray(d1.mixedProductIds) && d1.mixedProductIds.includes('REAL-003'), '混合格式命中 REAL-003', String(d1.mixedProductIds));
  assert(d1.batchId, `返回了批次 ID = ${d1.batchId}`);
  console.log(`  📎 批次号：${d1.batchId}`);
  writeFileSync(path.join(OUT_DIR, '01_import_v1.json'), JSON.stringify(d1, null, 2));

  // --- 阶段 1.5：GET /parameters 验证 latest ---
  section('GET /parameters 验证 latest 数据');
  const params1 = await request('GET', '/forecast/parameters');
  const latest1 = params1.json?.data?.records || [];
  assert(latest1.length === 5, `latest 条数 = 5（实际 ${latest1.length}）`);
  const rec3v1 = latest1.find((r) => r.productId === 'REAL-003');
  assert(rec3v1, '存在 REAL-003 记录');
  assert(rec3v1?.rawAlpha === '70%', `REAL-003 rawAlpha = 70%（实际 ${rec3v1?.rawAlpha}）`);
  assert(rec3v1?.rawBeta === '0.4', `REAL-003 rawBeta = 0.4（实际 ${rec3v1?.rawBeta}）`);
  assert(rec3v1?.rawGamma === '25%', `REAL-003 rawGamma = 25%（实际 ${rec3v1?.rawGamma}）`);
  assert(rec3v1?.valueFormat === 'mixed', `REAL-003 valueFormat = mixed（实际 ${rec3v1?.valueFormat}）`);
  assert(rec3v1?.hasMixedFormat === true, 'REAL-003 hasMixedFormat = true');
  assert(rec3v1?.nextOwner === '活动负责人', `下一步找 = 活动负责人（实际 ${rec3v1?.nextOwner}）`);
  assert(rec3v1?.version === 1, `REAL-003 version = 1（实际 ${rec3v1?.version}）`);
  writeFileSync(path.join(OUT_DIR, '02_latest_after_v1.json'), JSON.stringify(latest1, null, 2));

  // 验证：**不存在 PROD-DEMO-xxx 演示数据**
  const hasDemo = latest1.some((r) => r.productId.startsWith('PROD-DEMO'));
  assert(!hasDemo, '结果中不存在 PROD-DEMO-xxx 演示数据（证明真吃用户 CSV）');

  // --- 阶段 2：重复导入（CSV V2，覆盖策略） ---
  section('阶段 2：重复导入（CSV V2，覆盖策略）');
  const up2 = buildFormData(
    { strategy: 'overwrite', importedBy: 'E2E-测试脚本' },
    [{ field: 'file', filename: 'params-v2.csv', mime: 'text/csv', content: SAMPLE_CSV_V2 }]
  );
  const r2 = await request('POST', '/forecast/parameters/upload', { form: up2 });
  const d2 = r2.json?.data;
  assert(d2.importedCount === 6, `成功导入 6 条（实际 ${d2.importedCount}）`);
  assert(d2.duplicateCount === 5, `重复 5 条（实际 ${d2.duplicateCount}）`);
  assert(d2.overwrittenCount === 5, `覆盖 5 条（实际 ${d2.overwrittenCount}）`);
  assert(d2.mixedFormatCount === 1, `混合格式仍为 1 条（REAL-003 还是混合）`);

  // latest 重读
  const latest2 = (await request('GET', '/forecast/parameters')).json?.data?.records || [];
  const rec3v2 = latest2.find((r) => r.productId === 'REAL-003');
  assert(rec3v2?.version === 2, `REAL-003 version++ → 2（实际 ${rec3v2?.version}）`);
  assert(rec3v2?.source === 'overwritten', `REAL-003 source = overwritten（实际 ${rec3v2?.source}）`);
  assert(rec3v2?.changeReason === '重复导入覆盖', `changeReason = 重复导入覆盖`);
  assert(rec3v2?.previousValues?.rawAlpha === '70%', `previousValues.rawAlpha = 70%（可追溯）`);
  assert(rec3v2?.rawAlpha === '75%', `新 rawAlpha = 75%（实际 ${rec3v2?.rawAlpha}）`);
  assert(rec3v2?.rawGamma === '30%', `新 rawGamma = 30%（实际 ${rec3v2?.rawGamma}）`);
  assert(latest2.find((r) => r.productId === 'REAL-006'), '存在 REAL-006 新记录');
  writeFileSync(path.join(OUT_DIR, '03_latest_after_v2.json'), JSON.stringify(latest2, null, 2));

  // GET /parameters/all 验证历史版本都保留
  const allRecs = (await request('GET', '/forecast/parameters/all')).json?.data?.records || [];
  const rec3All = allRecs.filter((r) => r.productId === 'REAL-003');
  assert(rec3All.length >= 2, `REAL-003 历史版本 ≥ 2（实际 ${rec3All.length}，版本号保留可追溯）`);

  // --- 阶段 3：补录/修正 REAL-003（gamma 30% → 0.35，改结论） ---
  section('阶段 3：补录/修正 REAL-003（人工复核后调整）');
  const upd = await request('POST', '/forecast/parameters/update', {
    body: {
      productId: 'REAL-003',
      rawAlpha: '75%',
      rawBeta: '0.45',
      rawGamma: '0.35',
      forecastConclusion: '780',
      reason: '活动负责人复核：gamma 统一为小数 0.35；并叠加抖音达人合作加成 +20 件',
      operator: 'E2E-活动负责人',
    },
  });
  assert(upd.json?.success, '参数修正接口 success=true', upd.json?.error);
  const recAfterUpd = upd.json?.data;
  assert(recAfterUpd?.source === 'corrected', `修正后 source = corrected（实际 ${recAfterUpd?.source}）`);
  assert(recAfterUpd?.version === 3, `修正后 version = 3（实际 ${recAfterUpd?.version}）`);
  assert(recAfterUpd?.rawGamma === '0.35', `修正后 rawGamma = 0.35（实际 ${recAfterUpd?.rawGamma}）`);
  assert(recAfterUpd?.previousValues?.rawGamma === '30%', `修正前 previousValues.rawGamma = 30%（保留）`);
  assert(recAfterUpd?.changeReason?.includes('达人合作'), '修正理由已写入');
  assert(recAfterUpd?.lastModifiedBy === 'E2E-活动负责人', `lastModifiedBy = E2E-活动负责人`);
  writeFileSync(path.join(OUT_DIR, '04_after_correction.json'), JSON.stringify(recAfterUpd, null, 2));

  // 验证 latest 变了（GET /parameters 模拟刷新）
  const latest3 = (await request('GET', '/forecast/parameters')).json?.data?.records || [];
  const rec3v3 = latest3.find((r) => r.productId === 'REAL-003');
  assert(rec3v3?.version === 3, '刷新后 GET /parameters 中 REAL-003 version=3');

  // --- 阶段 4：导入反例并处理冲突 ---
  section('阶段 4：导入手算反例 + 自动冲突检测');
  const upC = buildFormData(
    { submittedBy: 'E2E-数据分析师小祁' },
    [{ field: 'file', filename: 'counter-examples.csv', mime: 'text/csv', content: COUNTER_CSV }]
  );
  const rc = await request('POST', '/forecast/counter-examples/upload', { form: upC });
  assert(rc.json?.success, '反例上传成功', rc.json?.error);
  const conflicts = (await request('GET', '/forecast/conflicts')).json?.data || [];
  assert(conflicts.length >= 3, `检测到 ≥3 个冲突（实际 ${conflicts.length}）`);
  const c3 = conflicts.find((c) => c.productId === 'REAL-003');
  assert(c3, 'REAL-003 存在冲突');
  assert(c3?.status === 'pending', `冲突初始 status = pending（实际 ${c3?.status}）`);
  console.log(`  📌 REAL-003 参数=${c3?.parameterValue} 手算=${c3?.exampleValue} 差异=${c3?.diffPercentage?.toFixed?.(2)}%`);

  // 解决两个冲突：REAL-002 accept（采纳手算）、REAL-003 reject（维持参数）
  const resolve2 = await request('POST', `/forecast/conflicts/${c3.id}/resolve`, {
    body: { resolution: 'reject_example', reason: '复核手算理由：雨季推迟影响已在 gamma=0.35 中体现，驳回', resolvedBy: 'E2E-小祁' },
  });
  const c2 = conflicts.find((c) => c.productId === 'REAL-002');
  await request('POST', `/forecast/conflicts/${c2.id}/resolve`, {
    body: { resolution: 'accept_example', reason: '确认抖音种草已落地，采纳手算值 1150', resolvedBy: 'E2E-小祁' },
  });
  const c6 = conflicts.find((c) => c.productId === 'REAL-006');
  await request('POST', `/forecast/conflicts/${c6.id}/resolve`, {
    body: { resolution: 'accept_example', reason: '竞品分流属实，采纳 2100', resolvedBy: 'E2E-小祁' },
  });

  // --- 阶段 5：计算（重算） ---
  section('阶段 5：执行指数平滑计算（POST /calculate）');
  const calc = await request('POST', '/forecast/calculate');
  assert(calc.json?.success, '计算接口 success=true', calc.json?.error);
  const results = calc.json?.data || [];
  assert(results.length >= 6, `计算结果 ≥6 条（实际 ${results.length}）`);
  writeFileSync(path.join(OUT_DIR, '05_forecast_results.json'), JSON.stringify(results, null, 2));

  // 验证：结果中 REAL-003 的关键信息（混合格式 + 取舍理由）
  const f3 = results.find((r) => r.productId === 'REAL-003');
  assert(f3, '结果中存在 REAL-003');
  assert(!f3.productId.startsWith('PROD-DEMO'), '结果中 key 记录不是 PROD-DEMO-xxx');
  assert(f3.rawAlpha === '75%', `Forecast rawAlpha = 75%（实际 ${f3.rawAlpha}）`);
  assert(f3.rawBeta === '0.45', `Forecast rawBeta = 0.45（实际 ${f3.rawBeta}）`);
  assert(f3.rawGamma === '0.35', `Forecast rawGamma = 0.35（实际 ${f3.rawGamma}）`);
  assert(typeof f3.parsedAlpha === 'number' && f3.parsedAlpha > 0, `parsedAlpha 已归一化 = ${f3.parsedAlpha}`);
  assert(typeof f3.parsedGamma === 'number' && f3.parsedGamma > 0, `parsedGamma 已归一化 = ${f3.parsedGamma}`);
  assert(f3.parameterVersion, `参数版本存在 = ${f3.parameterVersion}`);
  assert(f3.tradeoffReason && f3.tradeoffReason.length > 0, `取舍理由非空（${f3.tradeoffReason.slice(0, 60)}...）`);
  assert(f3.importBatch && f3.importBatch.startsWith('BATCH-'), `importBatch = ${f3.importBatch}`);
  assert(f3.recalculationCount >= 1, `recalculationCount ≥1（实际 ${f3.recalculationCount}）`);
  assert(Array.isArray(f3.reviewChain) && f3.reviewChain.length >= 2, `复核链路 ≥2 步（实际 ${f3.reviewChain?.length}）`);
  // 修正链路节点检查
  const hasCorrectedStage = f3.reviewChain.some((s) => s.stage === 'corrected');
  const hasDupStage = f3.reviewChain.some((s) => s.stage === 'duplicate_handled');
  assert(hasCorrectedStage, '复核链路包含 corrected 节点（来自补录/修正）');
  assert(hasDupStage, '复核链路包含 duplicate_handled 节点（来自重复导入覆盖）');

  // 冲突决策信息（REAL-003 驳回）
  assert(f3.conflictDecision, 'REAL-003 含冲突决策信息');
  assert(f3.conflictDecision.resolution === 'reject_example', `决策 = reject_example（实际 ${f3.conflictDecision.resolution}）`);
  assert(f3.conflictDecision.changeReason?.includes('驳回'), `决策理由含"驳回"`);

  // GET /results 验证展示和接口一致
  const getResults = (await request('GET', '/forecast/results')).json?.data || [];
  const gf3 = getResults.find((r) => r.productId === 'REAL-003');
  assert(gf3 && gf3.rawAlpha === '75%' && gf3.rawGamma === '0.35', 'GET /results 中 REAL-003 与计算返回完全一致');

  // --- 阶段 6：审计日志 / 历史记录 ---
  section('阶段 6：审计日志（导入/覆盖/修正/计算/冲突 全链路）');
  const logs = (await request('GET', '/forecast/audit-logs?limit=200')).json?.data || [];
  assert(logs.length >= 10, `审计日志 ≥10 条（实际 ${logs.length}）`);
  const has = (act) => logs.some((l) => l.action === act);
  assert(has('parameter.import'), '存在 parameter.import');
  assert(has('parameter.overwritten_duplicate'), '存在 parameter.overwritten_duplicate（重复覆盖轨迹）');
  assert(has('parameter.update'), '存在 parameter.update（补录修正轨迹）');
  assert(has('counterexample.import'), '存在 counterexample.import');
  assert(has('forecast.calculated'), '存在 forecast.calculated');
  // 只关心 REAL-003 的所有轨迹
  const logs_003 = logs.filter((l) => Array.isArray(l.productIds) && l.productIds.includes('REAL-003'));
  assert(logs_003.length >= 4, `REAL-003 单独轨迹 ≥4 条（实际 ${logs_003.length}：导入/覆盖/修正/计算）`);
  writeFileSync(path.join(OUT_DIR, '06_audit_logs.json'), JSON.stringify(logs.slice(0, 30), null, 2));

  // --- 阶段 7：自检状态（导入/修正/计算后变化） ---
  section('阶段 7：自检 - 导入/修正/计算后真实状态');
  const sc1 = await request('GET', '/forecast/self-check');
  const scItems = sc1.json?.data?.items || [];
  const scOverall = sc1.json?.data?.overallStatus;
  writeFileSync(path.join(OUT_DIR, '07_selfcheck_before_export.json'), JSON.stringify(sc1.json, null, 2));

  const dup = scItems.find((i) => i.id === 'duplicate-imports');
  const mix = scItems.find((i) => i.id === 'mixed-format');
  const recalc = scItems.find((i) => i.id === 'recalculation');
  const exp = scItems.find((i) => i.id === 'export-consistency');

  assert(dup.status !== 'pending', `[duplicate-imports] 已触发（实际 ${dup.status}）`);
  assert(dup.triggeredCount >= 1, `duplicate-imports.triggeredCount ≥1（实际 ${dup.triggeredCount}）`);
  assert(Array.isArray(mix.affectedProducts) && mix.affectedProducts.includes('REAL-003'), '[mixed-format] 命中 REAL-003');
  assert(recalc.status === 'pass' || recalc.status === 'warning', `[recalculation] 非 pending（实际 ${recalc.status}）`);
  assert(exp.status === 'pending', `[export-consistency] 尚未导出 → pending（实际 ${exp.status}）`);
  console.log(`  📝 自检导出项 = ${exp.status}，说明：${exp.message}`);

  // --- 阶段 8：导出明细 ---
  section('阶段 8：导出明细（验证 hash + 内容）');
  const exportRes = await request('GET', '/export/details');
  assert(exportRes.status === 200, `导出 HTTP 200（实际 ${exportRes.status}）`);
  const ct = exportRes.headers['content-type'] || '';
  assert(ct.includes('spreadsheetml') || ct.includes('excel'), `Content-Type 是 xlsx（实际 ${ct}）`);
  const cd = exportRes.headers['content-disposition'] || '';
  assert(cd.includes('forecast_details_'), `文件名含 forecast_details（实际 ${cd}）`);
  assert(exportRes.buffer.length > 10000, `导出文件体积 >10KB（实际 ${(exportRes.buffer.length / 1024).toFixed(1)} KB）`);

  // 写文件备用
  const xlsxPath = path.join(OUT_DIR, '08_export_details.xlsx');
  writeFileSync(xlsxPath, exportRes.buffer);
  console.log(`  💾 导出文件保存到：${xlsxPath}`);

  // 再次 GET metadata，验证 recordExport 写入了
  const metaAfter = (await request('GET', '/forecast/metadata')).json?.data;
  assert(metaAfter.lastExportedAt, 'metadata.lastExportedAt 非空（recordExport 已写入）');
  assert(metaAfter.lastExportedCount >= 6, `lastExportedCount ≥6（实际 ${metaAfter.lastExportedCount}）`);
  assert(metaAfter.lastExportedHash && metaAfter.lastExportedHash.length === 64, `lastExportedHash = sha256（${metaAfter.lastExportedHash?.slice(0, 12)}...）`);
  // 计算本地 hash 对比
  const localHash = crypto.createHash('sha256').update(exportRes.buffer).digest('hex');
  assert(localHash === metaAfter.lastExportedHash, `本地计算的导出 hash === metadata 记录的 hash（内容一致）`);

  // 再次自检：export-consistency 不应再是 pending
  const sc2 = await request('GET', '/forecast/self-check');
  const sc2Items = sc2.json?.data?.items || [];
  const exp2 = sc2Items.find((i) => i.id === 'export-consistency');
  assert(exp2.status !== 'pending', `导出后 export-consistency 非 pending（实际 ${exp2.status}）`);
  writeFileSync(path.join(OUT_DIR, '09_selfcheck_after_export.json'), JSON.stringify(sc2.json, null, 2));

  // --- 阶段 9：重新计算（验证 recalculation 状态机：修正时间 vs 计算时间） ---
  section('阶段 9：再修正一次 → 再计算，验证 recalculation 自检');
  await request('POST', '/forecast/parameters/update', {
    body: {
      productId: 'REAL-003',
      rawAlpha: '72%',
      rawBeta: '0.45',
      rawGamma: '0.35',
      forecastConclusion: '770',
      reason: '最终微调：alpha 调回 72%，更贴合历史均值',
      operator: 'E2E-小祁',
    },
  });
  // 修正未重算 → recalculation 应该 warning
  const sc3 = (await request('GET', '/forecast/self-check')).json?.data?.items || [];
  const recalc2 = sc3.find((i) => i.id === 'recalculation');
  assert(recalc2.status === 'warning', `[recalculation] 修正未重算 → warning（实际 ${recalc2.status}）`);
  console.log(`  📝 修正未重算 自检 = ${recalc2.status}：${recalc2.message}`);
  // 重算后 → pass
  await request('POST', '/forecast/calculate');
  const sc4 = (await request('GET', '/forecast/self-check')).json?.data?.items || [];
  const recalc3 = sc4.find((i) => i.id === 'recalculation');
  assert(recalc3.status === 'pass', `[recalculation] 重算后 → pass（实际 ${recalc3.status}）`);
  console.log(`  📝 重算后自检 = ${recalc3.status}：${recalc3.message}`);

  // --- 阶段 10：最终证明 - 结果里完全不存在 PROD-DEMO ---
  section('阶段 10：最终证明 - 不存在 PROD-DEMO-xxx 演示数据');
  const finalResults = (await request('GET', '/forecast/results')).json?.data || [];
  const finalParams = (await request('GET', '/forecast/parameters')).json?.data?.records || [];
  const demoInResults = finalResults.filter((r) => r.productId.startsWith('PROD-DEMO'));
  const demoInParams = finalParams.filter((r) => r.productId.startsWith('PROD-DEMO'));
  assert(demoInResults.length === 0, `结果中 0 条 PROD-DEMO-xxx（实际 ${demoInResults.length}）`);
  assert(demoInParams.length === 0, `参数中 0 条 PROD-DEMO-xxx（实际 ${demoInParams.length}）`);
  // 全 productId 都是 REAL- 开头（证明是我们的 CSV 解析）
  const realCount = finalResults.filter((r) => r.productId.startsWith('REAL-')).length;
  assert(realCount === finalResults.length, `全部 ${finalResults.length} 条结果 productId 以 REAL- 开头`);
  console.log(`  🎯 最终 productIds: ${finalResults.map((r) => r.productId).join(', ')}`);

  // ================ 总结 ================
  console.log(`\n${'='.repeat(70)}`);
  console.log(`🏁 E2E 验证完成：${passed} 通过 / ${failed} 失败`);
  console.log(`   输出目录：${OUT_DIR}`);
  console.log(`   产物：00_initial → 01_import → 04_correction → 08_export.xlsx → 09_selfcheck`);
  console.log(`${'='.repeat(70)}`);

  if (failed > 0) process.exit(1);
}

main().catch((e) => {
  console.error('\n💥 脚本运行异常：', e);
  process.exit(2);
});
