const db = require('../database');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');

const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (err) => reject(err));
  });
};

const importSensorReadings = async (filePath, filename) => {
  const data = await parseCSV(filePath);
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT INTO sensor_readings 
    (seedbed_id, reading_date, reading_time, temperature, humidity, source_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const row = data[i];
    try {
      const seedbedCode = row.seedbed_code || row.SeedbedCode || row.miaochuang || row.苗床;
      const dateStr = row.date || row.Date || row.reading_date || row.riqi || row.日期;
      const timeStr = row.time || row.Time || row.reading_time || row.shijian || row.时间;
      const temp = parseFloat(row.temperature || row.Temperature || row.temp || row.wendu || row.温度);
      const humid = parseFloat(row.humidity || row.Humidity || row.humid || row.shidu || row.湿度);
      
      if (!seedbedCode) {
        errors.push(`行${i + 1}: 缺少苗床编号`);
        continue;
      }
      
      const seedbed = db.prepare(`
        SELECT id FROM seedbeds WHERE code = ?
      `).get(seedbedCode.trim());
      
      if (!seedbed) {
        errors.push(`行${i + 1}: 苗床编号 ${seedbedCode} 不存在`);
        continue;
      }
      
      const readingDate = dateStr ? dayjs(dateStr).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      
      insertStmt.run(
        seedbed.id,
        readingDate,
        timeStr || null,
        isNaN(temp) ? null : temp,
        isNaN(humid) ? null : humid,
        filename
      );
      
      imported.push({ row: i + 1, seedbed: seedbedCode, date: readingDate });
    } catch (e) {
      errors.push(`行${i + 1}: ${e.message}`);
    }
  }
  
  return {
    total: data.length,
    imported: imported.length,
    errors,
    details: imported
  };
};

const importPollinationPlans = (jsonData, filename) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT INTO pollination_plans 
    (plant_batch_id, plan_date, target_plant, pollen_source, method, operator, priority, status, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      const batchNumber = item.batch_number || item.batchNumber || item.pici || item.批次;
      const plantName = item.plant_name || item.plantName || item.zhiwu || item.植物;
      
      let plantBatch;
      if (batchNumber) {
        plantBatch = db.prepare(`
          SELECT id FROM plant_batches WHERE batch_number = ?
        `).get(batchNumber);
      }
      
      if (!plantBatch && plantName) {
        plantBatch = db.prepare(`
          SELECT id FROM plant_batches WHERE plant_name = ?
        `).get(plantName);
      }
      
      if (!plantBatch) {
        errors.push(`记录${i + 1}: 未找到对应的植物批次`);
        continue;
      }
      
      const planDate = item.plan_date || item.date || item.riqi || item.日期;
      const formattedDate = planDate ? dayjs(planDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD');
      
      insertStmt.run(
        plantBatch.id,
        formattedDate,
        item.target_plant || item.targetPlant || item.mubiao || item.目标植物 || null,
        item.pollen_source || item.pollenSource || item.huafen || item.花粉来源 || null,
        item.method || item.fangfa || item.方法 || null,
        item.operator || item.caozuoyuan || item.操作员 || null,
        item.priority || item.youxianji || item.优先级 || 'normal',
        item.status || item.zhuangtai || item.状态 || 'pending',
        item.notes || item.remark || item.beizhu || item.备注 || null
      );
      
      imported.push({ row: i + 1, batch: batchNumber || plantName, date: formattedDate });
    } catch (e) {
      errors.push(`记录${i + 1}: ${e.message}`);
    }
  }
  
  return {
    total: data.length,
    imported: imported.length,
    errors,
    details: imported
  };
};

const importIsolationSchedules = (jsonData, filename) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT INTO isolation_schedules 
    (seedbed_id, start_date, end_date, is_open, reason)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      const seedbedCode = item.seedbed_code || item.seedbedCode || item.miaochuang || item.苗床;
      
      if (!seedbedCode) {
        errors.push(`记录${i + 1}: 缺少苗床编号`);
        continue;
      }
      
      const seedbed = db.prepare(`
        SELECT id FROM seedbeds WHERE code = ?
      `).get(seedbedCode.trim());
      
      if (!seedbed) {
        errors.push(`记录${i + 1}: 苗床编号 ${seedbedCode} 不存在`);
        continue;
      }
      
      const startDate = item.start_date || item.startDate || item.kaishi || item.开始日期;
      const endDate = item.end_date || item.endDate || item.jieshu || item.结束日期;
      
      if (!startDate || !endDate) {
        errors.push(`记录${i + 1}: 缺少开始或结束日期`);
        continue;
      }
      
      insertStmt.run(
        seedbed.id,
        dayjs(startDate).format('YYYY-MM-DD'),
        dayjs(endDate).format('YYYY-MM-DD'),
        item.is_open || item.isOpen || item.kaifang || item.开放 ? 1 : 0,
        item.reason || item.remark || item.beizhu || item.原因 || item.备注 || null
      );
      
      imported.push({ 
        row: i + 1, 
        seedbed: seedbedCode, 
        period: `${dayjs(startDate).format('MM-DD')} ~ ${dayjs(endDate).format('MM-DD')}`
      });
    } catch (e) {
      errors.push(`记录${i + 1}: ${e.message}`);
    }
  }
  
  return {
    total: data.length,
    imported: imported.length,
    errors,
    details: imported
  };
};

const importPlantBatches = (jsonData, filename) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT INTO plant_batches 
    (seedbed_id, plant_name, variety, batch_number, quantity, planting_date, 
     expected_flowering_start, expected_flowering_end, pollination_type, is_isolated, notes)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      const seedbedCode = item.seedbed_code || item.seedbedCode || item.miaochuang || item.苗床;
      const plantName = item.plant_name || item.plantName || item.zhiwu || item.植物;
      
      if (!seedbedCode || !plantName) {
        errors.push(`记录${i + 1}: 缺少苗床编号或植物名称`);
        continue;
      }
      
      const seedbed = db.prepare(`
        SELECT id FROM seedbeds WHERE code = ?
      `).get(seedbedCode.trim());
      
      if (!seedbed) {
        errors.push(`记录${i + 1}: 苗床编号 ${seedbedCode} 不存在`);
        continue;
      }
      
      const batchNumber = item.batch_number || item.batchNumber || item.pici || item.批次 || 
                          `${seedbedCode}-${plantName}-${dayjs().format('MMDD')}`;
      
      const existing = db.prepare(`
        SELECT id FROM plant_batches WHERE batch_number = ?
      `).get(batchNumber);
      
      if (existing) {
        errors.push(`记录${i + 1}: 批次号 ${batchNumber} 已存在`);
        continue;
      }
      
      insertStmt.run(
        seedbed.id,
        plantName,
        item.variety || item.pinzhong || item.品种 || null,
        batchNumber,
        parseInt(item.quantity || item.shuliang || item.数量) || null,
        item.planting_date ? dayjs(item.planting_date).format('YYYY-MM-DD') : null,
        item.expected_flowering_start ? dayjs(item.expected_flowering_start).format('YYYY-MM-DD') : null,
        item.expected_flowering_end ? dayjs(item.expected_flowering_end).format('YYYY-MM-DD') : null,
        item.pollination_type || item.shoufenleixing || item.授粉类型 || null,
        item.is_isolated || item.isIsolated || item.geli || item.隔离 ? 1 : 0,
        item.notes || item.remark || item.beizhu || item.备注 || null
      );
      
      imported.push({ row: i + 1, plant: plantName, batch: batchNumber, seedbed: seedbedCode });
    } catch (e) {
      errors.push(`记录${i + 1}: ${e.message}`);
    }
  }
  
  return {
    total: data.length,
    imported: imported.length,
    errors,
    details: imported
  };
};

const importEmployeeShifts = (jsonData, filename) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT INTO employee_shifts 
    (shift_date, employee_name, shift_type, start_time, end_time, assigned_areas)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    try {
      const employeeName = item.employee_name || item.employeeName || item.yuangong || item.员工;
      const shiftDate = item.shift_date || item.shiftDate || item.date || item.riqi || item.日期;
      
      if (!employeeName) {
        errors.push(`记录${i + 1}: 缺少员工姓名`);
        continue;
      }
      
      insertStmt.run(
        shiftDate ? dayjs(shiftDate).format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        employeeName,
        item.shift_type || item.shiftType || item.banci || item.班次 || null,
        item.start_time || item.startTime || item.kaishishijian || item.开始时间 || null,
        item.end_time || item.endTime || item.jieshushijian || item.结束时间 || null,
        item.assigned_areas || item.assignedAreas || item.fuqu || item.负责区域 || null
      );
      
      imported.push({ 
        row: i + 1, 
        employee: employeeName, 
        date: shiftDate ? dayjs(shiftDate).format('MM-DD') : '今日'
      });
    } catch (e) {
      errors.push(`记录${i + 1}: ${e.message}`);
    }
  }
  
  return {
    total: data.length,
    imported: imported.length,
    errors,
    details: imported
  };
};

const importGreenhouses = (jsonData) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO greenhouses (name, description) VALUES (?, ?)
  `);
  
  for (const item of data) {
    const name = item.name || item.mingcheng || item.名称;
    if (name) {
      const result = insertStmt.run(name, item.description || item.miaoshu || item.描述 || null);
      if (result.changes > 0) {
        imported.push({ name, id: result.lastInsertRowid });
      }
    }
  }
  
  return { imported, total: data.length };
};

const importSeedbeds = (jsonData) => {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const imported = [];
  const errors = [];
  
  const insertStmt = db.prepare(`
    INSERT OR IGNORE INTO seedbeds (greenhouse_id, code, name, location) VALUES (?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    const greenhouseName = item.greenhouse_name || item.greenhouseName || item.wenshi || item.温室;
    const code = item.code || item.bianhao || item.编号;
    
    if (!greenhouseName || !code) {
      errors.push(`记录${i + 1}: 缺少温室名称或苗床编号`);
      continue;
    }
    
    const greenhouse = db.prepare(`
      SELECT id FROM greenhouses WHERE name = ?
    `).get(greenhouseName);
    
    if (!greenhouse) {
      errors.push(`记录${i + 1}: 温室 ${greenhouseName} 不存在`);
      continue;
    }
    
    const result = insertStmt.run(
      greenhouse.id,
      code,
      item.name || item.mingcheng || item.名称 || null,
      item.location || item.weizhi || item.位置 || null
    );
    
    if (result.changes > 0) {
      imported.push({ code, greenhouse: greenhouseName });
    }
  }
  
  return { 
    imported: imported.length, 
    total: data.length, 
    errors,
    details: imported
  };
};

module.exports = {
  parseCSV,
  importSensorReadings,
  importPollinationPlans,
  importIsolationSchedules,
  importPlantBatches,
  importEmployeeShifts,
  importGreenhouses,
  importSeedbeds
};
