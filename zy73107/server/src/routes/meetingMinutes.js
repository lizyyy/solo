const express = require('express');
const router = express.Router();
const {
  getAllMinutes,
  getMinutesById,
  getFieldMappings,
  createMeetingMinutes,
  updateMinutesItem,
  addFieldMapping
} = require('../models/meetingMinutes');
const { getCollisionsByMinutes } = require('../models/collision');

router.get('/', (req, res) => {
  res.json({
    code: 0,
    data: getAllMinutes(),
    message: 'ok'
  });
});

router.get('/field-mappings', (req, res) => {
  res.json({
    code: 0,
    data: getFieldMappings(),
    message: 'ok'
  });
});

router.post('/field-mappings', (req, res) => {
  const { canonical, alias } = req.body;
  if (!canonical || !alias) {
    return res.status(400).json({ code: 1, message: '缺少 canonical 或 alias' });
  }
  const mappings = addFieldMapping(canonical, alias);
  res.json({ code: 0, data: mappings, message: '映射已添加' });
});

router.get('/:id', (req, res) => {
  const m = getMinutesById(req.params.id);
  if (!m) {
    return res.status(404).json({ code: 1, data: null, message: '会议纪要不存在' });
  }
  const collisions = getCollisionsByMinutes(req.params.id);
  res.json({
    code: 0,
    data: { ...m, linkedCollisions: collisions },
    message: 'ok'
  });
});

router.post('/', (req, res) => {
  const operator = req.headers['x-operator'] || '系统';
  const record = createMeetingMinutes(req.body, operator);
  res.json({
    code: 0,
    data: record,
    message: '导入成功',
    warnings: generateWarnings(record)
  });
});

function generateWarnings(record) {
  const warnings = [];
  const unmappedFields = new Set();

  record.items.forEach(item => {
    Object.keys(item.rawItem || {}).forEach(k => {
      if (!record.keyMap || record.keyMap[k] === undefined) {
        unmappedFields.add(k);
      }
    });
    if (!item.materialNo) {
      warnings.push(`第 ${item.index} 条未识别材料编号`);
    }
  });
  if (unmappedFields.size > 0) {
    warnings.push(`存在未映射字段，请考虑添加别名：${[...unmappedFields].join('、')}`);
  }
  return warnings;
}

router.put('/:id/items/:itemId', (req, res) => {
  const result = updateMinutesItem(req.params.id, req.params.itemId, req.body);
  if (!result) {
    return res.status(404).json({ code: 1, message: '会议纪要或条目不存在' });
  }
  res.json({ code: 0, data: result, message: '更新成功' });
});

module.exports = router;
