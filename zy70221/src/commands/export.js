const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const { Parser } = require('json2csv');
const { getDb, databaseExists } = require('../database');
const { EXPORTS_DIR, EXPIRY_THRESHOLD_DAYS, CRITICAL_EXPIRY_DAYS } = require('../config');

function ensureExportsDir() {
  if (!fs.existsSync(EXPORTS_DIR)) {
    fs.mkdirSync(EXPORTS_DIR, { recursive: true });
  }
}

function getDefaultOutputPath(type, format, checkId) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const suffix = checkId ? `_check-${checkId}` : '';
  return path.join(EXPORTS_DIR, `${type}_export${suffix}_${timestamp}.${format}`);
}

function exportToJson(data, filePath) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function exportToCsv(data, fields, filePath) {
  if (data.length === 0) {
    fs.writeFileSync(filePath, fields.join(','), 'utf-8');
    return;
  }
  
  const parser = new Parser({ fields });
  const csv = parser.parse(data);
  fs.writeFileSync(filePath, csv, 'utf-8');
}

function getIssuesData(db, checkId) {
  let query = `
    SELECT 
      ci.id,
      ci.check_run_id,
      ci.issue_type,
      ci.severity,
      ci.location_id,
      l.name as location_name,
      ci.product_id,
      p.name as product_name,
      ci.batch_number,
      ci.message,
      ci.details,
      ci.status,
      ci.created_at
    FROM check_issues ci
    LEFT JOIN locations l ON ci.location_id = l.id
    LEFT JOIN products p ON ci.product_id = p.id
  `;
  
  const params = [];
  if (checkId) {
    query += ' WHERE ci.check_run_id = ?';
    params.push(checkId);
  }
  query += ' ORDER BY ci.severity DESC, ci.created_at DESC';
  
  const issues = db.prepare(query).all(...params);
  
  return issues.map(issue => ({
    id: issue.id,
    check_run_id: issue.check_run_id,
    issue_type: issue.issue_type,
    severity: issue.severity,
    location_id: issue.location_id,
    location_name: issue.location_name || '',
    product_id: issue.product_id,
    product_name: issue.product_name || '',
    batch_number: issue.batch_number || '',
    message: issue.message,
    details: issue.details || '',
    status: issue.status,
    created_at: issue.created_at
  }));
}

function getTransfersData(db) {
  const query = `
    SELECT 
      ts.id,
      ts.from_location_id,
      l1.name as from_location_name,
      ts.to_location_id,
      l2.name as to_location_name,
      ts.product_id,
      p.name as product_name,
      ts.batch_number,
      ts.expiry_date,
      ts.quantity,
      ts.suggested_action,
      ts.suggested_price,
      ts.reason,
      ts.status,
      ts.created_at
    FROM transfer_suggestions ts
    LEFT JOIN locations l1 ON ts.from_location_id = l1.id
    LEFT JOIN locations l2 ON ts.to_location_id = l2.id
    LEFT JOIN products p ON ts.product_id = p.id
    ORDER BY ts.created_at DESC
  `;
  
  const suggestions = db.prepare(query).all();
  
  return suggestions.map(s => ({
    id: s.id,
    from_location_id: s.from_location_id,
    from_location_name: s.from_location_name || '',
    to_location_id: s.to_location_id || '',
    to_location_name: s.to_location_name || '',
    product_id: s.product_id,
    product_name: s.product_name || '',
    batch_number: s.batch_number || '',
    expiry_date: s.expiry_date,
    quantity: s.quantity,
    suggested_action: s.suggested_action,
    suggested_price: s.suggested_price || '',
    reason: s.reason,
    status: s.status,
    created_at: s.created_at
  }));
}

function getExpiringData(db) {
  const query = `
    SELECT 
      i.id,
      i.location_id,
      l.name as location_name,
      i.product_id,
      p.name as product_name,
      p.price as original_price,
      i.batch_number,
      i.expiry_date,
      i.quantity,
      date('now') as today,
      julianday(i.expiry_date) - julianday('now') as days_until_expiry,
      CASE 
        WHEN julianday(i.expiry_date) - julianday('now') <= ? THEN 'critical'
        WHEN julianday(i.expiry_date) - julianday('now') <= ? THEN 'warning'
        ELSE 'normal'
      END as urgency
    FROM inventory i
    JOIN locations l ON i.location_id = l.id
    JOIN products p ON i.product_id = p.id
    WHERE i.quantity > 0
      AND julianday(i.expiry_date) - julianday('now') <= ?
    ORDER BY days_until_expiry ASC
  `;
  
  const items = db.prepare(query).all(CRITICAL_EXPIRY_DAYS, EXPIRY_THRESHOLD_DAYS, EXPIRY_THRESHOLD_DAYS);
  
  return items.map(item => ({
    id: item.id,
    location_id: item.location_id,
    location_name: item.location_name,
    product_id: item.product_id,
    product_name: item.product_name,
    original_price: item.original_price,
    batch_number: item.batch_number || '',
    expiry_date: item.expiry_date,
    quantity: item.quantity,
    days_until_expiry: Math.ceil(item.days_until_expiry),
    urgency: item.urgency
  }));
}

function getAllData(db, checkId) {
  return {
    issues: getIssuesData(db, checkId),
    transfers: getTransfersData(db),
    expiring: getExpiringData(db)
  };
}

async function exportCommand(options) {
  const { type, format, output, checkId } = options;

  if (!databaseExists()) {
    console.log(chalk.yellow('数据库不存在，请先运行: vending-transfer init'));
    return;
  }

  const validTypes = ['all', 'issues', 'transfers', 'expiring'];
  if (!validTypes.includes(type)) {
    console.log(chalk.red(`无效的导出类型: ${type}。有效类型: ${validTypes.join(', ')}`));
    return;
  }

  const validFormats = ['csv', 'json'];
  if (!validFormats.includes(format)) {
    console.log(chalk.red(`无效的格式: ${format}。有效格式: ${validFormats.join(', ')}`));
    return;
  }

  ensureExportsDir();
  const db = getDb();

  try {
    let data;
    let fields;
    let exportType = type;

    console.log(chalk.cyan(`正在导出数据...`));
    console.log(chalk.gray(`  类型: ${type}`));
    console.log(chalk.gray(`  格式: ${format}`));

    switch (type) {
      case 'all':
        data = getAllData(db, checkId);
        break;
      case 'issues':
        data = getIssuesData(db, checkId);
        fields = [
          'id', 'check_run_id', 'issue_type', 'severity', 'location_id', 
          'location_name', 'product_id', 'product_name', 'batch_number', 
          'message', 'details', 'status', 'created_at'
        ];
        break;
      case 'transfers':
        data = getTransfersData(db);
        fields = [
          'id', 'from_location_id', 'from_location_name', 'to_location_id', 
          'to_location_name', 'product_id', 'product_name', 'batch_number', 
          'expiry_date', 'quantity', 'suggested_action', 'suggested_price', 
          'reason', 'status', 'created_at'
        ];
        break;
      case 'expiring':
        data = getExpiringData(db);
        fields = [
          'id', 'location_id', 'location_name', 'product_id', 'product_name', 
          'original_price', 'batch_number', 'expiry_date', 'quantity', 
          'days_until_expiry', 'urgency'
        ];
        break;
    }

    const outputPath = output || getDefaultOutputPath(type, format, checkId);

    if (type === 'all') {
      if (format === 'json') {
        exportToJson(data, outputPath);
      } else {
        const basePath = outputPath.replace(`.${format}`, '');
        exportToCsv(data.issues, fieldsFor('issues'), `${basePath}_issues.${format}`);
        exportToCsv(data.transfers, fieldsFor('transfers'), `${basePath}_transfers.${format}`);
        exportToCsv(data.expiring, fieldsFor('expiring'), `${basePath}_expiring.${format}`);
        console.log(chalk.green(`\n✓ 已导出到多个文件:`));
        console.log(chalk.gray(`  - ${basePath}_issues.${format}`));
        console.log(chalk.gray(`  - ${basePath}_transfers.${format}`));
        console.log(chalk.gray(`  - ${basePath}_expiring.${format}`));
        db.close();
        return;
      }
    } else {
      if (format === 'json') {
        exportToJson(data, outputPath);
      } else {
        exportToCsv(data, fields, outputPath);
      }
    }

    const recordCount = Array.isArray(data) ? data.length : 1;
    console.log(chalk.green(`\n✓ 导出成功！`));
    console.log(chalk.gray(`  记录数: ${recordCount}`));
    console.log(chalk.gray(`  输出路径: ${outputPath}`));

    db.close();

  } catch (err) {
    db.close();
    console.log(chalk.red(`导出失败: ${err.message}`));
  }
}

function fieldsFor(type) {
  switch (type) {
    case 'issues':
      return [
        'id', 'check_run_id', 'issue_type', 'severity', 'location_id', 
        'location_name', 'product_id', 'product_name', 'batch_number', 
        'message', 'details', 'status', 'created_at'
      ];
    case 'transfers':
      return [
        'id', 'from_location_id', 'from_location_name', 'to_location_id', 
        'to_location_name', 'product_id', 'product_name', 'batch_number', 
        'expiry_date', 'quantity', 'suggested_action', 'suggested_price', 
        'reason', 'status', 'created_at'
      ];
    case 'expiring':
      return [
        'id', 'location_id', 'location_name', 'product_id', 'product_name', 
        'original_price', 'batch_number', 'expiry_date', 'quantity', 
        'days_until_expiry', 'urgency'
      ];
    default:
      return [];
  }
}

module.exports = exportCommand;
