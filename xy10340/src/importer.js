
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { loadStorage, saveStorage, log, generateId } = require('./utils');

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

function importVehicles(filePath) {
  log(`开始导入车辆数据: ${filePath}`, 'info');
  const storage = loadStorage();
  const records = readCsvFile(filePath);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  records.forEach(record => {
    const vin = record.vin || record.VIN || record.车架号;
    const plateNumber = record.plateNumber || record.PlateNumber || record.车牌号;
    const ownerName = record.ownerName || record.OwnerName || record.车主姓名;
    const ownerPhone = record.ownerPhone || record.OwnerPhone || record.车主电话;

    if (!vin || !plateNumber) {
      log(`跳过记录: 缺少必要信息 (VIN或车牌号)`, 'warning');
      skipped++;
      return;
    }

    const existingVehicle = storage.vehicles.find(v => 
      v.vin === vin || 
      v.plateNumber === plateNumber ||
      v.plateHistory.includes(plateNumber)
    );

    if (existingVehicle) {
      if (plateNumber !== existingVehicle.plateNumber) {
        log(`车辆换牌: VIN ${vin} 从 ${existingVehicle.plateNumber} 更换为 ${plateNumber}`, 'warning');
        existingVehicle.updatePlateNumber(plateNumber);
        updated++;
      } else {
        log(`车辆已存在: ${plateNumber} (VIN: ${vin})`, 'info');
        skipped++;
      }
    } else {
      const { Vehicle } = require('./models');
      const vehicle = new Vehicle(vin, plateNumber, ownerName, ownerPhone);
      storage.vehicles.push(vehicle);
      log(`新增车辆: ${plateNumber} (VIN: ${vin})`, 'success');
      imported++;
    }
  });

  saveStorage(storage);
  log(`车辆导入完成: 新增 ${imported} 辆, 更新 ${updated} 辆, 跳过 ${skipped} 条`, 'success');
  return { imported, updated, skipped };
}

function importPackages(filePath) {
  log(`开始导入套餐数据: ${filePath}`, 'info');
  const storage = loadStorage();
  const records = readCsvFile(filePath);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  function safeParseJson(str) {
    if (!str) return [];
    try {
      return JSON.parse(str);
    } catch {
      return str.split(',').map(s => s.trim());
    }
  }

  records.forEach(record => {
    const id = record.id || record.ID || record.套餐ID;
    const name = record.name || record.Name || record.套餐名称;
    const packageType = record.packageType || record.PackageType || record.套餐类型;
    const totalServices = parseInt(record.totalServices || record.TotalServices || record.服务次数) || 0;
    const services = safeParseJson(record.services);
    const materials = safeParseJson(record.materials);

    if (!id || !name) {
      log(`跳过记录: 缺少必要信息 (套餐ID或名称)`, 'warning');
      skipped++;
      return;
    }

    const existingPackage = storage.packages.find(p => p.id === id);

    if (existingPackage) {
      existingPackage.name = name;
      existingPackage.packageType = packageType;
      existingPackage.totalServices = totalServices;
      existingPackage.services = services;
      existingPackage.materials = materials;
      log(`更新套餐: ${name} (ID: ${id})`, 'info');
      updated++;
    } else {
      const { Package } = require('./models');
      const pkg = new Package(id, name, packageType, totalServices, services, materials);
      storage.packages.push(pkg);
      log(`新增套餐: ${name} (ID: ${id})`, 'success');
      imported++;
    }
  });

  saveStorage(storage);
  log(`套餐导入完成: 新增 ${imported} 个, 更新 ${updated} 个, 跳过 ${skipped} 条`, 'success');
  return { imported, updated, skipped };
}

function importPackageRights(filePath) {
  log(`开始导入套餐权益数据: ${filePath}`, 'info');
  const storage = loadStorage();
  const records = readCsvFile(filePath);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  records.forEach(record => {
    const id = record.id || record.ID || record.权益ID;
    const vehicleVin = record.vehicleVin || record.VehicleVIN || record.车辆VIN;
    const packageId = record.packageId || record.PackageId || record.套餐ID;
    const purchaseDate = record.purchaseDate || record.PurchaseDate || record.购买日期;
    const totalServices = parseInt(record.totalServices || record.TotalServices || record.总服务次数) || 0;
    const remainingServices = parseInt(record.remainingServices || record.RemainingServices || record.剩余服务次数) || totalServices;
    const purchasePrice = parseFloat(record.purchasePrice || record.PurchasePrice || record.购买价格) || 0;
    const materials = record.materials ? JSON.parse(record.materials) : [];

    if (!id || !vehicleVin || !packageId) {
      log(`跳过记录: 缺少必要信息 (权益ID、车辆VIN或套餐ID)`, 'warning');
      skipped++;
      return;
    }

    const vehicle = storage.vehicles.find(v => v.vin === vehicleVin);
    if (!vehicle) {
      log(`跳过记录: 未找到对应车辆 (VIN: ${vehicleVin})`, 'warning');
      skipped++;
      return;
    }

    const existingRight = storage.packageRights.find(p => p.id === id);

    if (existingRight) {
      existingRight.remainingServices = remainingServices;
      existingRight.materials = materials;
      log(`更新套餐权益: ID ${id}`, 'info');
      updated++;
    } else {
      const { PackageRight } = require('./models');
      const right = new PackageRight(
        id,
        vehicle.id,
        packageId,
        purchaseDate,
        totalServices,
        remainingServices,
        materials,
        purchasePrice
      );
      storage.packageRights.push(right);
      log(`新增套餐权益: ID ${id} (车辆: ${vehicle.plateNumber})`, 'success');
      imported++;
    }
  });

  saveStorage(storage);
  log(`套餐权益导入完成: 新增 ${imported} 条, 更新 ${updated} 条, 跳过 ${skipped} 条`, 'success');
  return { imported, updated, skipped };
}

function importShops(filePath) {
  log(`开始导入门店数据: ${filePath}`, 'info');
  const storage = loadStorage();
  const records = readCsvFile(filePath);
  
  let imported = 0;
  let updated = 0;
  let skipped = 0;

  records.forEach(record => {
    const id = record.id || record.ID || record.门店ID;
    const name = record.name || record.Name || record.门店名称;
    const address = record.address || record.Address || record.地址;
    const phone = record.phone || record.Phone || record.电话;

    if (!id || !name) {
      log(`跳过记录: 缺少必要信息 (门店ID或名称)`, 'warning');
      skipped++;
      return;
    }

    const existingShop = storage.shops.find(s => s.id === id);

    if (existingShop) {
      existingShop.name = name;
      existingShop.address = address;
      existingShop.phone = phone;
      log(`更新门店: ${name} (ID: ${id})`, 'info');
      updated++;
    } else {
      const { Shop } = require('./models');
      const shop = new Shop(id, name, address, phone);
      storage.shops.push(shop);
      log(`新增门店: ${name} (ID: ${id})`, 'success');
      imported++;
    }
  });

  saveStorage(storage);
  log(`门店导入完成: 新增 ${imported} 个, 更新 ${updated} 个, 跳过 ${skipped} 条`, 'success');
  return { imported, updated, skipped };
}

module.exports = {
  importVehicles,
  importPackages,
  importPackageRights,
  importShops
};
