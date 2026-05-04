const csvParser = require('csv-parser');
const { Readable } = require('stream');
const { getDatabase, saveDatabase } = require('../database');

async function parseCSV(buffer) {
  return new Promise((resolve, reject) => {
    const results = [];
    const stream = Readable.from(buffer.toString('utf-8'));
    
    stream
      .pipe(csvParser())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', (error) => reject(error));
  });
}

function parseJSON(buffer) {
  try {
    return JSON.parse(buffer.toString('utf-8'));
  } catch (error) {
    throw new Error('无效的 JSON 格式: ' + error.message);
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const parsed = new Date(dateStr);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  
  const formats = [
    /^(\d{4})-(\d{2})-(\d{2})$/,
    /^(\d{4})\/(\d{2})\/(\d{2})$/,
    /^(\d{2})-(\d{2})-(\d{4})$/,
    /^(\d{2})\/(\d{2})\/(\d{4})$/
  ];
  
  for (const format of formats) {
    const match = dateStr.match(format);
    if (match) {
      let year, month, day;
      
      if (format === formats[0] || format === formats[1]) {
        [, year, month, day] = match;
      } else {
        [, day, month, year] = match;
      }
      
      const date = new Date(year, month - 1, day);
      if (!isNaN(date.getTime())) {
        return date.toISOString().split('T')[0];
      }
    }
  }
  
  return null;
}

function safeNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const num = Number(value);
  return isNaN(num) ? null : num;
}

async function importRopeLedger(buffer) {
  const db = getDatabase();
  const rows = await parseCSV(buffer);
  const imported = [];
  const errors = [];
  
  for (const [index, row] of rows.entries()) {
    try {
      const ropeNumber = row['绳索编号'] || row['rope_number'] || row['编号'] || row['RopeNumber'] || row['id'];
      if (!ropeNumber) {
        errors.push({ row: index + 1, error: '缺少绳索编号' });
        continue;
      }
      
      const brand = row['品牌'] || row['brand'] || row['Brand'] || '';
      const model = row['型号'] || row['model'] || row['Model'] || '';
      const purchaseDate = parseDate(row['购买日期'] || row['purchase_date'] || row['PurchaseDate']);
      const lengthM = safeNumber(row['长度(m)'] || row['length_m'] || row['长度'] || row['LengthM']);
      const diameterMm = safeNumber(row['直径(mm)'] || row['diameter_mm'] || row['直径'] || row['DiameterMm']);
      const wearLevel = safeNumber(row['磨损等级'] || row['wear_level'] || row['WearLevel']) || 0;
      const notes = row['备注'] || row['notes'] || row['Notes'] || '';
      
      const existing = db.exec(`
        SELECT id FROM ropes WHERE rope_number = ?
      `, [ropeNumber.trim()]);
      
      if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`
          UPDATE ropes SET
            brand = ?,
            model = ?,
            purchase_date = ?,
            length_m = ?,
            diameter_mm = ?,
            wear_level = ?,
            notes = ?,
            updated_at = datetime('now')
          WHERE rope_number = ?
        `, [
          brand,
          model,
          purchaseDate,
          lengthM,
          diameterMm,
          wearLevel,
          notes,
          ropeNumber.trim()
        ]);
        imported.push({ rope_number: ropeNumber.trim(), action: 'updated' });
      } else {
        db.run(`
          INSERT INTO ropes (
            rope_number, brand, model, purchase_date,
            length_m, diameter_mm, wear_level, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          ropeNumber.trim(),
          brand,
          model,
          purchaseDate,
          lengthM,
          diameterMm,
          wearLevel,
          notes
        ]);
        imported.push({ rope_number: ropeNumber.trim(), action: 'created' });
      }
    } catch (error) {
      errors.push({ row: index + 1, error: error.message });
    }
  }
  
  saveDatabase();
  
  return {
    total: rows.length,
    imported: imported.length,
    errors: errors.length,
    details: imported,
    errors: errors
  };
}

async function importUsageRecords(buffer) {
  const db = getDatabase();
  const rows = await parseCSV(buffer);
  const imported = [];
  const errors = [];
  const notFoundRopes = new Set();
  
  for (const [index, row] of rows.entries()) {
    try {
      const ropeNumber = row['绳索编号'] || row['rope_number'] || row['编号'] || row['RopeNumber'] || row['rope_id'];
      if (!ropeNumber) {
        errors.push({ row: index + 1, error: '缺少绳索编号' });
        continue;
      }
      
      const usageDate = parseDate(row['使用日期'] || row['usage_date'] || row['日期'] || row['UsageDate'] || row['date']);
      if (!usageDate) {
        errors.push({ row: index + 1, error: '缺少或无效的使用日期' });
        continue;
      }
      
      const ropeResult = db.exec(`
        SELECT id FROM ropes WHERE rope_number = ?
      `, [ropeNumber.trim()]);
      
      if (ropeResult.length === 0 || ropeResult[0].values.length === 0) {
        notFoundRopes.add(ropeNumber.trim());
        errors.push({ row: index + 1, error: `绳索编号 "${ropeNumber}" 不存在` });
        continue;
      }
      
      const ropeId = ropeResult[0].values[0][0];
      
      const usesCount = safeNumber(row['使用次数'] || row['uses_count'] || row['次数'] || row['UsesCount']) || 0;
      const fallEnergyKj = safeNumber(row['冲坠能量(kJ)'] || row['fall_energy_kj'] || row['冲坠能量'] || row['FallEnergyKj']) || 0;
      const fallFactor = safeNumber(row['冲坠系数'] || row['fall_factor'] || row['FallFactor']);
      const climberWeightKg = safeNumber(row['攀爬者体重(kg)'] || row['climber_weight_kg'] || row['体重'] || row['ClimberWeightKg']);
      const fallDistanceM = safeNumber(row['冲坠距离(m)'] || row['fall_distance_m'] || row['冲坠距离'] || row['FallDistanceM']);
      const wearLevel = safeNumber(row['磨损等级'] || row['wear_level'] || row['WearLevel']);
      const notes = row['备注'] || row['notes'] || row['Notes'] || '';
      
      db.run(`
        INSERT INTO usage_records (
          rope_id, usage_date, uses_count, fall_energy_kj,
          fall_factor, climber_weight_kg, fall_distance_m,
          wear_level, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        ropeId,
        usageDate,
        usesCount,
        fallEnergyKj,
        fallFactor,
        climberWeightKg,
        fallDistanceM,
        wearLevel,
        notes
      ]);
      
      imported.push({ rope_number: ropeNumber.trim(), usage_date: usageDate });
    } catch (error) {
      errors.push({ row: index + 1, error: error.message });
    }
  }
  
  saveDatabase();
  
  return {
    total: rows.length,
    imported: imported.length,
    errors: errors.length,
    details: imported,
    errors: errors,
    not_found_ropes: Array.from(notFoundRopes)
  };
}

async function importManufacturerThresholds(buffer) {
  const db = getDatabase();
  const data = parseJSON(buffer);
  const imported = [];
  const errors = [];
  
  let thresholds = [];
  if (Array.isArray(data)) {
    thresholds = data;
  } else if (data.thresholds && Array.isArray(data.thresholds)) {
    thresholds = data.thresholds;
  } else {
    thresholds = [data];
  }
  
  for (const [index, threshold] of thresholds.entries()) {
    try {
      const brand = threshold.brand || threshold.Brand || threshold['品牌'];
      const model = threshold.model || threshold.Model || threshold['型号'];
      
      if (!brand || !model) {
        errors.push({ row: index + 1, error: '缺少品牌或型号' });
        continue;
      }
      
      const maxTotalEnergyKj = safeNumber(
        threshold.max_total_energy_kj || 
        threshold.MaxTotalEnergyKj || 
        threshold['最大累计冲坠能量(kJ)']
      );
      const maxServiceDays = safeNumber(
        threshold.max_service_days || 
        threshold.MaxServiceDays || 
        threshold['最大使用天数']
      );
      const maxWearLevel = safeNumber(
        threshold.max_wear_level || 
        threshold.MaxWearLevel || 
        threshold['最大磨损等级']
      );
      const maxDailyUses = safeNumber(
        threshold.max_daily_uses || 
        threshold.MaxDailyUses || 
        threshold['最大日使用次数']
      );
      const maxDailyEnergyKj = safeNumber(
        threshold.max_daily_energy_kj || 
        threshold.MaxDailyEnergyKj || 
        threshold['最大日冲坠能量(kJ)']
      );
      
      if ([maxTotalEnergyKj, maxServiceDays, maxWearLevel, maxDailyUses, maxDailyEnergyKj].some(v => v === null)) {
        errors.push({ row: index + 1, error: '缺少必要的阈值参数' });
        continue;
      }
      
      const existing = db.exec(`
        SELECT id FROM manufacturer_thresholds WHERE brand = ? AND model = ?
      `, [brand, model]);
      
      const notes = threshold.notes || threshold.Notes || threshold['备注'] || '';
      
      if (existing.length > 0 && existing[0].values.length > 0) {
        db.run(`
          UPDATE manufacturer_thresholds SET
            max_total_energy_kj = ?,
            max_service_days = ?,
            max_wear_level = ?,
            max_daily_uses = ?,
            max_daily_energy_kj = ?,
            notes = ?
          WHERE brand = ? AND model = ?
        `, [
          maxTotalEnergyKj,
          maxServiceDays,
          maxWearLevel,
          maxDailyUses,
          maxDailyEnergyKj,
          notes,
          brand,
          model
        ]);
        imported.push({ brand, model, action: 'updated' });
      } else {
        db.run(`
          INSERT INTO manufacturer_thresholds (
            brand, model, max_total_energy_kj, max_service_days,
            max_wear_level, max_daily_uses, max_daily_energy_kj, notes
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          brand,
          model,
          maxTotalEnergyKj,
          maxServiceDays,
          maxWearLevel,
          maxDailyUses,
          maxDailyEnergyKj,
          notes
        ]);
        imported.push({ brand, model, action: 'created' });
      }
    } catch (error) {
      errors.push({ row: index + 1, error: error.message });
    }
  }
  
  saveDatabase();
  
  return {
    total: thresholds.length,
    imported: imported.length,
    errors: errors.length,
    details: imported,
    errors: errors
  };
}

module.exports = {
  parseCSV,
  parseJSON,
  importRopeLedger,
  importUsageRecords,
  importManufacturerThresholds
};
