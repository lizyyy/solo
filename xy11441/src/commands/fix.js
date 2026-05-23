const { getDb } = require('../utils/database');
const { requirePermission, getCurrentUser, logOperation } = require('../utils/auth');
const { 
  printSuccess, 
  printError, 
  printWarning,
  printInfo,
  ERROR_TYPES,
  generateUniqueKey
} = require('../utils/helpers');
const Table = require('cli-table3');
const chalk = require('chalk');
const inquirer = require('inquirer');

async function listDirtyRecords(db, options) {
  let whereClause = 'WHERE dr.status = ?';
  let params = ['open'];
  
  if (options.type) {
    whereClause += ' AND dr.error_type = ?';
    params.push(options.type);
  }
  
  if (options.factId) {
    whereClause += ' AND dr.fact_id = ?';
    params.push(options.factId);
  }
  
  const records = db.prepare(`
    SELECT dr.*, fr.supplier_name, fr.product_name, fr.original_line_number,
           fr.delivery_date, fr.delivery_quantity, fr.total_amount
    FROM dirty_records dr
    LEFT JOIN fact_records fr ON dr.fact_id = fr.id
    ${whereClause}
    ORDER BY dr.created_at DESC
    LIMIT ?
  `).all(...params, options.limit || 50);
  
  return records;
}

function displayDirtyRecords(records) {
  const table = new Table({
    head: ['脏记录ID', '事实ID', '错误类型', '商品', '行号', '错误信息'],
    colWidths: [12, 10, 12, 15, 8, 40]
  });
  
  for (const r of records) {
    const errorType = ERROR_TYPES[r.error_type];
    table.push([
      r.id,
      r.fact_id,
      errorType ? chalk.keyword(errorType.color)(errorType.name) : r.error_type,
      (r.product_name || '').substring(0, 12),
      r.original_line_number || '-',
      r.error_message.substring(0, 37) + '...'
    ]);
  }
  
  console.log(table.toString());
  printInfo(`共 ${records.length} 条脏记录`);
}

async function fixRecordInteractive(db, dirtyRecord) {
  const factRecord = db.prepare('SELECT * FROM fact_records WHERE id = ?').get(dirtyRecord.fact_id);
  
  if (!factRecord) {
    printError('事实记录不存在');
    return;
  }
  
  console.log('\n' + chalk.cyan('=== 原始数据 ==='));
  console.log(JSON.stringify(JSON.parse(dirtyRecord.original_data), null, 2));
  
  console.log('\n' + chalk.cyan('=== 当前事实数据 ==='));
  const displayFact = { ...factRecord };
  delete displayFact.unique_key;
  console.log(JSON.stringify(displayFact, null, 2));
  
  const { action } = await inquirer.prompt([
    {
      type: 'list',
      name: 'action',
      message: '选择处理方式:',
      choices: [
        { name: '修改字段', value: 'edit' },
        { name: '标记为已修复(不修改)', value: 'mark' },
        { name: '忽略', value: 'ignore' },
        { name: '取消', value: 'cancel' }
      ]
    }
  ]);
  
  if (action === 'cancel') {
    printInfo('已取消');
    return;
  }
  
  if (action === 'ignore') {
    db.prepare(`
      UPDATE dirty_records 
      SET status = 'ignored', fixed_by = ?, fixed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(getCurrentUser().id, dirtyRecord.id);
    
    printSuccess('已标记为忽略');
    logOperation('fix_ignore', 'dirty_records', dirtyRecord.id, dirtyRecord, { status: 'ignored' });
    return;
  }
  
  let updates = {};
  
  if (action === 'edit') {
    const editableFields = [
      'supplier_name', 'product_name', 'product_code', 'batch_no',
      'delivery_date', 'delivery_quantity', 'delivery_weight',
      'sorted_quantity', 'sorted_weight', 'loss_quantity', 'loss_weight',
      'unit_price', 'total_amount', 'bad_fruit_amount', 'second_sort_loss'
    ];
    
    const { field } = await inquirer.prompt([
      {
        type: 'list',
        name: 'field',
        message: '选择要修改的字段:',
        choices: editableFields
      }
    ]);
    
    const { newValue } = await inquirer.prompt([
      {
        type: 'input',
        name: 'newValue',
        message: `输入新的 ${field} 值:`,
        default: String(factRecord[field] || '')
      }
    ]);
    
    updates[field] = newValue;
    
    const { note } = await inquirer.prompt([
      {
        type: 'input',
        name: 'note',
        message: '处理意见:',
        default: `修正 ${field}`
      }
    ]);
    
    const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const values = Object.values(updates);
    
    if (updates.supplier_name || updates.product_code || updates.product_name || 
        updates.batch_no || updates.delivery_date) {
      const newKeyData = { ...factRecord, ...updates };
      updates.unique_key = generateUniqueKey(newKeyData);
    }
    
    values.push(getCurrentUser().id);
    values.push(factRecord.id);
    
    db.prepare(`
      UPDATE fact_records 
      SET ${setClauses}, status = 'fixed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(...values);
    
    db.prepare(`
      UPDATE dirty_records 
      SET status = 'fixed', fixed_data = ?, fix_note = ?, fixed_by = ?, fixed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(JSON.stringify(updates), note, getCurrentUser().id, dirtyRecord.id);
    
    logOperation('fix_edit', 'fact_records', factRecord.id, factRecord, updates);
    logOperation('fix_edit', 'dirty_records', dirtyRecord.id, dirtyRecord, { status: 'fixed', note });
  }
  
  if (action === 'mark') {
    const { note } = await inquirer.prompt([
      {
        type: 'input',
        name: 'note',
        message: '处理意见:',
        default: '数据核实无误'
      }
    ]);
    
    db.prepare(`
      UPDATE dirty_records 
      SET status = 'fixed', fix_note = ?, fixed_by = ?, fixed_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(note, getCurrentUser().id, dirtyRecord.id);
    
    db.prepare(`
      UPDATE fact_records 
      SET status = 'fixed', updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(factRecord.id);
    
    logOperation('fix_mark', 'dirty_records', dirtyRecord.id, dirtyRecord, { status: 'fixed', note });
  }
  
  printSuccess('修复完成!');
}

async function fixCommand(id, options) {
  requirePermission('fix');
  
  const db = getDb();
  
  if (options.list) {
    const records = await listDirtyRecords(db, options);
    displayDirtyRecords(records);
    return;
  }
  
  if (!id) {
    printError('请指定脏记录ID，或使用 --list 查看列表');
    return;
  }
  
  const dirtyRecord = db.prepare(`
    SELECT dr.*, fr.supplier_name, fr.product_name
    FROM dirty_records dr
    LEFT JOIN fact_records fr ON dr.fact_id = fr.id
    WHERE dr.id = ?
  `).get(id);
  
  if (!dirtyRecord) {
    printError(`脏记录 ${id} 不存在`);
    return;
  }
  
  printInfo(`处理脏记录 #${id}:`);
  const errorType = ERROR_TYPES[dirtyRecord.error_type];
  printInfo(`类型: ${errorType ? errorType.name : dirtyRecord.error_type}`);
  printInfo(`商品: ${dirtyRecord.product_name || '-'}`);
  printInfo(`错误: ${dirtyRecord.error_message}`);
  
  await fixRecordInteractive(db, dirtyRecord);
}

module.exports = fixCommand;
