const express = require('express');

const app = express();
const PORT = 3000;

app.use(express.json());

const database = {
  babies: {
    B001: {
      babyId: 'B001',
      memberId: 'M001',
      memberName: '张小宝',
      motherName: '李妈妈',
      birthDate: '2025-02-15',
      months: 3,
      allergies: ['牛奶蛋白'],
      isActive: true,
      createdAt: new Date('2025-03-01'),
      history: []
    },
    B002: {
      babyId: 'B002',
      memberId: 'M002',
      memberName: '王乐乐',
      motherName: '王妈妈',
      birthDate: '2024-06-10',
      months: 11,
      allergies: [],
      isActive: true,
      createdAt: new Date('2024-07-01'),
      history: []
    },
    B003: {
      babyId: 'B003',
      memberId: 'M003',
      memberName: '刘甜甜',
      motherName: '刘妈妈',
      birthDate: '2025-04-20',
      months: 1,
      allergies: ['乳糖不耐受'],
      isActive: true,
      createdAt: new Date('2025-05-01'),
      history: []
    },
    B004: {
      babyId: 'B004',
      memberId: 'M004',
      memberName: '陈萌萌',
      motherName: '陈妈妈',
      birthDate: '2024-01-05',
      months: 16,
      allergies: [],
      isActive: true,
      createdAt: new Date('2024-02-01'),
      history: []
    }
  },
  batches: {
    BT20260501: {
      batchId: 'BT20260501',
      milkBrand: '爱他美',
      milkType: '普通配方',
      stage: '1段',
      monthRange: { min: 0, max: 6 },
      allergenRisk: ['牛奶蛋白', '乳糖'],
      totalQuantity: 100,
      distributed: 15,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    },
    BT20260502: {
      batchId: 'BT20260502',
      milkBrand: '雀巢',
      milkType: '适度水解',
      stage: '1段',
      monthRange: { min: 0, max: 6 },
      allergenRisk: [],
      totalQuantity: 80,
      distributed: 8,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    },
    BT20260401: {
      batchId: 'BT20260401',
      milkBrand: '美赞臣',
      milkType: '普通配方',
      stage: '2段',
      monthRange: { min: 6, max: 12 },
      allergenRisk: ['牛奶蛋白'],
      totalQuantity: 120,
      distributed: 45,
      recallStatus: 'recalled',
      isActive: true,
      createdAt: new Date('2026-04-01'),
      expiryDate: '2027-04-01'
    },
    BT20260503: {
      batchId: 'BT20260503',
      milkBrand: '伊利',
      milkType: '普通配方',
      stage: '3段',
      monthRange: { min: 12, max: 36 },
      allergenRisk: ['牛奶蛋白'],
      totalQuantity: 150,
      distributed: 20,
      recallStatus: 'normal',
      isActive: true,
      createdAt: new Date('2026-05-01'),
      expiryDate: '2027-05-01'
    }
  },
  claims: {},
  claimHistory: {}
};

let nextClaimId = 1;
let nextHistoryId = 1;

const store = {
  getBaby(babyId) {
    return database.babies[babyId];
  },

  getAllBabies() {
    return Object.values(database.babies);
  },

  addBaby(baby) {
    database.babies[baby.babyId] = baby;
    return baby;
  },

  updateBaby(babyId, updates) {
    if (!database.babies[babyId]) return null;
    const before = JSON.stringify(database.babies[babyId]);
    Object.assign(database.babies[babyId], updates);
    database.babies[babyId].history.push({
      historyId: nextHistoryId++,
      updatedAt: new Date(),
      before: JSON.parse(before),
      after: JSON.parse(JSON.stringify(database.babies[babyId]))
    });
    return database.babies[babyId];
  },

  getBatch(batchId) {
    return database.batches[batchId];
  },

  getAllBatches() {
    return Object.values(database.batches);
  },

  addBatch(batch) {
    database.batches[batch.batchId] = batch;
    return batch;
  },

  updateBatch(batchId, updates) {
    if (!database.batches[batchId]) return null;
    Object.assign(database.batches[batchId], updates);
    return database.batches[batchId];
  },

  getClaim(claimId) {
    return database.claims[claimId];
  },

  getClaimByRequestId(requestId) {
    return Object.values(database.claims).find(c => c.requestId === requestId);
  },

  getAllClaims() {
    return Object.values(database.claims);
  },

  addClaim(claim) {
    const claimId = 'C' + (nextClaimId++).toString().padStart(6, '0');
    database.claims[claimId] = { ...claim, claimId, createdAt: new Date() };
    return database.claims[claimId];
  },

  updateClaim(claimId, updates) {
    if (!database.claims[claimId]) return null;
    Object.assign(database.claims[claimId], updates);
    return database.claims[claimId];
  },

  addClaimHistory(claimId, eventType, details) {
    const history = {
      historyId: nextHistoryId++,
      claimId,
      eventType,
      details,
      timestamp: new Date()
    };
    if (!database.claimHistory[claimId]) {
      database.claimHistory[claimId] = [];
    }
    database.claimHistory[claimId].push(history);
    return history;
  },

  getClaimHistory(claimId) {
    return database.claimHistory[claimId] || [];
  },

  getClaimsByBaby(babyId) {
    return Object.values(database.claims).filter(c => c.babyId === babyId);
  },

  hasBabyClaimedBatch(babyId, batchId) {
    return Object.values(database.claims).some(
      c => c.babyId === babyId &&
        c.batchId === batchId &&
        ['approved', 'completed'].includes(c.status)
    );
  },

  hasBabyClaimed(babyId) {
    return Object.values(database.claims).some(
      c => c.babyId === babyId && ['approved', 'completed'].includes(c.status)
    );
  },

  getClaimsSummary() {
    const claims = this.getAllClaims();
    return {
      total: claims.length,
      pending: claims.filter(c => c.status === 'pending').length,
      approved: claims.filter(c => c.status === 'approved').length,
      completed: claims.filter(c => c.status === 'completed').length,
      rejected: claims.filter(c => c.status === 'rejected').length,
      withdrawn: claims.filter(c => c.status === 'withdrawn').length,
      failed: claims.filter(c => c.status === 'failed').length
    };
  }
};

const RuleResults = { PASS: 'PASS', FAIL: 'FAIL', MANUAL: 'MANUAL' };
const ValidationStatus = { VALID: 'VALID', INVALID: 'INVALID', UNCERTAIN: 'UNCERTAIN' };

function buildResponse(status, message, code, data = null, details = null) {
  return {
    status,
    code,
    message,
    data,
    details,
    timestamp: new Date().toISOString()
  };
}

function validateBabyProfile(baby) {
  if (!baby) {
    return { status: ValidationStatus.INVALID, code: 'BABY_NOT_FOUND', message: '宝宝档案不存在', details: { reason: 'baby_not_found' } };
  }
  if (!baby.isActive) {
    return { status: ValidationStatus.INVALID, code: 'BABY_INACTIVE', message: '宝宝档案已失效', details: { reason: 'baby_inactive', babyId: baby.babyId } };
  }
  const now = new Date();
  const birth = new Date(baby.birthDate);
  const ageMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (ageMonths < 0) {
    return { status: ValidationStatus.UNCERTAIN, code: 'BIRTH_DATE_INVALID', message: '出生日期在当前时间之后，需要人工确认', details: { reason: 'birth_date_future', babyMonths: baby.months, calculatedMonths: ageMonths } };
  }
  if (Math.abs(ageMonths - baby.months) > 1) {
    return { status: ValidationStatus.UNCERTAIN, code: 'AGE_MISMATCH', message: '档案月龄与计算月龄不一致，建议检查', details: { reason: 'age_mismatch', recordedMonths: baby.months, calculatedMonths: ageMonths } };
  }
  return {
    status: ValidationStatus.VALID,
    code: 'BABY_VALID',
    message: '宝宝档案有效',
    details: { babyId: baby.babyId, memberName: baby.memberName, months: baby.months, allergies: baby.allergies, isActive: baby.isActive }
  };
}

function validateBatch(batch) {
  if (!batch) {
    return { status: ValidationStatus.INVALID, code: 'BATCH_NOT_FOUND', message: '批次不存在', details: { reason: 'batch_not_found' } };
  }
  if (!batch.isActive) {
    return { status: ValidationStatus.INVALID, code: 'BATCH_INACTIVE', message: '批次已停用', details: { reason: 'batch_inactive', batchId: batch.batchId } };
  }
  if (batch.recallStatus === 'recalled') {
    return { status: ValidationStatus.INVALID, code: 'BATCH_RECALLED', message: '批次已召回，禁止分发', details: { reason: 'batch_recalled', batchId: batch.batchId } };
  }
  const remaining = batch.totalQuantity - batch.distributed;
  if (remaining <= 0) {
    return { status: ValidationStatus.INVALID, code: 'BATCH_OUT_OF_STOCK', message: '批次库存不足', details: { reason: 'out_of_stock', total: batch.totalQuantity, distributed: batch.distributed } };
  }
  const expiry = new Date(batch.expiryDate);
  const now = new Date();
  const daysToExpiry = Math.floor((expiry - now) / (1000 * 60 * 60 * 24));
  if (daysToExpiry < 0) {
    return { status: ValidationStatus.INVALID, code: 'BATCH_EXPIRED', message: '批次已过期', details: { reason: 'expired', expiryDate: batch.expiryDate } };
  }
  if (daysToExpiry < 30) {
    return { status: ValidationStatus.UNCERTAIN, code: 'BATCH_EXPIRING_SOON', message: '批次即将过期（30天内），建议人工确认', details: { reason: 'expiring_soon', expiryDate: batch.expiryDate, daysRemaining: daysToExpiry } };
  }
  return {
    status: ValidationStatus.VALID,
    code: 'BATCH_VALID',
    message: '批次有效',
    details: { batchId: batch.batchId, brand: batch.milkBrand, type: batch.milkType, stage: batch.stage, monthRange: batch.monthRange, allergenRisk: batch.allergenRisk, remaining: batch.totalQuantity - batch.distributed }
  };
}

function checkAgeEligibility(babyMonths, batchMonthRange) {
  if (babyMonths < batchMonthRange.min) {
    return { eligible: false, code: 'TOO_YOUNG', message: `宝宝月龄(${babyMonths}月)小于批次最小月龄(${batchMonthRange.min}月)`, details: { babyMonths, minMonth: batchMonthRange.min } };
  }
  if (babyMonths > batchMonthRange.max) {
    return { eligible: false, code: 'TOO_OLD', message: `宝宝月龄(${babyMonths}月)超过批次最大月龄(${batchMonthRange.max}月)`, details: { babyMonths, maxMonth: batchMonthRange.max } };
  }
  return { eligible: true, code: 'AGE_OK', message: '月龄符合要求', details: { babyMonths, monthRange: batchMonthRange } };
}

function checkAllergenSafety(babyAllergies, batchAllergenRisk) {
  if (!babyAllergies || babyAllergies.length === 0) {
    return { safe: true, code: 'NO_ALLERGIES', message: '宝宝无过敏史', details: { babyAllergies: [], batchAllergenRisk } };
  }
  const conflicts = [];
  for (const allergy of babyAllergies) {
    if (batchAllergenRisk.includes(allergy)) {
      conflicts.push(allergy);
    }
  }
  if (conflicts.length > 0) {
    return { safe: false, code: 'ALLERGEN_CONFLICT', message: `宝宝过敏史(${conflicts.join('、')})与批次过敏原冲突`, details: { babyAllergies, batchAllergenRisk, conflicts } };
  }
  const babyHasMilkAllergy = babyAllergies.some(a => a.includes('牛奶') || a.includes('乳蛋白'));
  const batchIsRegular = batchAllergenRisk.some(a => a.includes('牛奶') || a.includes('乳糖'));
  if (babyHasMilkAllergy && batchIsRegular) {
    return { safe: false, code: 'MILK_ALLERGY_WARNING', message: '宝宝有牛奶相关过敏史，但批次为普通配方奶粉', details: { babyAllergies, batchAllergenRisk } };
  }
  return { safe: true, code: 'ALLERGENS_OK', message: '过敏原检查通过', details: { babyAllergies, batchAllergenRisk } };
}

function checkDuplicateClaim(babyId, batchId) {
  if (store.hasBabyClaimedBatch(babyId, batchId)) {
    return { duplicate: true, code: 'DUPLICATE_BATCH', message: '已领取过该批次试用装', details: { babyId, batchId } };
  }
  if (store.hasBabyClaimed(babyId)) {
    const claims = store.getClaimsByBaby(babyId).filter(c => ['approved', 'completed'].includes(c.status));
    return { duplicate: true, code: 'ALREADY_CLAIMED', message: '已领取过试用装，每个宝宝限领一次', details: { babyId, claimCount: claims.length } };
  }
  return { duplicate: false, code: 'NO_DUPLICATE', message: '无重复领取记录', details: { babyId } };
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

  const hasInvalid = Object.values(validations).some(v => v.status === ValidationStatus.INVALID);
  if (hasInvalid) {
    return buildResponse(RuleResults.FAIL, '基础验证失败', 'VALIDATION_FAILED', null, validations);
  }

  if (babyValidation.status === ValidationStatus.UNCERTAIN || batchValidation.status === ValidationStatus.UNCERTAIN) {
    return buildResponse(RuleResults.MANUAL, '存在不确定因素，需要人工审核', 'NEEDS_MANUAL_REVIEW', null, validations);
  }

  const ageCheck = checkAgeEligibility(baby.months, batch.monthRange);
  const allergenCheck = checkAllergenSafety(baby.allergies, batch.allergenRisk);
  const duplicateCheck = checkDuplicateClaim(babyId, batchId);
  const eligibilityChecks = { ageEligibility: ageCheck, allergenSafety: allergenCheck, duplicateCheck };

  if (!ageCheck.eligible || !allergenCheck.safe || duplicateCheck.duplicate) {
    return buildResponse(RuleResults.FAIL, '资格检查不通过', 'ELIGIBILITY_FAILED', null, { ...validations, ...eligibilityChecks });
  }

  const claim = store.addClaim({
    requestId,
    babyId,
    batchId,
    status: 'pending',
    operator,
    validations,
    eligibilityChecks
  });

  store.addClaimHistory(claim.claimId, 'CREATED', { message: '领取申请已创建', operator });
  return buildResponse(RuleResults.PASS, '领取申请创建成功', 'CLAIM_CREATED', claim, { ...validations, ...eligibilityChecks });
}

function advanceClaim(claimId, operator = 'system') {
  const claim = store.getClaim(claimId);
  if (!claim) {
    return buildResponse(RuleResults.FAIL, '领取记录不存在', 'CLAIM_NOT_FOUND', null, { claimId });
  }

  if (claim.status === 'completed') {
    store.addClaimHistory(claimId, 'IDEMPOTENT_ADVANCE', { message: '已完成状态，幂等返回' });
    return buildResponse(RuleResults.PASS, '领取已完成', 'ALREADY_COMPLETED', claim, { idempotent: true });
  }

  if (claim.status === 'rejected' || claim.status === 'withdrawn') {
    return buildResponse(RuleResults.FAIL, '领取已终止，无法推进', 'CLAIM_TERMINATED', claim, { currentStatus: claim.status });
  }

  if (claim.status === 'pending') {
    const baby = store.getBaby(claim.babyId);
    const batch = store.getBatch(claim.batchId);

    const babyValidation = validateBabyProfile(baby);
    const batchValidation = validateBatch(batch);

    if (babyValidation.status === ValidationStatus.INVALID || batchValidation.status === ValidationStatus.INVALID) {
      store.updateClaim(claimId, { status: 'failed', failedReason: '基础验证失败' });
      store.addClaimHistory(claimId, 'FAILED', { reason: '基础验证失败', details: { babyValidation, batchValidation } });
      return buildResponse(RuleResults.FAIL, '推进失败：基础验证不通过', 'ADVANCE_FAILED_VALIDATION', store.getClaim(claimId), { babyValidation, batchValidation });
    }

    const ageCheck = checkAgeEligibility(baby.months, batch.monthRange);
    const allergenCheck = checkAllergenSafety(baby.allergies, batch.allergenRisk);
    const duplicateCheck = checkDuplicateClaim(claim.babyId, claim.batchId);

    if (!ageCheck.eligible || !allergenCheck.safe || duplicateCheck.duplicate) {
      store.updateClaim(claimId, { status: 'rejected', rejectedReason: '资格检查不通过' });
      store.addClaimHistory(claimId, 'REJECTED', { reason: '资格检查不通过', details: { ageCheck, allergenCheck, duplicateCheck } });
      return buildResponse(RuleResults.FAIL, '推进失败：资格检查不通过', 'ADVANCE_FAILED_ELIGIBILITY', store.getClaim(claimId), { ageCheck, allergenCheck, duplicateCheck });
    }

    store.updateClaim(claimId, { status: 'approved', approvedAt: new Date(), approvedBy: operator });
    store.addClaimHistory(claimId, 'APPROVED', { operator });
    return buildResponse(RuleResults.PASS, '领取已审核通过', 'CLAIM_APPROVED', store.getClaim(claimId));
  }

  if (claim.status === 'approved') {
    const batch = store.getBatch(claim.batchId);
    const remaining = batch.totalQuantity - batch.distributed;

    if (remaining <= 0) {
      store.updateClaim(claimId, { status: 'failed', failedReason: '库存不足' });
      store.addClaimHistory(claimId, 'FAILED', { reason: '库存不足' });
      return buildResponse(RuleResults.FAIL, '推进失败：库存不足', 'ADVANCE_FAILED_STOCK', store.getClaim(claimId), { batchId: batch.batchId, remaining: 0 });
    }

    store.updateBatch(claim.batchId, { distributed: batch.distributed + 1 });
    store.updateClaim(claimId, { status: 'completed', completedAt: new Date(), distributedBy: operator });
    store.addClaimHistory(claimId, 'COMPLETED', { operator, batchDistributed: batch.distributed + 1 });
    return buildResponse(RuleResults.PASS, '领取已完成', 'CLAIM_COMPLETED', store.getClaim(claimId));
  }

  return buildResponse(RuleResults.FAIL, '未知状态，无法推进', 'UNKNOWN_STATUS', claim, { currentStatus: claim.status });
}

function withdrawClaim(claimId, reason, operator = 'system') {
  const claim = store.getClaim(claimId);
  if (!claim) {
    return buildResponse(RuleResults.FAIL, '领取记录不存在', 'CLAIM_NOT_FOUND', null, { claimId });
  }

  if (claim.status === 'withdrawn') {
    store.addClaimHistory(claimId, 'IDEMPOTENT_WITHDRAW', { message: '已撤回状态，幂等返回' });
    return buildResponse(RuleResults.PASS, '已撤回', 'ALREADY_WITHDRAWN', claim, { idempotent: true });
  }

  if (claim.status === 'completed') {
    return buildResponse(RuleResults.FAIL, '已完成的领取无法撤回，需走修正流程', 'CANNOT_WITHDRAW_COMPLETED', claim, { currentStatus: claim.status });
  }

  if (claim.status === 'approved') {
    const batch = store.getBatch(claim.batchId);
    store.updateBatch(claim.batchId, { distributed: Math.max(0, batch.distributed - 1) });
  }

  store.updateClaim(claimId, { status: 'withdrawn', withdrawnAt: new Date(), withdrawnReason: reason, withdrawnBy: operator });
  store.addClaimHistory(claimId, 'WITHDRAWN', { reason, operator });
  return buildResponse(RuleResults.PASS, '撤回成功', 'CLAIM_WITHDRAWN', store.getClaim(claimId));
}

function correctBabyProfile(babyId, updates, operator = 'system') {
  const baby = store.getBaby(babyId);
  if (!baby) {
    return buildResponse(RuleResults.FAIL, '宝宝档案不存在', 'BABY_NOT_FOUND', null, { babyId });
  }
  const updated = store.updateBaby(babyId, { ...updates, updatedAt: new Date(), updatedBy: operator });
  return buildResponse(RuleResults.PASS, '宝宝档案已修正', 'BABY_UPDATED', updated);
}

function correctClaim(claimId, correction, operator = 'system') {
  const claim = store.getClaim(claimId);
  if (!claim) {
    return buildResponse(RuleResults.FAIL, '领取记录不存在', 'CLAIM_NOT_FOUND', null, { claimId });
  }

  if (correction.type === 'change_batch') {
    if (!correction.newBatchId) {
      return buildResponse(RuleResults.FAIL, '缺少新批次ID', 'MISSING_BATCH_ID');
    }

    const newBatch = store.getBatch(correction.newBatchId);
    const batchValidation = validateBatch(newBatch);

    if (batchValidation.status === ValidationStatus.INVALID) {
      return buildResponse(RuleResults.FAIL, '新批次无效', 'INVALID_BATCH', null, { batchValidation });
    }

    const baby = store.getBaby(claim.babyId);
    const ageCheck = checkAgeEligibility(baby.months, newBatch.monthRange);
    const allergenCheck = checkAllergenSafety(baby.allergies, newBatch.allergenRisk);

    if (!ageCheck.eligible || !allergenCheck.safe) {
      return buildResponse(RuleResults.MANUAL, '新批次资格检查不通过，需要人工确认', 'CORRECTION_NEEDS_REVIEW', null, { ageCheck, allergenCheck });
    }

    if (claim.status === 'approved' || claim.status === 'completed') {
      const oldBatch = store.getBatch(claim.batchId);
      store.updateBatch(claim.batchId, { distributed: Math.max(0, oldBatch.distributed - 1) });
      store.updateBatch(correction.newBatchId, { distributed: newBatch.distributed + 1 });
    }

    store.updateClaim(claimId, {
      batchId: correction.newBatchId,
      status: 'pending',
      corrections: {
        type: 'change_batch',
        oldBatchId: claim.batchId,
        newBatchId: correction.newBatchId,
        correctedBy: operator,
        correctedAt: new Date(),
        reason: correction.reason
      }
    });

    store.addClaimHistory(claimId, 'CORRECTED_BATCH', {
      oldBatchId: claim.batchId,
      newBatchId: correction.newBatchId,
      reason: correction.reason,
      operator
    });

    return buildResponse(RuleResults.PASS, '批次已修正，需要重新推进流程', 'BATCH_CORRECTED', store.getClaim(claimId));
  }

  return buildResponse(RuleResults.FAIL, '不支持的修正类型', 'UNSUPPORTED_CORRECTION');
}

function queryClaimsSummary() {
  const summary = store.getClaimsSummary();
  return buildResponse(RuleResults.PASS, '查询成功', 'QUERY_SUCCESS', {
    summary,
    batches: store.getAllBatches().map(b => ({
      batchId: b.batchId, brand: b.milkBrand, stage: b.stage, total: b.totalQuantity,
      distributed: b.distributed, remaining: b.totalQuantity - b.distributed, recallStatus: b.recallStatus
    })),
    babies: store.getAllBabies().map(b => ({
      babyId: b.babyId, memberName: b.memberName, months: b.months,
      allergies: b.allergies, claimCount: store.getClaimsByBaby(b.babyId).length
    }))
  });
}

function queryBabyClaims(babyId) {
  const baby = store.getBaby(babyId);
  if (!baby) {
    return buildResponse(RuleResults.FAIL, '宝宝档案不存在', 'BABY_NOT_FOUND', null, { babyId });
  }
  return buildResponse(RuleResults.PASS, '查询成功', 'QUERY_SUCCESS', {
    baby,
    claims: store.getClaimsByBaby(babyId),
    history: store.getAllClaims().filter(c => c.babyId === babyId).flatMap(c => store.getClaimHistory(c.claimId))
  });
}

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/babies', (req, res) => {
  const babies = store.getAllBabies();
  const validated = babies.map(baby => ({ ...baby, validation: validateBabyProfile(baby) }));
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: validated });
});

app.get('/api/babies/:babyId', (req, res) => {
  const baby = store.getBaby(req.params.babyId);
  if (!baby) {
    return res.status(404).json({ status: 'FAIL', code: 'BABY_NOT_FOUND', message: '宝宝档案不存在' });
  }
  const validation = validateBabyProfile(baby);
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: { ...baby, validation } });
});

app.get('/api/batches', (req, res) => {
  const batches = store.getAllBatches();
  const validated = batches.map(batch => ({ ...batch, validation: validateBatch(batch) }));
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: validated });
});

app.get('/api/batches/:batchId', (req, res) => {
  const batch = store.getBatch(req.params.batchId);
  if (!batch) {
    return res.status(404).json({ status: 'FAIL', code: 'BATCH_NOT_FOUND', message: '批次不存在' });
  }
  const validation = validateBatch(batch);
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: { ...batch, validation } });
});

app.post('/api/claims/create', (req, res) => {
  const { requestId, babyId, batchId, operator } = req.body;
  if (!requestId || !babyId || !batchId) {
    return res.status(400).json({ status: 'FAIL', code: 'MISSING_PARAMS', message: '缺少必要参数: requestId, babyId, batchId' });
  }
  const result = createClaim(requestId, babyId, batchId, operator);
  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  if (result.status === 'MANUAL') httpStatus = 202;
  res.status(httpStatus).json(result);
});

app.post('/api/claims/advance', (req, res) => {
  const { claimId, operator } = req.body;
  if (!claimId) {
    return res.status(400).json({ status: 'FAIL', code: 'MISSING_PARAMS', message: '缺少必要参数: claimId' });
  }
  const result = advanceClaim(claimId, operator);
  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  res.status(httpStatus).json(result);
});

app.post('/api/claims/withdraw', (req, res) => {
  const { claimId, reason, operator } = req.body;
  if (!claimId || !reason) {
    return res.status(400).json({ status: 'FAIL', code: 'MISSING_PARAMS', message: '缺少必要参数: claimId, reason' });
  }
  const result = withdrawClaim(claimId, reason, operator);
  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  res.status(httpStatus).json(result);
});

app.post('/api/babies/correct', (req, res) => {
  const { babyId, updates, operator } = req.body;
  if (!babyId) {
    return res.status(400).json({ status: 'FAIL', code: 'MISSING_PARAMS', message: '缺少必要参数: babyId' });
  }
  const result = correctBabyProfile(babyId, updates, operator);
  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  res.status(httpStatus).json(result);
});

app.post('/api/claims/correct', (req, res) => {
  const { claimId, correction, operator } = req.body;
  if (!claimId || !correction || !correction.type) {
    return res.status(400).json({ status: 'FAIL', code: 'MISSING_PARAMS', message: '缺少必要参数: claimId, correction.type' });
  }
  const result = correctClaim(claimId, correction, operator);
  let httpStatus = 200;
  if (result.status === 'FAIL') httpStatus = 400;
  if (result.status === 'MANUAL') httpStatus = 202;
  res.status(httpStatus).json(result);
});

app.get('/api/claims', (req, res) => {
  const claims = store.getAllClaims();
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: claims });
});

app.get('/api/claims/:claimId', (req, res) => {
  const claim = store.getClaim(req.params.claimId);
  if (!claim) {
    return res.status(404).json({ status: 'FAIL', code: 'CLAIM_NOT_FOUND', message: '领取记录不存在' });
  }
  const history = store.getClaimHistory(req.params.claimId);
  res.json({ status: 'PASS', code: 'QUERY_SUCCESS', message: '查询成功', data: { claim, history } });
});

app.get('/api/summary', (req, res) => {
  const result = queryClaimsSummary();
  res.json(result);
});

app.get('/api/babies/:babyId/claims', (req, res) => {
  const result = queryBabyClaims(req.params.babyId);
  if (result.status === 'FAIL') {
    return res.status(404).json(result);
  }
  res.json(result);
});

app.post('/api/check/eligibility', (req, res) => {
  const { babyId, batchId } = req.body;
  const baby = store.getBaby(babyId);
  const batch = store.getBatch(batchId);

  if (!baby || !batch) {
    return res.status(400).json({ status: 'FAIL', code: 'NOT_FOUND', message: '宝宝或批次不存在' });
  }

  const babyValidation = validateBabyProfile(baby);
  const batchValidation = validateBatch(batch);
  const ageCheck = checkAgeEligibility(baby.months, batch.monthRange);
  const allergenCheck = checkAllergenSafety(baby.allergies, batch.allergenRisk);
  const duplicateCheck = checkDuplicateClaim(babyId, batchId);

  const allChecks = { babyProfile: babyValidation, batchStatus: batchValidation, ageEligibility: ageCheck, allergenSafety: allergenCheck, duplicateCheck };

  const hasInvalid = babyValidation.status === 'INVALID' || batchValidation.status === 'INVALID';
  const hasEligibilityFail = !ageCheck.eligible || !allergenCheck.safe || duplicateCheck.duplicate;
  const hasUncertain = babyValidation.status === 'UNCERTAIN' || batchValidation.status === 'UNCERTAIN';

  let overall = 'PASS';
  if (hasInvalid || hasEligibilityFail) overall = 'FAIL';
  else if (hasUncertain) overall = 'MANUAL';

  res.json({
    status: overall,
    code: 'ELIGIBILITY_CHECKED',
    message: overall === 'PASS' ? '资格检查通过' : overall === 'FAIL' ? '资格检查不通过' : '需要人工审核',
    details: allChecks
  });
});

app.listen(PORT, () => {
  console.log(`母婴店奶粉试用装分发 API 服务已启动`);
  console.log(`服务地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`API 基础路径: http://localhost:${PORT}/api`);
  console.log('');
  console.log('运行验收测试: npm test');
});

module.exports = app;
