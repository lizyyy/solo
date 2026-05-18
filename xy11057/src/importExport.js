const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { allQuery, getQuery, runQuery } = require('./db');

async function exportRecords(options = {}) {
  const {
    record_type,
    status,
    handler,
    store_code,
    start_date,
    end_date,
    format = 'csv'
  } = options;

  let sql = `
    SELECT 
      r.id, r.record_code, r.record_type, 
      a.artwork_code, a.artwork_name, a.artist, a.estimated_value,
      s.store_code, s.store_name,
      r.handler, r.record_date, r.status, r.remarks,
      r.register_code, r.has_dual_auth, r.auth_by, r.auth_date,
      r.consistency_checked, r.consistency_result,
      r.created_at
    FROM inventory_records r
    JOIN artworks a ON r.artwork_id = a.id
    JOIN stores s ON r.store_id = s.id
    WHERE 1=1
  `;
  const params = [];

  if (record_type) {
    sql += ' AND r.record_type = ?';
    params.push(record_type);
  }
  if (status) {
    sql += ' AND r.status = ?';
    params.push(status);
  }
  if (handler) {
    sql += ' AND r.handler LIKE ?';
    params.push(`%${handler}%`);
  }
  if (store_code) {
    sql += ' AND s.store_code = ?';
    params.push(store_code);
  }
  if (start_date) {
    sql += ' AND r.record_date >= ?';
    params.push(start_date);
  }
  if (end_date) {
    sql += ' AND r.record_date <= ?';
    params.push(end_date);
  }

  sql += ' ORDER BY r.record_date DESC, r.created_at DESC';

  const records = await allQuery(sql, params);

  if (format === 'json') {
    return records;
  }

  const csvWriter = createCsvWriter({
    path: path.join(__dirname, '..', 'exports', `temp-${Date.now()}.csv`),
    header: [
      { id: 'record_code', title: '记录编号' },
      { id: 'record_type', title: '记录类型' },
      { id: 'artwork_code', title: '艺术品编号' },
      { id: 'artwork_name', title: '艺术品名称' },
      { id: 'artist', title: '艺术家' },
      { id: 'estimated_value', title: '估值(元)' },
      { id: 'store_code', title: '门店编号' },
      { id: 'store_name', title: '门店名称' },
      { id: 'handler', title: '负责人' },
      { id: 'record_date', title: '出入库日期' },
      { id: 'status', title: '状态' },
      { id: 'remarks', title: '备注' },
      { id: 'register_code', title: '出入库册编号' },
      { id: 'has_dual_auth', title: '是否二次授权' },
      { id: 'auth_by', title: '授权人' },
      { id: 'auth_date', title: '授权日期' },
      { id: 'consistency_result', title: '一致性校验结果' },
      { id: 'created_at', title: '创建时间' }
    ]
  });

  const exportDir = path.join(__dirname, '..', 'exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const csvData = records.map(record => ({
    ...record,
    record_type: record.record_type === 'inbound' ? '入库' : '出库',
    status: record.status === 'completed' ? '已完成' : record.status === 'pending' ? '待处理' : '已取消',
    has_dual_auth: record.has_dual_auth ? '是' : '否'
  }));

  await csvWriter.writeRecords(csvData);
  const csvContent = fs.readFileSync(csvWriter.path, 'utf8');
  fs.unlinkSync(csvWriter.path);

  return csvContent;
}

async function importRecords(filePath) {
  const results = [];
  const rowResults = [];

  await new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', resolve)
      .on('error', reject);
  });

  let successCount = 0;
  let warningCount = 0;
  let errorCount = 0;

  for (let i = 0; i < results.length; i++) {
    const row = results[i];
    const rowNum = i + 1;
    const rowWarnings = [];
    const rowErrors = [];

    try {
      const record_code = row['记录编号'] || row['record_code'];
      const record_type = (row['记录类型'] || row['record_type'] || '').toLowerCase();
      const artwork_code = row['艺术品编号'] || row['artwork_code'];
      const store_code = row['门店编号'] || row['store_code'];
      const handler = row['负责人'] || row['handler'];
      const record_date = row['出入库日期'] || row['record_date'];
      const remarks = row['备注'] || row['remarks'];
      const register_code = row['出入库册编号'] || row['register_code'];
      const has_dual_auth = (row['是否二次授权'] || row['has_dual_auth'] || '') === '是' || (row['是否二次授权'] || row['has_dual_auth'] || '') === 'true';
      const auth_by = row['授权人'] || row['auth_by'];
      const auth_date = row['授权日期'] || row['auth_date'];

      if (!record_code || !record_type || !artwork_code || !store_code || !handler || !record_date) {
        errorCount++;
        rowErrors.push('缺少必填字段');
        rowResults.push({
          row: rowNum,
          record_code: record_code || '',
          success: false,
          errors: rowErrors,
          warnings: rowWarnings
        });
        continue;
      }

      if (!['inbound', 'outbound', '入库', '出库'].includes(record_type)) {
        errorCount++;
        rowErrors.push('记录类型必须是 入库/inbound 或 出库/outbound');
        rowResults.push({
          row: rowNum,
          record_code: record_code,
          success: false,
          errors: rowErrors,
          warnings: rowWarnings
        });
        continue;
      }

      const normalizedRecordType = ['outbound', '出库'].includes(record_type) ? 'outbound' : 'inbound';

      const artwork = await getQuery('SELECT * FROM artworks WHERE artwork_code = ?', [artwork_code]);
      if (!artwork) {
        errorCount++;
        rowErrors.push(`艺术品不存在: ${artwork_code}`);
        rowResults.push({
          row: rowNum,
          record_code: record_code,
          success: false,
          errors: rowErrors,
          warnings: rowWarnings
        });
        continue;
      }

      const store = await getQuery('SELECT * FROM stores WHERE store_code = ?', [store_code]);
      if (!store) {
        errorCount++;
        rowErrors.push(`门店不存在: ${store_code}`);
        rowResults.push({
          row: rowNum,
          record_code: record_code,
          success: false,
          errors: rowErrors,
          warnings: rowWarnings
        });
        continue;
      }

      const existingRecord = await getQuery('SELECT * FROM inventory_records WHERE record_code = ?', [record_code]);
      if (existingRecord) {
        errorCount++;
        rowErrors.push(`记录编号已存在: ${record_code}`);
        rowResults.push({
          row: rowNum,
          record_code: record_code,
          success: false,
          errors: rowErrors,
          warnings: rowWarnings
        });
        continue;
      }

      let status = 'pending';

      if (normalizedRecordType === 'outbound') {
        if (artwork.requires_dual_auth && !has_dual_auth) {
          warningCount++;
          rowWarnings.push({
            type: 'high_value_without_auth',
            message: `高估值艺术品出库需要二次授权`
          });
        }
        if (has_dual_auth && auth_by) {
          status = 'completed';
        } else if (!artwork.requires_dual_auth) {
          status = 'completed';
        }
      } else {
        status = 'completed';
      }

      if (register_code) {
        const sameRegister = await allQuery('SELECT * FROM inventory_records WHERE register_code = ?', [register_code]);
        if (sameRegister.length > 0) {
          const hasDifferentType = sameRegister.some(r => r.record_type !== normalizedRecordType);
          if (hasDifferentType) {
            warningCount++;
            rowWarnings.push({
              type: 'register_inconsistency',
              message: `出入库册包含不同类型的出入库记录`
            });
          }
        }
      }

      await runQuery(
        `INSERT INTO inventory_records (
          record_code, record_type, artwork_id, store_id, handler, record_date,
          status, remarks, register_code, has_dual_auth, auth_by, auth_date,
          consistency_checked, consistency_result
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          record_code, normalizedRecordType, artwork.id, store.id, handler, record_date,
          status, remarks, register_code, has_dual_auth ? 1 : 0, auth_by, auth_date,
          rowWarnings.some(w => w.type === 'register_inconsistency') ? 1 : 0,
          rowWarnings.some(w => w.type === 'register_inconsistency') ? 'inconsistent' : 'consistent'
        ]
      );

      if (normalizedRecordType === 'outbound' && status === 'completed') {
        await runQuery('UPDATE artworks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['out_of_storage', artwork.id]);
      } else if (normalizedRecordType === 'inbound') {
        await runQuery('UPDATE artworks SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', ['in_storage', artwork.id]);
      }

      successCount++;
      rowResults.push({
        row: rowNum,
        record_code: record_code,
        artwork_code: artwork_code,
        artwork_name: artwork.artwork_name,
        success: true,
        status: status,
        warnings: rowWarnings.length > 0 ? rowWarnings : undefined
      });

    } catch (err) {
      errorCount++;
      rowErrors.push(err.message);
      rowResults.push({
        row: rowNum,
        success: false,
        errors: rowErrors,
        warnings: rowWarnings
      });
    }
  }

  fs.unlinkSync(filePath);

  return {
    summary: {
      total: results.length,
      success: successCount,
      warnings: warningCount,
      errors: errorCount
    },
    results: rowResults
  };
}

module.exports = {
  exportRecords,
  importRecords
};