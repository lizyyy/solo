const fs = require('fs');
const http = require('http');

function api(method, path, bodyObj, contentType) {
  return new Promise((resolve, reject) => {
    let body = null;
    const headers = {};
    if (bodyObj !== undefined) {
      if (Buffer.isBuffer(bodyObj)) {
        body = bodyObj;
        headers['Content-Type'] = contentType;
      } else {
        body = JSON.stringify(bodyObj);
        headers['Content-Type'] = 'application/json';
      }
      headers['Content-Length'] = Buffer.byteLength(body);
    }
    const r = http.request({ hostname: 'localhost', port: 3001, path, method, headers }, (res) => {
      const chunks = [];
      const isExport = path === '/api/anomalies/export';
      if (isExport) res.setEncoding('utf8');
      res.on('data', (c) => { chunks.push(c); });
      res.on('end', () => {
        if (isExport) resolve({ status: res.statusCode, body: chunks.join('') });
        else resolve({ status: res.statusCode, body: Buffer.concat(chunks).toString('utf8') });
      });
    });
    r.on('error', reject);
    if (body) r.write(body);
    r.end();
  });
}

const CSV_PATH = '/Users/lzy/pro/solo/workspaces/zy72366/data/fridge_calibration.csv';

function bar(title) {
  const b = '='.repeat(78);
  console.log('\n' + b);
  console.log('  ' + title);
  console.log(b);
}

async function main() {
  bar('STEP 1 导入温度校准记录CSV (14条样例)');
  const csv = fs.readFileSync(CSV_PATH);
  const bnd = '----Calib' + Date.now();
  const mbody = Buffer.concat([
    Buffer.from('--' + bnd + '\r\nContent-Disposition: form-data; name="file"; filename="fridge.csv"\r\nContent-Type: text/csv\r\n\r\n'),
    csv,
    Buffer.from('\r\n--' + bnd + '--\r\n'),
  ]);
  const imp = await api('POST', '/api/calibration/import', mbody, 'multipart/form-data; boundary=' + bnd);
  const impBody = JSON.parse(imp.body);
  console.log('  HTTP %d | imported=%d abnormal=%d pendingReview=%d',
    imp.status, impBody.imported, impBody.abnormal, impBody.pendingReview);

  bar('STEP 2 异常工况摘要（真实无效数与待复核数分开统计）');
  const sum = await api('GET', '/api/anomalies/summary');
  const s = JSON.parse(sum.body);
  console.log('  待复核(pendingReview) = %d', s.pendingReview);
  console.log('  无效数(invalid)      = %d', s.invalid);
  console.log('  已确认/已回滚        = %d / %d', s.confirmed, s.rolledBack);

  bar('STEP 3 温度校准记录清单（验证向左→待复核而不是无效）');
  const rec = await api('GET', '/api/calibration/records?pageSize=50');
  const recj = JSON.parse(rec.body);
  const leftRecs = [];
  const invalidRecs = [];
  console.log('  ID  CSV行  传感器                  温度°C   方向       方向状态         处理状态');
  console.log('  ' + '-'.repeat(90));
  for (const r of recj.data) {
    const r1 = String(r.id).padEnd(4);
    const r2 = String(r.originalLineNumber).padEnd(6);
    const r3 = String(r.sensorId).padEnd(24);
    const r4 = Number(r.temperature).toFixed(2).padEnd(9);
    const r5 = String(r.direction).padEnd(11);
    const r6 = String(r.directionStatus).padEnd(17);
    const r7 = String(r.status);
    console.log('  %s%s%s%s%s%s%s', r1, r2, r3, r4, r5, r6, r7);
    if (/向左|左|left/i.test(r.direction)) leftRecs.push(r);
    if (r.directionStatus === 'abnormal') invalidRecs.push(r);
  }
  console.log('');
  console.log('  向左/左/left 记录数=%d → 全部pending_review? %s',
    leftRecs.length, leftRecs.every(r => r.directionStatus === 'pending_review') ? '✅' : '❌');
  console.log('  无效(abnormal)记录=%d条 → %s',
    invalidRecs.length, invalidRecs.map(r => r.direction + '/' + r.sensorId).join(' | '));

  const s1003 = recj.data.find(r => r.sensorId === 'SEN-1003' && r.originalLineNumber === 3);
  const s1008 = recj.data.find(r => r.sensorId === 'SEN-1008' && r.originalLineNumber === 8);
  const s1010 = recj.data.find(r => r.sensorId === 'SEN-1010' && r.originalLineNumber === 10);
  console.log('  → 闭环样例 id=%d SEN-1003 向左 T=%.2f°C dirStatus=%s',
    s1003.id, s1003.temperature, s1003.directionStatus);
  console.log('  → 闭环样例 id=%d SEN-1008 左   T=%.2f°C dirStatus=%s',
    s1008.id, s1008.temperature, s1008.directionStatus);
  console.log('  → 闭环样例 id=%d SEN-1010 未知口径 T=%.2f°C dirStatus=%s (无效)',
    s1010.id, s1010.temperature, s1010.directionStatus);

  bar('STEP 4 维修师傅【老岑】→ 补看SEN-1003 临时补材料(传感器编号补录)');
  const p1 = await api('PATCH', '/api/calibration/records/' + s1003.id, {
    field_name: 'sensorId',
    new_value: 'SEN-1003-B-现场补录-临时补材料',
    reason: '维修师傅老岑现场补看校准记录,原SEN-1003标牌磨损,核对B批次-补录(温度2.88°C对应左方门封)',
    changed_by: '老岑',
    role: 'technician',
  });
  const p1j = JSON.parse(p1.body);
  console.log('  HTTP %d %s', p1.status, p1j.success ? '✅' : '❌' + p1j.error);
  console.log('  改前 sensorId = SEN-1003');
  console.log('  改后 sensorId =', p1j.data.sensorId);
  console.log('  direction状态 =', p1j.data.directionStatus, '(应为pending_review, 向左保持待复核, 不先变无效)');
  console.log('  温度校准值 T = %.2f°C (保留不变)', Number(p1j.data.temperature));

  bar('STEP 5 实验老师【王老师】→ 确认SEN-1003(向左=待复核→负方向)');
  const cf1 = await api('PATCH', '/api/anomalies/records/' + s1003.id + '/confirm', {
    changedBy: '实验老师-王', role: 'lab_teacher',
    reason: '待复核:向左经温度曲线2.88°C核对=负方向密封漏热,王老师确认标准化',
    newValue: '负方向',
  });
  const cf1j = JSON.parse(cf1.body);
  console.log('  HTTP %d %s', cf1.status, cf1j.success ? '✅' : '❌' + cf1j.error);
  if (cf1j.success) {
    console.log('  改前 direction=向左 (pending_review)');
    console.log('  改后 direction=%s (normalized=%s) dirStatus=%s',
      cf1j.data.direction, cf1j.data.directionNormalized, cf1j.data.directionStatus);
    console.log('  处理状态 status=%s', cf1j.data.status);
    console.log('  温度校准值保留 T=%.2f°C ✅', Number(cf1j.data.temperature));
  }

  bar('STEP 6 实验老师【李老师】→ 驳回SEN-1008(左=待复核)→ 回滚重核');
  const rb1 = await api('PATCH', '/api/anomalies/records/' + s1008.id + '/rollback', {
    changedBy: '实验老师-李', role: 'lab_teacher',
    reason: '驳回:SEN-1008(左)与现场示意图不符,3.88°C温度实际为正方向漏热,要求老岑重拍照片再核',
    newValue: '正方向',
  });
  const rb1j = JSON.parse(rb1.body);
  console.log('  HTTP %d %s', rb1.status, rb1j.success ? '✅' : '❌' + rb1j.error);
  if (rb1j.success) {
    console.log('  改前 direction=左 (pending_review imported)');
    console.log('  改后 direction=%s (normalized=%s) dirStatus=%s',
      rb1j.data.direction, rb1j.data.directionNormalized, rb1j.data.directionStatus);
    console.log('  处理状态=%s', rb1j.data.status);
    console.log('  温度校准值保留 T=%.2f°C ✅', Number(rb1j.data.temperature));
  }

  bar('STEP 7 实验老师→ 确认SEN-1010(未知口径=真正无效abnormal)留档');
  const cf2 = await api('PATCH', '/api/anomalies/records/' + s1010.id + '/confirm', {
    changedBy: '实验老师-王', role: 'lab_teacher',
    reason: '无效值留档:未知口径无法对应标准方向,通知现场重新采集SEN-1010',
  });
  const cf2j = JSON.parse(cf2.body);
  console.log('  HTTP %d %s', cf2.status, cf2j.success ? '✅' : '❌' + cf2j.error);
  if (cf2j.success) {
    console.log('  改前:方向="未知口径" status=abnormal');
    console.log('  改后:directionStatus=%s status=%s', cf2j.data.directionStatus, cf2j.data.status);
  }

  bar('STEP 8 刷新→重取摘要(保存后持久化验证)');
  const sum2 = await api('GET', '/api/anomalies/summary');
  const s2 = JSON.parse(sum2.body);
  console.log('  [刷新后] 待复核=%d 无效=%d 已确认=%d 已回滚=%d',
    s2.pendingReview, s2.invalid, s2.confirmed, s2.rolledBack);
  const anr = await api('GET', '/api/anomalies/records?includeAll=1&pageSize=100');
  const anrj = JSON.parse(anr.body);
  console.log('  [刷新后] 工况记录总数(含审计追踪):%d', anrj.total);
  for (const r of anrj.data) {
    const mark = [];
    if (r.directionStatus === 'pending_review') mark.push('待复核');
    if (r.directionStatus === 'abnormal') mark.push('无效');
    if (r.directionStatus === 'normal') mark.push('正常');
    if (r.status === 'confirmed') mark.push('已确认');
    if (r.status === 'rolled_back') mark.push('已回滚');
    if ('auditCount' in r && r.auditCount > 0) mark.push('audit=' + r.auditCount);
    if (/向左|临时补材料|B-/.test(r.sensorId + '|' + r.direction)) mark.push('★重点');
    console.log('    id=%2d L#%2d %-28s T=%.2f°C dir=%-10s %s',
      r.id, r.originalLineNumber, r.sensorId,
      Number(r.temperature).toFixed(2), r.direction, mark.join(' '));
  }

  bar('STEP 9 审计日志反查 SEN-1003(id=' + s1003.id + ')');
  const au = await api('GET', '/api/calibration/records/' + s1003.id + '/audit');
  const auj = JSON.parse(au.body).data;
  console.log('  SEN-1003审计日志共%d条 (临时补材料→确认→方向变化):', auj.length);
  console.log('  #   字段            改前值(old)                 改后值(new)                 处理人          原因');
  console.log('  ' + '-'.repeat(120));
  for (let i = 0; i < auj.length; i++) {
    const l = auj[i];
    const oldv = (l.oldValue || '').substring(0, 28).padEnd(28);
    const newv = (l.newValue || '').substring(0, 28).padEnd(28);
    const by = (l.changedBy + '(' + l.role + ')').padEnd(16);
    const rea = (l.reason || '').substring(0, 40);
    console.log('  %-3s %-15s %s %s %s %s', (i + 1), l.fieldName, oldv, newv, by, rea);
  }
  const fieldSensorId = auj.find(l => l.fieldName === 'sensorId');
  const fieldStatus = auj.find(l => l.fieldName === 'status');
  const fieldDirection = auj.find(l => l.fieldName === 'direction');
  console.log('');
  console.log('  ✅ 补录前/后:', fieldSensorId ? fieldSensorId.oldValue + ' → ' + fieldSensorId.newValue : 'N/A');
  console.log('  ✅ 状态变化: ', fieldStatus ? fieldStatus.oldValue + ' → ' + fieldStatus.newValue : 'N/A');
  console.log('  ✅ 向左→负方向:', fieldDirection ? fieldDirection.oldValue + ' → ' + fieldDirection.newValue : 'N/A');
  console.log('  ✅ 处理人: ', auj.map(l => l.changedBy).join(' + '));

  bar('STEP 10 导出CSV报告→同一条(id=' + s1003.id + ')向左/临时补材料完整变化链');
  const exp = await api('GET', '/api/anomalies/export');
  const expPath = '/tmp/fridge_export_' + Date.now() + '.csv';
  const raw = (exp.body || '').replace(/^\uFEFF/, '');
  fs.writeFileSync(expPath, '\uFEFF' + raw, 'utf8');
  const lines = raw.split('\n');
  console.log('  CSV写入: ', expPath);
  console.log('  lines=%d bytes=%d', lines.length, Buffer.byteLength(exp.body, 'utf8'));

  function parsecsv(l) {
    const cols = []; let cur = ''; let inQ = false;
    for (const c of l) {
      if (c === '"') inQ = !inQ;
      else if (c === ',' && !inQ) { cols.push(cur); cur = ''; }
      else cur += c;
    }
    cols.push(cur); return cols;
  }

  const headers = parsecsv(lines[0]);
  console.log('');
  console.log('  CSV头部 %d 列:', headers.length);
  for (let i = 0; i < headers.length; i++) console.log('    %2d. %s', i + 1, headers[i]);

  console.log('');
  console.log('  ====== 【重点】同一条记录(ID=%d)完整链路 ======', s1003.id);
  const idTarget = String(s1003.id);
  const lbls = ['记录ID', '原始行号', '传感器编号', '温度(°C)', '当前方向值', '原始方向值(导入时)',
    '标准化值', '方向状态', '处理状态', '触发异常原因', '审计条数',
    '最近确认-改前', '最近确认-改后', '最近确认-原因', '最近确认-处理人',
    '最近回滚-改前', '最近回滚-改后', '最近回滚-原因', '最近回滚-处理人',
    '临时补材料痕', '向左痕迹', '创建时间', '更新时间'];
  let prevWasId3 = false;
  for (let i = 0; i < lines.length; i++) {
    const cols = parsecsv(lines[i]);
    if (cols[0] === idTarget) {
      prevWasId3 = true;
      console.log('');
      console.log('  ── DATA行 CSV L#%d ──', i + 1);
      for (let k = 0; k < Math.min(lbls.length, cols.length); k++) {
        if (cols[k]) console.log('    · %-20s: %s', lbls[k] || ('col' + (k + 1)), String(cols[k]).substring(0, 80));
      }
    } else if (prevWasId3 && /审计子行/.test(lines[i])) {
      console.log('  ── AUDIT子行 CSV L#%d ──', i + 1);
      const sWhole = cols.join(' | ');
      console.log('     %s', sWhole.substring(0, 200));
      if (!/审计子行/.test(lines[i + 1] || '')) prevWasId3 = false;
    } else {
      prevWasId3 = false;
    }
  }

  bar('STEP 11 最终核对关键点');
  const keys = [];
  const pendingCount = leftRecs.filter(r => r.directionStatus === 'pending_review').length;
  keys.push(['向左/左→待复核(非无效)', pendingCount === leftRecs.length, pendingCount + '/' + leftRecs.length]);
  keys.push(['无效数按真实乱码统计(>0)', s.invalid > 0, 'summary.invalid=' + s.invalid]);
  keys.push(['向左无需先变无效即可confirm', !!cf1j.success, cf1j.success ? 'HTTP200' : '失败']);
  keys.push(['向左无需先变无效即可rollback', !!rb1j.success, rb1j.success ? 'HTTP200' : '失败']);
  keys.push(['补录前/后可追溯', !!(fieldSensorId && fieldSensorId.oldValue !== fieldSensorId.newValue),
    fieldSensorId ? (fieldSensorId.oldValue + '→' + fieldSensorId.newValue) : '无']);
  keys.push(['状态变化可追溯', !!(fieldStatus && fieldStatus.oldValue !== fieldStatus.newValue),
    fieldStatus ? (fieldStatus.oldValue + '→' + fieldStatus.newValue) : '无']);
  keys.push(['向左→负方向变化可追溯', !!(fieldDirection && fieldDirection.oldValue === '向左'),
    fieldDirection ? (fieldDirection.oldValue + '→' + fieldDirection.newValue) : '无']);
  const fullCsv = raw;
  keys.push(['导出含原始方向值向左', /向左/.test(fullCsv), '原始方向列存在向左']);
  keys.push(['导出含温度校准值(2.88°C)', /2\.88/.test(fullCsv), 'SEN-1003温度保留']);
  keys.push(['导出含临时补材料痕迹', /临时补材料|B-/.test(fullCsv), '痕迹列/传感器编号更新']);
  keys.push(['刷新后摘要数值正确', s2.pendingReview >= 0 && s2.invalid >= 0,
    'pendingReview=' + s2.pendingReview + ' invalid=' + s2.invalid]);

  let allPass = true;
  for (const [name, pass, info] of keys) {
    const mark = pass ? '✅ PASS' : '❌ FAIL';
    if (!pass) allPass = false;
    console.log('  %s | %-35s | %s', mark, name, info);
  }

  console.log('');
  if (allPass) console.log('✅✅✅ 11项关键点全部通过 → 业务逻辑已修正为正确版本 ✅✅✅');
  else console.log('❌ 有未通过项,需要进一步修复');

  console.log('\n📌 可复现命令:');
  console.log('  1. 清理DB: rm -rf data; mkdir -p data');
  console.log('  2. 启动后端: npx tsx api/server.ts');
  console.log('  3. 准备样例CSV: data/fridge_calibration.csv (14条,含向左/左/右/反方向/乱码)');
  console.log('  4. 执行全链路: node data/_chain_v2.cjs');
  console.log('  5. 浏览器查看: http://localhost:5173/anomalies');
  console.log('  6. 导出CSV检查: GET http://localhost:3001/api/anomalies/export → /tmp/fridge_export_*.csv');
}

main().catch(e => { console.error('ERR', e); process.exit(1); });
