const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../db');

const MANUAL_REVIEW_THRESHOLD = 50000;

const REQUIRED_MATERIALS = {
  '门诊理赔': ['身份证', '门诊发票', '门诊病历', '费用清单'],
  '住院理赔': ['身份证', '住院发票', '出院小结', '费用清单', '诊断证明'],
  '重疾理赔': ['身份证', '诊断证明', '病理报告', '检查报告']
};

const COVERED_DIAGNOSES = ['急性阑尾炎', '骨折', '肺炎', '冠心病', '糖尿病'];

const checkPolicyResponsibility = async (claim) => {
  const result = {
    covered: true,
    responsibility: '属于保险责任范围',
    details: {}
  };

  if (!claim.diagnosis) {
    result.covered = false;
    result.responsibility = '缺少诊断信息，无法确认责任';
    result.details.missing_diagnosis = true;
    return result;
  }

  const isDiagnosisCovered = COVERED_DIAGNOSES.some(d => 
    claim.diagnosis.includes(d)
  );

  if (!isDiagnosisCovered) {
    result.covered = false;
    result.responsibility = `诊断病种"${claim.diagnosis}"不属于保单责任范围`;
    result.details.diagnosis_not_covered = true;
  }

  const accidentDate = new Date(claim.accident_date);
  const policyStartDate = new Date('2020-01-01');
  if (accidentDate < policyStartDate) {
    result.covered = false;
    result.responsibility = '事故发生在保单生效前';
    result.details.policy_expired = true;
  }

  return result;
};

const checkMaterialGaps = (claim) => {
  const gaps = [];
  const materials = JSON.parse(claim.materials || '[]');
  const claimType = claim.claim_type || '住院理赔';

  const required = REQUIRED_MATERIALS[claimType] || REQUIRED_MATERIALS['住院理赔'];

  required.forEach(requiredMat => {
    if (!materials.includes(requiredMat)) {
      gaps.push({
        type: claimType,
        missing: requiredMat,
        reason: `${claimType}必须提供${requiredMat}`
      });
    }
  });

  if (claim.claim_amount >= 10000 && !materials.includes('银行卡')) {
    gaps.push({
      type: '大额赔付',
      missing: '银行卡信息',
      reason: '金额超过1万元需要提供银行卡用于转账'
    });
  }

  return gaps;
};

const checkDuplicateClaim = async (claim) => {
  const result = {
    is_duplicate: false,
    details: null
  };

  const duplicates = await all(
    `SELECT * FROM claim_materials 
     WHERE insured_id_card = ? 
       AND accident_date = ? 
       AND id != ?
     LIMIT 10`,
    [claim.insured_id_card, claim.accident_date, claim.id]
  );

  if (duplicates.length > 0) {
    result.is_duplicate = true;
    result.details = {
      same_id_card_and_date: true,
      duplicate_count: duplicates.length,
      duplicate_claims: duplicates.map(d => ({
        claim_no: d.claim_no,
        amount: d.claim_amount,
        created_at: d.created_at
      }))
    };
  }

  const samePolicy = await all(
    `SELECT * FROM claim_materials 
     WHERE policy_no = ? 
       AND accident_date = ? 
       AND id != ?
     LIMIT 10`,
    [claim.policy_no, claim.accident_date, claim.id]
  );

  if (samePolicy.length > 0 && !result.is_duplicate) {
    result.is_duplicate = true;
    result.details = {
      same_policy_and_date: true,
      duplicate_count: samePolicy.length,
      duplicate_claims: samePolicy.map(d => ({
        claim_no: d.claim_no,
        amount: d.claim_amount,
        created_at: d.created_at
      }))
    };
  }

  return result;
};

const determineCategory = (policyCheck, materialGaps, duplicateCheck, claimAmount) => {
  const reasons = [];
  const nextActions = [];
  let category = 'normal';
  let needsManualReview = false;
  let reviewReason = '';

  if (duplicateCheck.is_duplicate) {
    category = 'blocked';
    reasons.push('重复报案');
    nextActions.push('标记为重复报案，转入人工核实后做撤案处理');
  } else if (!policyCheck.covered) {
    category = 'blocked';
    reasons.push(policyCheck.responsibility);
    nextActions.push('不属于保险责任，做拒赔处理');
  } else if (materialGaps.length > 0) {
    category = 'supplement';
    reasons.push(`缺少${materialGaps.length}项必要材料`);
    materialGaps.forEach(gap => {
      reasons.push(gap.reason);
      nextActions.push(`请补充：${gap.missing}`);
    });
  }

  if (claimAmount >= MANUAL_REVIEW_THRESHOLD && category === 'normal') {
    needsManualReview = true;
    reviewReason = `理赔金额${claimAmount}元超过阈值${MANUAL_REVIEW_THRESHOLD}元，需要人工复核`;
    reasons.push(reviewReason);
    nextActions.push('转审核专员进行人工复核');
  }

  return {
    category,
    reasons,
    nextActions,
    needsManualReview,
    reviewReason
  };
};

const precheckSingleClaim = async (claim) => {
  try {
    const policyCheck = await checkPolicyResponsibility(claim);
    const materialGaps = checkMaterialGaps(claim);
    const duplicateCheck = await checkDuplicateClaim(claim);

    const categoryResult = determineCategory(
      policyCheck,
      materialGaps,
      duplicateCheck,
      claim.claim_amount
    );

    const resultId = uuidv4();
    await run(
      `INSERT INTO precheck_results 
       (id, claim_id, batch_id, category, policy_responsibility, 
        material_gaps, duplicate_claim, reasons, next_actions, 
        needs_manual_review, review_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId,
        claim.id,
        claim.batch_id,
        categoryResult.category,
        JSON.stringify(policyCheck),
        JSON.stringify(materialGaps),
        JSON.stringify(duplicateCheck),
        JSON.stringify(categoryResult.reasons),
        JSON.stringify(categoryResult.nextActions),
        categoryResult.needsManualReview ? 1 : 0,
        categoryResult.reviewReason
      ]
    );

    const taskId = uuidv4();
    await run(
      'INSERT INTO task_status (id, batch_id, claim_id, status, message) VALUES (?, ?, ?, ?, ?)',
      [taskId, claim.batch_id, claim.id, 'completed', `预审完成，分类：${categoryResult.category}`]
    );

    return {
      id: resultId,
      claim_id: claim.id,
      claim_no: claim.claim_no,
      category: categoryResult.category,
      policy_responsibility: policyCheck,
      material_gaps: materialGaps,
      duplicate_claim: duplicateCheck,
      reasons: categoryResult.reasons,
      next_actions: categoryResult.nextActions,
      needs_manual_review: categoryResult.needsManualReview,
      review_reason: categoryResult.reviewReason
    };
  } catch (err) {
    const taskId = uuidv4();
    await run(
      'INSERT INTO task_status (id, batch_id, claim_id, status, message) VALUES (?, ?, ?, ?, ?)',
      [taskId, claim.batch_id, claim.id, 'failed', `预审失败：${err.message}`]
    );
    throw err;
  }
};

const precheckBatch = async (batchId) => {
  const batch = await get('SELECT * FROM batches WHERE id = ?', [batchId]);
  if (!batch) {
    throw new Error('批次不存在');
  }

  const taskId = uuidv4();
  await run(
    'INSERT INTO task_status (id, batch_id, status, message) VALUES (?, ?, ?, ?)',
    [taskId, batchId, 'processing', '开始批量预审']
  );

  await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['processing', batchId]);

  const claims = await all('SELECT * FROM claim_materials WHERE batch_id = ?', [batchId]);

  const results = [];
  const errors = [];

  for (const claim of claims) {
    try {
      const existing = await get('SELECT * FROM precheck_results WHERE claim_id = ?', [claim.id]);
      if (existing) {
        await run('DELETE FROM precheck_results WHERE claim_id = ?', [claim.id]);
      }

      const result = await precheckSingleClaim(claim);
      results.push(result);
    } catch (err) {
      errors.push({
        claim_id: claim.id,
        claim_no: claim.claim_no,
        error: err.message
      });
    }
  }

  await run(
    'INSERT INTO task_status (id, batch_id, status, message) VALUES (?, ?, ?, ?)',
    [uuidv4(), batchId, 'completed', `批量预审完成，成功${results.length}条，失败${errors.length}条`]
  );

  await run('UPDATE batches SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['completed', batchId]);

  return {
    batch_id: batchId,
    batch_no: batch.batch_no,
    total: claims.length,
    success: results.length,
    failed: errors.length,
    categories: {
      normal: results.filter(r => r.category === 'normal').length,
      supplement: results.filter(r => r.category === 'supplement').length,
      blocked: results.filter(r => r.category === 'blocked').length,
      manual_review: results.filter(r => r.needs_manual_review).length
    },
    results,
    errors
  };
};

module.exports = {
  precheckSingleClaim,
  precheckBatch,
  checkPolicyResponsibility,
  checkMaterialGaps,
  checkDuplicateClaim,
  MANUAL_REVIEW_THRESHOLD
};
