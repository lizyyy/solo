
const fs = require('fs');
const { parse } = require('csv-parse/sync');
const { loadStorage, saveStorage, log, generateId, formatDate, formatMoney } = require('./utils');
const { VerificationRecord } = require('./models');

function readCsvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  const content = fs.readFileSync(filePath, 'utf8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true
  });
}

function getVehicleByPlateOrVin(storage, identifier) {
  return storage.vehicles.find(v => 
    v.vin === identifier || 
    v.plateNumber === identifier ||
    v.plateHistory.includes(identifier)
  );
}

function processVerification(filePath) {
  log(`开始处理核销记录: ${filePath}`, 'info');
  const storage = loadStorage();
  const records = readCsvFile(filePath);
  const fileName = filePath.split('/').pop();

  let processed = 0;
  let duplicate = 0;
  let error = 0;
  let warning = 0;
  let refundExchange = 0;

  records.forEach(record => {
    const recordId = record.id || record.ID || record.核销单ID;
    const vehicleIdentifier = record.vehicleIdentifier || record.VehicleIdentifier || record.车辆标识;
    const shopId = record.shopId || record.ShopId || record.门店ID;
    const date = record.date || record.Date || record.日期;
    const action = record.action || record.Action || record.操作类型; // 'verify', 'refund', 'exchange'
    const packageRightId = record.packageRightId || record.PackageRightId || record.权益ID;
    const materials = record.materials ? JSON.parse(record.materials) : [];
    const oilLiters = parseFloat(record.oilLiters || record.OilLiters || record.机油升数) || 0;
    const newPackageRightId = record.newPackageRightId || record.NewPackageRightId || record.新权益ID;

    // 检查重复核销单
    const existingRecord = storage.verificationRecords.find(r => r.id === recordId);
    if (existingRecord) {
      if (existingRecord.status === 'verified') {
        log(`核销单 ${recordId} 已存在且已核销，跳过处理`, 'warning');
        duplicate++;
        return;
      } else if (existingRecord.status === 'cancelled') {
        log(`核销单 ${recordId} 已存在但已取消，将重新处理`, 'warning');
      }
    }

    if (!recordId || !vehicleIdentifier || !shopId || !action) {
      log(`核销单 ${recordId}: 缺少必要信息`, 'error');
      error++;
      return;
    }

    // 查找车辆
    const vehicle = getVehicleByPlateOrVin(storage, vehicleIdentifier);
    if (!vehicle) {
      log(`核销单 ${recordId}: 未找到车辆 (标识: ${vehicleIdentifier})`, 'error');
      error++;
      return;
    }

    // 查找门店
    const shop = storage.shops.find(s => s.id === shopId);
    if (!shop) {
      log(`核销单 ${recordId}: 未找到门店 (ID: ${shopId})`, 'error');
      error++;
      return;
    }

    // 处理核销
    if (action === 'verify') {
      let verificationRecord;
      let finalResult = '';
      let usedPackageRight = null;
      let pkgRight = null;

      if (packageRightId) {
        pkgRight = storage.packageRights.find(p => p.id === packageRightId && p.vehicleId === vehicle.id);
        if (!pkgRight) {
          log(`核销单 ${recordId}: 未找到权益 (ID: ${packageRightId})`, 'error');
          error++;
          return;
        }
      } else {
        // 自动选择有效权益
        const availableRights = storage.packageRights.filter(p => 
          p.vehicleId === vehicle.id && 
          p.remainingServices > 0 && 
          !p.isRefunded
        );
        if (availableRights.length === 0) {
          log(`核销单 ${recordId}: 车辆 ${vehicle.plateNumber} 没有可用权益`, 'error');
          error++;
          return;
        }
        pkgRight = availableRights[0];
      }

      const pkg = storage.packages.find(p => p.id === pkgRight.packageId);
      if (!pkg) {
        log(`核销单 ${recordId}: 未找到套餐 (ID: ${pkgRight.packageId})`, 'error');
        error++;
        return;
      }

      // 检查机油升数匹配
      let oilMatch = true;
      const requiredOilLiters = pkg.materials ? 
        (pkg.materials.find(m => m.type === 'oil')?.quantity || 0) : 0;
      
      if (oilLiters > 0 && requiredOilLiters > 0 && oilLiters !== requiredOilLiters) {
        log(`核销单 ${recordId}: 机油升数不匹配 (套餐要求: ${requiredOilLiters}L, 实际使用: ${oilLiters}L)`, 'warning');
        warning++;
        oilMatch = false;
        finalResult += `机油升数不匹配(套餐${requiredOilLiters}L/实际${oilLiters}L); `;
      }

      // 检查材料超额
      let materialExcess = [];
      if (pkg.materials && materials.length > 0) {
        materials.forEach(used => {
          const pkgMaterial = pkg.materials.find(pm => pm.name === used.name);
          if (pkgMaterial && used.quantity > pkgMaterial.quantity) {
            materialExcess.push(`${used.name}超${used.quantity - pkgMaterial.quantity}`);
          }
        });
      }

      if (materialExcess.length > 0) {
        log(`核销单 ${recordId}: 材料超额 - ${materialExcess.join(', ')}`, 'warning');
        warning++;
        finalResult += `材料超额(${materialExcess.join(', ')}); `;
      }

      // 执行核销
      if (existingRecord) {
        verificationRecord = existingRecord;
        verificationRecord.status = 'verified';
      } else {
        verificationRecord = {
          id: recordId,
          packageRightId: pkgRight.id,
          shopId: shopId,
          date: date,
          materials: materials,
          status: 'verified',
          sourceFile: null,
          action: null,
          finalResult: null
        };
      }

      const beforeRemaining = pkgRight.remainingServices;
      let success = false;
      let afterRemaining = beforeRemaining;
      
      if (beforeRemaining > 0) {
        afterRemaining = beforeRemaining - 1;
        pkgRight.remainingServices = afterRemaining;
        success = true;
      }
      
      if (success) {
        finalResult += `核销成功: ${pkg.name} (剩余${afterRemaining}/${pkgRight.totalServices}次)`;
        
        log(`核销单 ${recordId}: 车辆 ${vehicle.plateNumber} 核销 ${pkg.name} 成功`, 'success');
        log(`  前: ${beforeRemaining} 次, 后: ${afterRemaining} 次`, 'info');
        
        if (!oilMatch) {
          log(`  ⚠ 机油升数不匹配: 套餐${requiredOilLiters}L, 实际${oilLiters}L`, 'warning');
        }
        if (materialExcess.length > 0) {
          log(`  ⚠ 材料超额: ${materialExcess.join(', ')}`, 'warning');
        }
        
        // 跨店核销提示
        const firstShopId = getFirstShopOfRights(storage, vehicle.id);
        if (firstShopId && firstShopId !== shopId) {
          log(`  ℹ 跨店核销: 首次核销门店 ${firstShopId}, 当前门店 ${shopId} (${shop.name})`, 'info');
          finalResult += `; 跨店核销`;
        }

        verificationRecord.sourceFile = fileName;
        verificationRecord.action = '核销';
        verificationRecord.finalResult = finalResult;
        
        if (!existingRecord) {
          storage.verificationRecords.push(verificationRecord);
        }
        processed++;
      } else {
        log(`核销单 ${recordId}: 权益 ${pkgRight.id} 已用完`, 'error');
        error++;
        verificationRecord.sourceFile = fileName;
        verificationRecord.action = '核销';
        verificationRecord.finalResult = '失败:权益已用完';
        if (!existingRecord) {
          storage.verificationRecords.push(verificationRecord);
        }
      }
    }

    // 处理退款换购
    if (action === 'refund' || action === 'exchange') {
      let oldRight = null;
      let newRight = null;

      if (packageRightId) {
        oldRight = storage.packageRights.find(p => p.id === packageRightId && p.vehicleId === vehicle.id);
      }

      if (!oldRight) {
        log(`核销单 ${recordId}: 未找到原权益 (ID: ${packageRightId})`, 'error');
        error++;
        return;
      }

      const oldPkg = storage.packages.find(p => p.id === oldRight.packageId);

      if (action === 'refund') {
        // 退款处理
        oldRight.isRefunded = true;
        oldRight.refundDate = date;
        log(`核销单 ${recordId}: 车辆 ${vehicle.plateNumber} 套餐 ${oldPkg.name} 退款成功`, 'success');
        
        const verificationRecord = {
          id: recordId,
          packageRightId: oldRight.id,
          shopId: shopId,
          date: date,
          materials: [],
          status: 'refunded',
          sourceFile: fileName,
          action: '退款',
          finalResult: `退款成功: ${oldPkg.name}`
        };
        storage.verificationRecords.push(verificationRecord);
        refundExchange++;
      }

      if (action === 'exchange' && newPackageRightId) {
        // 换购处理
        newRight = storage.packageRights.find(p => p.id === newPackageRightId && p.vehicleId === vehicle.id);
        if (!newRight) {
          log(`核销单 ${recordId}: 未找到新权益 (ID: ${newPackageRightId})`, 'error');
          error++;
          return;
        }

        const newPkg = storage.packages.find(p => p.id === newRight.packageId);
        
        // 原套餐退款
        oldRight.isRefunded = true;
        oldRight.refundDate = date;
        
        // 新套餐激活
        log(`核销单 ${recordId}: 车辆 ${vehicle.plateNumber} 换购成功`, 'success');
        log(`  原套餐: ${oldPkg.name} → 新套餐: ${newPkg.name}`, 'info');
        log(`  新套餐权益: ${newRight.remainingServices}/${newRight.totalServices} 次`, 'info');
        
        const verificationRecord = {
          id: recordId,
          packageRightId: oldRight.id,
          shopId: shopId,
          date: date,
          materials: [],
          status: 'exchanged',
          sourceFile: fileName,
          action: '换购',
          finalResult: `换购成功: ${oldPkg.name} → ${newPkg.name}`
        };
        storage.verificationRecords.push(verificationRecord);
        refundExchange++;
      }

      processed++;
    }
  });

  saveStorage(storage);
  
  log(`\n=== 核销处理汇总 ==`, 'info');
  log(`成功处理: ${processed} 条`, 'success');
  log(`重复跳过: ${duplicate} 条`, 'warning');
  log(`警告记录: ${warning} 条`, 'warning');
  log(`退款换购: ${refundExchange} 条`, 'info');
  log(`错误记录: ${error} 条`, 'error');
  
  return { processed, duplicate, warning, error, refundExchange };
}

function getFirstShopOfRights(storage, vehicleId) {
  const vehicleRecords = storage.verificationRecords
    .filter(r => {
      const pkgRight = storage.packageRights.find(p => p.id === r.packageRightId);
      return pkgRight && pkgRight.vehicleId === vehicleId && r.status === 'verified';
    })
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  
  return vehicleRecords.length > 0 ? vehicleRecords[0].shopId : null;
}

function cancelVerification(recordId, reason = '') {
  log(`开始撤销核销: 核销单ID ${recordId}`, 'info');
  const storage = loadStorage();

  const record = storage.verificationRecords.find(r => r.id === recordId);
  
  if (!record) {
    log(`未找到核销单: ${recordId}`, 'error');
    return { success: false, message: '未找到核销单' };
  }

  if (record.status !== 'verified') {
    log(`核销单 ${recordId} 状态不是已核销，无法撤销`, 'warning');
    return { success: false, message: '核销单状态不是已核销' };
  }

  const pkgRight = storage.packageRights.find(p => p.id === record.packageRightId);
  if (!pkgRight) {
    log(`未找到对应权益: ${record.packageRightId}`, 'error');
    return { success: false, message: '未找到对应权益' };
  }

  const beforeRemaining = pkgRight.remainingServices;
  let success = false;
  let afterRemaining = beforeRemaining;
  
  if (beforeRemaining < pkgRight.totalServices) {
    afterRemaining = beforeRemaining + 1;
    pkgRight.remainingServices = afterRemaining;
    success = true;
  }
  
  if (success) {
    record.status = 'cancelled';
    record.sourceFile = record.sourceFile || 'manual';
    record.action = '撤销';
    record.finalResult = `撤销成功: 恢复权益 ${afterRemaining - 1} → ${afterRemaining} 次${reason ? ` (原因: ${reason})` : ''}`;

    saveStorage(storage);
    
    log(`撤销成功`, 'success');
    log(`  核销单: ${recordId}`, 'info');
    log(`  权益恢复: ${beforeRemaining} → ${afterRemaining} 次`, 'info');
    if (reason) {
      log(`  原因: ${reason}`, 'info');
    }
    
    return { 
      success: true, 
      message: '撤销成功',
      details: {
        recordId,
        beforeRemaining,
        afterRemaining,
        reason
      }
    };
  } else {
    log(`撤销失败: 权益已达上限`, 'error');
    return { success: false, message: '撤销失败: 权益已达上限' };
  }
}

function getRecordTrace(recordId) {
  const storage = loadStorage();
  const record = storage.verificationRecords.find(r => r.id === recordId);
  
  if (!record) {
    return { success: false, message: '未找到核销单' };
  }

  const pkgRight = storage.packageRights.find(p => p.id === record.packageRightId);
  const vehicle = pkgRight ? storage.vehicles.find(v => v.id === pkgRight.vehicleId) : null;
  const shop = storage.shops.find(s => s.id === record.shopId);

  return {
    success: true,
    trace: {
      recordId: record.id,
      sourceFile: record.sourceFile,
      action: record.action,
      finalResult: record.finalResult,
      status: record.status,
      date: record.date,
      vehicle: vehicle ? `${vehicle.plateNumber} (${vehicle.vin})` : '未知',
      shop: shop ? `${shop.name} (${shop.id})` : '未知',
      materials: record.materials
    }
  };
}

module.exports = {
  processVerification,
  cancelVerification,
  getRecordTrace
};
