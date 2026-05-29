const fs = require('fs');
const csv = require('csv-parser');
const dayjs = require('dayjs');
const batchDao = require('../dao/batchDao');
const itemDao = require('../dao/itemDao');
const logDao = require('../dao/logDao');
const config = require('../config');
const { getDb } = require('../dao/database');

function generateBatchNo(settlementMonth) {
  const timestamp = dayjs().format('HHmmss');
  const cleanMonth = settlementMonth.replace(/[^0-9]/g, '');
  return `B${cleanMonth}${timestamp}`;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).replace(/[^\d.-]/g, '');
  return parseFloat(str) || 0;
}

function parsePercent(value) {
  if (value === null || value === undefined || value === '') return 0;
  const str = String(value).trim();
  if (str.includes('%')) {
    return parseNumber(str) / 100;
  }
  const num = parseNumber(str);
  return num > 1 ? num / 100 : num;
}

function importFromJSON(data, settlementMonth, sourceFile, remarks) {
  const batchNo = generateBatchNo(settlementMonth);
  const items = Array.isArray(data) ? data : (data.items || []);
  
  const db = getDb();
  const batchId = db.transaction(() => {
    const bid = batchDao.createBatch(batchNo, settlementMonth, items.length, sourceFile, remarks);
    
    const logs = [{
      batch_id: bid,
      step: 'import',
      action: 'create_batch',
      severity: config.SEVERITY.INFO,
      message: `创建批次 ${batchNo}，共 ${items.length} 条记录`,
      raw_value: items.length.toString(),
      is_original: 0,
      is_processed: 1
    }];

    let lineNo = 1;
    for (const rawItem of items) {
      const itemData = normalizeItem(rawItem, lineNo, bid);
      itemDao.createItem(itemData);
      
      logs.push({
        batch_id: bid,
        step: 'import',
        action: 'import_record',
        severity: config.SEVERITY.INFO,
        message: `导入第 ${lineNo} 行: 作品 ${rawItem.artwork_no || rawItem.作品编号 || '未知'}`,
        raw_value: JSON.stringify(rawItem),
        is_original: 1,
        is_processed: 0
      });
      
      lineNo++;
    }

    logDao.batchCreateLogs(logs);
    return bid;
  })();

  return {
    batch_id: batchId,
    batch_no: batchNo,
    settlement_month: settlementMonth,
    total_items: items.length
  };
}

function importFromCSV(filePath, settlementMonth, sourceFile, remarks) {
  return new Promise((resolve, reject) => {
    const results = [];
    const batchNo = generateBatchNo(settlementMonth);
    
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => {
        try {
          const result = importFromJSON(results, settlementMonth, sourceFile, remarks);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      })
      .on('error', reject);
  });
}

function normalizeItem(rawItem, lineNo, batchId) {
  const getValue = (...keys) => {
    for (const key of keys) {
      if (rawItem[key] !== undefined && rawItem[key] !== null && rawItem[key] !== '') {
        return rawItem[key];
      }
    }
    return '';
  };

  return {
    batch_id: batchId,
    line_no: lineNo,
    artwork_no: String(getValue('artwork_no', '作品编号', 'artworkNo') || '').trim(),
    artist_code: String(getValue('artist_code', '艺术家编码', 'artistCode') || '').trim(),
    artist_name: String(getValue('artist_name', '艺术家', '艺术家名称', 'artistName') || '').trim(),
    exhibition_start_date: String(getValue('exhibition_start_date', '展期开始', 'exhibitionStartDate', 'start_date') || '').trim(),
    exhibition_end_date: String(getValue('exhibition_end_date', '展期结束', 'exhibitionEndDate', 'end_date') || '').trim(),
    transaction_date: String(getValue('transaction_date', '交易日期', 'transactionDate') || '').trim(),
    listed_price: parseNumber(getValue('listed_price', '标价', '挂牌价', 'listedPrice')),
    transaction_price: parseNumber(getValue('transaction_price', '成交价', 'transactionPrice', '售价')),
    discount_rate: parsePercent(getValue('discount_rate', '折扣', '折扣率', 'discountRate')),
    declared_commission_rate: parsePercent(getValue('declared_commission_rate', '佣金比例', '佣金率', 'commission_rate', 'commissionRate')),
    raw_data: rawItem
  };
}

module.exports = {
  importFromJSON,
  importFromCSV,
  normalizeItem,
  generateBatchNo
};
