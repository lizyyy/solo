const express = require('express');
const router = express.Router();
const { db, getNextId, now } = require('../database');
const utils = require('../utils');

async function checkConsignmentExists(consignmentId) {
  await db.read();
  return db.data.consignments.find(c => c.id === consignmentId);
}

function canInspect(status) {
  return ['pending', 'inspecting', 'inspected'].includes(status);
}

router.get('/:consignmentId', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  
  await db.read();
  
  const shutterItem = [...db.data.inspection_items]
    .filter(i => i.consignment_id === cid && i.item_type === 'shutter')
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))[0];
  
  const defects = db.data.defects
    .filter(d => d.consignment_id === cid)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .map(d => ({ ...d, level_info: utils.getDefectLevelInfo(d.defect_level) }));
  
  const accessories = db.data.accessories
    .filter(a => a.consignment_id === cid)
    .sort((a, b) => a.id - b.id);
  
  const functionTests = db.data.inspection_items
    .filter(i => i.consignment_id === cid && i.item_type === 'function')
    .sort((a, b) => new Date(a.updated_at) - new Date(b.updated_at));
  
  const pricing = [...db.data.pricing_records]
    .filter(p => p.consignment_id === cid)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  
  const overallStatus = calculateInspectionStatus({ shutterItem, defects, accessories, functionTests });
  
  res.json({
    consignment_status: consignment.status,
    can_inspect: canInspect(consignment.status),
    shutter: shutterItem,
    defects,
    accessories,
    function_tests: functionTests,
    pricing,
    overall_status: overallStatus,
    suggestions: getSuggestions({ shutterItem, defects, accessories, functionTests, pricing, consignmentStatus: consignment.status })
  });
});

function calculateInspectionStatus({ shutterItem, defects, accessories, functionTests }) {
  const steps = {
    shutter: { name: '快门数', completed: !!shutterItem && shutterItem.status === 'completed' },
    appearance: { name: '外观', completed: defects.length > 0 || (shutterItem && shutterItem.status === 'completed') },
    accessories: { name: '配件', completed: accessories.length > 0 && accessories.some(a => a.present === 1) },
    function: { name: '功能', completed: functionTests.length > 0 && functionTests.every(t => t.status === 'completed') }
  };
  
  const completed = Object.values(steps).filter(s => s.completed).length;
  const total = Object.keys(steps).length;
  const progress = Math.round((completed / total) * 100);
  
  let blocker = null;
  if (!steps.shutter.completed) blocker = 'shutter';
  else if (defects.some(d => d.defect_level === 'severe')) blocker = 'severe_defect';
  
  return { steps, progress, blocker, is_complete: progress === 100 };
}

function getSuggestions({ shutterItem, defects, accessories, functionTests, pricing, consignmentStatus }) {
  const suggestions = [];
  
  if (!shutterItem) {
    suggestions.push({ type: 'required', message: '请先录入快门数', priority: 1 });
  }
  
  const severeDefects = defects.filter(d => d.defect_level === 'severe');
  if (severeDefects.length > 0) {
    suggestions.push({ type: 'warning', message: `发现${severeDefects.length}处严重瑕疵，建议与客户确认后再继续`, priority: 2 });
  }
  
  const missingAccessories = accessories.filter(a => a.present === 0);
  if (missingAccessories.length > 2) {
    suggestions.push({ type: 'info', message: `缺少${missingAccessories.length}件配件，可能影响定价`, priority: 3 });
  }
  
  if (consignmentStatus === 'inspected' && !pricing) {
    suggestions.push({ type: 'required', message: '质检已完成，请进行定价', priority: 1 });
  }
  
  return suggestions.sort((a, b) => a.priority - b.priority);
}

router.post('/:consignmentId/shutter', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  if (!canInspect(consignment.status)) return res.status(400).json({ error: '当前状态不允许质检' });
  
  const { count, notes } = req.body;
  if (!count || count < 0) return res.status(400).json({ error: '快门数无效' });
  
  await db.read();
  const existing = db.data.inspection_items.find(i => i.consignment_id === cid && i.item_type === 'shutter');
  
  if (existing) {
    const oldValue = { count: existing.value, notes: existing.notes };
    existing.value = count.toString();
    existing.notes = notes;
    existing.status = 'completed';
    existing.updated_at = now();
    await utils.recordHistory(cid, 'inspection_update', 'shutter_count', oldValue, { count, notes }, '更新快门数');
  } else {
    db.data.inspection_items.push({
      id: getNextId('inspection_items'),
      consignment_id: cid,
      item_type: 'shutter',
      item_name: '快门数',
      value: count.toString(),
      notes: notes || null,
      status: 'completed',
      created_at: now(),
      updated_at: now()
    });
    await utils.recordHistory(cid, 'inspection_create', 'shutter_count', null, { count, notes }, '录入快门数');
  }
  
  await db.write();
  
  if (consignment.status === 'pending') {
    await utils.updateConsignmentStatus(cid, 'inspecting', '开始质检');
  }
  
  res.json({ success: true, count });
});

router.post('/:consignmentId/defects', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  if (!canInspect(consignment.status)) return res.status(400).json({ error: '当前状态不允许质检' });
  
  const { defect_type, defect_level, description, location } = req.body;
  if (!defect_type || !defect_level || !description) {
    return res.status(400).json({ error: '缺少瑕疵必要信息' });
  }
  
  if (!utils.DEFECT_LEVELS[defect_level]) {
    return res.status(400).json({ error: '无效的瑕疵等级' });
  }
  
  await db.read();
  const id = getNextId('defects');
  const defect = {
    id,
    consignment_id: cid,
    defect_type,
    defect_level,
    description,
    location: location || null,
    created_at: now()
  };
  
  db.data.defects.push(defect);
  await db.write();
  
  await utils.recordHistory(cid, 'defect_add', 'defects', null, { id, defect_type, defect_level, description }, '添加瑕疵记录');
  
  res.json({ success: true, id });
});

router.delete('/:consignmentId/defects/:defectId', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const did = parseInt(req.params.defectId);
  
  await db.read();
  const defect = db.data.defects.find(d => d.id === did && d.consignment_id === cid);
  if (!defect) return res.status(404).json({ error: '瑕疵记录不存在' });
  
  const defectCopy = { ...defect };
  db.data.defects = db.data.defects.filter(d => d.id !== did);
  await db.write();
  
  await utils.recordHistory(cid, 'defect_remove', 'defects', defectCopy, null, '移除瑕疵记录');
  
  res.json({ success: true });
});

router.put('/:consignmentId/accessories/:accessoryId', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const aid = parseInt(req.params.accessoryId);
  
  await db.read();
  const accessory = db.data.accessories.find(a => a.id === aid && a.consignment_id === cid);
  if (!accessory) return res.status(404).json({ error: '配件记录不存在' });
  
  const { present, condition, notes } = req.body;
  const oldValue = { present: accessory.present, condition: accessory.condition, notes: accessory.notes };
  const newValue = { ...oldValue };
  let changed = false;
  
  if (present !== undefined) { accessory.present = present ? 1 : 0; newValue.present = present ? 1 : 0; changed = true; }
  if (condition !== undefined) { accessory.condition = condition; newValue.condition = condition; changed = true; }
  if (notes !== undefined) { accessory.notes = notes; newValue.notes = notes; changed = true; }
  
  if (!changed) return res.json({ success: true, message: '无变更' });
  
  await db.write();
  await utils.recordHistory(cid, 'accessory_update', accessory.name, oldValue, newValue, `更新配件: ${accessory.name}`);
  
  res.json({ success: true });
});

router.post('/:consignmentId/complete', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  if (consignment.status !== 'inspecting') return res.status(400).json({ error: '仅质检中状态可完成质检' });
  
  await db.read();
  const shutter = db.data.inspection_items.find(i => i.consignment_id === cid && i.item_type === 'shutter');
  if (!shutter) return res.status(400).json({ error: '请先录入快门数' });
  
  const result = await utils.updateConsignmentStatus(cid, 'inspected', '质检完成，进入定价环节');
  res.json(result);
});

router.post('/:consignmentId/pricing', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  if (consignment.status !== 'inspected' && consignment.status !== 'pricing') {
    return res.status(400).json({ error: '仅质检完成或定价中状态可定价' });
  }
  
  const { market_price, inspection_price, final_price, pricing_basis } = req.body;
  if (final_price === undefined) {
    return res.status(400).json({ error: '请输入最终定价' });
  }
  
  await db.read();
  const id = getNextId('pricing_records');
  const record = {
    id,
    consignment_id: cid,
    market_price: market_price || null,
    inspection_price: inspection_price || null,
    final_price,
    pricing_basis: pricing_basis || null,
    operator: null,
    created_at: now()
  };
  
  db.data.pricing_records.push(record);
  await db.write();
  
  await utils.recordHistory(cid, 'pricing', 'price', null, { market_price, inspection_price, final_price }, '创建定价记录');
  
  if (consignment.status === 'inspected') {
    await utils.updateConsignmentStatus(cid, 'pricing', '定价中');
  }
  
  res.json({ success: true, id });
});

router.post('/:consignmentId/list', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const consignment = await checkConsignmentExists(cid);
  if (!consignment) return res.status(404).json({ error: '寄卖单不存在' });
  if (consignment.status !== 'pricing') return res.status(400).json({ error: '仅定价中状态可上架' });
  
  await db.read();
  const pricing = [...db.data.pricing_records]
    .filter(p => p.consignment_id === cid)
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0];
  
  if (!pricing) return res.status(400).json({ error: '请先完成定价' });
  
  const result = await utils.updateConsignmentStatus(cid, 'listed', '已上架寄卖');
  res.json(result);
});

router.post('/:consignmentId/reject', async (req, res) => {
  const cid = parseInt(req.params.consignmentId);
  const { reason } = req.body;
  
  try {
    const result = await utils.updateConsignmentStatus(cid, 'rejected', reason || '质检/定价未通过');
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

module.exports = router;
