const express = require('express');
const router = express.Router();
const {
  MATERIAL_STATUS,
  STATUS_LABEL,
  getAllMaterials,
  getMaterialById,
  createMaterial,
  updateMaterial
} = require('../models/material');
const { getCollisionsByMaterial } = require('../models/collision');

router.get('/', (req, res) => {
  const { status, category, keyword } = req.query;
  let list = getAllMaterials();
  if (status) list = list.filter(m => m.status === status);
  if (category) list = list.filter(m => m.category === category);
  if (keyword) {
    const k = keyword.toLowerCase();
    list = list.filter(m =>
      (m.name || '').toLowerCase().includes(k) ||
      (m.materialNo || '').toLowerCase().includes(k)
    );
  }
  res.json({
    code: 0,
    data: list,
    message: 'ok'
  });
});

router.get('/status-enum', (req, res) => {
  res.json({
    code: 0,
    data: { MATERIAL_STATUS, STATUS_LABEL },
    message: 'ok'
  });
});

router.get('/:id', (req, res) => {
  const m = getMaterialById(req.params.id);
  if (!m) {
    return res.status(404).json({ code: 1, data: null, message: '材料不存在' });
  }
  const collisions = getCollisionsByMaterial(req.params.id);
  res.json({
    code: 0,
    data: { ...m, collisions },
    message: 'ok'
  });
});

router.post('/', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const mat = createMaterial({ ...req.body, reviewer: req.body.reviewer || operator });
  res.json({ code: 0, data: mat, message: '创建成功' });
});

router.put('/:id', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const result = updateMaterial(req.params.id, req.body, operator);
  if (!result) {
    return res.status(404).json({ code: 1, data: null, message: '材料不存在' });
  }
  res.json({ code: 0, data: result, message: '更新成功' });
});

router.post('/:id/review', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const { status, reviewConclusion, remarks } = req.body;
  const data = {};
  if (status) data.status = status;
  if (reviewConclusion !== undefined) data.reviewConclusion = reviewConclusion;
  if (remarks !== undefined) data.remarks = remarks;
  data.reviewer = operator;

  const result = updateMaterial(req.params.id, data, operator);
  if (!result) {
    return res.status(404).json({ code: 1, data: null, message: '材料不存在' });
  }
  const collisions = getCollisionsByMaterial(req.params.id);
  res.json({
    code: 0,
    data: { ...result, collisions },
    message: '复核完成',
    decision: buildDecisionText(result, collisions)
  });
});

function buildDecisionText(material, collisions) {
  const unresolved = collisions.filter(c => !c.resolved);
  if (material.status === MATERIAL_STATUS.APPROVED) {
    return {
      action: '放行',
      level: 'success',
      text: `材料 ${material.name || material.materialNo} 可放行`
    };
  }
  if (material.status === MATERIAL_STATUS.NEED_SUPPLEMENT) {
    const missing = [];
    if (!material.specification) missing.push('规格');
    if (!material.quantity) missing.push('数量');
    if (unresolved.length > 0) missing.push(`解决碰撞点(${unresolved.length})`);
    return {
      action: '补材料',
      level: 'warning',
      text: `需补充：${missing.join('、')}，${material.reviewConclusion || ''}`
    };
  }
  if (unresolved.length > 0) {
    return {
      action: '暂扣',
      level: 'danger',
      text: `存在 ${unresolved.length} 条未解决碰撞点，需先行处理`
    };
  }
  return {
    action: '待确认',
    level: 'info',
    text: '请继续复核'
  };
}

module.exports = router;
