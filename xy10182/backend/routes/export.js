const express = require('express');
const { Parser } = require('json2csv');
const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const { readJSON, writeJSON } = require('../utils/db');

const router = express.Router();

router.get('/reagents', (req, res) => {
  const reagents = readJSON('reagents.json');
  
  const fields = [
    { label: '试剂名称', value: 'name' },
    { label: '试剂编码', value: 'code' },
    { label: '分类', value: 'category' },
    { label: '规格', value: 'specification' },
    { label: '单位', value: 'unit' },
    { label: '最小库存', value: 'minStock' },
    { label: '最大库存', value: 'maxStock' },
    { label: '保质期(天)', value: 'shelfLifeDays' },
    { label: '状态', value: 'status' },
    { label: '创建时间', value: (row) => moment(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(reagents);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=reagents_${moment().format('YYYYMMDD')}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/batches', (req, res) => {
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const reagentMap = new Map(reagents.map(r => [r.id, r]));
  
  const statusMap = {
    in_stock: '正常库存',
    low_stock: '库存不足',
    expiring: '即将过期',
    expired: '已过期',
    empty: '已空库'
  };
  
  const data = batches.map(b => ({
    ...b,
    reagentName: reagentMap.get(b.reagentId)?.name || '',
    reagentCode: reagentMap.get(b.reagentId)?.code || '',
    statusLabel: statusMap[b.status] || b.status
  }));
  
  const fields = [
    { label: '批次号', value: 'batchNo' },
    { label: '试剂名称', value: 'reagentName' },
    { label: '试剂编码', value: 'reagentCode' },
    { label: '生产厂家', value: 'manufacturer' },
    { label: '生产日期', value: 'productionDate' },
    { label: '有效期', value: 'expiryDate' },
    { label: '总数量', value: 'totalQuantity' },
    { label: '已使用', value: 'usedQuantity' },
    { label: '剩余数量', value: 'remainingQuantity' },
    { label: '存储位置', value: 'storageLocation' },
    { label: '状态', value: 'statusLabel' },
    { label: '二维码', value: 'qrCode' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=batches_${moment().format('YYYYMMDD')}.csv`);
  res.send('\uFEFF' + csv);
});

router.get('/records', (req, res) => {
  const records = readJSON('records.json');
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  
  const batchMap = new Map(batches.map(b => [b.id, b]));
  const reagentMap = new Map(reagents.map(r => [r.id, r]));
  
  const typeMap = {
    stock_in: '入库',
    open: '开封',
    claim: '领用',
    subpackage: '分装',
    return: '归还',
    discard: '报废'
  };
  
  const data = records.map(r => ({
    ...r,
    batchNo: batchMap.get(r.batchId)?.batchNo || '',
    reagentName: reagentMap.get(r.reagentId)?.name || '',
    typeLabel: typeMap[r.type] || r.type,
    createdAtStr: moment(r.createdAt).format('YYYY-MM-DD HH:mm:ss')
  }));
  
  const fields = [
    { label: '操作类型', value: 'typeLabel' },
    { label: '试剂名称', value: 'reagentName' },
    { label: '批次号', value: 'batchNo' },
    { label: '数量', value: 'quantity' },
    { label: '操作员', value: 'operator' },
    { label: '操作地点', value: 'location' },
    { label: '扫描码', value: 'scanCode' },
    { label: '备注', value: 'remark' },
    { label: '操作时间', value: 'createdAtStr' }
  ];
  
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=records_${moment().format('YYYYMMDD')}.csv`);
  res.send('\uFEFF' + csv);
});

router.post('/import/reagents', (req, res) => {
  const { csvData } = req.body;
  
  if (!csvData || !Array.isArray(csvData)) {
    return res.status(400).json({ success: false, message: '无效的导入数据格式' });
  }
  
  const reagents = readJSON('reagents.json');
  const existingCodes = new Set(reagents.map(r => r.code));
  
  const imported = [];
  const failed = [];
  const warnings = [];
  
  csvData.forEach((row, index) => {
    const lineNum = index + 2;
    
    if (!row.name || !row.code || !row.category) {
      failed.push({ line: lineNum, error: '缺少必填字段：名称、编码或分类' });
      return;
    }
    
    if (existingCodes.has(row.code)) {
      warnings.push({ line: lineNum, message: `试剂编码 ${row.code} 已存在，跳过` });
      return;
    }
    
    const newReagent = {
      id: uuidv4(),
      name: row.name,
      code: row.code,
      category: row.category,
      specification: row.specification || '',
      unit: row.unit || '瓶',
      minStock: parseInt(row.minStock) || 0,
      maxStock: parseInt(row.maxStock) || 100,
      shelfLifeDays: parseInt(row.shelfLifeDays) || 365,
      description: row.description || '',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    reagents.push(newReagent);
    existingCodes.add(row.code);
    imported.push(newReagent);
  });
  
  writeJSON('reagents.json', reagents);
  
  res.json({
    success: true,
    data: {
      total: csvData.length,
      imported: imported.length,
      failed: failed.length,
      warnings: warnings.length,
      importedItems: imported,
      failedItems: failed,
      warnings
    }
  });
});

router.post('/import/batches', (req, res) => {
  const { csvData } = req.body;
  
  if (!csvData || !Array.isArray(csvData)) {
    return res.status(400).json({ success: false, message: '无效的导入数据格式' });
  }
  
  const batches = readJSON('batches.json');
  const reagents = readJSON('reagents.json');
  const existingBatchNos = new Set(batches.map(b => b.batchNo));
  
  const imported = [];
  const failed = [];
  const warnings = [];
  
  csvData.forEach((row, index) => {
    const lineNum = index + 2;
    
    if (!row.reagentCode || !row.batchNo || !row.totalQuantity) {
      failed.push({ line: lineNum, error: '缺少必填字段：试剂编码、批次号或数量' });
      return;
    }
    
    const reagent = reagents.find(r => r.code === row.reagentCode);
    if (!reagent) {
      failed.push({ line: lineNum, error: `试剂编码 ${row.reagentCode} 不存在` });
      return;
    }
    
    if (existingBatchNos.has(row.batchNo)) {
      warnings.push({ line: lineNum, message: `批次号 ${row.batchNo} 已存在，跳过` });
      return;
    }
    
    const qty = parseInt(row.totalQuantity);
    if (isNaN(qty) || qty <= 0) {
      failed.push({ line: lineNum, error: '数量必须为正整数' });
      return;
    }
    
    const newBatch = {
      id: uuidv4(),
      reagentId: reagent.id,
      batchNo: row.batchNo,
      manufacturer: row.manufacturer || '',
      productionDate: row.productionDate || moment().format('YYYY-MM-DD'),
      expiryDate: row.expiryDate || moment().add(1, 'year').format('YYYY-MM-DD'),
      totalQuantity: qty,
      usedQuantity: 0,
      remainingQuantity: qty,
      status: 'in_stock',
      storageLocation: row.storageLocation || '',
      qrCode: `QR-${row.batchNo}`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    batches.push(newBatch);
    existingBatchNos.add(row.batchNo);
    imported.push(newBatch);
  });
  
  writeJSON('batches.json', batches);
  
  res.json({
    success: true,
    data: {
      total: csvData.length,
      imported: imported.length,
      failed: failed.length,
      warnings: warnings.length,
      importedItems: imported,
      failedItems: failed,
      warnings
    }
  });
});

module.exports = router;
