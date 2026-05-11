const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { DATA_TYPES } = require('./config');
const { 
  generateId, 
  hashFile, 
  parseDate, 
  parseAmount, 
  roundAmount,
  isCsvFile,
  isJsonFile
} = require('./utils');
const { 
  checkFileAlreadyImported, 
  logImport,
  validateSalesRecord,
  validateRefundRecord
} = require('./business');

function readCsvFile(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath, 'utf-8')
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

async function readDataFile(filePath) {
  if (isCsvFile(filePath)) {
    return await readCsvFile(filePath);
  } else if (isJsonFile(filePath)) {
    return readJsonFile(filePath);
  }
  throw new Error(`不支持的文件格式: ${filePath}`);
}

async function importVendors(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO vendors (id, name, contact_person, phone, email)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  const updateStmt = db.prepare(`
    UPDATE vendors SET 
      name = ?,
      contact_person = ?,
      phone = ?,
      email = ?
    WHERE id = ?
  `);
  
  for (const item of data) {
    const id = item.id || item.vendor_id || generateId();
    const name = item.name || item.vendor_name;
    
    if (!name) {
      skipped++;
      continue;
    }
    
    const existing = db.prepare('SELECT id FROM vendors WHERE id = ?').get(id);
    
    if (existing) {
      updateStmt.run(
        name,
        item.contact_person || item.contact || null,
        item.phone || item.mobile || null,
        item.email || item.email_address || null,
        id
      );
    } else {
      insertStmt.run(
        id,
        name,
        item.contact_person || item.contact || null,
        item.phone || item.mobile || null,
        item.email || item.email_address || null
      );
    }
    processed++;
  }
  
  return { processed, skipped };
}

async function importBooths(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO booths (id, booth_number, zone, description)
    VALUES (?, ?, ?, ?)
  `);
  
  const updateStmt = db.prepare(`
    UPDATE booths SET 
      booth_number = ?,
      zone = ?,
      description = ?
    WHERE id = ?
  `);
  
  for (const item of data) {
    const id = item.id || item.booth_id || generateId();
    const boothNumber = item.booth_number || item.booth;
    
    if (!boothNumber) {
      skipped++;
      continue;
    }
    
    const existing = db.prepare('SELECT id FROM booths WHERE id = ?').get(id);
    
    if (existing) {
      updateStmt.run(
        boothNumber,
        item.zone || item.area || null,
        item.description || item.desc || null,
        id
      );
    } else {
      insertStmt.run(
        id,
        boothNumber,
        item.zone || item.area || null,
        item.description || item.desc || null
      );
    }
    processed++;
  }
  
  return { processed, skipped };
}

async function importVendorBoothAssignments(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO vendor_booth_assignments (id, vendor_id, booth_id, start_date, end_date)
    VALUES (?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    const vendorId = item.vendor_id;
    const boothId = item.booth_id;
    const startDate = parseDate(item.start_date || item.date);
    
    if (!vendorId || !boothId || !startDate) {
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      vendorId,
      boothId,
      startDate,
      item.end_date ? parseDate(item.end_date) : null
    );
    processed++;
  }
  
  return { processed, skipped };
}

async function importCommissionRates(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO commission_rates (id, booth_id, vendor_id, rate_type, flat_rate, tier_config, effective_date, end_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    const rateType = item.rate_type || 'flat';
    const effectiveDate = parseDate(item.effective_date || item.date);
    
    if (!effectiveDate) {
      skipped++;
      continue;
    }
    
    let tierConfig = null;
    if (rateType === 'tiered') {
      if (item.tier_config) {
        tierConfig = typeof item.tier_config === 'string' 
          ? item.tier_config 
          : JSON.stringify(item.tier_config);
      } else if (item.tiers) {
        tierConfig = typeof item.tiers === 'string' 
          ? item.tiers 
          : JSON.stringify(item.tiers);
      }
    }
    
    insertStmt.run(
      generateId(),
      item.booth_id || null,
      item.vendor_id || null,
      rateType,
      item.flat_rate ? parseAmount(item.flat_rate) : null,
      tierConfig,
      effectiveDate,
      item.end_date ? parseDate(item.end_date) : null
    );
    processed++;
  }
  
  return { processed, skipped };
}

async function importSales(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  let errors = [];
  
  const existingVendors = new Set(
    db.prepare('SELECT id FROM vendors').all().map(v => v.id)
  );
  const existingBooths = new Set(
    db.prepare('SELECT id FROM booths').all().map(b => b.id)
  );
  
  const insertStmt = db.prepare(`
    INSERT INTO sales_records (
      id, vendor_id, booth_id, sale_date, amount, transaction_count, 
      source_file, source_file_hash, source_row_number, note
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const checkDuplicateStmt = db.prepare(`
    SELECT 1 FROM sales_records 
    WHERE vendor_id = ? AND booth_id = ? AND sale_date = ? 
    AND source_file_hash = ?
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    const record = {
      vendor_id: item.vendor_id,
      booth_id: item.booth_id,
      sale_date: parseDate(item.sale_date || item.date),
      amount: parseAmount(item.amount || item.sales_amount || item.total),
      transaction_count: parseInt(item.transaction_count || item.count || '1'),
      note: item.note || item.remark || null
    };
    
    const validation = validateSalesRecord(record, existingVendors, existingBooths);
    if (validation.errors.length > 0) {
      errors.push(`第${i + 2}行: ${validation.errors.join('; ')}`);
      skipped++;
      continue;
    }
    
    const isDuplicate = checkDuplicateStmt.get(
      record.vendor_id,
      record.booth_id,
      record.sale_date,
      sourceFileHash
    );
    
    if (isDuplicate) {
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      record.vendor_id,
      record.booth_id,
      record.sale_date,
      record.amount,
      record.transaction_count,
      sourceFile,
      sourceFileHash,
      i + 2,
      record.note
    );
    processed++;
  }
  
  return { processed, skipped, errors };
}

async function importDeposits(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO deposits (id, vendor_id, amount, deposit_date, note, source_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    const vendorId = item.vendor_id;
    const amount = parseAmount(item.amount || item.deposit_amount);
    const depositDate = parseDate(item.deposit_date || item.date);
    
    if (!vendorId || amount === null || !depositDate) {
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      vendorId,
      amount,
      depositDate,
      item.note || item.remark || null,
      sourceFile
    );
    processed++;
  }
  
  return { processed, skipped };
}

async function importElectricityFees(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO electricity_fees (id, vendor_id, booth_id, amount, kwh, fee_date, note, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    const vendorId = item.vendor_id;
    const amount = parseAmount(item.amount || item.fee_amount);
    const feeDate = parseDate(item.fee_date || item.date);
    
    if (!vendorId || amount === null || !feeDate) {
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      vendorId,
      item.booth_id || null,
      amount,
      item.kwh ? parseAmount(item.kwh) : null,
      feeDate,
      item.note || item.remark || null,
      sourceFile
    );
    processed++;
  }
  
  return { processed, skipped };
}

async function importRefunds(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  let errors = [];
  
  const existingVendors = new Set(
    db.prepare('SELECT id FROM vendors').all().map(v => v.id)
  );
  const existingBooths = new Set(
    db.prepare('SELECT id FROM booths').all().map(b => b.id)
  );
  
  const insertStmt = db.prepare(`
    INSERT INTO refunds (
      id, vendor_id, booth_id, amount, refund_date, related_sale_id, 
      reason, note, source_file
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (let i = 0; i < data.length; i++) {
    const item = data[i];
    
    const record = {
      vendor_id: item.vendor_id,
      booth_id: item.booth_id,
      amount: parseAmount(item.amount || item.refund_amount),
      refund_date: parseDate(item.refund_date || item.date),
      related_sale_id: item.related_sale_id || item.sale_id || null,
      reason: item.reason || null,
      note: item.note || item.remark || null
    };
    
    const validation = validateRefundRecord(record, existingVendors, existingBooths);
    if (validation.errors.length > 0) {
      errors.push(`第${i + 2}行: ${validation.errors.join('; ')}`);
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      record.vendor_id,
      record.booth_id,
      record.amount,
      record.refund_date,
      record.related_sale_id,
      record.reason,
      record.note,
      sourceFile
    );
    processed++;
  }
  
  return { processed, skipped, errors };
}

async function importPayments(data, sourceFile, sourceFileHash) {
  const { getDb } = require('./db');
  const db = await getDb();
  let processed = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO payments (id, vendor_id, amount, payment_date, payment_method, settlement_id, note, source_file)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const item of data) {
    const vendorId = item.vendor_id;
    const amount = parseAmount(item.amount || item.payment_amount);
    const paymentDate = parseDate(item.payment_date || item.date);
    
    if (!vendorId || amount === null || !paymentDate) {
      skipped++;
      continue;
    }
    
    insertStmt.run(
      generateId(),
      vendorId,
      amount,
      paymentDate,
      item.payment_method || item.method || null,
      item.settlement_id || null,
      item.note || item.remark || null,
      sourceFile
    );
    processed++;
  }
  
  return { processed, skipped };
}

async function importData(dataType, filePath, options = {}) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`文件不存在: ${filePath}`);
  }
  
  const fileHash = hashFile(filePath);
  const existingImport = await checkFileAlreadyImported(dataType, fileHash);
  
  if (existingImport && !options.force) {
    return {
      alreadyImported: true,
      importLog: existingImport,
      message: `该文件已于 ${existingImport.created_at} 导入过，共 ${existingImport.records_count} 条记录，已处理 ${existingImport.processed_count} 条`
    };
  }
  
  const data = await readDataFile(filePath);
  let result;
  
  switch (dataType) {
    case DATA_TYPES.VENDOR:
      result = await importVendors(data, filePath, fileHash);
      break;
    case DATA_TYPES.BOOTH:
      result = await importBooths(data, filePath, fileHash);
      break;
    case 'vendor_booth_assignment':
      result = await importVendorBoothAssignments(data, filePath, fileHash);
      break;
    case DATA_TYPES.COMMISSION_RATE:
      result = await importCommissionRates(data, filePath, fileHash);
      break;
    case DATA_TYPES.SALES:
      result = await importSales(data, filePath, fileHash);
      break;
    case DATA_TYPES.DEPOSIT:
      result = await importDeposits(data, filePath, fileHash);
      break;
    case DATA_TYPES.ELECTRICITY:
      result = await importElectricityFees(data, filePath, fileHash);
      break;
    case DATA_TYPES.REFUND:
      result = await importRefunds(data, filePath, fileHash);
      break;
    case DATA_TYPES.PAYMENT:
      result = await importPayments(data, filePath, fileHash);
      break;
    default:
      throw new Error(`不支持的数据类型: ${dataType}`);
  }
  
  await logImport(
    dataType, 
    filePath, 
    fileHash, 
    data.length, 
    result.processed, 
    result.skipped
  );
  
  return {
    alreadyImported: false,
    totalRecords: data.length,
    processed: result.processed,
    skipped: result.skipped,
    errors: result.errors || []
  };
}

module.exports = {
  importData,
  readDataFile
};
