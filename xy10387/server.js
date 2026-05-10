const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR);
}

function readData(fileName) {
  const filePath = path.join(DATA_DIR, fileName);
  if (!fs.existsSync(filePath)) {
    return [];
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content || '[]');
}

function writeData(fileName, data) {
  const filePath = path.join(DATA_DIR, fileName);
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}

function initData() {
  if (!fs.existsSync(path.join(DATA_DIR, 'stores.json'))) {
    const sampleStores = [
      { id: 'ST001', name: '旺旺烟酒超市', owner: '张三', phone: '13800138001', address: '北京市朝阳区建国路88号' },
      { id: 'ST002', name: '顺发烟酒商行', owner: '李四', phone: '13800138002', address: '北京市海淀区中关村大街1号' },
      { id: 'ST003', name: '鑫源烟酒店', owner: '王五', phone: '13800138003', address: '北京市西城区西单北大街100号' },
      { id: 'ST004', name: '利民烟酒商店', owner: '赵六', phone: '13800138004', address: '北京市东城区王府井大街200号' }
    ];
    writeData('stores.json', sampleStores);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'brands.json'))) {
    const sampleBrands = [
      { id: 'BR001', name: '中华', category: '香烟' },
      { id: 'BR002', name: '玉溪', category: '香烟' },
      { id: 'BR003', name: '茅台', category: '白酒' },
      { id: 'BR004', name: '五粮液', category: '白酒' }
    ];
    writeData('brands.json', sampleBrands);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'activities.json'))) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    const sampleActivities = [
      {
        id: 'AC001',
        brandId: 'BR001',
        name: '中华香烟春节陈列活动',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        description: '春节期间中华香烟陈列促销活动'
      },
      {
        id: 'AC002',
        brandId: 'BR003',
        name: '茅台白酒陈列推广',
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
        description: '茅台白酒终端陈列推广活动'
      }
    ];
    writeData('activities.json', sampleActivities);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'rebateRules.json'))) {
    const sampleRules = [
      {
        id: 'RR001',
        activityId: 'AC001',
        name: '中华香烟基础返利',
        minStock: 10,
        minDisplayPhotos: 3,
        rebateAmount: 500,
        description: '进货量≥10条，陈列照片≥3张，返利500元'
      },
      {
        id: 'RR002',
        activityId: 'AC001',
        name: '中华香烟进阶返利',
        minStock: 30,
        minDisplayPhotos: 5,
        rebateAmount: 1200,
        description: '进货量≥30条，陈列照片≥5张，返利1200元'
      },
      {
        id: 'RR003',
        activityId: 'AC002',
        name: '茅台白酒基础返利',
        minStock: 5,
        minDisplayPhotos: 3,
        rebateAmount: 800,
        description: '进货量≥5瓶，陈列照片≥3张，返利800元'
      },
      {
        id: 'RR004',
        activityId: 'AC002',
        name: '茅台白酒进阶返利',
        minStock: 15,
        minDisplayPhotos: 5,
        rebateAmount: 2000,
        description: '进货量≥15瓶，陈列照片≥5张，返利2000元'
      }
    ];
    writeData('rebateRules.json', sampleRules);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'displayTasks.json'))) {
    const sampleTasks = [
      {
        id: 'DT001',
        activityId: 'AC001',
        storeId: 'ST001',
        description: '中华香烟堆头陈列',
        photoCount: 5,
        status: 'pending'
      },
      {
        id: 'DT002',
        activityId: 'AC001',
        storeId: 'ST002',
        description: '中华香烟端架陈列',
        photoCount: 3,
        status: 'pending'
      },
      {
        id: 'DT003',
        activityId: 'AC002',
        storeId: 'ST003',
        description: '茅台白酒专柜陈列',
        photoCount: 4,
        status: 'pending'
      },
      {
        id: 'DT004',
        activityId: 'AC002',
        storeId: 'ST004',
        description: '茅台白酒堆头陈列',
        photoCount: 3,
        status: 'pending'
      }
    ];
    writeData('displayTasks.json', sampleTasks);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'stocks.json'))) {
    const sampleStocks = [
      { id: 'SK001', storeId: 'ST001', activityId: 'AC001', stockAmount: 35, purchaseDate: '2026-05-02' },
      { id: 'SK002', storeId: 'ST002', activityId: 'AC001', stockAmount: 8, purchaseDate: '2026-05-03' },
      { id: 'SK003', storeId: 'ST003', activityId: 'AC002', stockAmount: 12, purchaseDate: '2026-05-01' },
      { id: 'SK004', storeId: 'ST004', activityId: 'AC002', stockAmount: 3, purchaseDate: '2026-05-04' }
    ];
    writeData('stocks.json', sampleStocks);
  }

  if (!fs.existsSync(path.join(DATA_DIR, 'displayRecords.json'))) {
    const sampleRecords = [
      {
        id: 'DR001',
        activityId: 'AC001',
        storeId: 'ST001',
        taskId: 'DT001',
        submitDate: '2026-05-05',
        photos: ['photo1.jpg', 'photo2.jpg', 'photo3.jpg', 'photo4.jpg', 'photo5.jpg'],
        photoStatus: 'approved',
        stockAmount: 35,
        reviewStatus: 'approved',
        isSettled: false,
        rebateAmount: 1200,
        remarks: '陈列规范，照片清晰，进货量达标'
      }
    ];
    writeData('displayRecords.json', sampleRecords);
  }
}

initData();

app.get('/api/stores', (req, res) => {
  res.json(readData('stores.json'));
});

app.post('/api/stores', (req, res) => {
  const stores = readData('stores.json');
  const newStore = { id: `ST${String(stores.length + 1).padStart(3, '0')}`, ...req.body };
  stores.push(newStore);
  writeData('stores.json', stores);
  res.json(newStore);
});

app.get('/api/brands', (req, res) => {
  res.json(readData('brands.json'));
});

app.get('/api/activities', (req, res) => {
  res.json(readData('activities.json'));
});

app.post('/api/activities', (req, res) => {
  const activities = readData('activities.json');
  const newActivity = { id: `AC${String(activities.length + 1).padStart(3, '0')}`, ...req.body };
  activities.push(newActivity);
  writeData('activities.json', activities);
  res.json(newActivity);
});

app.get('/api/rebate-rules', (req, res) => {
  res.json(readData('rebateRules.json'));
});

app.get('/api/display-tasks', (req, res) => {
  res.json(readData('displayTasks.json'));
});

app.get('/api/stocks', (req, res) => {
  res.json(readData('stocks.json'));
});

app.post('/api/stocks', (req, res) => {
  const stocks = readData('stocks.json');
  const newStock = { id: `SK${String(stocks.length + 1).padStart(3, '0')}`, ...req.body };
  stocks.push(newStock);
  writeData('stocks.json', stocks);
  res.json(newStock);
});

app.get('/api/display-records', (req, res) => {
  const records = readData('displayRecords.json');
  const stores = readData('stores.json');
  const activities = readData('activities.json');
  const brands = readData('brands.json');
  
  const enrichedRecords = records.map(record => {
    const store = stores.find(s => s.id === record.storeId);
    const activity = activities.find(a => a.id === record.activityId);
    const brand = activity ? brands.find(b => b.id === activity.brandId) : null;
    
    return {
      ...record,
      storeName: store ? store.name : '未知门店',
      activityName: activity ? activity.name : '未知活动',
      brandName: brand ? brand.name : '未知品牌'
    };
  });
  
  res.json(enrichedRecords);
});

function isDateInRange(dateStr, startStr, endStr) {
  const date = new Date(dateStr);
  const start = new Date(startStr);
  const end = new Date(endStr);
  return date >= start && date <= end;
}

function getStockForStoreAndActivity(storeId, activityId) {
  const stocks = readData('stocks.json');
  const storeStocks = stocks.filter(s => s.storeId === storeId && s.activityId === activityId);
  return storeStocks.reduce((sum, s) => sum + (s.stockAmount || 0), 0);
}

function checkDuplicateSubmission(storeId, activityId) {
  const records = readData('displayRecords.json');
  return records.some(r => r.storeId === storeId && r.activityId === activityId);
}

function isRecordSettled(recordId) {
  const records = readData('displayRecords.json');
  const record = records.find(r => r.id === recordId);
  return record ? record.isSettled : false;
}

function calculateRebate(activityId, photoCount, stockAmount) {
  const rules = readData('rebateRules.json').filter(r => r.activityId === activityId);
  if (rules.length === 0) return { success: false, message: '未找到返利规则', amount: 0 };
  
  const matchingRules = rules.filter(r => photoCount >= r.minDisplayPhotos && stockAmount >= r.minStock);
  if (matchingRules.length === 0) {
    return { success: false, message: '未满足任何返利条件', amount: 0 };
  }
  
  matchingRules.sort((a, b) => b.rebateAmount - a.rebateAmount);
  const bestRule = matchingRules[0];
  
  return {
    success: true,
    message: `符合规则：${bestRule.name}`,
    amount: bestRule.rebateAmount,
    rule: bestRule
  };
}

function checkEligibility(storeId, activityId, photoCount, submitDate) {
  const activities = readData('activities.json');
  const activity = activities.find(a => a.id === activityId);
  
  if (!activity) {
    return { eligible: false, reason: '活动不存在', reasonCode: 'NO_ACTIVITY' };
  }
  
  if (!isDateInRange(submitDate, activity.startDate, activity.endDate)) {
    return {
      eligible: false,
      reason: `不在活动期内（活动时间：${activity.startDate} 至 ${activity.endDate}）`,
      reasonCode: 'OUT_OF_DATE'
    };
  }
  
  const stockAmount = getStockForStoreAndActivity(storeId, activityId);
  
  const rules = readData('rebateRules.json').filter(r => r.activityId === activityId);
  if (rules.length === 0) {
    return { eligible: false, reason: '活动无返利规则配置', reasonCode: 'NO_RULES' };
  }
  
  const minStock = Math.min(...rules.map(r => r.minStock));
  const minPhotos = Math.min(...rules.map(r => r.minDisplayPhotos));
  
  if (stockAmount < minStock) {
    return {
      eligible: false,
      reason: `进货量不足（当前：${stockAmount}，最低要求：${minStock}）`,
      reasonCode: 'INSUFFICIENT_STOCK',
      stockAmount,
      requiredStock: minStock
    };
  }
  
  if (photoCount < minPhotos) {
    return {
      eligible: false,
      reason: `照片数量不足（当前：${photoCount}，最低要求：${minPhotos}）`,
      reasonCode: 'INSUFFICIENT_PHOTOS',
      photoCount,
      requiredPhotos: minPhotos
    };
  }
  
  if (checkDuplicateSubmission(storeId, activityId)) {
    return { eligible: false, reason: '该门店已申报过此活动', reasonCode: 'DUPLICATE' };
  }
  
  const rebateResult = calculateRebate(activityId, photoCount, stockAmount);
  
  return {
    eligible: rebateResult.success,
    reason: rebateResult.message,
    reasonCode: rebateResult.success ? 'ELIGIBLE' : 'NOT_ELIGIBLE',
    rebateAmount: rebateResult.amount,
    stockAmount,
    photoCount,
    stockMatch: stockAmount >= minStock,
    photosMatch: photoCount >= minPhotos,
    activityMatch: true
  };
}

app.post('/api/display-records', (req, res) => {
  const { storeId, activityId, photos, submitDate } = req.body;
  const photoCount = (photos || []).length;
  const actualDate = submitDate || new Date().toISOString().split('T')[0];
  
  const eligibility = checkEligibility(storeId, activityId, photoCount, actualDate);
  
  if (!eligibility.eligible) {
    return res.status(400).json({
      success: false,
      ...eligibility
    });
  }
  
  const records = readData('displayRecords.json');
  const newRecord = {
    id: `DR${String(records.length + 1).padStart(3, '0')}`,
    storeId,
    activityId,
    taskId: req.body.taskId,
    submitDate: actualDate,
    photos: photos || [],
    photoStatus: 'pending',
    stockAmount: eligibility.stockAmount,
    reviewStatus: 'pending',
    isSettled: false,
    rebateAmount: eligibility.rebateAmount,
    remarks: ''
  };
  
  records.push(newRecord);
  writeData('displayRecords.json', records);
  
  res.json({
    success: true,
    record: newRecord,
    eligibility
  });
});

app.post('/api/display-records/:id/review-photos', (req, res) => {
  const { id } = req.params;
  const { photoStatus, remarks } = req.body;
  
  if (isRecordSettled(id)) {
    return res.status(400).json({
      success: false,
      message: '已结算记录无法修改照片审核状态'
    });
  }
  
  const records = readData('displayRecords.json');
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }
  
  records[index].photoStatus = photoStatus;
  if (remarks !== undefined) {
    records[index].remarks = remarks;
  }
  
  writeData('displayRecords.json', records);
  res.json({ success: true, record: records[index] });
});

app.post('/api/display-records/:id/review', (req, res) => {
  const { id } = req.params;
  const { reviewStatus, remarks } = req.body;
  
  if (isRecordSettled(id)) {
    return res.status(400).json({
      success: false,
      message: '已结算记录无法修改审核状态'
    });
  }
  
  const records = readData('displayRecords.json');
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }
  
  records[index].reviewStatus = reviewStatus;
  if (remarks !== undefined) {
    records[index].remarks = remarks;
  }
  
  writeData('displayRecords.json', records);
  res.json({ success: true, record: records[index] });
});

app.post('/api/display-records/:id/settle', (req, res) => {
  const { id } = req.params;
  const records = readData('displayRecords.json');
  const index = records.findIndex(r => r.id === id);
  
  if (index === -1) {
    return res.status(404).json({ success: false, message: '记录不存在' });
  }
  
  records[index].isSettled = true;
  writeData('displayRecords.json', records);
  res.json({ success: true, record: records[index] });
});

app.post('/api/check-eligibility', (req, res) => {
  const { storeId, activityId, photoCount, submitDate } = req.body;
  const actualDate = submitDate || new Date().toISOString().split('T')[0];
  const eligibility = checkEligibility(storeId, activityId, photoCount || 0, actualDate);
  res.json(eligibility);
});

app.post('/api/calculate-rebate', (req, res) => {
  const { activityId, photoCount, stockAmount } = req.body;
  const result = calculateRebate(activityId, photoCount || 0, stockAmount || 0);
  res.json(result);
});

app.post('/api/check-stock', (req, res) => {
  const { storeId, activityId } = req.body;
  const stockAmount = getStockForStoreAndActivity(storeId, activityId);
  res.json({ success: true, stockAmount });
});

app.get('/api/export-settlement', (req, res) => {
  const records = readData('displayRecords.json');
  const stores = readData('stores.json');
  const activities = readData('activities.json');
  const brands = readData('brands.json');
  
  const exportData = records.map(record => {
    const store = stores.find(s => s.id === record.storeId);
    const activity = activities.find(a => a.id === record.activityId);
    const brand = activity ? brands.find(b => b.id === activity.brandId) : null;
    
    const rules = readData('rebateRules.json').filter(r => r.activityId === record.activityId);
    const stockAmount = getStockForStoreAndActivity(record.storeId, record.activityId);
    const photoCount = (record.photos || []).length;
    
    const minStock = rules.length > 0 ? Math.min(...rules.map(r => r.minStock)) : 0;
    const minPhotos = rules.length > 0 ? Math.min(...rules.map(r => r.minDisplayPhotos)) : 0;
    
    let passReason = '';
    let failReason = '';
    
    if (record.reviewStatus === 'approved') {
      passReason = '审核通过';
      if (record.photoStatus === 'approved') passReason += '，照片合规';
      if (stockAmount >= minStock) passReason += `，进货量达标（${stockAmount}/${minStock}）`;
      if (photoCount >= minPhotos) passReason += `，照片数量达标（${photoCount}/${minPhotos}）`;
    } else {
      if (record.photoStatus === 'rejected') failReason = '照片审核不通过';
      else if (stockAmount < minStock) failReason = `进货量不足（${stockAmount}/${minStock}）`;
      else if (photoCount < minPhotos) failReason = `照片数量不足（${photoCount}/${minPhotos}）`;
      else failReason = record.remarks || '未通过审核';
    }
    
    return {
      '门店编号': record.storeId,
      '门店名称': store ? store.name : '',
      '联系人': store ? store.owner : '',
      '联系电话': store ? store.phone : '',
      '品牌': brand ? brand.name : '',
      '活动名称': activity ? activity.name : '',
      '活动时间': activity ? `${activity.startDate} 至 ${activity.endDate}` : '',
      '申报日期': record.submitDate,
      '进货量': stockAmount,
      '要求最低进货量': minStock,
      '照片数量': photoCount,
      '要求最低照片数': minPhotos,
      '照片审核状态': record.photoStatus === 'approved' ? '通过' : record.photoStatus === 'rejected' ? '不通过' : '待审核',
      '审核状态': record.reviewStatus === 'approved' ? '通过' : record.reviewStatus === 'rejected' ? '不通过' : '待审核',
      '返利金额(元)': record.reviewStatus === 'approved' ? record.rebateAmount : 0,
      '通过原因': passReason,
      '不通过原因': failReason,
      '是否已结算': record.isSettled ? '是' : '否',
      '备注': record.remarks || ''
    };
  });
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData);
  
  ws['!cols'] = [
    { wch: 12 }, { wch: 20 }, { wch: 10 }, { wch: 15 },
    { wch: 10 }, { wch: 25 }, { wch: 25 }, { wch: 12 },
    { wch: 8 }, { wch: 15 }, { wch: 10 }, { wch: 15 },
    { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 30 },
    { wch: 30 }, { wch: 10 }, { wch: 20 }
  ];
  
  XLSX.utils.book_append_sheet(wb, ws, '陈列返利结算表');
  
  const fileName = `陈列返利结算表_${new Date().toISOString().split('T')[0]}.xlsx`;
  const filePath = path.join(__dirname, 'public', fileName);
  
  XLSX.writeFile(wb, filePath);
  
  res.json({
    success: true,
    fileName,
    downloadUrl: `/${fileName}`
  });
});

app.get('/api/sample-data', (req, res) => {
  const { type } = req.query;
  
  if (type === 'normal') {
    res.json({
      scenario: '正常返利',
      storeId: 'ST001',
      activityId: 'AC001',
      photoCount: 5,
      stockAmount: 35,
      expected: {
        eligible: true,
        rebateAmount: 1200,
        reason: '符合规则：中华香烟进阶返利'
      }
    });
  } else if (type === 'no-photos') {
    res.json({
      scenario: '照片缺失',
      storeId: 'ST001',
      activityId: 'AC001',
      photoCount: 1,
      stockAmount: 35,
      expected: {
        eligible: false,
        reasonCode: 'INSUFFICIENT_PHOTOS'
      }
    });
  } else if (type === 'insufficient-stock') {
    res.json({
      scenario: '进货不足',
      storeId: 'ST002',
      activityId: 'AC001',
      photoCount: 5,
      stockAmount: 8,
      expected: {
        eligible: false,
        reasonCode: 'INSUFFICIENT_STOCK'
      }
    });
  } else if (type === 'duplicate') {
    res.json({
      scenario: '重复申报',
      storeId: 'ST001',
      activityId: 'AC001',
      photoCount: 5,
      stockAmount: 35,
      expected: {
        eligible: false,
        reasonCode: 'DUPLICATE'
      }
    });
  } else {
    res.status(400).json({ error: '未知的样例类型' });
  }
});

app.listen(PORT, () => {
  console.log(`烟酒店陈列返利管理系统已启动：http://localhost:${PORT}`);
});
