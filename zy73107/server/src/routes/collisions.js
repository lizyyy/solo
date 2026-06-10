const express = require('express');
const router = express.Router();
const {
  getAllCollisions,
  getCollisionById,
  getCollisionsByMaterial,
  createCollision,
  updateCollision,
  linkCollisionToMinutes
} = require('../models/collision');
const { buildLocationText } = require('../utils/aggregation');

router.get('/', (req, res) => {
  const { resolved, severity, materialId } = req.query;
  let list = getAllCollisions();
  if (resolved !== undefined) list = list.filter(c => c.resolved === (resolved === 'true'));
  if (severity) list = list.filter(c => c.severity === severity);
  if (materialId) list = getCollisionsByMaterial(materialId);

  res.json({
    code: 0,
    data: list,
    message: 'ok'
  });
});

router.get('/:id', (req, res) => {
  const c = getCollisionById(req.params.id);
  if (!c) {
    return res.status(404).json({ code: 1, data: null, message: '碰撞点不存在' });
  }
  const enriched = {
    ...c,
    locationText: buildLocationText(c)
  };
  res.json({ code: 0, data: enriched, message: 'ok' });
});

router.post('/', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const result = createCollision(req.body, operator);
  if (result.duplicated) {
    return res.status(409).json({
      code: 2,
      data: {
        existing: result.existing,
        locationText: buildLocationText(result.existing),
        originalQuote: result.existing.originalQuote
      },
      message: result.message,
      duplicated: true
    });
  }
  res.json({
    code: 0,
    data: {
      ...result.collision,
      locationText: buildLocationText(result.collision)
    },
    message: '碰撞点已记录，来源已保留'
  });
});

router.put('/:id', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const result = updateCollision(req.params.id, req.body, operator);
  if (result === null) {
    return res.status(404).json({ code: 1, message: '碰撞点不存在' });
  }
  if (result.duplicated) {
    return res.status(409).json({
      code: 2,
      data: result.existing,
      message: result.message,
      duplicated: true
    });
  }
  res.json({
    code: 0,
    data: { ...result.collision,
    locationText: buildLocationText(result.collision)
    },
    message: '更新成功'
  });
});

router.post('/:id/link-minutes', (req, res) => {
  const { minutesId, itemId } = req.body;
  if (!minutesId) {
    return res.status(400).json({ code: 1, message: '缺少 minutesId' });
  }
  const result = linkCollisionToMinutes(req.params.id, minutesId, itemId || null);
  if (!result) {
    return res.status(404).json({ code: 1, message: '碰撞点不存在' });
  }
  res.json({
    code: 0,
    data: result.collision,
    message: '已关联会议纪要'
  });
});

module.exports = router;
