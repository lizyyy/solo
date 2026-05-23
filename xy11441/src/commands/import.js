const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const XLSX = require('xlsx');
const { getDb } = require('../utils/database');
const { requirePermission, getCurrentUser, logOperation } = require('../utils/auth');
const { 
  generateUniqueKey, 
  generateFileHash, 
  parseDate, 
  parseFloatSafe, 
  parseIntSafe,
  isEmpty,
  printSuccess, 
  printError, 
  printWarning,
  printInfo,
  SOURCE_TYPES
} = require('../utils/helpers');

const SOURCE_MAPPINGS = {
  delivery: {
    requiredFields: ['supplier_name', 'product_name', 'delivery_date'],
    fieldMap: {
      '供应商': 'supplier_name',
      '供应商名称': 'supplier_name',
      '商品名称': 'product_name',
      '商品': 'product_name',
      '商品编码': 'product_code',
      '批次号': 'batch_no',
      '送货日期': 'delivery_date',
      '日期': 'delivery_date',
      '送货数量': 'delivery_quantity',
      '数量': 'delivery_quantity',
      '送货重量': 'delivery_weight',
      '重量': 'delivery_weight',
      '单价': 'unit_price',
      '金额': 'total_amount',
      '坏果扣款': 'bad_fruit_amount',
      '是否坏果': 'is_bad_fruit',
      '行号': 'original_line_number'
    }
  },
  weight: {
    requiredFields: ['product_name', 'delivery_date'],
    fieldMap: {
      '商品名称': 'product_name',
      '商品': 'product_name',
      '商品编码': 'product_code',
      '批次号': 'batch_no',
      '供应商': 'supplier_name',
      '日期': 'delivery_date',
      '称重日期': 'delivery_date',
      '分拣数量': 'sorted_quantity',
      '分拣重量': 'sorted_weight',
      '损耗数量': 'loss_quantity',
      '损耗重量': 'loss_weight',
      '二次分拣损耗': 'second_sort_loss',
      '行号': 'original_line_number'
    }
  },
  return_basket: {
    requiredFields: ['product_name', 'supplier_name'],
    fieldMap: {
      '供应商': 'supplier_name',
      '商品名称': 'product_name',
      '商品编码': 'product_code',
      '批次号': 'batch_no',
      '退货数量': 'loss_quantity',
      '退货重量': 'loss_weight',
      '退筐原因': 'loss_reason',
      '照片编号': 'batch_no',
      '行号': 'original_line_number'
    }
  },
  price_adjust: {
    requiredFields: ['product_name', 'unit_price'],
    fieldMap: {
      '商品名称': 'product_name',
      '商品编码': 'product_code',
      '原单价': 'unit_price',
      '新单价': 'unit_price',
      '调整后单价': 'unit_price',
      '调整金额': 'total_amount',
      '行号': 'original_line_number'
    }
  }
};

async function readCSV(filePath) {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
}

function readExcel(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet);
}

function mapFields(rawData, sourceType) {
  const mapping = SOURCE_MAPPINGS[sourceType];
  if (!mapping) return rawData;

  return rawData.map((row, index) => {
    const mapped = { source_type: sourceType, original_line_number: index + 2 };
    
    for (const [sourceKey, targetKey] of Object.entries(mapping.fieldMap)) {
      if (row[sourceKey] !== undefined) {
        mapped[targetKey] = row[sourceKey];
      }
    }
    
    if (mapped.delivery_date) {
      mapped.delivery_date = parseDate(mapped.delivery_date);
    }
    
    mapped.delivery_quantity = parseFloatSafe(mapped.delivery_quantity);
    mapped.delivery_weight = parseFloatSafe(mapped.delivery_weight);
    mapped.sorted_quantity = parseFloatSafe(mapped.sorted_quantity);
    mapped.sorted_weight = parseFloatSafe(mapped.sorted_weight);
    mapped.loss_quantity = parseFloatSafe(mapped.loss_quantity);
    mapped.loss_weight = parseFloatSafe(mapped.loss_weight);
    mapped.unit_price = parseFloatSafe(mapped.unit_price);
    mapped.total_amount = parseFloatSafe(mapped.total_amount);
    mapped.bad_fruit_amount = parseFloatSafe(mapped.bad_fruit_amount);
    mapped.second_sort_loss = parseFloatSafe(mapped.second_sort_loss);
    
    if (mapped.is_bad_fruit !== undefined) {
      mapped.is_bad_fruit = String(mapped.is_bad_fruit).toLowerCase() === '是' || 
                           String(mapped.is_bad_fruit) === '1' ||
                           String(mapped.is_bad_fruit).toLowerCase() === 'true' ? 1 : 0;
    }
    
    mapped.unique_key = generateUniqueKey(mapped);
    
    return mapped;
  });
}

async function importCommand(filePath, options) {
  requirePermission('import');
  
  const sourceType = options.type || 'delivery';
  const user = getCurrentUser();
  
  if (!SOURCE_MAPPINGS[sourceType]) {
    printError(`无效的数据源类型: ${sourceType}`);
    printInfo(`支持的类型: ${Object.keys(SOURCE_TYPES).join(', ')}`);
    return;
  }
  
  if (!fs.existsSync(filePath)) {
    printError(`文件不存在: ${filePath}`);
    return;
  }
  
  printInfo(`正在导入 ${SOURCE_TYPES[sourceType].name}...`);
  printInfo(`文件: ${filePath}`);
  
  const fileHash = generateFileHash(filePath);
  const db = getDb();
  
  const existingSource = db.prepare('SELECT * FROM data_sources WHERE hash = ?').get(fileHash);
  if (existingSource && !options.force) {
    printWarning('该文件已导入过，使用 --force 强制重新导入');
    return;
  }
  
  let rawData;
  const ext = path.extname(filePath).toLowerCase();
  
  try {
    if (ext === '.csv') {
      rawData = await readCSV(filePath);
    } else if (ext === '.xlsx' || ext === '.xls') {
      rawData = readExcel(filePath);
    } else {
      printError(`不支持的文件格式: ${ext}`);
      return;
    }
  } catch (e) {
    printError(`读取文件失败: ${e.message}`);
    return;
  }
  
  printInfo(`读取到 ${rawData.length} 条原始记录`);
  
  const mappedData = mapFields(rawData, sourceType);
  
  const sourceResult = db.prepare(`
    INSERT OR REPLACE INTO data_sources (name, type, file_path, imported_by, hash)
    VALUES (?, ?, ?, ?, ?)
  `).run(path.basename(filePath), sourceType, filePath, user.id, fileHash);
  
  const sourceId = existingSource ? existingSource.id : sourceResult.lastInsertRowid;
  
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  
  const insertStmt = db.prepare(`
    INSERT INTO fact_records (
      source_id, source_type, original_line_number, supplier_name, product_name,
      product_code, batch_no, delivery_date, delivery_quantity, delivery_weight,
      sorted_quantity, sorted_weight, loss_quantity, loss_weight, loss_reason,
      unit_price, total_amount, is_bad_fruit, bad_fruit_amount, second_sort_loss,
      status, unique_key
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const updateStmt = db.prepare(`
    UPDATE fact_records SET
      source_id = ?,
      original_line_number = ?,
      supplier_name = COALESCE(?, supplier_name),
      product_name = COALESCE(?, product_name),
      product_code = COALESCE(?, product_code),
      batch_no = COALESCE(?, batch_no),
      delivery_date = COALESCE(?, delivery_date),
      delivery_quantity = delivery_quantity + ?,
      delivery_weight = delivery_weight + ?,
      sorted_quantity = sorted_quantity + ?,
      sorted_weight = sorted_weight + ?,
      loss_quantity = loss_quantity + ?,
      loss_weight = loss_weight + ?,
      loss_reason = COALESCE(?, loss_reason),
      unit_price = COALESCE(?, unit_price),
      total_amount = total_amount + ?,
      is_bad_fruit = MAX(is_bad_fruit, ?),
      bad_fruit_amount = bad_fruit_amount + ?,
      second_sort_loss = second_sort_loss + ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE unique_key = ?
  `);
  
  const findStmt = db.prepare('SELECT id FROM fact_records WHERE unique_key = ?');
  
  for (const record of mappedData) {
    const existing = findStmt.get(record.unique_key);
    
    if (existing) {
      if (options.skipDuplicates) {
        skipped++;
        continue;
      }
      
      updateStmt.run(
        sourceId,
        record.original_line_number,
        record.supplier_name,
        record.product_name,
        record.product_code,
        record.batch_no,
        record.delivery_date,
        record.delivery_quantity || 0,
        record.delivery_weight || 0,
        record.sorted_quantity || 0,
        record.sorted_weight || 0,
        record.loss_quantity || 0,
        record.loss_weight || 0,
        record.loss_reason,
        record.unit_price,
        record.total_amount || 0,
        record.is_bad_fruit || 0,
        record.bad_fruit_amount || 0,
        record.second_sort_loss || 0,
        record.unique_key
      );
      updated++;
      
      logOperation('update_record', 'fact_records', existing.id, null, record);
    } else {
      insertStmt.run(
        sourceId,
        record.source_type,
        record.original_line_number,
        record.supplier_name,
        record.product_name,
        record.product_code,
        record.batch_no,
        record.delivery_date,
        record.delivery_quantity,
        record.delivery_weight,
        record.sorted_quantity,
        record.sorted_weight,
        record.loss_quantity,
        record.loss_weight,
        record.loss_reason,
        record.unit_price,
        record.total_amount,
        record.is_bad_fruit,
        record.bad_fruit_amount,
        record.second_sort_loss,
        'pending',
        record.unique_key
      );
      inserted++;
    }
  }
  
  printSuccess(`导入完成! 新增: ${inserted}, 更新: ${updated}, 跳过: ${skipped}`);
  logOperation('import', 'data_sources', sourceId, null, { file: filePath, type: sourceType, inserted, updated });
}

module.exports = importCommand;
