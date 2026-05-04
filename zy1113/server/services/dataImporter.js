const db = require('../config/database');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const dayjs = require('dayjs');
const { attributeCall, extractCommitments, loadTaxonomy } = require('./textAnalyzer');

const validationErrors = {
  MISSING_CUSTOMER: '缺少客户信息',
  ORDER_NOT_FOUND: '订单号不存在',
  INVALID_DATE: '日期格式无效',
  MISSING_REQUIRED_FIELD: '缺少必填字段',
  CATEGORY_NOT_FOUND: '分类标签不存在',
  DUPLICATE_ID: 'ID重复'
};

class ImportResult {
  constructor() {
    this.success = 0;
    this.errors = [];
    this.warnings = [];
  }

  addError(message, row, detail = '') {
    this.errors.push({
      message,
      row: row || 'N/A',
      detail,
      timestamp: new Date().toISOString()
    });
  }

  addWarning(message, row, detail = '') {
    this.warnings.push({
      message,
      row: row || 'N/A',
      detail,
      timestamp: new Date().toISOString()
    });
  }
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY/MM/DD HH:mm:ss'
  ];

  for (const format of formats) {
    const parsed = dayjs(dateStr, format, true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD HH:mm:ss');
    }
  }

  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return dayjs(timestamp).format('YYYY-MM-DD HH:mm:ss');
  }

  return null;
}

function validateDate(dateStr) {
  if (!dateStr) return null;
  
  const formats = [
    'YYYY-MM-DD',
    'YYYY/MM/DD',
    'DD/MM/YYYY',
    'MM/DD/YYYY'
  ];

  for (const format of formats) {
    const parsed = dayjs(dateStr, format, true);
    if (parsed.isValid()) {
      return parsed.format('YYYY-MM-DD');
    }
  }

  const timestamp = Date.parse(dateStr);
  if (!isNaN(timestamp)) {
    return dayjs(timestamp).format('YYYY-MM-DD');
  }

  return null;
}

async function importCustomers(filePath) {
  const result = new ImportResult();
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO customers (customer_id, name, phone, email, region, address)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const transaction = db.transaction((rows) => {
          rows.forEach((row, index) => {
            const rowNum = index + 2;
            
            if (!row.customer_id && !row.id) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少 customer_id，将跳过该行');
              return;
            }

            const customerId = row.customer_id || row.id;
            
            if (!row.name) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少客户姓名');
            }

            try {
              insertStmt.run(
                customerId,
                row.name || '未知客户',
                row.phone || row.电话,
                row.email || row.邮箱,
                row.region || row.地区 || '',
                row.address || row.地址 || ''
              );
              result.success++;
            } catch (err) {
              if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                result.addWarning(validationErrors.DUPLICATE_ID, rowNum, `customer_id: ${customerId} 已存在，已更新`);
              } else {
                result.addError('导入失败', rowNum, err.message);
              }
            }
          });
        });

        try {
          transaction(rows);
          resolve(result);
        } catch (err) {
          result.addError('批量导入失败', 'N/A', err.message);
          resolve(result);
        }
      })
      .on('error', (err) => {
        result.addError('文件读取失败', 'N/A', err.message);
        resolve(result);
      });
  });
}

async function importOrders(filePath) {
  const result = new ImportResult();
  const rows = [];

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        const insertStmt = db.prepare(`
          INSERT OR REPLACE INTO orders (order_id, customer_id, product_name, category, purchase_date, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const checkCustomer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ?');

        const transaction = db.transaction((rows) => {
          rows.forEach((row, index) => {
            const rowNum = index + 2;
            
            if (!row.order_id && !row.id) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少 order_id，将跳过该行');
              return;
            }

            const orderId = row.order_id || row.id;
            const customerId = row.customer_id;
            
            if (!row.product_name && !row['产品名称']) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少产品名称');
            }

            if (customerId) {
              const customer = checkCustomer.get(customerId);
              if (!customer) {
                result.addWarning(validationErrors.MISSING_CUSTOMER, rowNum, `customer_id: ${customerId} 不存在，但仍将导入订单`);
              }
            }

            let purchaseDate = null;
            if (row.purchase_date || row['购买日期']) {
              purchaseDate = validateDate(row.purchase_date || row['购买日期']);
              if (!purchaseDate) {
                result.addWarning(validationErrors.INVALID_DATE, rowNum, `日期格式无效: ${row.purchase_date || row['购买日期']}`);
              }
            }

            try {
              insertStmt.run(
                orderId,
                customerId || null,
                row.product_name || row['产品名称'] || '未知产品',
                row.category || row['分类'] || '',
                purchaseDate,
                row.status || 'active'
              );
              result.success++;
            } catch (err) {
              if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                result.addWarning(validationErrors.DUPLICATE_ID, rowNum, `order_id: ${orderId} 已存在，已更新`);
              } else {
                result.addError('导入失败', rowNum, err.message);
              }
            }
          });
        });

        try {
          transaction(rows);
          resolve(result);
        } catch (err) {
          result.addError('批量导入失败', 'N/A', err.message);
          resolve(result);
        }
      })
      .on('error', (err) => {
        result.addError('文件读取失败', 'N/A', err.message);
        resolve(result);
      });
  });
}

async function importTaxonomy(filePath) {
  const result = new ImportResult();
  
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const taxonomy = JSON.parse(content);
    const categories = Array.isArray(taxonomy) ? taxonomy : (taxonomy.categories || []);

    const insertStmt = db.prepare(`
      INSERT OR REPLACE INTO categories (code, name, parent_code, keywords, description)
      VALUES (?, ?, ?, ?, ?)
    `);

    const transaction = db.transaction((items) => {
      items.forEach((item, index) => {
        const rowNum = index + 1;
        
        if (!item.code) {
          result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少 code 字段');
          return;
        }

        if (!item.name) {
          result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少 name 字段');
        }

        try {
          insertStmt.run(
            item.code,
            item.name || '分类',
            item.parent_code || item.parentCode || null,
            item.keywords || '',
            item.description || ''
          );
          result.success++;
        } catch (err) {
          result.addError('导入失败', rowNum, err.message);
        }
      });
    });

    transaction(categories);
  } catch (err) {
    result.addError('JSON 解析失败', 'N/A', err.message);
  }

  return result;
}

async function importCallNotes(filePath) {
  const result = new ImportResult();
  const rows = [];
  const categories = loadTaxonomy();

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => rows.push(row))
      .on('end', async () => {
        const insertCallStmt = db.prepare(`
          INSERT OR REPLACE INTO call_notes (call_id, customer_id, order_id, call_time, agent_name, category, product_category, region, raw_text, cleaned_text)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertAttributionStmt = db.prepare(`
          INSERT INTO attributions (call_id, category_code, confidence, keywords, evidence, is_manual)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        const insertCommitmentStmt = db.prepare(`
          INSERT INTO commitments (call_id, content, deadline, priority)
          VALUES (?, ?, ?, ?)
        `);

        const checkOrder = db.prepare('SELECT order_id FROM orders WHERE order_id = ?');
        const checkCustomer = db.prepare('SELECT customer_id FROM customers WHERE customer_id = ?');

        const deleteOldAttributions = db.prepare('DELETE FROM attributions WHERE call_id = ?');
        const deleteOldCommitments = db.prepare('DELETE FROM commitments WHERE call_id = ?');

        const transaction = db.transaction((rows) => {
          rows.forEach((row, index) => {
            const rowNum = index + 2;
            
            if (!row.call_id && !row.id) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少 call_id，将跳过该行');
              return;
            }

            const callId = row.call_id || row.id;
            const customerId = row.customer_id;
            const orderId = row.order_id;
            
            if (!row.raw_text && !row.notes && !row.content && !row['纪要'] && !row['内容']) {
              result.addWarning(validationErrors.MISSING_REQUIRED_FIELD, rowNum, '缺少通话纪要内容');
            }

            if (customerId) {
              const customer = checkCustomer.get(customerId);
              if (!customer) {
                result.addWarning(validationErrors.MISSING_CUSTOMER, rowNum, `customer_id: ${customerId} 不存在`);
              }
            }

            if (orderId) {
              const order = checkOrder.get(orderId);
              if (!order) {
                result.addWarning(validationErrors.ORDER_NOT_FOUND, rowNum, `order_id: ${orderId} 不存在`);
              }
            }

            let callTime = null;
            if (row.call_time || row.time || row['通话时间']) {
              callTime = parseDate(row.call_time || row.time || row['通话时间']);
              if (!callTime) {
                result.addWarning(validationErrors.INVALID_DATE, rowNum, `日期格式无效: ${row.call_time || row.time || row['通话时间']}`);
              }
            }

            const rawText = row.raw_text || row.notes || row.content || row['纪要'] || row['内容'] || '';
            
            const attribution = attributeCall(rawText, categories);
            const commitments = extractCommitments(rawText);

            try {
              insertCallStmt.run(
                callId,
                customerId || null,
                orderId || null,
                callTime,
                row.agent_name || row.agent || row['客服'] || '',
                row.category || '',
                row.product_category || row['产品分类'] || '',
                row.region || row['地区'] || '',
                rawText,
                attribution.cleaned_text
              );

              deleteOldAttributions.run(callId);
              if (attribution.best_match) {
                insertAttributionStmt.run(
                  callId,
                  attribution.best_match.category_code,
                  attribution.best_match.confidence,
                  JSON.stringify(attribution.best_match.matched_keywords),
                  attribution.best_match.evidence,
                  0
                );
              }

              deleteOldCommitments.run(callId);
              commitments.forEach((commitment) => {
                let deadline = null;
                if (callTime) {
                  deadline = dayjs(callTime).add(commitment.deadline_days, 'day').format('YYYY-MM-DD');
                } else {
                  deadline = dayjs().add(commitment.deadline_days, 'day').format('YYYY-MM-DD');
                }
                
                insertCommitmentStmt.run(
                  callId,
                  commitment.content,
                  deadline,
                  commitment.priority
                );
              });

              result.success++;
            } catch (err) {
              if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                result.addWarning(validationErrors.DUPLICATE_ID, rowNum, `call_id: ${callId} 已存在，已更新`);
              } else {
                result.addError('导入失败', rowNum, err.message);
              }
            }
          });
        });

        try {
          transaction(rows);
          resolve(result);
        } catch (err) {
          result.addError('批量导入失败', 'N/A', err.message);
          resolve(result);
        }
      })
      .on('error', (err) => {
        result.addError('文件读取失败', 'N/A', err.message);
        resolve(result);
      });
  });
}

module.exports = {
  importCustomers,
  importOrders,
  importTaxonomy,
  importCallNotes,
  validationErrors,
  ImportResult
};
