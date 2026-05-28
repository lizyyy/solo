const assert = require('assert');

const G = 9.80665;
const MAX_FALL_FACTOR = 2.0;
const ENERGY_DEVIATION_WARN = 0.10;
const ENERGY_DEVIATION_CRITICAL = 0.25;
const UIAA_MAX_IMPACT = 12;

const RISK_THRESHOLDS = [
  { max: 6, level: 'Low', color: '#4caf50' },
  { max: 8, level: 'Medium', color: '#ff9800' },
  { max: 12, level: 'High', color: '#f44336' },
  { max: Infinity, level: 'Critical', color: '#9c27b0' }
];

const STATE_TRANSITIONS = {
  draft:     { submit: 'submitted', delete: null },
  submitted: { approve: 'approved', reject: 'rejected', withdraw: 'draft', supplement: 'submitted' },
  approved:  { withdraw: 'submitted', supplement: 'approved' },
  rejected:  { supplement: 'rejected', submit: 'submitted' }
};

function calculate(params) {
  const { ropeLength, fallDistance, mass, frictionCoeff, frictionDir, elongationRate, ropeModulus } = params;
  const errors = [];
  const warnings = [];

  if (ropeLength <= 0) {
    errors.push({ field: 'ropeLength', msg: '绳长必须大于零，否则无法计算坠落系数' });
  }
  if (fallDistance < 0) {
    errors.push({ field: 'fallDistance', msg: '坠落距离不能为负' });
  }
  if (mass <= 0) {
    errors.push({ field: 'mass', msg: '攀爬者质量必须大于零' });
  }
  if (frictionCoeff < 0 || frictionCoeff > 1) {
    errors.push({ field: 'frictionCoeff', msg: '摩擦系数应在 0~1 之间' });
  }
  if (frictionDir === 'opposing') {
    warnings.push({ field: 'frictionDir', msg: '摩擦方向为"反向"，这与正常保护操作相反，冲击力将放大', severity: 'error' });
  }
  if (ropeLength > 0) {
    const ff = fallDistance / ropeLength;
    if (ff > MAX_FALL_FACTOR) {
      errors.push({ field: 'fallFactor', msg: `坠落系数 ${ff.toFixed(2)} > 2.0，物理上不可能` });
    }
  }
  if (elongationRate !== undefined && (elongationRate < 0 || elongationRate > 50)) {
    errors.push({ field: 'elongationRate', msg: '绳伸长率应在 0~50% 之间' });
  }

  if (errors.some(e => e.field === 'ropeLength' || e.field === 'fallFactor')) {
    return {
      valid: false,
      errors,
      warnings,
      fallFactor: ropeLength > 0 ? fallDistance / ropeLength : Infinity,
      baseImpactForce: null,
      effectiveImpactForce: null,
      ropeElongationAbs: null,
      potentialEnergy: mass * G * Math.max(fallDistance, 0),
      absorbedEnergy: null,
      energyDeviation: null,
      riskLevel: null,
      riskColor: null,
      exceedsUIAA: false
    };
  }

  const fallFactor = fallDistance / ropeLength;
  const weight = mass * G;
  const K = ropeModulus || 25.0;
  const K_N = K * 1000;

  const discriminant = 1 + (2 * K_N * fallFactor) / (weight * 1);
  const baseImpactForce = weight * (1 + Math.sqrt(Math.max(discriminant, 0)));

  let frictionFactor;
  if (frictionDir === 'opposing') {
    frictionFactor = 1 + (1 - frictionCoeff) * 0.5;
  } else {
    frictionFactor = (1 + Math.exp(-frictionCoeff * Math.PI)) / 2;
  }

  const effectiveImpactForce = baseImpactForce * frictionFactor;

  const k_total = K_N / Math.max(ropeLength, 0.01);
  const x_base = baseImpactForce / Math.max(k_total, 1);
  const ropeElongationAbs = effectiveImpactForce / Math.max(k_total, 1);

  const potentialEnergyBase = weight * (fallDistance + Math.max(x_base, 0));
  const potentialEnergy = weight * (fallDistance + Math.max(ropeElongationAbs, 0));
  const absorbedEnergyBase = 0.5 * k_total * Math.max(x_base, 0) * Math.max(x_base, 0);
  const absorbedEnergy = 0.5 * k_total * Math.max(ropeElongationAbs, 0) * Math.max(ropeElongationAbs, 0);
  const frictionDissipated = potentialEnergy - absorbedEnergy;

  let energyDeviation = null;
  if (potentialEnergyBase > 0 && absorbedEnergyBase !== null) {
    energyDeviation = Math.abs(absorbedEnergyBase - potentialEnergyBase) / potentialEnergyBase;
  }

  const riskResult = classifyRisk(effectiveImpactForce / 1000);
  const exceedsUIAA = (effectiveImpactForce / 1000) > UIAA_MAX_IMPACT;

  if (exceedsUIAA) {
    warnings.push({ field: 'impactForce', msg: `有效冲击力 ${(effectiveImpactForce/1000).toFixed(2)} kN 超过 UIAA 标准 12 kN`, severity: 'error' });
  }
  if (energyDeviation !== null && energyDeviation > ENERGY_DEVIATION_CRITICAL) {
    warnings.push({ field: 'energy', msg: `能量守恒偏差 ${(energyDeviation*100).toFixed(1)}% > 25%，计算结果不可信`, severity: 'error' });
  } else if (energyDeviation !== null && energyDeviation > ENERGY_DEVIATION_WARN) {
    warnings.push({ field: 'energy', msg: `能量守恒偏差 ${(energyDeviation*100).toFixed(1)}% > 10%，需复核参数`, severity: 'warn' });
  }
  if (fallFactor >= 1.0) {
    warnings.push({ field: 'fallFactor', msg: `坠落系数 ${fallFactor.toFixed(2)} ≥ 1.0，属于严重坠落`, severity: 'warn' });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    fallFactor,
    baseImpactForce: baseImpactForce / 1000,
    effectiveImpactForce: effectiveImpactForce / 1000,
    ropeElongationAbs,
    potentialEnergy,
    absorbedEnergy,
    energyDeviation,
    riskLevel: riskResult.level,
    riskColor: riskResult.color,
    exceedsUIAA
  };
}

function classifyRisk(forceKN) {
  for (const t of RISK_THRESHOLDS) {
    if (forceKN < t.max) return t;
  }
  return RISK_THRESHOLDS[RISK_THRESHOLDS.length - 1];
}

function canTransition(currentState, action) {
  const transitions = STATE_TRANSITIONS[currentState];
  if (!transitions) return false;
  return action in transitions;
}

function transition(currentState, action) {
  if (!canTransition(currentState, action)) {
    return { success: false, error: `不允许从 "${currentState}" 执行 "${action}" 操作` };
  }
  const newState = STATE_TRANSITIONS[currentState][action];
  if (newState === null) {
    return { success: false, error: `操作 "${action}" 在 "${currentState}" 状态下不可用` };
  }
  return { success: true, newState };
}

class DataManager {
  constructor() { this._records = new Map(); }
  getAll() { return Array.from(this._records.values()); }
  getById(id) { return this._records.get(id) || null; }
  idExists(id) { return this._records.has(id); }

  add(record) {
    if (this.idExists(record.id)) {
      return { success: false, error: `记录编号 "${record.id}" 已存在，不允许重复编号` };
    }
    const now = Date.now();
    const rec = {
      ...record,
      status: record.status || 'draft',
      createdAt: now,
      updatedAt: now,
      history: [{ action: 'create', from: null, to: 'draft', ts: now, note: '创建记录' }],
      calcResult: null
    };
    rec.calcResult = calculate(rec);
    this._records.set(rec.id, rec);
    return { success: true, record: rec };
  }

  update(id, updates) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    if (rec.status !== 'draft' && rec.status !== 'rejected') {
      return { success: false, error: `记录 "${id}" 状态为 "${rec.status}"，不可直接编辑` };
    }
    const now = Date.now();
    Object.assign(rec, updates, { updatedAt: now });
    rec.calcResult = calculate(rec);
    rec.history.push({ action: 'update', from: rec.status, to: rec.status, ts: now, note: '编辑记录' });
    this._records.set(id, rec);
    return { success: true, record: rec };
  }

  supplement(id, supplementalData) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    if (!canTransition(rec.status, 'supplement')) {
      return { success: false, error: `记录 "${id}" 状态为 "${rec.status}"，不可补录` };
    }
    const now = Date.now();
    const prevState = rec.status;
    Object.assign(rec, supplementalData, { updatedAt: now });
    rec.calcResult = calculate(rec);
    const result = transition(rec.status, 'supplement');
    if (result.success) rec.status = result.newState;
    rec.history.push({ action: 'supplement', from: prevState, to: rec.status, ts: now, note: '补录数据' });
    this._records.set(id, rec);
    return { success: true, record: rec };
  }

  changeState(id, action) {
    const rec = this._records.get(id);
    if (!rec) return { success: false, error: `记录 "${id}" 不存在` };
    const result = transition(rec.status, action);
    if (!result.success) return result;
    const now = Date.now();
    const prevState = rec.status;
    rec.status = result.newState;
    rec.updatedAt = now;
    rec.history.push({ action, from: prevState, to: result.newState, ts: now, note: action });
    this._records.set(id, rec);
    return { success: true, record: rec };
  }
}

function runTests() {
  console.log('\n🧪 ========== 物理引擎测试 ==========');

  console.log('\n1️⃣ 测试: 绳长为零');
  const zeroRope = calculate({ ropeLength: 0, fallDistance: 2, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert.strictEqual(zeroRope.valid, false, '绳长为零应导致计算无效');
  assert(zeroRope.errors.some(e => e.msg.includes('绳长必须大于零')), '应有绳长错误');
  assert.strictEqual(zeroRope.fallFactor, Infinity, '坠落系数应为 Infinity');
  assert.strictEqual(zeroRope.effectiveImpactForce, null, '冲击力应为 null');
  console.log('✅ 绳长为零正确拒绝');

  console.log('\n2️⃣ 测试: 摩擦方向反向');
  const reverseFriction = calculate({ ropeLength: 20, fallDistance: 4, mass: 75, frictionCoeff: 0.5, frictionDir: 'opposing', elongationRate: 8, ropeModulus: 25 });
  assert(reverseFriction.warnings.some(w => w.msg.includes('摩擦方向为"反向"')), '应有摩擦方向警告');
  const normalFriction = calculate({ ropeLength: 20, fallDistance: 4, mass: 75, frictionCoeff: 0.5, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 25 });
  assert(reverseFriction.effectiveImpactForce > normalFriction.effectiveImpactForce, '反向摩擦冲击力应大于正常摩擦');
  console.log(`✅ 摩擦方向反向正确放大冲击力: ${normalFriction.effectiveImpactForce.toFixed(2)} → ${reverseFriction.effectiveImpactForce.toFixed(2)} kN`);

  console.log('\n3️⃣ 测试: 冲击力超限 (>12 kN)');
  const extreme = calculate({ ropeLength: 8, fallDistance: 15, mass: 100, frictionCoeff: 0.25, frictionDir: 'opposing', elongationRate: 12, ropeModulus: 35 });
  assert(extreme.valid, '参数本身应有效 (FF=1.875 < 2)');
  assert(extreme.exceedsUIAA, '应检测到超 UIAA 标准');
  assert(extreme.warnings.some(w => w.msg.includes('超过 UIAA 标准 12 kN')), '应有超限警告');
  assert.strictEqual(extreme.riskLevel, 'Critical', '风险等级应为 Critical');
  console.log(`✅ 冲击力超限正确检测: ${extreme.effectiveImpactForce.toFixed(2)} kN, 风险等级: ${extreme.riskLevel}`);

  console.log('\n4️⃣ 测试: 坠落系数 > 2 (物理不可能)');
  const impossible = calculate({ ropeLength: 10, fallDistance: 25, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert.strictEqual(impossible.valid, false, '坠落系数>2应无效');
  assert(impossible.errors.some(e => e.msg.includes('物理上不可能')), '应有不可能错误');
  console.log(`✅ 坠落系数 ${impossible.fallFactor.toFixed(2)} 正确拒绝`);

  console.log('\n5️⃣ 测试: 能量守恒校验');
  const normal = calculate({ ropeLength: 25, fallDistance: 3, mass: 72, frictionCoeff: 0.5, frictionDir: 'assisting', elongationRate: 8.5, ropeModulus: 25 });
  assert(normal.energyDeviation !== null, '应有能量偏差');
  assert(normal.energyDeviation < 0.25, '正常参数下能量偏差应 < 25%');
  console.log(`✅ 能量守恒: 输入=${normal.potentialEnergy.toFixed(1)}J, 吸收=${normal.absorbedEnergy.toFixed(1)}J, 偏差=${(normal.energyDeviation*100).toFixed(2)}%`);

  console.log('\n6️⃣ 测试: 风险分级');
  assert.strictEqual(classifyRisk(5).level, 'Low', '5 kN 应为 Low');
  assert.strictEqual(classifyRisk(7).level, 'Medium', '7 kN 应为 Medium');
  assert.strictEqual(classifyRisk(10).level, 'High', '10 kN 应为 High');
  assert.strictEqual(classifyRisk(15).level, 'Critical', '15 kN 应为 Critical');
  console.log('✅ 风险分级正确');

  console.log('\n🧪 ========== 状态流转测试 ==========');

  console.log('\n1️⃣ 测试: 草稿 → 提交 → 审核 → 撤回');
  const dm = new DataManager();
  let r = dm.add({ id: 'TEST-001', ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert(r.success, '应成功添加');
  assert.strictEqual(r.record.status, 'draft', '初始状态应为草稿');

  r = dm.changeState('TEST-001', 'submit');
  assert(r.success, '草稿应可提交');
  assert.strictEqual(r.record.status, 'submitted', '提交后状态应为已提交');

  r = dm.changeState('TEST-001', 'approve');
  assert(r.success, '已提交应可审核');
  assert.strictEqual(r.record.status, 'approved', '审核后状态应为已审核');

  r = dm.changeState('TEST-001', 'withdraw');
  assert(r.success, '已审核应可撤回');
  assert.strictEqual(r.record.status, 'submitted', '撤回后状态应为已提交');

  r = dm.changeState('TEST-001', 'withdraw');
  assert(r.success, '已提交应可撤回');
  assert.strictEqual(r.record.status, 'draft', '撤回后状态应为草稿');
  console.log('✅ 正常状态流转正确');

  console.log('\n2️⃣ 测试: 草稿 → 提交 → 驳回 → 补录 → 重新提交 → 审核');
  const dm2 = new DataManager();
  let r2 = dm2.add({ id: 'TEST-002', ropeLength: 30, fallDistance: 5, mass: 80, frictionCoeff: 0.5, frictionDir: 'assisting' });
  dm2.changeState('TEST-002', 'submit');
  dm2.changeState('TEST-002', 'reject');
  assert.strictEqual(dm2.getById('TEST-002').status, 'rejected', '应为驳回状态');

  r2 = dm2.update('TEST-002', { notes: '已修正保护方式说明' });
  assert(r2.success, '驳回后应可编辑');

  r2 = dm2.changeState('TEST-002', 'submit');
  assert(r2.success, '驳回后应可重新提交');
  assert.strictEqual(r2.record.status, 'submitted');

  r2 = dm2.changeState('TEST-002', 'approve');
  assert(r2.success);
  assert.strictEqual(r2.record.status, 'approved');
  console.log('✅ 驳回后补录重提正确');

  console.log('\n3️⃣ 测试: 审核记录的补录（不改变状态）');
  const dm3 = new DataManager();
  let r3 = dm3.add({ id: 'TEST-003', ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting', elongationRate: 8 });
  dm3.changeState('TEST-003', 'submit');
  dm3.changeState('TEST-003', 'approve');

  r3 = dm3.supplement('TEST-003', { elongationRate: 9.5 });
  assert(r3.success, '已审核记录应可补录');
  assert.strictEqual(r3.record.status, 'approved', '补录不应改变已审核状态');
  assert(r3.record.calcResult.energyDeviation !== null, '补录后应重新计算');
  console.log('✅ 审核记录补录正确，状态保持');

  console.log('\n4️⃣ 测试: 非法状态流转');
  const dm4 = new DataManager();
  dm4.add({ id: 'TEST-004', ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });

  let fail = dm4.changeState('TEST-004', 'approve');
  assert(!fail.success, '草稿不能直接审核');
  assert(fail.error.includes('不允许从 "draft" 执行 "approve" 操作'), '应有正确错误');

  dm4.changeState('TEST-004', 'submit');
  fail = dm4.update('TEST-004', { mass: 75 });
  assert(!fail.success, '已提交不能直接编辑');
  console.log('✅ 非法状态流转正确阻止');

  console.log('\n🧪 ========== 数据完整性测试 ==========');

  console.log('\n1️⃣ 测试: 重复编号防护');
  const dm5 = new DataManager();
  const first = dm5.add({ id: 'DUPLICATE-001', ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert(first.success);
  const duplicate = dm5.add({ id: 'DUPLICATE-001', ropeLength: 15, fallDistance: 2, mass: 65, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert(!duplicate.success, '重复编号应被拒绝');
  assert(duplicate.error.includes('已存在，不允许重复编号'), '应有重复错误');
  assert.strictEqual(dm5.getAll().length, 1, '只应有一条记录');
  console.log('✅ 重复编号正确拦截，未生成两份有效结果');

  console.log('\n2️⃣ 测试: 三条同编号测试');
  const dm6 = new DataManager();
  dm6.add({ id: 'SAME-ID', ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  const a2 = dm6.add({ id: 'SAME-ID', ropeLength: 15, fallDistance: 2, mass: 65, frictionCoeff: 0.6, frictionDir: 'assisting' });
  const a3 = dm6.add({ id: 'SAME-ID', ropeLength: 25, fallDistance: 5, mass: 80, frictionCoeff: 0.7, frictionDir: 'assisting' });
  assert(!a2.success && !a3.success, '后两条应全部被拒');
  assert.strictEqual(dm6.getAll().length, 1, '最终只应有一条记录');
  const rec = dm6.getById('SAME-ID');
  assert.strictEqual(rec.ropeLength, 20, '应保留第一条的绳长');
  console.log('✅ 三条同编号仅第一条有效，后两条均被拒');

  console.log('\n🧪 ========== 边界参数测试 ==========');

  console.log('\n1️⃣ 测试: 质量为零');
  const zeroMass = calculate({ ropeLength: 20, fallDistance: 3, mass: 0, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert(!zeroMass.valid, '质量为零应无效');

  console.log('\n2️⃣ 测试: 摩擦系数为1 (最大值)');
  const maxFriction = calculate({ ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 1.0, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 25 });
  assert(maxFriction.valid, '摩擦系数1有效');
  const noFriction = calculate({ ropeLength: 20, fallDistance: 3, mass: 70, frictionCoeff: 0, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 25 });
  assert(maxFriction.effectiveImpactForce < noFriction.effectiveImpactForce, '摩擦大冲击力小');
  console.log(`✅ 摩擦系数边界: μ=0 → ${noFriction.effectiveImpactForce.toFixed(2)} kN, μ=1 → ${maxFriction.effectiveImpactForce.toFixed(2)} kN`);

  console.log('\n3️⃣ 测试: 超短绳长');
  const shortRope = calculate({ ropeLength: 0.1, fallDistance: 0.05, mass: 70, frictionCoeff: 0.5, frictionDir: 'assisting' });
  assert(shortRope.valid, '极短绳长但FF=0.5有效');
  assert.strictEqual(shortRope.fallFactor, 0.5, '坠落系数正确');

  console.log('\n4️⃣ 测试: 能量守恒极端参数');
  const extremeParams = calculate({ ropeLength: 50, fallDistance: 1, mass: 50, frictionCoeff: 0.5, frictionDir: 'assisting', elongationRate: 1, ropeModulus: 50 });
  assert(extremeParams.energyDeviation < ENERGY_DEVIATION_CRITICAL, '极端参数下能量守恒仍应在合理范围');
  console.log(`✅ 极端参数能量偏差: ${(extremeParams.energyDeviation*100).toFixed(2)}%`);

  console.log('\n🧪 ========== 风险分级与报告测试 ==========');

  console.log('\n1️⃣ 测试: 各风险等级样本');
  const risks = [
    { ropeLength: 25, fallDistance: 2, mass: 60, frictionCoeff: 0.7, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 25, expected: 'Low' },
    { ropeLength: 10, fallDistance: 14, mass: 88, frictionCoeff: 0.18, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 30, expected: 'Medium' },
    { ropeLength: 8, fallDistance: 14, mass: 95, frictionCoeff: 0.15, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 35, expected: 'High' },
    { ropeLength: 10, fallDistance: 18, mass: 100, frictionCoeff: 0.2, frictionDir: 'opposing', elongationRate: 10, ropeModulus: 35, expected: 'Critical' }
  ];

  risks.forEach((tc, i) => {
    const res = calculate(tc);
    assert.strictEqual(res.riskLevel, tc.expected, `第 ${i+1} 条风险等级应为 ${tc.expected}，实际 ${res.riskLevel}`);
    console.log(`  ✅ 样本 ${i+1}: ${res.effectiveImpactForce.toFixed(2)} kN → ${res.riskLevel}`);
  });

  console.log('\n2️⃣ 测试: UIAA 12 kN 边界');
  const justUnder = calculate({ ropeLength: 10, fallDistance: 18, mass: 100, frictionCoeff: 0.02, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 35 });
  const justOver = calculate({ ropeLength: 10, fallDistance: 18, mass: 100, frictionCoeff: 0, frictionDir: 'assisting', elongationRate: 8, ropeModulus: 35 });
  assert(!justUnder.exceedsUIAA, `${justUnder.effectiveImpactForce.toFixed(2)} kN 应未超限`);
  assert(justOver.exceedsUIAA, `${justOver.effectiveImpactForce.toFixed(2)} kN 应超限`);
  console.log(`✅ UIAA 边界: ${justUnder.effectiveImpactForce.toFixed(2)} kN (未超) / ${justOver.effectiveImpactForce.toFixed(2)} kN (超限)`);

  console.log('\n🏆 ========== 所有测试通过 ==========\n');
}

try {
  runTests();
} catch (e) {
  console.error('\n❌ 测试失败:', e.message);
  console.error(e.stack);
  process.exit(1);
}
