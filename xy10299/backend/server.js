const express = require('express');
const cors = require('cors');
const { Parser } = require('json2csv');
const { 
  freezerStorage, 
  zoneStorage, 
  slotStorage, 
  vendorStorage, 
  occupancyStorage, 
  billingRuleStorage,
  sampleDataStorage 
} = require('./storage');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: '市集共享冷柜占用结算台服务运行中' });
});

app.post('/api/sample-data/load', (req, res) => {
  const result = sampleDataStorage.loadSampleData();
  res.json(result);
});

app.post('/api/sample-data/clear', (req, res) => {
  const result = sampleDataStorage.clearAllData();
  res.json(result);
});

app.get('/api/freezers', (req, res) => {
  const freezers = freezerStorage.getAll();
  res.json(freezers);
});

app.get('/api/freezers/:id', (req, res) => {
  const freezer = freezerStorage.getById(req.params.id);
  if (!freezer) {
    return res.status(404).json({ error: '冷柜不存在' });
  }
  res.json(freezer);
});

app.post('/api/freezers', (req, res) => {
  const { name, location, totalSlots } = req.body;
  if (!name || !location) {
    return res.status(400).json({ error: '名称和位置不能为空' });
  }
  const freezer = freezerStorage.create({ name, location, totalSlots });
  res.status(201).json(freezer);
});

app.put('/api/freezers/:id', (req, res) => {
  const freezer = freezerStorage.update(req.params.id, req.body);
  if (!freezer) {
    return res.status(404).json({ error: '冷柜不存在' });
  }
  res.json(freezer);
});

app.delete('/api/freezers/:id', (req, res) => {
  const success = freezerStorage.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '冷柜不存在' });
  }
  res.json({ success: true });
});

app.get('/api/zones', (req, res) => {
  const { freezerId } = req.query;
  if (freezerId) {
    res.json(zoneStorage.getByFreezerId(freezerId));
  } else {
    res.json(zoneStorage.getAll());
  }
});

app.post('/api/zones', (req, res) => {
  const { freezerId, name, zoneType, pricePerHour, tempRange } = req.body;
  if (!freezerId || !name || !zoneType || !pricePerHour) {
    return res.status(400).json({ error: '必填字段缺失' });
  }
  const zone = zoneStorage.create({ freezerId, name, zoneType, pricePerHour, tempRange });
  res.status(201).json(zone);
});

app.put('/api/zones/:id', (req, res) => {
  const zone = zoneStorage.update(req.params.id, req.body);
  if (!zone) {
    return res.status(404).json({ error: '温区不存在' });
  }
  res.json(zone);
});

app.delete('/api/zones/:id', (req, res) => {
  const success = zoneStorage.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '温区不存在' });
  }
  res.json({ success: true });
});

app.get('/api/slots', (req, res) => {
  const { freezerId, zoneId } = req.query;
  if (freezerId) {
    res.json(slotStorage.getByFreezerId(freezerId));
  } else if (zoneId) {
    res.json(slotStorage.getByZoneId(zoneId));
  } else {
    res.json(slotStorage.getAll());
  }
});

app.post('/api/slots', (req, res) => {
  const { freezerId, zoneId, slotNumber } = req.body;
  if (!freezerId || !zoneId || !slotNumber) {
    return res.status(400).json({ error: '必填字段缺失' });
  }
  const existingSlots = slotStorage.getByFreezerId(freezerId);
  if (existingSlots.some(s => s.slotNumber === slotNumber)) {
    return res.status(400).json({ error: '格口编号已存在', type: 'DUPLICATE_SLOT' });
  }
  const slot = slotStorage.create({ freezerId, zoneId, slotNumber });
  res.status(201).json(slot);
});

app.put('/api/slots/:id', (req, res) => {
  const slot = slotStorage.update(req.params.id, req.body);
  if (!slot) {
    return res.status(404).json({ error: '格口不存在' });
  }
  res.json(slot);
});

app.delete('/api/slots/:id', (req, res) => {
  const success = slotStorage.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '格口不存在' });
  }
  res.json({ success: true });
});

app.get('/api/vendors', (req, res) => {
  res.json(vendorStorage.getAll());
});

app.get('/api/vendors/:id', (req, res) => {
  const vendor = vendorStorage.getById(req.params.id);
  if (!vendor) {
    return res.status(404).json({ error: '摊主不存在' });
  }
  res.json(vendor);
});

app.post('/api/vendors', (req, res) => {
  const { name, phone, stallNumber } = req.body;
  if (!name) {
    return res.status(400).json({ error: '摊主名称不能为空' });
  }
  const vendor = vendorStorage.create({ name, phone, stallNumber });
  res.status(201).json(vendor);
});

app.put('/api/vendors/:id', (req, res) => {
  const vendor = vendorStorage.update(req.params.id, req.body);
  if (!vendor) {
    return res.status(404).json({ error: '摊主不存在' });
  }
  res.json(vendor);
});

app.delete('/api/vendors/:id', (req, res) => {
  const success = vendorStorage.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '摊主不存在' });
  }
  res.json({ success: true });
});

app.get('/api/occupancy', (req, res) => {
  const { vendorId, slotId, status } = req.query;
  let records = occupancyStorage.getAll();
  if (vendorId) records = records.filter(r => r.vendorId === vendorId);
  if (slotId) records = records.filter(r => r.slotId === slotId);
  if (status) records = records.filter(r => r.status === status);
  res.json(records);
});

app.post('/api/occupancy', (req, res) => {
  const { vendorId, slotId, startTime, endTime, notes } = req.body;
  
  if (!vendorId || !slotId || !startTime || !endTime) {
    return res.status(400).json({ error: '必填字段缺失' });
  }
  
  const slots = slotStorage.getAll();
  const slot = slots.find(s => s.id === slotId);
  if (!slot) {
    return res.status(404).json({ error: '格口不存在', type: 'SLOT_NOT_FOUND' });
  }
  
  const zones = zoneStorage.getAll();
  const zone = zones.find(z => z.id === slot.zoneId);
  if (!zone) {
    return res.status(404).json({ error: '来源记录缺失：格口对应的温区不存在', type: 'SOURCE_RECORD_MISSING' });
  }
  
  const vendors = vendorStorage.getAll();
  const vendor = vendors.find(v => v.id === vendorId);
  if (!vendor) {
    return res.status(404).json({ error: '来源记录缺失：摊主不存在', type: 'SOURCE_RECORD_MISSING' });
  }
  
  const allRecords = occupancyStorage.getAll();
  const slotRecords = allRecords.filter(r => r.slotId === slotId && r.status !== 'rejected');
  
  const newStart = new Date(startTime);
  const newEnd = new Date(endTime);
  
  const hasConflict = slotRecords.some(record => {
    const recStart = new Date(record.startTime);
    const recEnd = new Date(record.endTime);
    return (newStart < recEnd && newEnd > recStart);
  });
  
  if (hasConflict) {
    return res.status(409).json({ 
      error: '状态冲突：该格口在请求时间段内已有占用记录', 
      type: 'STATUS_CONFLICT' 
    });
  }
  
  const durationHours = (newEnd - newStart) / (1000 * 60 * 60);
  const pricePerHour = zone.pricePerHour;
  const totalCost = Math.round(durationHours * pricePerHour * 100) / 100;
  
  const record = occupancyStorage.create({
    vendorId,
    slotId,
    freezerId: slot.freezerId,
    zoneId: slot.zoneId,
    startTime,
    endTime,
    notes,
    pricePerHour,
    totalCost
  });
  
  res.status(201).json(record);
});

app.put('/api/occupancy/:id', (req, res) => {
  const { id } = req.params;
  const { status, startTime, endTime, notes } = req.body;
  
  const records = occupancyStorage.getAll();
  const record = records.find(r => r.id === id);
  
  if (!record) {
    return res.status(404).json({ error: '占用记录不存在' });
  }
  
  if (record.status === 'confirmed') {
    return res.status(409).json({ 
      error: '状态冲突：已确认的记录不能修改', 
      type: 'STATUS_CONFLICT' 
    });
  }
  
  if (record.status === 'rejected') {
    return res.status(409).json({ 
      error: '状态冲突：已拒绝的记录不能修改', 
      type: 'STATUS_CONFLICT' 
    });
  }
  
  const updates = {};
  if (status) updates.status = status;
  if (startTime) updates.startTime = startTime;
  if (endTime) updates.endTime = endTime;
  if (notes !== undefined) updates.notes = notes;
  
  if (status === 'confirmed') {
    const slots = slotStorage.getAll();
    const slotIndex = slots.findIndex(s => s.id === record.slotId);
    if (slotIndex !== -1) {
      slotStorage.update(record.slotId, { 
        status: 'occupied', 
        currentVendorId: record.vendorId 
      });
    }
  }
  
  if (status === 'rejected') {
    const slots = slotStorage.getAll();
    const slotIndex = slots.findIndex(s => s.id === record.slotId);
    if (slotIndex !== -1) {
      slotStorage.update(record.slotId, { 
        status: 'available', 
        currentVendorId: null 
      });
    }
  }
  
  const updatedRecord = occupancyStorage.update(id, updates);
  res.json(updatedRecord);
});

app.delete('/api/occupancy/:id', (req, res) => {
  const { id } = req.params;
  const records = occupancyStorage.getAll();
  const record = records.find(r => r.id === id);
  
  if (!record) {
    return res.status(404).json({ error: '占用记录不存在' });
  }
  
  if (record.status === 'confirmed') {
    return res.status(409).json({ 
      error: '状态冲突：已确认的记录不能删除', 
      type: 'STATUS_CONFLICT' 
    });
  }
  
  const success = occupancyStorage.delete(id);
  res.json({ success });
});

app.get('/api/billing-rules', (req, res) => {
  res.json(billingRuleStorage.getAll());
});

app.post('/api/billing-rules', (req, res) => {
  const { zoneType, pricePerHour, minHours, maxHours } = req.body;
  if (!zoneType || !pricePerHour) {
    return res.status(400).json({ error: '必填字段缺失' });
  }
  
  const rules = billingRuleStorage.getAll();
  if (rules.some(r => r.zoneType === zoneType)) {
    return res.status(400).json({ error: '该温区类型的计费规则已存在', type: 'DUPLICATE_SUBMIT' });
  }
  
  const rule = billingRuleStorage.create({ zoneType, pricePerHour, minHours, maxHours });
  res.status(201).json(rule);
});

app.put('/api/billing-rules/:id', (req, res) => {
  const rule = billingRuleStorage.update(req.params.id, req.body);
  if (!rule) {
    return res.status(404).json({ error: '计费规则不存在' });
  }
  res.json(rule);
});

app.delete('/api/billing-rules/:id', (req, res) => {
  const success = billingRuleStorage.delete(req.params.id);
  if (!success) {
    return res.status(404).json({ error: '计费规则不存在' });
  }
  res.json({ success: true });
});

app.get('/api/dashboard', (req, res) => {
  const freezers = freezerStorage.getAll();
  const slots = slotStorage.getAll();
  const vendors = vendorStorage.getAll();
  const zones = zoneStorage.getAll();
  const records = occupancyStorage.getAll();
  
  const occupiedSlots = slots.filter(s => s.status === 'occupied').length;
  const availableSlots = slots.filter(s => s.status === 'available').length;
  const pendingRecords = records.filter(r => r.status === 'pending').length;
  const confirmedRecords = records.filter(r => r.status === 'confirmed').length;
  const rejectedRecords = records.filter(r => r.status === 'rejected').length;
  const totalRevenue = records
    .filter(r => r.status === 'confirmed')
    .reduce((sum, r) => sum + r.totalCost, 0);
  
  const vendorStats = vendors.map(vendor => {
    const vendorRecords = records.filter(r => r.vendorId === vendor.id);
    const confirmed = vendorRecords.filter(r => r.status === 'confirmed');
    return {
      vendorId: vendor.id,
      vendorName: vendor.name,
      totalRecords: vendorRecords.length,
      confirmedRecords: confirmed.length,
      totalCost: confirmed.reduce((sum, r) => sum + r.totalCost, 0)
    };
  });
  
  const zoneStats = zones.map(zone => {
    const zoneSlots = slots.filter(s => s.zoneId === zone.id);
    const zoneRecords = records.filter(r => r.zoneId === zone.id);
    const confirmed = zoneRecords.filter(r => r.status === 'confirmed');
    return {
      zoneId: zone.id,
      zoneName: zone.name,
      zoneType: zone.zoneType,
      pricePerHour: zone.pricePerHour,
      totalSlots: zoneSlots.length,
      occupiedSlots: zoneSlots.filter(s => s.status === 'occupied').length,
      totalRevenue: confirmed.reduce((sum, r) => sum + r.totalCost, 0)
    };
  });
  
  res.json({
    summary: {
      totalFreezers: freezers.length,
      totalSlots: slots.length,
      occupiedSlots,
      availableSlots,
      totalVendors: vendors.length,
      pendingRecords,
      confirmedRecords,
      rejectedRecords,
      totalRevenue: Math.round(totalRevenue * 100) / 100
    },
    vendorStats,
    zoneStats
  });
});

app.get('/api/export/billing', (req, res) => {
  const { status, vendorId, startDate, endDate } = req.query;
  
  let records = occupancyStorage.getAll();
  const vendors = vendorStorage.getAll();
  const slots = slotStorage.getAll();
  const zones = zoneStorage.getAll();
  const freezers = freezerStorage.getAll();
  
  if (status) records = records.filter(r => r.status === status);
  if (vendorId) records = records.filter(r => r.vendorId === vendorId);
  if (startDate) {
    const start = new Date(startDate);
    records = records.filter(r => new Date(r.startTime) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    records = records.filter(r => new Date(r.endTime) <= end);
  }
  
  const exportData = records.map(record => {
    const vendor = vendors.find(v => v.id === record.vendorId);
    const slot = slots.find(s => s.id === record.slotId);
    const zone = zones.find(z => z.id === record.zoneId);
    const freezer = freezers.find(f => f.id === record.freezerId);
    
    return {
      '记录编号': record.id.substring(0, 8),
      '摊主': vendor ? vendor.name : '未知',
      '摊号位': vendor ? vendor.stallNumber : '未知',
      '冷柜': freezer ? freezer.name : '未知',
      '温区': zone ? zone.name : '未知',
      '格口编号': slot ? slot.slotNumber : '未知',
      '开始时间': record.startTime,
      '结束时间': record.endTime,
      '单价(元/小时)': record.pricePerHour,
      '总费用(元)': record.totalCost,
      '状态': record.status === 'pending' ? '待确认' : 
            record.status === 'confirmed' ? '已确认' : 
            record.status === 'rejected' ? '已拒绝' : record.status,
      '备注': record.notes
    };
  });
  
  if (exportData.length === 0) {
    return res.json({ success: false, message: '没有可导出的数据' });
  }
  
  const fields = [
    '记录编号', '摊主', '摊号位', '冷柜', '温区', '格口编号',
    '开始时间', '结束时间', '单价(元/小时)', '总费用(元)', '状态', '备注'
  ];
  
  const parser = new Parser({ fields });
  const csv = parser.parse(exportData);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="billing_${new Date().toISOString().split('T')[0]}.csv"`);
  res.send('\uFEFF' + csv);
});

app.get('/api/export/dashboard', (req, res) => {
  const freezers = freezerStorage.getAll();
  const slots = slotStorage.getAll();
  const vendors = vendorStorage.getAll();
  const zones = zoneStorage.getAll();
  const records = occupancyStorage.getAll();
  
  const exportData = {
    冷柜统计: freezers.map(f => ({
      冷柜名称: f.name,
      位置: f.location,
      总格口数: f.totalSlots
    })),
    温区统计: zones.map(z => ({
      温区名称: z.name,
      类型: z.zoneType === 'chilled' ? '冷藏' : '冷冻',
      单价: z.pricePerHour,
      温度范围: z.tempRange
    })),
    摊主统计: vendors.map(v => {
      const vendorRecords = records.filter(r => r.vendorId === v.id && r.status === 'confirmed');
      return {
        摊主名称: v.name,
        摊号位: v.stallNumber,
        电话: v.phone,
        已确认订单数: vendorRecords.length,
        总费用: vendorRecords.reduce((sum, r) => sum + r.totalCost, 0)
      };
    })
  };
  
  res.json({ success: true, data: exportData });
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: '服务器内部错误' });
});

app.listen(PORT, () => {
  console.log(`市集共享冷柜占用结算台后端服务运行在 http://localhost:${PORT}`);
});
