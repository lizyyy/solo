const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { 
  CLAIM_STATUS,
  isMaterialExpired,
  canAddMaterial,
  isDuplicateMaterial,
  validateInsuranceTypeMatch
} = require('../services/validationService');

const router = express.Router();

router.post('/claims/:claimId/materials', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.claimId);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  if (!canAddMaterial(claim)) {
    return res.status(400).json({
      error: claim.status === CLAIM_STATUS.CLOSED 
        ? '已结案的申请不能再补件' 
        : '已驳回的申请不能再提交材料',
      current_status: claim.status
    });
  }

  const { material_code, material_name, file_path, expiry_date, notes } = req.body;
  
  if (!material_code) {
    return res.status(400).json({ error: '请提供材料代码' });
  }

  const requirements = db.prepare(`
    SELECT * FROM material_requirements 
    WHERE insurance_type_id = ? AND material_code = ?
  `).get(claim.insurance_type_id, material_code);

  if (!requirements) {
    return res.status(400).json({
      error: '材料代码与险种不匹配',
      material_code,
      insurance_type_id: claim.insurance_type_id
    });
  }

  if (isDuplicateMaterial(claim.id, material_code)) {
    return res.status(409).json({
      error: '同一材料不能重复提交',
      material_code
    });
  }

  if (expiry_date) {
    const expiryDate = new Date(expiry_date);
    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({ error: '过期日期格式无效' });
    }
    
    if (isMaterialExpired({ expiry_date: expiryDate })) {
      return res.status(400).json({
        error: '材料已过期',
        expiry_date
      });
    }
  }

  const id = uuidv4();
  const uploadDate = new Date().toISOString();
  
  db.prepare(`
    INSERT INTO claim_materials 
    (id, claim_id, material_code, material_name, file_path, upload_date, expiry_date, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, claim.id, material_code, material_name || requirements.material_name, 
         file_path, uploadDate, expiry_date, 'SUBMITTED', notes);

  const pendingNotifications = db.prepare(`
    SELECT * FROM supplement_notifications 
    WHERE claim_id = ? AND material_code = ? AND resolved_at IS NULL
  `).all(claim.id, material_code);

  for (const notif of pendingNotifications) {
    db.prepare(`
      UPDATE supplement_notifications 
      SET resolved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(notif.id);
  }

  const material = db.prepare('SELECT * FROM claim_materials WHERE id = ?').get(id);
  res.status(201).json(material);
});

router.get('/claims/:claimId/materials', (req, res) => {
  const claim = db.prepare('SELECT * FROM claims WHERE id = ?').get(req.params.claimId);
  if (!claim) {
    return res.status(404).json({ error: '理赔申请不存在' });
  }

  const materials = db.prepare(`
    SELECT * FROM claim_materials WHERE claim_id = ?
  `).all(claim.id);

  const materialsWithExpiryStatus = materials.map(m => ({
    ...m,
    is_expired: isMaterialExpired(m)
  }));

  res.json({
    claim_id: claim.id,
    claim_no: claim.claim_no,
    materials: materialsWithExpiryStatus
  });
});

router.get('/claims/:claimId/materials/:materialId', (req, res) => {
  const material = db.prepare(`
    SELECT cm.*, c.claim_no, c.insurance_type_id
    FROM claim_materials cm
    JOIN claims c ON cm.claim_id = c.id
    WHERE cm.id = ? AND cm.claim_id = ?
  `).get(req.params.materialId, req.params.claimId);

  if (!material) {
    return res.status(404).json({ error: '材料记录不存在' });
  }

  res.json({
    ...material,
    is_expired: isMaterialExpired(material)
  });
});

router.put('/claims/:claimId/materials/:materialId', (req, res) => {
  const material = db.prepare(`
    SELECT cm.*, c.status as claim_status
    FROM claim_materials cm
    JOIN claims c ON cm.claim_id = c.id
    WHERE cm.id = ? AND cm.claim_id = ?
  `).get(req.params.materialId, req.params.claimId);

  if (!material) {
    return res.status(404).json({ error: '材料记录不存在' });
  }

  if (!canAddMaterial({ status: material.claim_status })) {
    return res.status(400).json({
      error: material.claim_status === CLAIM_STATUS.CLOSED 
        ? '已结案的申请不能修改材料' 
        : '已驳回的申请不能修改材料',
      current_status: material.claim_status
    });
  }

  const { material_name, file_path, expiry_date, status, notes } = req.body;

  if (expiry_date) {
    const expiryDate = new Date(expiry_date);
    if (isNaN(expiryDate.getTime())) {
      return res.status(400).json({ error: '过期日期格式无效' });
    }
  }

  db.prepare(`
    UPDATE claim_materials 
    SET material_name = COALESCE(?, material_name),
        file_path = COALESCE(?, file_path),
        expiry_date = COALESCE(?, expiry_date),
        status = COALESCE(?, status),
        notes = COALESCE(?, notes),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(material_name, file_path, expiry_date, status, notes, req.params.materialId);

  const updatedMaterial = db.prepare('SELECT * FROM claim_materials WHERE id = ?').get(req.params.materialId);
  res.json({
    ...updatedMaterial,
    is_expired: isMaterialExpired(updatedMaterial)
  });
});

router.delete('/claims/:claimId/materials/:materialId', (req, res) => {
  const material = db.prepare(`
    SELECT cm.*, c.status as claim_status
    FROM claim_materials cm
    JOIN claims c ON cm.claim_id = c.id
    WHERE cm.id = ? AND cm.claim_id = ?
  `).get(req.params.materialId, req.params.claimId);

  if (!material) {
    return res.status(404).json({ error: '材料记录不存在' });
  }

  if (!canAddMaterial({ status: material.claim_status })) {
    return res.status(400).json({
      error: material.claim_status === CLAIM_STATUS.CLOSED 
        ? '已结案的申请不能删除材料' 
        : '已驳回的申请不能删除材料',
      current_status: material.claim_status
    });
  }

  db.prepare('DELETE FROM claim_materials WHERE id = ?').run(req.params.materialId);
  res.json({ message: '材料记录已删除', id: req.params.materialId });
});

module.exports = router;
