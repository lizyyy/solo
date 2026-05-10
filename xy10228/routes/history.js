const express = require('express');
const router = express.Router();
const { db } = require('../database');

router.get('/:consignmentId', async (req, res) => {
  await db.read();
  const cid = parseInt(req.params.consignmentId);
  const history = db.data.history
    .filter(h => h.consignment_id === cid)
    .sort((a, b) => {
      const tDiff = new Date(b.created_at) - new Date(a.created_at);
      return tDiff !== 0 ? tDiff : b.id - a.id;
    });
  
  const formatted = history.map(h => {
    let oldVal = null;
    let newVal = null;
    
    try {
      if (h.old_value) oldVal = JSON.parse(h.old_value);
      if (h.new_value) newVal = JSON.parse(h.new_value);
    } catch (e) {
      oldVal = h.old_value;
      newVal = h.new_value;
    }
    
    return {
      ...h,
      old_value_parsed: oldVal,
      new_value_parsed: newVal,
      action_label: getActionLabel(h.action_type)
    };
  });
  
  res.json(formatted);
});

function getActionLabel(actionType) {
  const labels = {
    'create': '创建寄卖单',
    'status_change': '状态变更',
    'update': '修改信息',
    'withdraw': '撤回寄卖',
    'inspection_create': '新增质检项',
    'inspection_update': '更新质检项',
    'defect_add': '添加瑕疵',
    'defect_remove': '移除瑕疵',
    'accessory_update': '更新配件',
    'pricing': '定价记录'
  };
  return labels[actionType] || actionType;
}

router.get('/:consignmentId/diff', async (req, res) => {
  await db.read();
  const cid = parseInt(req.params.consignmentId);
  const history = [...db.data.history]
    .filter(h => h.consignment_id === cid)
    .sort((a, b) => {
      const tDiff = new Date(a.created_at) - new Date(b.created_at);
      return tDiff !== 0 ? tDiff : a.id - b.id;
    });
  
  const changes = history.map((h, index) => {
    let oldVal = null;
    let newVal = null;
    
    try {
      if (h.old_value) oldVal = JSON.parse(h.old_value);
      if (h.new_value) newVal = JSON.parse(h.new_value);
    } catch (e) {}
    
    return {
      sequence: index + 1,
      action: h.action_type,
      field: h.field_name,
      from: oldVal,
      to: newVal,
      notes: h.notes,
      time: h.created_at
    };
  });
  
  res.json({
    total_changes: changes.length,
    changes: changes.reverse()
  });
});

module.exports = router;
