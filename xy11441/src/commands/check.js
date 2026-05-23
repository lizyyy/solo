const { getDb } = require('../utils/database');
const { requirePermission, logOperation } = require('../utils/auth');
const { 
  isEmpty,
  printSuccess, 
  printError, 
  printWarning,
  printInfo,
  ERROR_TYPES
} = require('../utils/helpers');
const Table = require('cli-table3');
const chalk = require('chalk');

function checkMissingFields(db, options) {
  const records = db.prepare(`
    SELECT id, source_id, original_line_number, supplier_name, product_name, 
           product_code, delivery_date, delivery_quantity, delivery_weight
    FROM fact_records
    WHERE status != 'rejected'
  `).all();
  
  const dirtyRecords = [];
  const requiredFields = ['supplier_name', 'product_name', 'delivery_date'];
  
  for (const record of records) {
    const missing = requiredFields.filter(field => isEmpty(record[field]));
    
    if (missing.length > 0) {
      dirtyRecords.push({
        fact_id: record.id,
        source_id: record.source_id,
        error_type: 'missing_field',
        error_message: `缺少必填字段: ${missing.join(', ')}`,
        original_data: JSON.stringify(record),
        original_line_number: record.original_line_number
      });
    }
  }
  
  return dirtyRecords;
}

function checkCrossDate(db, options) {
  const dateRange = options.dateRange || 7;
  const records = db.prepare(`
    SELECT fr.*, ds.name as source_name
    FROM fact_records fr
    LEFT JOIN data_sources ds ON fr.source_id = ds.id
    WHERE fr.delivery_date IS NOT NULL
      AND fr.status != 'rejected'
    ORDER BY fr.supplier_name, fr.product_name, fr.delivery_date
  `).all();
  
  const dirtyRecords = [];
  const grouped = {};
  
  for (const record of records) {
    const key = `${record.supplier_name || ''}|${record.product_name || ''}`;
    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(record);
  }
  
  for (const [key, group] of Object.entries(grouped)) {
    if (group.length < 2) continue;
    
    for (let i = 0; i < group.length - 1; i++) {
      const curr = group[i];
      const next = group[i + 1];
      
      const date1 = new Date(curr.delivery_date);
      const date2 = new Date(next.delivery_date);
      const diffDays = Math.abs((date2 - date1) / (1000 * 60 * 60 * 24));
      
      if (diffDays > dateRange && diffDays < 30) {
        dirtyRecords.push({
          fact_id: curr.id,
          source_id: curr.source_id,
          error_type: 'cross_date',
          error_message: `与下一条记录日期间隔 ${diffDays.toFixed(0)} 天，可能跨月或日期错误`,
          original_data: JSON.stringify(curr),
          original_line_number: curr.original_line_number
        });
      }
    }
  }
  
  return dirtyRecords;
}

function checkNameChange(db, options) {
  const records = db.prepare(`
    SELECT DISTINCT product_code, product_name, supplier_name
    FROM fact_records
    WHERE product_code IS NOT NULL 
      AND product_code != ''
      AND status != 'rejected'
    ORDER BY product_code
  `).all();
  
  const dirtyRecords = [];
  const codeNames = {};
  
  for (const record of records) {
    const code = record.product_code.trim();
    const name = record.product_name ? record.product_name.trim() : '';
    
    if (!codeNames[code]) {
      codeNames[code] = new Set();
    }
    codeNames[code].add(name);
  }
  
  for (const [code, names] of Object.entries(codeNames)) {
    if (names.size > 1) {
      const nameList = Array.from(names);
      const factRecords = db.prepare(`
        SELECT id, source_id, original_line_number, product_name
        FROM fact_records
        WHERE product_code = ? AND status != 'rejected'
      `).all(code);
      
      for (const fr of factRecords) {
        dirtyRecords.push({
          fact_id: fr.id,
          source_id: fr.source_id,
          error_type: 'name_change',
          error_message: `商品编码 ${code} 存在多个名称: ${nameList.join(' vs ')}`,
          original_data: JSON.stringify(fr),
          original_line_number: fr.original_line_number
        });
      }
    }
  }
  
  return dirtyRecords;
}

function checkAmountConflict(db, options) {
  const threshold = options.threshold || 0.01;
  const records = db.prepare(`
    SELECT id, source_id, original_line_number, 
           delivery_quantity, unit_price, total_amount,
           supplier_name, product_name
    FROM fact_records
    WHERE delivery_quantity > 0 
      AND unit_price > 0 
      AND total_amount > 0
      AND status != 'rejected'
  `).all();
  
  const dirtyRecords = [];
  
  for (const record of records) {
    const calculated = record.delivery_quantity * record.unit_price;
    const diff = Math.abs(calculated - record.total_amount);
    
    if (diff > threshold && diff / record.total_amount > 0.01) {
      dirtyRecords.push({
        fact_id: record.id,
        source_id: record.source_id,
        error_type: 'amount_conflict',
        error_message: `金额计算不一致: 数量×单价=${calculated.toFixed(2)}, 实际=${record.total_amount}, 差额=${diff.toFixed(2)}`,
        original_data: JSON.stringify(record),
        original_line_number: record.original_line_number
      });
    }
  }
  
  return dirtyRecords;
}

function checkQuantityConflict(db, options) {
  const records = db.prepare(`
    SELECT id, source_id, original_line_number,
           delivery_quantity, sorted_quantity, loss_quantity,
           supplier_name, product_name, delivery_date
    FROM fact_records
    WHERE delivery_quantity > 0 
      AND (sorted_quantity > 0 OR loss_quantity > 0)
      AND status != 'rejected'
  `).all();
  
  const dirtyRecords = [];
  
  for (const record of records) {
    const totalOut = (record.sorted_quantity || 0) + (record.loss_quantity || 0);
    const diff = record.delivery_quantity - totalOut;
    
    if (Math.abs(diff) > 0.01 && diff < 0) {
      dirtyRecords.push({
        fact_id: record.id,
        source_id: record.source_id,
        error_type: 'quantity_conflict',
        error_message: `数量不平衡: 送货=${record.delivery_quantity}, 分拣+损耗=${totalOut}, 超出=${Math.abs(diff)}`,
        original_data: JSON.stringify(record),
        original_line_number: record.original_line_number
      });
    }
  }
  
  return dirtyRecords;
}

async function checkCommand(options) {
  requirePermission('view');
  
  const db = getDb();
  const checkTypes = options.type ? [options.type] : ['all'];
  
  printInfo('开始数据质量检查...');
  
  const allDirtyRecords = [];
  
  if (checkTypes.includes('all') || checkTypes.includes('missing_field')) {
    printInfo('检查缺失字段...');
    const records = checkMissingFields(db, options);
    allDirtyRecords.push(...records);
    printInfo(`  发现 ${records.length} 条缺字段记录`);
  }
  
  if (checkTypes.includes('all') || checkTypes.includes('cross_date')) {
    printInfo('检查跨日异常...');
    const records = checkCrossDate(db, options);
    allDirtyRecords.push(...records);
    printInfo(`  发现 ${records.length} 条跨日异常记录`);
  }
  
  if (checkTypes.includes('all') || checkTypes.includes('name_change')) {
    printInfo('检查商品改名...');
    const records = checkNameChange(db, options);
    allDirtyRecords.push(...records);
    printInfo(`  发现 ${records.length} 条改名记录`);
  }
  
  if (checkTypes.includes('all') || checkTypes.includes('amount_conflict')) {
    printInfo('检查金额冲突...');
    const records = checkAmountConflict(db, options);
    allDirtyRecords.push(...records);
    printInfo(`  发现 ${records.length} 条金额冲突`);
  }
  
  if (checkTypes.includes('all') || checkTypes.includes('quantity_conflict')) {
    printInfo('检查数量冲突...');
    const records = checkQuantityConflict(db, options);
    allDirtyRecords.push(...records);
    printInfo(`  发现 ${records.length} 条数量冲突`);
  }
  
  if (!options.dryRun) {
    const insertStmt = db.prepare(`
      INSERT OR IGNORE INTO dirty_records 
      (fact_id, source_id, error_type, error_message, original_data, status)
      VALUES (?, ?, ?, ?, ?, 'open')
    `);
    
    let inserted = 0;
    for (const dr of allDirtyRecords) {
      const result = insertStmt.run(
        dr.fact_id,
        dr.source_id,
        dr.error_type,
        dr.error_message,
        dr.original_data
      );
      if (result.changes > 0) inserted++;
    }
    
    printSuccess(`检查完成! 新增 ${inserted} 条脏记录`);
    logOperation('check', 'dirty_records', null, null, { count: inserted });
  }
  
  if (allDirtyRecords.length > 0) {
    const table = new Table({
      head: ['ID', '类型', '错误信息', '原始行号'],
      colWidths: [8, 12, 50, 10]
    });
    
    for (const dr of allDirtyRecords.slice(0, 20)) {
      const errorType = ERROR_TYPES[dr.error_type];
      table.push([
        dr.fact_id,
        errorType ? chalk.keyword(errorType.color)(errorType.name) : dr.error_type,
        dr.error_message.substring(0, 47) + (dr.error_message.length > 47 ? '...' : ''),
        dr.original_line_number || '-'
      ]);
    }
    
    console.log(table.toString());
    
    if (allDirtyRecords.length > 20) {
      printInfo(`... 还有 ${allDirtyRecords.length - 20} 条记录，请使用 fix 命令查看详情`);
    }
  } else {
    printSuccess('未发现脏数据!');
  }
}

module.exports = checkCommand;
