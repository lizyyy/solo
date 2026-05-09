const express = require('express');

const PORT = 3001;

const app = express();
app.use(express.json());

const database = {
  babies: {
    B001: { babyId: 'B001', memberName: '张小宝', months: 3, allergies: ['牛奶蛋白'], isActive: true, birthDate: '2025-02-15', history: [] },
    B002: { babyId: 'B002', memberName: '王乐乐', months: 11, allergies: [], isActive: true, birthDate: '2024-06-10', history: [] },
    B003: { babyId: 'B003', memberName: '刘甜甜', months: 1, allergies: ['乳糖不耐受'], isActive: true, birthDate: '2025-04-20', history: [] },
    B004: { babyId: 'B004', memberName: '陈萌萌', months: 16, allergies: [], isActive: true, birthDate: '2024-01-05', history: [] }
  },
  batches: {
    BT20260501: { batchId: 'BT20260501', milkBrand: '爱他美', stage: '1段', monthRange: { min: 0, max: 6 }, allergenRisk: ['牛奶蛋白', '乳糖'], totalQuantity: 100, distributed: 15, recallStatus: 'normal', isActive: true, expiryDate: '2027-05-01' },
    BT20260502: { batchId: 'BT20260502', milkBrand: '雀巢', stage: '1段', monthRange: { min: 0, max: 6 }, allergenRisk: [], totalQuantity: 80, distributed: 8, recallStatus: 'normal', isActive: true, expiryDate: '2027-05-01' },
    BT20260401: { batchId: 'BT20260401', milkBrand: '美赞臣', stage: '2段', monthRange: { min: 6, max: 12 }, allergenRisk: ['牛奶蛋白'], totalQuantity: 120, distributed: 45, recallStatus: 'recalled', isActive: true, expiryDate: '2027-04-01' },
    BT20260503: { batchId: 'BT20260503', milkBrand: '伊利', stage: '3段', monthRange: { min: 12, max: 36 }, allergenRisk: ['牛奶蛋白'], totalQuantity: 150, distributed: 20, recallStatus: 'normal', isActive: true, expiryDate: '2027-05-01' },
    BT20260504: { batchId: 'BT20260504', milkBrand: '惠氏', stage: '2段', monthRange: { min: 6, max: 12 }, allergenRisk: ['牛奶蛋白'], totalQuantity: 90, distributed: 10, recallStatus: 'normal', isActive: true, expiryDate: '2027-05-01' }
  },
  claims: {},
  claimHistory: {}
};

let nextClaimId = 1;
let nextHistoryId = 1;

const store = {
  getBaby: id => database.babies[id],
  getAllBabies: () => Object.values(database.babies),
  updateBaby: (id, updates) => { if (!database.babies[id]) return null; Object.assign(database.babies[id], updates); return database.babies[id]; },
  getBatch: id => database.batches[id],
  getAllBatches: () => Object.values(database.batches),
  updateBatch: (id, updates) => { if (!database.batches[id]) return null; Object.assign(database.batches[id], updates); return database.batches[id]; },
  getClaim: id => database.claims[id],
  getClaimByRequestId: rid => Object.values(database.claims).find(c => c.requestId === rid),
  getAllClaims: () => Object.values(database.claims),
  addClaim: claim => { const id = 'C' + (nextClaimId++).toString().padStart(6, '0'); database.claims[id] = { ...claim, claimId: id, createdAt: new Date() }; return database.claims[id]; },
  updateClaim: (id, updates) => { if (!database.claims[id]) return null; Object.assign(database.claims[id], updates); return database.claims[id]; },
  addClaimHistory: (cid, et, det) => { const h = { historyId: nextHistoryId++, claimId: cid, eventType: et, details: det, timestamp: new Date() }; if (!database.claimHistory[cid]) database.claimHistory[cid] = []; database.claimHistory[cid].push(h); return h; },
  getClaimHistory: cid => database.claimHistory[cid] || [],
  getClaimsByBaby: bid => Object.values(database.claims).filter(c => c.babyId === bid),
  hasBabyClaimedBatch: (bid, batchId) => Object.values(database.claims).some(c => c.babyId === bid && c.batchId === batchId && ['approved', 'completed'].includes(c.status)),
  hasBabyClaimed: bid => Object.values(database.claims).some(c => c.babyId === bid && ['approved', 'completed'].includes(c.status)),
  getClaimsSummary: () => { const cs = Object.values(database.claims); return { total: cs.length, pending: cs.filter(c => c.status === 'pending').length, approved: cs.filter(c => c.status === 'approved').length, completed: cs.filter(c => c.status === 'completed').length, rejected: cs.filter(c => c.status === 'rejected').length, withdrawn: cs.filter(c => c.status === 'withdrawn').length, failed: cs.filter(c => c.status === 'failed').length }; }
};

const RuleResults = { PASS: 'PASS', FAIL: 'FAIL', MANUAL: 'MANUAL' };
const ValidationStatus = { VALID: 'VALID', INVALID: 'INVALID', UNCERTAIN: 'UNCERTAIN' };

function buildResponse(status, message, code, data = null, details = null) {
  return { status, code, message, data, details, timestamp: new Date().toISOString() };
}

function validateBabyProfile(baby) {
  if (!baby) return { status: ValidationStatus.INVALID, code: 'BABY_NOT_FOUND', message: '宝宝档案不存在' };
  if (!baby.isActive) return { status: ValidationStatus.INVALID, code: 'BABY_INACTIVE', message: '宝宝档案已失效' };
  return { status: ValidationStatus.VALID, code: 'BABY_VALID', message: '宝宝档案有效', details: { babyId: baby.babyId, months: baby.months, allergies: baby.allergies } };
}

function validateBatch(batch) {
  if (!batch) return { status: ValidationStatus.INVALID, code: 'BATCH_NOT_FOUND', message: '批次不存在' };
  if (!batch.isActive) return { status: ValidationStatus.INVALID, code: 'BATCH_INACTIVE', message: '批次已停用' };
  if (batch.recallStatus === 'recalled') return { status: ValidationStatus.INVALID, code: 'BATCH_RECALLED', message: '批次已召回，禁止分发' };
  if (batch.totalQuantity - batch.distributed <= 0) return { status: ValidationStatus.INVALID, code: 'BATCH_OUT_OF_STOCK', message: '批次库存不足' };
  return { status: ValidationStatus.VALID, code: 'BATCH_VALID', message: '批次有效' };
}

function checkAgeEligibility(babyMonths, batchMonthRange) {
  if (babyMonths < batchMonthRange.min) return { eligible: false, code: 'TOO_YOUNG', message: `宝宝月龄(${babyMonths}月)小于批次最小月龄(${batchMonthRange.min}月)` };
  if (babyMonths > batchMonthRange.max) return { eligible: false, code: 'TOO_OLD', message: `宝宝月龄(${babyMonths}月)超过批次最大月龄(${batchMonthRange.max}月)` };
  return { eligible: true, code: 'AGE_OK', message: '月龄符合要求' };
}

function checkAllergenSafety(babyAllergies, batchAllergenRisk) {
  if (!babyAllergies || babyAllergies.length === 0) return { safe: true, code: 'NO_ALLERGIES', message: '宝宝无过敏史' };
  const conflicts = babyAllergies.filter(a => batchAllergenRisk.includes(a));
  if (conflicts.length > 0) return { safe: false, code: 'ALLERGEN_CONFLICT', message: `宝宝过敏史(${conflicts.join('、')})与批次过敏原冲突` };
  const babyMilk = babyAllergies.some(a => a.includes('牛奶') || a.includes('乳糖'));
  const batchMilk = batchAllergenRisk.some(a => a.includes('牛奶') || a.includes('乳糖'));
  if (babyMilk && batchMilk) return { safe: false, code: 'MILK_ALLERGY_WARNING', message: '宝宝有牛奶相关过敏史，但批次为普通配方奶粉' };
  return { safe: true, code: 'ALLERGENS_OK', message: '过敏原检查通过' };
}

function checkDuplicateClaim(babyId, batchId) {
  if (store.hasBabyClaimedBatch(babyId, batchId)) return { duplicate: true, code: 'DUPLICATE_BATCH', message: '已领取过该批次试用装' };
  if (store.hasBabyClaimed(babyId)) return { duplicate: true, code: 'ALREADY_CLAIMED', message: '已领取过试用装，每个宝宝限领一次' };
  return { duplicate: false, code: 'NO_DUPLICATE', message: '无重复领取记录' };
}

function createClaim(requestId, babyId, batchId, operator = 'system') {
  const existing = store.getClaimByRequestId(requestId);
  if (existing) {
    store.addClaimHistory(existing.claimId, 'IDEMPOTENT_RETURN', { message: '请求已存在，幂等返回' });
    return buildResponse(RuleResults.PASS, '请求已存在，幂等返回', 'IDEMPOTENT_SUCCESS', existing, { idempotent: true });
  }

  const baby = store.getBaby(babyId);
  const batch = store.getBatch(batchId);
  const babyValidation = validateBabyProfile(baby);
  const batchValidation = validateBatch(batch);
  const validations = { babyProfile: babyValidation, batchStatus: batchValidation };

  if (babyValidation.status === ValidationStatus.INVALID || batchValidation.status === ValidationStatus.INVALID) {
    return buildResponse(RuleResults.FAIL, '基础验证失败', 'VALIDATION_FAILED', null, validations);
  }

  const ageCheck = checkAgeEligibility(baby.months, batch.monthRange);
  const allergenCheck = checkAllergenSafety(baby.allergies, batch.allergenRisk);
  const duplicateCheck = checkDuplicateClaim(babyId, batchId);
  const eligibilityChecks = { ageEligibility: ageCheck, allergenSafety: allergenCheck, duplicateCheck };

  if (!ageCheck.eligible || !allergenCheck.safe || duplicateCheck.duplicate) {
    return buildResponse(RuleResults.FAIL, '资格检查不通过', 'ELIGIBILITY_FAILED', null, { ...validations, ...eligibilityChecks });
  }

  const claim = store.addClaim({
    requestId, babyId, batchId, status: 'pending', operator, validations, eligibilityChecks
  });
  store.addClaimHistory(claim.claimId, 'CREATED', { operator });
  return buildResponse(RuleResults.PASS, '领取申请创建成功', 'CLAIM_CREATED', claim, { ...validations, ...eligibilityChecks });
}

function advanceClaim(claimId, operator = 'system') {
  const claim = store.getClaim(claimId);
  if (!claim) return buildResponse(RuleResults.FAIL, '领取记录不存在', 'CLAIM_NOT_FOUND');
  if (claim.status === 'completed') {
    store.addClaimHistory(claimId, 'IDEMPOTENT_ADVANCE', {});
    return buildResponse(RuleResults.PASS, '领取已完成', 'ALREADY_COMPLETED', claim, { idempotent: true });
  }
  if (claim.status === 'rejected' || claim.status === 'withdrawn') return buildResponse(RuleResults.FAIL, '领取已终止，无法推进', 'CLAIM_TERMINATED');

  if (claim.status === 'pending') {
    const baby = store.getBaby(claim.babyId);
    const batch = store.getBatch(claim.batchId);
    const babyValidation = validateBabyProfile(baby);
    const batchValidation = validateBatch(batch);
    if (babyValidation.status === ValidationStatus.INVALID || batchValidation.status === ValidationStatus.INVALID) {
      store.updateClaim(claimId, { status: 'failed', failedReason: '基础验证失败' });
      store.addClaimHistory(claimId, 'FAILED', {});
      return buildResponse(RuleResults.FAIL, '推进失败：基础验证不通过', 'ADVANCE_FAILED_VALIDATION');
    }

    const ageCheck = checkAgeEligibility(baby.months, batch.monthRange);
    const allergenCheck = checkAllergenSafety(baby.allergies, batch.allergenRisk);
    const duplicateCheck = checkDuplicateClaim(claim.babyId, claim.batchId);
    if (!ageCheck.eligible || !allergenCheck.safe || duplicateCheck.duplicate) {
      store.updateClaim(claimId, { status: 'rejected', rejectedReason: '资格检查不通过' });
      store.addClaimHistory(claimId, 'REJECTED', {});
      return buildResponse(RuleResults.FAIL, '推进失败：资格检查不通过', 'ADVANCE_FAILED_ELIGIBILITY');
    }

    store.updateClaim(claimId, { status: 'approved', approvedAt: new Date(), approvedBy: operator });
    store.addClaimHistory(claimId, 'APPROVED', { operator });
    return buildResponse(RuleResults.PASS, '领取已审核通过', 'CLAIM_APPROVED', store.getClaim(claimId));
  }

  if (claim.status === 'approved') {
    const batch = store.getBatch(claim.batchId);
    if (batch.totalQuantity - batch.distributed <= 0) {
      store.updateClaim(claimId, { status: 'failed', failedReason: '库存不足' });
      return buildResponse(RuleResults.FAIL, '推进失败：库存不足', 'ADVANCE_FAILED_STOCK');
    }
    store.updateBatch(claim.batchId, { distributed: batch.distributed + 1 });
    store.updateClaim(claimId, { status: 'completed', completedAt: new Date(), distributedBy: operator });
    store.addClaimHistory(claimId, 'COMPLETED', { operator });
    return buildResponse(RuleResults.PASS, '领取已完成', 'CLAIM_COMPLETED', store.getClaim(claimId));
  }

  return buildResponse(RuleResults.FAIL, '未知状态', 'UNKNOWN_STATUS');
}

function withdrawClaim(claimId, reason, operator = 'system') {
  const claim = store.getClaim(claimId);
  if (!claim) return buildResponse(RuleResults.FAIL, '领取记录不存在', 'CLAIM_NOT_FOUND');
  if (claim.status === 'withdrawn') {
    store.addClaimHistory(claimId, 'IDEMPOTENT_WITHDRAW', {});
    return buildResponse(RuleResults.PASS, '已撤回', 'ALREADY_WITHDRAWN', claim, { idempotent: true });
  }
  if (claim.status === 'completed') return buildResponse(RuleResults.FAIL, '已完成的领取无法撤回', 'CANNOT_WITHDRAW_COMPLETED');
  if (claim.status === 'approved') {
    const batch = store.getBatch(claim.batchId);
    store.updateBatch(claim.batchId, { distributed: Math.max(0, batch.distributed - 1) });
  }
  store.updateClaim(claimId, { status: 'withdrawn', withdrawnAt: new Date(), withdrawnReason: reason, withdrawnBy: operator });
  store.addClaimHistory(claimId, 'WITHDRAWN', { reason, operator });
  return buildResponse(RuleResults.PASS, '撤回成功', 'CLAIM_WITHDRAWN', store.getClaim(claimId));
}

let testPassed = 0, testFailed = 0, testManual = 0;

function printSection(title) { console.log('\n' + '='.repeat(60) + `\n  ${title}\n` + '='.repeat(60)); }

function recordTest(label, result, expected = 'PASS') {
  const passed = result.status === expected;
  console.log(`\n[${passed ? '✓ 通过' : '✗ 失败'}] ${label}`);
  console.log(`  业务状态: ${result.status} | 业务编码: ${result.code}`);
  console.log(`  消息: ${result.message}`);
  if (passed) testPassed++; else testFailed++;
  return passed;
}

function main() {
  console.log('\n' + '#'.repeat(60));
  console.log('#  母婴店奶粉试用装分发 API - 验收测试（直接调用）');
  console.log('#  测试目标: 正常处理、失败原因、修正重跑');
  console.log('#  边界维度: 宝宝月龄、过敏史、试用装批次');
  console.log('#'.repeat(60));

  printSection('场景 1: 正常处理流程 - 无过敏宝宝领普通配方');

  console.log('\n1.1 验证宝宝档案 (B002 - 王乐乐, 11月龄, 无过敏史)');
  const baby = store.getBaby('B002');
  const bv = validateBabyProfile(baby);
  recordTest('宝宝档案验证', { status: bv.status === ValidationStatus.VALID ? 'PASS' : 'FAIL', code: bv.code, message: bv.message });

  console.log('\n1.2 验证批次 (BT20260504 - 惠氏2段, 6-12月龄)');
  const batch = store.getBatch('BT20260504');
  const btv = validateBatch(batch);
  recordTest('批次验证', { status: btv.status === ValidationStatus.VALID ? 'PASS' : 'FAIL', code: btv.code, message: btv.message });

  console.log('\n1.3 月龄检查 (11月龄 是否在 6-12月范围)');
  const ac = checkAgeEligibility(baby.months, batch.monthRange);
  const acStatus = ac.eligible ? 'PASS' : 'FAIL';
  recordTest('月龄检查（11月 vs 6-12月）', { status: acStatus, code: ac.code, message: ac.message });

  console.log('\n1.4 创建领取申请 (B002 王乐乐, 11月龄 -> BT20260504 2段)');
  const create1 = createClaim('TEST-001', 'B002', 'BT20260504', 'TestRunner');
  const c1 = recordTest('创建领取申请', create1);
  const claimId1 = create1.data?.claimId;
  if (claimId1) console.log(`  生成的申领ID: ${claimId1}`);

  console.log('\n1.5 重复提交同一requestId (幂等性测试)');
  const dup = createClaim('TEST-001', 'B002', 'BT20260504', 'TestRunner');
  recordTest('幂等创建', dup);

  if (claimId1 && c1) {
    console.log('\n1.6 第一次推进 (pending -> approved)');
    const adv1 = advanceClaim(claimId1, 'TestRunner');
    recordTest('推进到审核通过', adv1);

    console.log('\n1.7 第二次推进 (approved -> completed)');
    const adv2 = advanceClaim(claimId1, 'TestRunner');
    recordTest('推进到完成', adv2);

    console.log('\n1.8 再次推进已完成的申请 (幂等性测试)');
    const adv3 = advanceClaim(claimId1, 'TestRunner');
    recordTest('幂等推进', adv3);
  }

  printSection('场景 2: 失败原因 - 各种资格不通过的情况');

  console.log('\n2.1 过敏原冲突 - 牛奶蛋白过敏宝宝领普通配方');
  const a1 = createClaim('TEST-002', 'B001', 'BT20260501', 'TestRunner');
  recordTest('过敏原冲突（应失败）', a1, 'FAIL');

  console.log('\n2.2 月龄不匹配 - 1月龄宝宝领3段(12-36月)');
  const a2 = createClaim('TEST-003', 'B003', 'BT20260503', 'TestRunner');
  recordTest('月龄不匹配（应失败）', a2, 'FAIL');

  console.log('\n2.3 已召回批次 - BT20260401');
  const a3 = createClaim('TEST-004', 'B004', 'BT20260401', 'TestRunner');
  recordTest('已召回批次（应失败）', a3, 'FAIL');

  console.log('\n2.4 重复领取 - B002已领取，再次申请');
  const a4 = createClaim('TEST-005', 'B002', 'BT20260504', 'TestRunner');
  recordTest('重复领取（应失败）', a4, 'FAIL');

  console.log('\n2.5 不存在的宝宝');
  const a5 = createClaim('TEST-006', 'B999', 'BT20260503', 'TestRunner');
  recordTest('不存在的宝宝（应失败）', a5, 'FAIL');

  printSection('场景 3: 修正后重跑 - 过敏宝宝选错批次，修正后重新领取');

  console.log('\n3.1 过敏宝宝(B001)错误申请普通配方');
  const wrong = createClaim('TEST-007', 'B001', 'BT20260501', 'TestRunner');
  recordTest('错误申请（应失败）', wrong, 'FAIL');

  console.log('\n3.2 检查水解配方(BT20260502 - 雀巢适度水解)');
  const hydro = store.getBatch('BT20260502');
  const hv = validateBatch(hydro);
  recordTest('水解批次验证', { status: hv.status === ValidationStatus.VALID ? 'PASS' : 'FAIL', code: hv.code, message: hv.message });

  console.log('\n3.3 验证过敏宝宝是否符合水解配方');
  const baby2 = store.getBaby('B001');
  const age2 = checkAgeEligibility(baby2.months, hydro.monthRange);
  const all2 = checkAllergenSafety(baby2.allergies, hydro.allergenRisk);
  console.log(`  月龄检查: ${age2.eligible ? '通过' : '不通过'} - ${age2.message}`);
  console.log(`  过敏原检查: ${all2.safe ? '通过' : '不通过'} - ${all2.message}`);
  const checkPassed = age2.eligible && all2.safe;
  recordTest('资格检查（水解配方）', {
    status: checkPassed ? 'PASS' : 'FAIL',
    code: checkPassed ? 'ELIGIBILITY_OK' : 'ELIGIBILITY_FAIL',
    message: checkPassed ? '资格检查通过' : '资格检查不通过'
  });

  console.log('\n3.4 重新申请 - 使用正确的水解配方批次');
  const newClaim = createClaim('TEST-008', 'B001', 'BT20260502', 'TestRunner');
  const nc = recordTest('重新申请（水解配方）', newClaim);
  const claimId2 = newClaim.data?.claimId;

  if (claimId2 && nc) {
    console.log('\n3.5 推进领取流程');
    const advn1 = advanceClaim(claimId2, 'TestRunner');
    recordTest('推进到审核通过', advn1);
    const advn2 = advanceClaim(claimId2, 'TestRunner');
    recordTest('推进到完成', advn2);
  }

  printSection('场景 4: 撤回流程');

  console.log('\n4.1 创建一个待撤回的申请 (B004 陈萌萌, 16月龄 -> BT20260503 3段)');
  const w1 = createClaim('TEST-010', 'B004', 'BT20260503', 'TestRunner');
  const wp = recordTest('创建待撤回申请', w1);
  const claimId3 = w1.data?.claimId;

  if (claimId3 && wp) {
    console.log('\n4.2 撤回申请');
    const w2 = withdrawClaim(claimId3, '用户主动取消', 'TestRunner');
    recordTest('撤回申请', w2);

    console.log('\n4.3 再次撤回同一申请（幂等性测试）');
    const w3 = withdrawClaim(claimId3, '用户主动取消', 'TestRunner');
    recordTest('幂等撤回', w3);

    console.log('\n4.4 尝试推进已撤回的申请（应失败）');
    const wa = advanceClaim(claimId3, 'TestRunner');
    recordTest('推进已撤回申请（应失败）', wa, 'FAIL');
  }

  printSection('场景 5: 汇总查询');

  const summary = store.getClaimsSummary();
  console.log('\n5.1 领取统计:', summary);

  console.log('\n5.2 批次库存:');
  store.getAllBatches().forEach(b => {
    console.log(`    ${b.batchId} (${b.milkBrand}${b.stage}): ` +
      `${b.distributed}/${b.totalQuantity} 已分发, 召回: ${b.recallStatus}`);
  });

  printSection('验收测试完成');

  const total = testPassed + testFailed + testManual;
  console.log('\n测试统计:');
  console.log(`  通过: ${testPassed}`);
  console.log(`  失败: ${testFailed}`);
  console.log(`  人工: ${testManual}`);
  console.log(`  总计: ${total}`);

  console.log('\n输出规范说明:');
  console.log('  status=PASS   → ✓ 自动通过，无需人工处理');
  console.log('  status=FAIL   → ✗ 系统拦截，需要检查原因');
  console.log('  status=MANUAL → ? 需要人工审核确认');

  console.log('\n业务编码规范:');
  console.log('  *_CREATED / *_APPROVED / *_COMPLETED  → 正常状态');
  console.log('  *_FAILED  / *_REJECTED / *_TERMINATED → 失败状态');
  console.log('  IDEMPOTENT_*                          → 幂等保护');

  process.exit(testFailed > 0 ? 1 : 0);
}

main();
