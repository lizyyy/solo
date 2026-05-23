const fs = require('fs');
const path = require('path');
const { getDb } = require('../utils/database');
const { requirePermission, getCurrentUser, logOperation } = require('../utils/auth');
const { 
  printSuccess, 
  printError, 
  printInfo,
  ERROR_TYPES,
  SOURCE_TYPES
} = require('../utils/helpers');
const XLSX = require('xlsx');

async function exportCommand(filePath, options) {
  requirePermission('export');
  
  const db = getDb();
  const user = getCurrentUser();
  
  const exportType = options.type || 'all';
  const format = options.format || 'xlsx';
  
  printInfo(`正在导出数据...`);
  printInfo(`类型: ${exportType}`);
  printInfo(`格式: ${format}`);
  
  let data = {};
  
  if (exportType === 'all' || exportType === 'facts') {
    const facts = db.prepare(`
      SELECT 
        fr.id,
        fr.original_line_number,
        ds.name as source_file,
        ds.type as source_type,
        fr.supplier_name,
        fr.product_name,
        fr.product_code,
        fr.batch_no,
        fr.delivery_date,
        fr.delivery_quantity,
        fr.delivery_weight,
        fr.sorted_quantity,
        fr.sorted_weight,
        fr.loss_quantity,
        fr.loss_weight,
        fr.loss_reason,
        fr.unit_price,
        fr.total_amount,
        fr.is_bad_fruit,
        fr.bad_fruit_amount,
        fr.second_sort_loss,
        fr.status,
        fr.created_at,
        fr.updated_at
      FROM fact_records fr
      LEFT JOIN data_sources ds ON fr.source_id = ds.id
      ORDER BY fr.delivery_date DESC, fr.id DESC
    `).all();
    
    data['事实记录'] = facts.map(r => ({
      ...r,
      source_type: SOURCE_TYPES[r.source_type] ? SOURCE_TYPES[r.source_type].name : r.source_type,
      is_bad_fruit: r.is_bad_fruit ? '是' : '否'
    }));
  }
  
  if (exportType === 'all' || exportType === 'dirty') {
    const dirty = db.prepare(`
      SELECT 
        dr.id,
        dr.fact_id,
        fr.original_line_number,
        dr.error_type,
        dr.error_message,
        dr.status,
        dr.fix_note,
        u.username as fixed_by,
        dr.fixed_at,
        dr.created_at
      FROM dirty_records dr
      LEFT JOIN fact_records fr ON dr.fact_id = fr.id
      LEFT JOIN users u ON dr.fixed_by = u.id
      ORDER BY dr.created_at DESC
    `).all();
    
    data['脏记录'] = dirty.map(r => ({
      ...r,
      error_type: ERROR_TYPES[r.error_type] ? ERROR_TYPES[r.error_type].name : r.error_type
    }));
  }
  
  if (exportType === 'all' || exportType === 'sources') {
    const sources = db.prepare(`
      SELECT 
        ds.id,
        ds.name,
        ds.type,
        ds.file_path,
        u.username as imported_by,
        ds.imported_at
      FROM data_sources ds
      LEFT JOIN users u ON ds.imported_by = u.id
      ORDER BY ds.imported_at DESC
    `).all();
    
    data['数据源'] = sources.map(r => ({
      ...r,
      type: SOURCE_TYPES[r.type] ? SOURCE_TYPES[r.type].name : r.type
    }));
  }
  
  if (exportType === 'all' || exportType === 'history') {
    const history = db.prepare(`
      SELECT 
        oh.id,
        oh.action,
        oh.table_name,
        oh.record_id,
        oh.new_value,
        u.username,
        u.role,
        oh.created_at
      FROM operation_history oh
      LEFT JOIN users u ON oh.user_id = u.id
      ORDER BY oh.created_at DESC
      LIMIT 1000
    `).all();
    
    data['操作历史'] = history;
  }
  
  if (!filePath) {
    const exportDir = path.join(process.cwd(), 'data', 'exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    filePath = path.join(exportDir, `export_${timestamp}.${format}`);
  }
  
  try {
    if (format === 'json') {
      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } else if (format === 'csv') {
      const allRecords = data['事实记录'] || [];
      const csvContent = [
        Object.keys(allRecords[0] || {}).join(','),
        ...allRecords.map(r => Object.values(r).map(v => `"${v}"`).join(','))
      ].join('\n');
      fs.writeFileSync(filePath, csvContent, 'utf8');
    } else {
      const wb = XLSX.utils.book_new();
      
      for (const [sheetName, sheetData] of Object.entries(data)) {
        if (sheetData.length > 0) {
          const ws = XLSX.utils.json_to_sheet(sheetData);
          XLSX.utils.book_append_sheet(wb, ws, sheetName);
        }
      }
      
      XLSX.writeFile(wb, filePath);
    }
    
    printSuccess(`导出成功! 文件: ${filePath}`);
    
    const recordCount = Object.values(data).reduce((sum, arr) => sum + arr.length, 0);
    printInfo(`共导出 ${recordCount} 条记录，${Object.keys(data).length} 个工作表`);
    
    logOperation('export', null, null, null, { file: filePath, type: exportType, format });
    
  } catch (e) {
    printError(`导出失败: ${e.message}`);
    throw e;
  }
}

module.exports = exportCommand;
