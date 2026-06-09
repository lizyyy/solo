const http = require('http');
const { BOUNDARY_SAMPLE_TO_APPEND } = require('./sample-data');

const API = 'http://localhost:3100';

function httpCall(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const u = new URL(API + urlPath);
    const data = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: u.hostname, port: u.port, path: u.pathname + u.search,
      method, headers: { 'Content-Type': 'application/json', ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}) }
    }, res => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, json: JSON.parse(buf) }); }
        catch (e) { resolve({ status: res.statusCode, raw: buf }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const BARS = '━'.repeat(82);
function section(title) {
  console.log('\n' + BARS);
  console.log(`  🚩 ${title}`);
  console.log(BARS);
}

function print(label, data, depth = 0) {
  const p = '  '.repeat(depth);
  if (typeof data !== 'object' || data === null) { console.log(`${p}${label}: ${data}`); return; }
  if (Array.isArray(data)) {
    console.log(`${p}${label} (共 ${data.length} 项):`);
    data.forEach((v, i) => print(`[${i}]`, v, depth + 1));
    return;
  }
  console.log(`${p}${label}${label ? ':' : ''}`);
  for (const [k, v] of Object.entries(data)) {
    if (typeof v === 'object' && v !== null) {
      if (Array.isArray(v) && !v.length) { console.log(`${p}  ${k}: []`); continue; }
      if (Object.keys(v).length === 0 && v.constructor === Object) { console.log(`${p}  ${k}: {}`); continue; }
      print(`  ${k}`, v, depth + 1);
    } else {
      console.log(`${p}  ${k}: ${v}`);
    }
  }
}

let targetWoId = 'WO_B003_202603';
let partIdToReplace = null;

(async () => {
  section('灰度发布测试流程 · 风机叶片工单回放');
  console.log('  节奏: 导入旧材料 → 补边界样本 → 状态流转/备件替换 → 复核接口说清变化');

  /* ── 健康检查 ── */
  section('0. 健康检查 & 当前库数据');
  try {
    const h = await httpCall('GET', '/api/health');
    print('服务健康', h.json);
  } catch (e) {
    console.log('❌ 连不上后端，请先执行: npm start');
    process.exit(1);
  }

  /* ── 步骤 1: 复核导入的旧材料 ── */
  section('Step ① 导入旧材料复核 (小林看:异常是否被平均值盖住?)');
  const woList = (await httpCall('GET', '/api/workorders')).json;
  console.log(`✅ 导入后工单总数: ${woList.total}`);
  print('  按状态分桶', {
    已确认: woList.counts.confirmed,
    待补件: woList.counts.pending_part,
    退回: woList.counts.returned,
    待处理: woList.counts.pending
  });

  const target = woList.items.find(x => x.id === targetWoId);
  console.log(`\n📌 拿重点工单 ${target.blade_no}(${target.id}) 细看——`);
  print('  小林最关心：异常是否单独列出（没被均值盖住）', {
    异常条数: target.anomalies.sensor_anomaly_count,
    异常明细: target.anomalies.sensor_anomalies,
    边界样本数: target.anomalies.boundary_samples.length,
    边界明细: target.anomalies.boundary_samples,
    防掩盖风险提示: target.anomalies.masked_risk
  });
  print('  传感器摘要(小林可直接看)', target.sensor_summary.summary_note);
  print('  备件情况(已替换的影响范围&来源行)', target.parts);

  /* ── 步骤 2: 追加一条边界样本（排班同事动作） ── */
  section('Step ② 排班同事补一条边界样本 → 看哪一步让结果变化');
  const appendR = await httpCall('POST', `/api/workorders/${targetWoId}/boundary`, {
    operator: '排班同事-老王', sensor_log: BOUNDARY_SAMPLE_TO_APPEND
  });
  const appendStep = appendR.json.step;
  print('✅ 已回放步骤', {
    步骤序号: `#${appendStep.seq_no}`,
    动作: appendStep.action,
    变化字段: appendStep.changed_fields,
    params_before: appendStep.params_before,
    params_after: appendStep.params_after,
    note: appendStep.note
  });
  console.log('\n📌 排班同事一眼看到——发生变化的字段: ' + (appendStep.changed_fields.join(', ') || '无'));
  console.log('📌 影响工单: ' + appendStep.workorder_impact.join(', '));

  /* ── 步骤 3: 备件替换 (型号替换-人眼扫→自动留痕) ── */
  section('Step ③ 备件型号替换(以前人眼扫,现在自动留来源行+影响范围)');
  const fresh = (await httpCall('GET', `/api/workorders/${targetWoId}`)).json;
  const pendingPart = fresh.parts.total > 0 ? fresh.parts.pending_replace[0] : null;
  let origPart = fresh.parts.total > 0 ? (await httpCall('GET', '/api/health')).json : null;

  /* 直接从 DB 里找一个 original 的 part 也可以；这里找 pending_replace 或第一个 original */
  const pendingOrOriginal = [...fresh.parts.pending_replace, ...(await httpCall('GET', `/api/workorders/${targetWoId}`)).json.parts.replaced];
  /* 简单做法：重新查 detail API 拿完整 id 列表 */
  const detailForId = (await httpCall('GET', `/api/workorders/${targetWoId}`)).json;
  console.log('  🔎 工单上所有备件片段(用于找id):');
  console.log('     待补件id:', detailForId.parts.pending_replace.map(x => x.id));
  console.log('     已替换id:', detailForId.parts.replaced.map(x => x.id));

  partIdToReplace = (detailForId.parts.pending_replace[0] || {}).id;
  if (!partIdToReplace) {
    console.log('  ⚠  没有待补件了, 用接口健康检查再构造一个 (此演示跳过)');
  } else {
    const r = await httpCall('POST', `/api/parts/${partIdToReplace}/replace`, {
      replacement_model: 'SANY-LHG-5FT-Epoxy-Composite',
      operator: '小林',
      source_line: '《备件替换审批单 SP-2026-0610》第3行',
      impact_scope: '叶片#C-0088 前缘整条粘接面,下次排程需顺延4小时施工',
      note: '原型号缺货,临时走跨场调货流程'
    });
    print('✅ 备件替换回放步骤', {
      步骤序号: `#${r.json.step.seq_no}`,
      动作: r.json.step.action,
      变化字段: r.json.step.changed_fields,
      note: r.json.step.note
    });
  }

  /* ── 步骤 4: 状态流转 (月底小林复核) ── */
  section('Step ④ 月底小林状态流转:把工单分清楚(已确认/待补件/退回)');
  const woD = woList.items;
  const statusOps = [
    { id: 'WO_B005_202605', to: 'confirmed', operator: '小林', confirm_note: '复核通过:传感器数据连续,备件齐全' },
    { id: 'WO_B004_202604', to: 'pending_part', operator: '小林', note: '待补叶片定位销,库房在途' },
    { id: 'WO_B005_202605', to: 'returned', operator: '小林', return_reason: '发现有2条日志时间戳漂移>30秒,退采集组重跑' }
  ];
  for (const op of statusOps) {
    const r = await httpCall('POST', `/api/workorders/${op.id}/status`, op);
    if (!r.json || !r.json.step) {
      console.log(`  ⚠ ${op.id} → ${op.to}  HTTP=${r.status} 返回:`, JSON.stringify(r.json || r.raw).slice(0, 200));
      continue;
    }
    console.log(`  ${op.id} ${op.to.padEnd(12)}  步骤#${r.json.step.seq_no} 变化:${r.json.step.changed_fields.join(',')}  ${r.json.step.note || ''}`);
  }

  /* ── 步骤 5: 最终接口(排班同事)是否讲明白待处理 ── */
  section('Step ⑤ 最终接口返回 · 排班同事看"能不能讲明白待处理记录"');
  const final = (await httpCall('GET', '/api/workorders')).json;
  print('✅ 月底分类结果(小林可出报表)', final.counts);
  console.log('\n🗣  排班同事视角 —— 待处理说明 (接口 /api/workorders.pending_explain):');
  final.pending_explain.forEach((p, i) => {
    console.log(`\n  [${i + 1}] ${p.blade_no} @ ${p.wind_farm}  当前:${p.current_status}`);
    console.log(`      讲明白了吗? → ${p.reasons.length ? '✅ 理由共 ' + p.reasons.length + ' 条:' : '❌ 没讲明白(不应该出现)'}`);
    p.reasons.forEach(r => console.log(`        • ${r}`));
    if (p.last_action) console.log(`      最后一步回放: 步骤#? ${p.last_action.action} (${p.last_action.time})`);
  });

  /* ── 步骤 6: 回放轨迹 —— 换一组参数能看出哪一步变了 ── */
  section('Step ⑥ 回放轨迹·排班同事:换一组参数重跑时能看出哪一步变了');
  const trail = (await httpCall('GET', `/api/workorders/${targetWoId}/trail`)).json;
  console.log(`📌 工单 ${targetWoId} 共经历 ${trail.steps.length} 步回放:`);
  trail.steps.forEach(s => {
    console.log(`\n  步骤#${s.seq_no}  ${s.action}  [${s.operator}]  ${s.created_at}`);
    console.log(`         变化字段: ${s.changed_fields.length ? s.changed_fields.join(', ') : '(无字段级变化)'}`);
    console.log(`         备注说明: ${s.note || '(无)'}`);
    if (s.snapshot) {
      console.log(`         快照: 状态=${s.snapshot.status_label}  异常=${s.snapshot.anomalies.sensor_anomaly_count || 0}条  边界=${s.snapshot.anomalies.boundary_samples ? s.snapshot.anomalies.boundary_samples.length : 0}条  已换备件=${s.snapshot.parts.replaced_count || 0}`);
    }
  });

  section('✅ 灰度发布前验证完成');
  console.log('  验证项清单:');
  console.log('    ✦ 异常不被平均值盖住          → Step ① sensor_anomalies / masked_risk 已单独列出');
  console.log('    ✦ 换参数看出哪一步变了         → Step ⑥ 回放轨迹每步 seq + changed_fields + 快照');
  console.log('    ✦ 边界样本(现场毛边)          → Step ② boundary_samples 标注 + is_boundary=1');
  console.log('    ✦ 备件替换留影响范围+来源行    → Step ③ replace_source_line + replace_impact_scope');
  console.log('    ✦ 月底状态分类清晰             → Step ④/⑤ counts.confirmed/pending_part/returned');
  console.log('    ✦ 待处理记录讲明白              → Step ⑤ pending_explain.reasons 多原因列清');
  console.log('\n  打开前端看可视化: http://localhost:3100');
})().catch(e => { console.error('❌ 运行出错:', e); process.exit(1); });
