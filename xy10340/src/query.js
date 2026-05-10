
const fs = require('fs');
const path = require('path');
const { stringify } = require('csv-stringify/sync');
const { loadStorage, log, formatDate, formatMoney, ensureDataDir } = require('./utils');

const EXPORT_DIR = path.join(__dirname, '../exports');

function ensureExportDir() {
  ensureDataDir();
  if (!fs.existsSync(EXPORT_DIR)) {
    fs.mkdirSync(EXPORT_DIR, { recursive: true });
  }
}

function getVehicleByPlateOrVin(storage, identifier) {
  return storage.vehicles.find(v => 
    v.vin === identifier || 
    v.plateNumber === identifier ||
    v.plateHistory.includes(identifier)
  );
}

function getVehicleDetails(vehicleIdentifier) {
  log(`查询车辆明细: ${vehicleIdentifier}`, 'info');
  const storage = loadStorage();

  const vehicle = getVehicleByPlateOrVin(storage, vehicleIdentifier);
  if (!vehicle) {
    log(`未找到车辆: ${vehicleIdentifier}`, 'error');
    return { success: false, message: '未找到车辆' };
  }

  // 获取车辆的所有套餐权益
  const rights = storage.packageRights.filter(p => p.vehicleId === vehicle.id);
  
  // 获取车辆的所有核销记录
  const records = storage.verificationRecords.filter(r => {
    const right = storage.packageRights.find(p => p.id === r.packageRightId);
    return right && right.vehicleId === vehicle.id;
  }).sort((a, b) => new Date(b.date) - new Date(a.date));

  // 构建详细信息
  const details = {
    vehicle: {
      plateNumber: vehicle.plateNumber,
      vin: vehicle.vin,
      ownerName: vehicle.ownerName,
      ownerPhone: vehicle.ownerPhone,
      plateHistory: vehicle.plateHistory
    },
    packageRights: [],
    verificationRecords: []
  };

  // 处理套餐权益
  rights.forEach(right => {
    const pkg = storage.packages.find(p => p.id === right.packageId);
    const shop = storage.shops.find(s => {
      const firstRecord = records.find(r => r.packageRightId === right.id && r.status === 'verified');
      return firstRecord ? s.id === firstRecord.shopId : false;
    });

    details.packageRights.push({
      id: right.id,
      package: pkg ? `${pkg.name} (${pkg.id})` : '未知套餐',
      packageType: pkg?.packageType || '未知',
      purchaseDate: right.purchaseDate,
      purchasePrice: right.purchasePrice,
      totalServices: right.totalServices,
      remainingServices: right.remainingServices,
      usedServices: right.totalServices - right.remainingServices,
      isRefunded: right.isRefunded,
      refundDate: right.refundDate,
      materials: pkg?.materials || right.materials,
      firstShop: shop ? `${shop.name} (${shop.id})` : '未核销'
    });
  });

  // 处理核销记录
  records.forEach(record => {
    const right = storage.packageRights.find(p => p.id === record.packageRightId);
    const pkg = right ? storage.packages.find(p => p.id === right.packageId) : null;
    const shop = storage.shops.find(s => s.id === record.shopId);

    details.verificationRecords.push({
      id: record.id,
      date: record.date,
      package: pkg ? pkg.name : '未知套餐',
      shop: shop ? `${shop.name} (${shop.id})` : '未知门店',
      status: getStatusText(record.status),
      action: record.action,
      finalResult: record.finalResult,
      sourceFile: record.sourceFile,
      materials: record.materials
    });
  });

  // 输出格式化的明细
  log(`\n=== 车辆明细 (${vehicle.plateNumber}) ==`, 'success');
  log(`车牌号码: ${vehicle.plateNumber}`, 'info');
  log(`车架号(VIN): ${vehicle.vin}`, 'info');
  log(`车主: ${vehicle.ownerName || '-'}`, 'info');
  log(`联系电话: ${vehicle.ownerPhone || '-'}`, 'info');
  if (vehicle.plateHistory.length > 1) {
    log(`车牌历史: ${vehicle.plateHistory.join(' → ')}`, 'warning');
  }

  log(`\n=== 套餐权益 (${details.packageRights.length} 个) ==`, 'info');
  details.packageRights.forEach((right, index) => {
    log(`\n[${index + 1}] ${right.package}`, 'info');
    log(`  类型: ${right.packageType}`, 'info');
    log(`  购买日期: ${right.purchaseDate}`, 'info');
    log(`  购买价格: ${formatMoney(right.purchasePrice)}`, 'info');
    log(`  服务次数: ${right.remainingServices}/${right.totalServices} (已用${right.usedServices}次)`, 
      right.remainingServices > 0 ? 'info' : 'warning');
    
    if (right.materials && right.materials.length > 0) {
      log(`  套餐材料:`, 'info');
      right.materials.forEach(m => {
        log(`    - ${m.name}: ${m.quantity}${m.unit || ''}`, 'info');
      });
    }
    
    if (right.isRefunded) {
      log(`  ⚠ 已退款: ${right.refundDate}`, 'warning');
    }
    log(`  首次核销门店: ${right.firstShop}`, 'info');
  });

  log(`\n=== 核销记录 (${details.verificationRecords.length} 条) ==`, 'info');
  details.verificationRecords.forEach((record, index) => {
    log(`\n[${index + 1}] 核销单ID: ${record.id}`, 'info');
    log(`  日期: ${record.date}`, 'info');
    log(`  套餐: ${record.package}`, 'info');
    log(`  门店: ${record.shop}`, 'info');
    log(`  状态: ${record.status}`, getStatusColor(record.status));
    log(`  操作: ${record.action}`, 'info');
    log(`  结果: ${record.finalResult}`, 'info');
    log(`  来源文件: ${record.sourceFile || '-'}`, 'info');
    if (record.materials && record.materials.length > 0) {
      log(`  使用材料:`, 'info');
      record.materials.forEach(m => {
        log(`    - ${m.name}: ${m.quantity}${m.unit || ''}`, 'info');
      });
    }
  });

  return { success: true, details };
}

function getStatusText(status) {
  const map = {
    'pending': '待处理',
    'verified': '已核销',
    'cancelled': '已撤销',
    'refunded': '已退款',
    'exchanged': '已换购'
  };
  return map[status] || status;
}

function getStatusColor(status) {
  const map = {
    'verified': 'success',
    'cancelled': 'warning',
    'refunded': 'warning',
    'exchanged': 'info',
    'pending': 'info'
  };
  return map[status] || 'info';
}

function exportShopReconciliation(shopId, startDate, endDate, outputFile = null) {
  log(`导出门店对账: 门店 ${shopId}`, 'info');
  if (startDate && endDate) {
    log(`时间范围: ${startDate} ~ ${endDate}`, 'info');
  }
  
  const storage = loadStorage();
  const shop = storage.shops.find(s => s.id === shopId);
  
  if (!shop) {
    log(`未找到门店: ${shopId}`, 'error');
    return { success: false, message: '未找到门店' };
  }

  // 筛选该门店的核销记录
  let records = storage.verificationRecords.filter(r => r.shopId === shopId);
  
  // 按时间范围筛选
  if (startDate && endDate) {
    records = records.filter(r => {
      const date = new Date(r.date);
      return date >= new Date(startDate) && date <= new Date(endDate);
    });
  }

  // 按日期排序
  records.sort((a, b) => new Date(a.date) - new Date(b.date));

  // 构建对账数据
  const reconciliationData = [];
  let stats = {
    total: 0,
    verified: 0,
    cancelled: 0,
    refunded: 0,
    exchanged: 0,
    totalAmount: 0
  };

  records.forEach(record => {
    const right = storage.packageRights.find(p => p.id === record.packageRightId);
    const pkg = right ? storage.packages.find(p => p.id === right.packageId) : null;
    const vehicle = right ? storage.vehicles.find(v => v.id === right.vehicleId) : null;

    const amount = pkg && right ? right.purchasePrice / right.totalServices : 0;
    
    stats.total++;
    if (record.status === 'verified') {
      stats.verified++;
      stats.totalAmount += amount;
    } else if (record.status === 'cancelled') {
      stats.cancelled++;
      stats.totalAmount -= amount;
    } else if (record.status === 'refunded') {
      stats.refunded++;
    } else if (record.status === 'exchanged') {
      stats.exchanged++;
    }

    reconciliationData.push({
      date: record.date,
      recordId: record.id,
      plateNumber: vehicle?.plateNumber || '未知',
      vin: vehicle?.vin || '未知',
      packageName: pkg?.name || '未知套餐',
      packageId: pkg?.id || '未知',
      amount: record.status === 'verified' ? amount.toFixed(2) : 
              record.status === 'cancelled' ? `-${amount.toFixed(2)}` : '0.00',
      status: getStatusText(record.status),
      action: record.action,
      result: record.finalResult,
      sourceFile: record.sourceFile || ''
    });
  });

  // 生成默认文件名
  const defaultFileName = `reconciliation_${shopId}_${formatDate(new Date())}.csv`;
  const outputPath = outputFile || path.join(EXPORT_DIR, defaultFileName);

  ensureExportDir();

  // 生成CSV
  const csvContent = stringify(reconciliationData, {
    header: true,
    columns: [
      { key: 'date', header: '日期' },
      { key: 'recordId', header: '核销单ID' },
      { key: 'plateNumber', header: '车牌号码' },
      { key: 'vin', header: '车架号' },
      { key: 'packageName', header: '套餐名称' },
      { key: 'packageId', header: '套餐ID' },
      { key: 'amount', header: '金额' },
      { key: 'status', header: '状态' },
      { key: 'action', header: '操作类型' },
      { key: 'result', header: '处理结果' },
      { key: 'sourceFile', header: '来源文件' }
    ]
  });

  // 写入文件
  fs.writeFileSync(outputPath, '\ufeff' + csvContent, 'utf8');

  // 输出统计信息
  log(`\n=== 门店对账统计 (${shop.name}) ==`, 'success');
  log(`门店名称: ${shop.name}`, 'info');
  log(`门店地址: ${shop.address || '-'}`, 'info');
  log(`联系电话: ${shop.phone || '-'}`, 'info');
  log(`记录总数: ${stats.total} 条`, 'info');
  log(`已核销: ${stats.verified} 条`, 'success');
  log(`已撤销: ${stats.cancelled} 条`, 'warning');
  log(`已退款: ${stats.refunded} 条`, 'warning');
  log(`已换购: ${stats.exchanged} 条`, 'info');
  log(`对账金额: ${formatMoney(stats.totalAmount)}`, 'success');
  log(`\n对账文件已导出: ${outputPath}`, 'success');

  return { 
    success: true, 
    outputPath,
    stats,
    records: reconciliationData 
  };
}

module.exports = {
  getVehicleDetails,
  exportShopReconciliation
};
