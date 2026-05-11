const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { 
  CLAIM_STATUS, 
  STAGES,
  canModifyCoreInfo,
  canAddMaterial,
  canRequestSupplement,
  canApprove,
  canReject,
  canClose,
  getMaterialGaps,
  calculateProcessingTime,
  isDuplicateMaterial,
  calculateEstimatedPayout
} = require('../services/validationService');

const router = express.Router();

const generateClaimNo = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `CL${dateStr}${random}`;
};

router.post('/', (req, res) => {
  const { 
    insurance_type_id, 
    policy_no, 
    claimant_name, 
    claimant_id_card, 
    incident_date, 
    claimed_amount,
    notes 
  } = req.body;

  if (!insurance_type_id || !policy_no || !claimant_name || 
      !claimant_id_card || !incident_date || claimed_amount === undefined) {
    return res.status(400).json({
      error: '缺少必要字段',
      required: ['insurance_type_id', 'policy_no', 'claimant_name', 'claimant_id_card', 'incident_date', 'claimed_amount']
    });
  }

  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(insurance_type_id);
  if (!insuranceType) {
    return res.status(404).json({ error: '险种不存在' });
  }

  const id = uuidv4();
  const claimNo = generateClaimNo();
  
  db.prepare(`
    INSERT INTO claims 
    (id, claim_no, insurance_type_id, policy_no, claimant_name, claimant_id_card, 
     incident_date, claimed_amount, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, claimNo, insurance_type_id, policy_no, claimant_name, claimant_id_card, 
         incident_date, claimed_amount, notes);

  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(id);
  res.status(201).json(claim);
});

router.get('/', (req, res) => {
  const { status, insurance_type_id, claimant_name } = req.query;
  
  let query = 'SELECT * FROM claims WHERE 1=1';
  const params = [];
  
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (insurance_type_id) {
    query += ' AND insurance_type_id = ?';
    params.push(insurance_type_id);
  }
  if (claimant_name) {
    query += ' AND claimant_name LIKE ?';
    params.push(`%${claimant_name}%`);
  }
  
  query += ' ORDER BY created_at DESC';
  const claims = db.prepare(query).all(...params);
  
  const enrichedClaims = claims.map(claim => {
    const gaps = getMaterialGaps(claim.id, claim.insurance_type_id);
    const insuranceType = db.prepare('SELECT max_payout FROM insurance_types WHERE id = ?').get(claim.insurance_type_id);
    
    return {
      ...claim,
      material_gaps: gaps,
      estimated_payout: calculateEstimatedPayout(
        claim.claimed_amount,
        insuranceType?.max_payout || 0,
        gaps.length > 0
      ),
      processing_time: calculateProcessingTime(claim)
    };
  });
  
  res.json(enrichedClaims);
});

router.get('/:id', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const gaps = getMaterialGaps(claim.id, claim.insurance_type_id);
  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(claim.insurance_type_id);
  const materials = db.prepare('SELECT * FROM claim_materials WHERE claim_id = ?').all(claim.id);

  res.json({
    ...claim,
    insurance_type: insuranceType,
    material_gaps: gaps,
    materials,
    estimated_payout: calculateEstimatedPayout(
      claim.claimed_amount,
      insuranceType?.max_payout || 0,
      gaps.length > 0
    ),
    processing_time: calculateProcessingTime(claim)
  });
});

router.put('/:id', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const coreFields = ['insurance_type_id', 'policy_no', 'claimant_name', 'claimant_id_card', 'incident_date', 'claimed_amount'];
  const hasCoreFieldChange = coreFields.some(field => req.body[field] !== undefined && req.body[field] !== claim[field]);
  
  if (hasCoreFieldChange && !canModifyCoreInfo(claim)) {
    return res.status(400).json({
      error: '审核中或已结案的申请不能修改核心信息',
      current_status: claim.status
    });
  }

  const { policy_no, claimant_name, claimant_id_card, incident_date, claimed_amount, notes } = req.body;
  
  db.prepare(`
    UPDATE claims 
    SET policy_no = COALESCE(?, policy_no),
        claimant_name = COALESCE(?, claimant_name),
        claimant_id_card = COALESCE(?, claimant_id_card),
        incident_date = COALESCE(?, incident_date),
        claimed_amount = COALESCE(?, claimed_amount),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(policy_no, claimant_name, claimant_id_card, incident_date, claimed_amount, notes, req.params.id);

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  res.json(updatedClaim);
});

router.post('/:id/submit', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (claim.status !== CLAIM_STATUS.DRAFT) {
    return res.status(400).json({
      error: '只有草稿状态的申请可以提交',
      current_status: claim.status
    });
  }

  const gaps = getMaterialGaps(claim.id, claim.insurance_type_id);
  
  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.SUBMITTED, STAGES.MATERIAL_CHECK, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reason)
    VALUES (?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'SUBMITTED', gaps.length > 0 ? `存在${gaps.length}项材料缺口` : '材料齐全');

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json({
    ...updatedClaim,
    material_gaps: gaps
  });
});

router.post('/:id/start-review', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (claim.status !== CLAIM_STATUS.SUBMITTED && claim.status !== CLAIM_STATUS.SUPPLEMENT_REQUESTED) {
    return res.status(400).json({
      error: '只有已提交或待补件的申请可以开始审核',
      current_status: claim.status
    });
  }

  const gaps = getMaterialGaps(claim.id, claim.insurance_type_id);
  if (gaps.length > 0) {
    return res.status(400).json({
      error: '存在材料缺口，请先补件',
      material_gaps: gaps
    });
  }

  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.UNDER_REVIEW, STAGES.REVIEW, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reviewer, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'START_REVIEW', req.body.reviewer || 'system', '开始审核');

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json(updatedClaim);
});

router.post('/:id/request-supplement', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (!canRequestSupplement(claim)) {
    return res.status(400).json({
      error: '当前状态无法请求补件',
      current_status: claim.status
    });
  }

  const { material_codes, reason, reviewer } = req.body;
  if (!material_codes || !Array.isArray(material_codes) || material_codes.length === 0) {
    return res.status(400).json({ error: '请指定需要补件的材料代码' });
  }

  const requirements = db.prepare(`
    SELECT * FROM material_requirements WHERE insurance_type_id = ?
  `).all(claim.insurance_type_id);

  const validCodes = new Set(requirements.map(r => r.material_code));
  const invalidCodes = material_codes.filter(c => !validCodes.has(c));
  
  if (invalidCodes.length > 0) {
    return res.status(400).json({
      error: '存在无效的材料代码',
      invalid_codes: invalidCodes
    });
  }

  const notifications = [];
  for (const code of material_codes) {
    const req = requirements.find(r => r.material_code === code);
    const notificationId = uuidv4();
    db.prepare(`
      INSERT INTO supplement_notifications 
      (id, claim_id, material_code, material_name, reason)
      VALUES (?, ?, ?, ?, ?)
    `).run(notificationId, claim.id, code, req?.material_name, reason || '需要补充材料');
    
    notifications.push({
      id: notificationId,
      material_code: code,
      material_name: req?.material_name,
      reason
    });
  }

  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.SUPPLEMENT_REQUESTED, STAGES.MATERIAL_CHECK, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reviewer, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'REQUEST_SUPPLEMENT', reviewer || 'system', reason || '需要补充材料');

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json({
    claim: updatedClaim,
    supplement_notifications: notifications
  });
});

router.post('/:id/approve', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (!canApprove(claim)) {
    return res.status(400).json({
      error: '只有审核中的申请可以批准',
      current_status: claim.status
    });
  }

  const { reviewer, approved_amount } = req.body;
  const insuranceType = db.prepare('SELECT max_payout FROM insurance_types WHERE id = ?').get(claim.insurance_type_id);
  
  const finalAmount = approved_amount !== undefined 
    ? Math.min(approved_amount, insuranceType.max_payout, claim.claimed_amount)
    : Math.min(claim.claimed_amount, insuranceType.max_payout);

  const exceedsLimit = approved_amount !== undefined && approved_amount > insuranceType.max_payout;

  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        estimated_payout = ?,
        actual_payout = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.APPROVED, STAGES.PAYMENT, finalAmount, finalAmount, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reviewer, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'APPROVED', reviewer || 'system', 
         `审核通过，赔付金额：${finalAmount}${exceedsLimit ? '（已超限，按最高限额赔付）' : ''}`);

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json({
    ...updatedClaim,
    exceeds_limit: exceedsLimit,
    max_payout: insuranceType.max_payout
  });
});

router.post('/:id/reject', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (!canReject(claim)) {
    return res.status(400).json({
      error: '只有审核中的申请可以驳回',
      current_status: claim.status
    });
  }

  const { reviewer, reason } = req.body;
  if (!reason) {
    return res.status(400).json({ error: '请提供驳回原因' });
  }

  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.REJECTED, STAGES.CLOSED, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reviewer, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'REJECTED', reviewer || 'system', reason);

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json(updatedClaim);
});

router.post('/:id/close', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (!canClose(claim)) {
    return res.status(400).json({
      error: '只有已批准的申请可以结案',
      current_status: claim.status
    });
  }

  const { reviewer } = req.body;

  db.prepare(`
    UPDATE claims 
    SET status = ?, 
        current_stage = ?,
        closed_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(CLAIM_STATUS.CLOSED, STAGES.CLOSED, claim.id);

  db.prepare(`
    INSERT INTO review_actions (id, claim_id, action_type, reviewer, reason)
    VALUES (?, ?, ?, ?, ?)
  `).run(uuidv4(), claim.id, 'CLOSED', reviewer || 'system', '案件已结案');

  const updatedClaim = db.prepare('SELECT * FROM claims WHERE id = ?').get(claim.id);
  res.json({
    ...updatedClaim,
    processing_time: calculateProcessingTime(updatedClaim)
  });
});

router.post('/:id/calculate-payout', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const insuranceType = db.prepare('SELECT * FROM insurance_types WHERE id = ?').get(claim.insurance_type_id);
  const gaps = getMaterialGaps(claim.id, claim.insurance_type_id);
  
  const estimatedPayout = calculateEstimatedPayout(
    claim.claimed_amount,
    insuranceType.max_payout,
    gaps.length > 0
  );

  const exceedsLimit = claim.claimed_amount > insuranceType.max_payout;

  res.json({
    claim_id: claim.id,
    claimed_amount: claim.claimed_amount,
    max_payout: insuranceType.max_payout,
    estimated_payout: estimatedPayout,
    exceeds_limit: exceedsLimit,
    material_gaps: gaps,
    has_missing_materials: gaps.length > 0
  });
});

router.get('/:id/supplement-notifications', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const notifications = db.prepare(`
    SELECT * FROM supplement_notifications 
    WHERE claim_id = ? 
    ORDER BY sent_at DESC
  `).all(claim.id);

  res.json({
    claim_id: claim.id,
    claim_no: claim.claim_no,
    supplement_notifications: notifications
  });
});

router.get('/:id/review-actions', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.id);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const actions = db.prepare(`
    SELECT * FROM review_actions 
    WHERE claim_id = ? 
    ORDER BY created_at DESC
  `).all(claim.id);

  res.json({
    claim_id: claim.id,
    claim_no: claim.claim_no,
    review_actions: actions
  });
});

module.exports = router;
