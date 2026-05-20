const csv = require('csv-parser');
const fs = require('fs');
const { runAsync, getAsync, allAsync } = require('../database');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const parseJSON = (filePath) => {
  return new Promise((resolve, reject) => {
    fs.readFile(filePath, 'utf8', (err, data) => {
      if (err) reject(err);
      else resolve(JSON.parse(data));
    });
  });
};

const importBorrowReturnCSV = async (batchId, filePath, operator) => {
  const records = await parseCSV(filePath);
  
  for (const record of records) {
    const vehicle = await getAsync('SELECT id, vin, current_mileage FROM vehicles WHERE vin = ?', [record.vin]);
    
    let vehicleId;
    if (!vehicle) {
      const result = await runAsync(
        'INSERT INTO vehicles (batch_id, vin, plate_no, brand, model, current_mileage) VALUES (?, ?, ?, ?, ?, ?)',
        [batchId, record.vin, record.plate_no || '', record.brand || '', record.model || '', record.start_mileage || 0]
      );
      vehicleId = result.lastID;
    } else {
      vehicleId = vehicle.id;
    }

    const result = await runAsync(
      `INSERT INTO borrow_return_records 
      (batch_id, vehicle_id, vin, sales_consultant, test_route, customer_name, 
       borrow_time, expected_return_time, start_mileage, start_fuel_balance, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'borrowed')`,
      [batchId, vehicleId, record.vin, record.sales_consultant, record.test_route, 
       record.customer_name, record.borrow_time, record.expected_return_time,
       record.start_mileage, record.start_fuel_balance]
    );

    if (record.start_mileage) {
      await trackMileage(vehicleId, record.vin, result.lastID, 'borrow', 
        parseFloat(record.start_mileage), null, `批次${batchId}-借车记录`, operator);
    }

    if (record.expected_return_time) {
      const now = new Date();
      const expected = new Date(record.expected_return_time);
      if (now > expected) {
        await recordException('borrow_return', result.lastID, 'overtime', 
          `预计还车时间${record.expected_return_time}已超时`, operator);
      }
    }
  }

  await logOperation('import', 'borrow_return', batchId, operator, `导入${records.length}条借还记录`);
  return records.length;
};

const importVehiclesJSON = async (batchId, filePath, operator) => {
  const data = await parseJSON(filePath);
  const vehicles = Array.isArray(data) ? data : data.vehicles || [];
  
  for (const vehicle of vehicles) {
    const existing = await getAsync('SELECT id, current_mileage FROM vehicles WHERE vin = ?', [vehicle.vin]);
    
    if (existing) {
      const mileageChange = vehicle.current_mileage - existing.current_mileage;
      await runAsync(
        `UPDATE vehicles SET batch_id = ?, plate_no = ?, brand = ?, model = ?, 
         color = ?, current_mileage = ?, fuel_card_balance = ? WHERE vin = ?`,
        [batchId, vehicle.plate_no, vehicle.brand, vehicle.model, 
         vehicle.color, vehicle.current_mileage, vehicle.fuel_card_balance, vehicle.vin]
      );

      if (mileageChange !== 0) {
        await trackMileage(existing.id, vehicle.vin, null, 'vehicle_update',
          vehicle.current_mileage, mileageChange, `批次${batchId}-车辆信息更新`, operator);
      }
    } else {
      const result = await runAsync(
        `INSERT INTO vehicles 
         (batch_id, vin, plate_no, brand, model, color, initial_mileage, current_mileage, fuel_card_balance)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [batchId, vehicle.vin, vehicle.plate_no, vehicle.brand, vehicle.model,
         vehicle.color, vehicle.current_mileage, vehicle.current_mileage, vehicle.fuel_card_balance]
      );

      await trackMileage(result.lastID, vehicle.vin, null, 'vehicle_create',
        vehicle.current_mileage, vehicle.current_mileage, `批次${batchId}-新车入库`, operator);
    }
  }

  await logOperation('import', 'vehicles', batchId, operator, `导入${vehicles.length}条车辆数据`);
  return vehicles.length;
};

const importViolationReceipt = async (batchId, filePath, operator, fileName) => {
  const violations = await parseJSON(filePath);
  const list = Array.isArray(violations) ? violations : violations.records || [];
  
  for (const v of list) {
    const vehicle = await getAsync('SELECT id FROM vehicles WHERE vin = ?', [v.vin]);
    const vehicleId = vehicle ? vehicle.id : null;

    await runAsync(
      `INSERT INTO violation_records 
       (batch_id, vehicle_id, vin, violation_time, violation_location, violation_type,
        fine_amount, deduction_points, receipt_file)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [batchId, vehicleId, v.vin, v.violation_time, v.location, v.type,
       v.fine_amount, v.deduction_points, fileName]
    );
  }

  await logOperation('import', 'violation', batchId, operator, `导入${list.length}条违章记录`);
  return list.length;
};

const trackMileage = async (vehicleId, vin, recordId, recordType, mileage, mileageChange, source, operator) => {
  await runAsync(
    `INSERT INTO mileage_tracking 
     (vehicle_id, vin, record_id, record_type, mileage, mileage_change, source, operator)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [vehicleId, vin, recordId, recordType, mileage, mileageChange, source, operator]
  );
};

const recordException = async (recordType, recordId, exceptionType, reason, handler) => {
  await runAsync(
    `INSERT INTO exception_logs 
     (record_type, record_id, exception_type, reason, handler)
     VALUES (?, ?, ?, ?, ?)`,
    [recordType, recordId, exceptionType, reason, handler]
  );
};

const logOperation = async (type, targetType, targetId, operator, detail) => {
  await runAsync(
    `INSERT INTO operation_logs 
     (operation_type, target_type, target_id, operator, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [type, targetType, targetId, operator, detail]
  );
};

module.exports = {
  parseCSV,
  parseJSON,
  importBorrowReturnCSV,
  importVehiclesJSON,
  importViolationReceipt,
  trackMileage,
  recordException,
  logOperation
};