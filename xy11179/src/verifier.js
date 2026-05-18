const fs = require('fs');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;

const KEY_COLUMNS = [
  'orderId',
  'pickupCode',
  'customerName',
  'customerPhone',
  'cakeName',
  'cakeSize',
  'orderStore',
  'pickupStore',
  'pickupTime',
  'pickupType',
  'isProxy',
  'proxyName',
  'proxyPhone',
  'isManualCode',
  'isCrossStore',
  'status',
  'verificationResult',
  'remark'
];

function readCsv(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function normalizePickupCode(code) {
  if (!code) return '';
  return String(code).toUpperCase().replace(/[^A-Z0-9]/g, '');
}

function verifyPickupCodes(orders, pickups) {
  const orderMap = new Map();
  orders.forEach(order => {
    const normalizedCode = normalizePickupCode(order.pickupCode);
    if (normalizedCode) {
      if (!orderMap.has(normalizedCode)) {
        orderMap.set(normalizedCode, []);
      }
      orderMap.get(normalizedCode).push(order);
    }
  });

  const results = [];
  const boundaryCases = {
    proxyPickup: [],
    manualCode: [],
    crossStore: [],
    rerunnable: []
  };

  pickups.forEach(pickup => {
    const normalizedCode = normalizePickupCode(pickup.pickupCode);
    const matchedOrders = orderMap.get(normalizedCode) || [];
    
    matchedOrders.forEach(order => {
      const result = verifySingleOrder(order, pickup);
      results.push(result);
      
      if (result.isProxy) boundaryCases.proxyPickup.push(result);
      if (result.isManualCode) boundaryCases.manualCode.push(result);
      if (result.isCrossStore) boundaryCases.crossStore.push(result);
      if (result.canRerun) boundaryCases.rerunnable.push(result);
    });

    if (matchedOrders.length === 0) {
      results.push({
        ...pickup,
        orderId: '',
        cakeName: '',
        cakeSize: '',
        orderStore: '',
        verificationResult: 'NOT_FOUND',
        status: '异常',
        remark: '取货码未找到对应订单',
        isProxy: false,
        isManualCode: detectManualCode(pickup.pickupCode),
        isCrossStore: false,
        canRerun: true
      });
    }
  });

  return { results, boundaryCases };
}

function verifySingleOrder(order, pickup) {
  const result = {
    orderId: order.orderId || '',
    pickupCode: order.pickupCode || pickup.pickupCode || '',
    customerName: order.customerName || pickup.customerName || '',
    customerPhone: order.customerPhone || pickup.customerPhone || '',
    cakeName: order.cakeName || '',
    cakeSize: order.cakeSize || '',
    orderStore: order.orderStore || '',
    pickupStore: pickup.pickupStore || order.pickupStore || '',
    pickupTime: pickup.pickupTime || '',
    pickupType: pickup.pickupType || order.pickupType || '',
    isProxy: false,
    proxyName: pickup.proxyName || order.proxyName || '',
    proxyPhone: pickup.proxyPhone || order.proxyPhone || '',
    isManualCode: false,
    isCrossStore: false,
    status: '正常',
    verificationResult: 'SUCCESS',
    remark: '',
    canRerun: false
  };

  if (pickup.proxyName || order.isProxy === '是' || order.isProxy === 'true') {
    result.isProxy = true;
    result.remark += '【代取】';
  }

  result.isManualCode = detectManualCode(result.pickupCode);
  if (result.isManualCode) {
    result.remark += '【手输码】';
  }

  if (order.orderStore && result.pickupStore && 
      order.orderStore !== result.pickupStore) {
    result.isCrossStore = true;
    result.verificationResult = 'CROSS_STORE_WARNING';
    result.status = '警告';
    result.remark += `【跨店取货: ${order.orderStore} → ${result.pickupStore}】`;
  }

  if (!result.customerPhone || !result.pickupTime) {
    result.canRerun = true;
  }

  if (!order.pickupCode || !pickup.pickupCode) {
    result.verificationResult = 'MISSING_CODE';
    result.status = '异常';
    result.remark += '【缺失取货码】';
  }

  return result;
}

function detectManualCode(code) {
  if (!code) return false;
  const normalized = normalizePickupCode(code);
  if (normalized.length < 4) return true;
  if (/^[0-9]{4,6}$/.test(normalized)) return true;
  if (/^[A-Z]{1,2}[0-9]{3,4}$/.test(normalized)) return true;
  return false;
}

async function writeResults(results, outputPath) {
  const orderedResults = results.map(r => {
    const ordered = {};
    KEY_COLUMNS.forEach(col => {
      ordered[col] = r[col] !== undefined ? r[col] : '';
    });
    return ordered;
  });

  const csvWriter = createCsvWriter({
    path: outputPath,
    header: KEY_COLUMNS.map(col => ({ id: col, title: col }))
  });

  await csvWriter.writeRecords(orderedResults);
}

function generateSummary(results, boundaryCases) {
  const total = results.length;
  const success = results.filter(r => r.verificationResult === 'SUCCESS').length;
  const warnings = results.filter(r => r.status === '警告').length;
  const errors = results.filter(r => r.status === '异常').length;

  return {
    total,
    success,
    warnings,
    errors,
    boundaryCases: {
      proxyPickup: boundaryCases.proxyPickup.length,
      manualCode: boundaryCases.manualCode.length,
      crossStore: boundaryCases.crossStore.length,
      rerunnable: boundaryCases.rerunnable.length
    }
  };
}

module.exports = {
  readCsv,
  verifyPickupCodes,
  writeResults,
  generateSummary,
  KEY_COLUMNS
};
