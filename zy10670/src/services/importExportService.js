const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const { runQuery, getOne, getAll, STATUS, STATUS_LABELS } = require('../db');
const { addReading, getMeterByNo, createMeter } = require('./meterService');
const dayjs = require('dayjs');

async function importReadingsFromCsv(filePath, batchNo) {
  const results = [];
  const failed = [];
  let successCount = 0;
  let totalCount = 0;

  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', async () => {
        totalCount = results.length;

        for (let i = 0; i < results.length; i++) {
          const row = results[i];
          const rowNum = i + 2;
          
          try {
            if (!row.meter_no || !row.reading_value || !row.reading_time) {
              throw new Error('缺少必填字段：电表号、读数、采集时间');
            }

            let meter = await getMeterByNo(row.meter_no);
            if (!meter) {
              meter = await createMeter({
                meter_no: row.meter_no,
                meter_name: row.meter_name || `电表-${row.meter_no}`,
                location: row.location
              });
            }

            await addReading(
              meter.id,
              parseFloat(row.reading_value),
              row.reading_time,
              row.collector || 'import'
            );

            successCount++;
          } catch (err) {
            failed.push({
              row: rowNum,
              data: row,
              error: err.message
            });
          }
        }

        await runQuery(
          `INSERT INTO import_batches (batch_no, file_name, total_count, success_count, failed_count, failed_details) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [
            batchNo,
            path.basename(filePath),
            totalCount,
            successCount,
            failed.length,
            JSON.stringify(failed)
          ]
        );

        resolve({
          batchNo,
          totalCount,
          successCount,
          failedCount: failed.length,
          failed
        });
      })
      .on('error', reject);
  });
}

async function exportReviewsToCsv(params = {}) {
  const exportDir = path.join(__dirname, '../../exports');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  let sql = `
    SELECT r.*, m.meter_no, m.meter_name, m.location
    FROM review_records r
    LEFT JOIN meters m ON r.meter_id = m.id
    WHERE 1=1
  `;
  const queryParams = [];

  if (params.status) {
    sql += ' AND r.status = ?';
    queryParams.push(params.status);
  }
  if (params.start_date) {
    sql += ' AND r.created_at >= ?';
    queryParams.push(params.start_date);
  }
  if (params.end_date) {
    sql += ' AND r.created_at <= ?';
    queryParams.push(params.end_date);
  }

  sql += ' ORDER BY r.created_at DESC';

  const reviews = await getAll(sql, queryParams);

  const fileName = `reviews_export_${dayjs().format('YYYYMMDD_HHmmss')}.csv`;
  const filePath = path.join(exportDir, fileName);

  const csvWriter = createCsvWriter({
    path: filePath,
    header: [
      { id: 'id', title: '复核记录ID' },
      { id: 'meter_no', title: '电表编号' },
      { id: 'meter_name', title: '电表名称' },
      { id: 'location', title: '安装位置' },
      { id: 'previous_reading', title: '上次读数' },
      { id: 'current_reading', title: '当前读数' },
      { id: 'previous_reading_time', title: '上次采集时间' },
      { id: 'current_reading_time', title: '当前采集时间' },
      { id: 'status_label', title: '状态' },
      { id: 'anomaly_type', title: '异常类型' },
      { id: 'anomaly_detail', title: '异常说明' },
      { id: 'review_note', title: '复核说明' },
      { id: 'reviewed_by', title: '复核人' },
      { id: 'created_at', title: '创建时间' },
      { id: 'updated_at', title: '更新时间' }
    ]
  });

  const records = reviews.map(r => ({
    ...r,
    status_label: STATUS_LABELS[r.status] || r.status
  }));

  await csvWriter.writeRecords(records);

  return {
    fileName,
    filePath,
    count: records.length
  };
}

async function getImportBatchList() {
  return getAll('SELECT * FROM import_batches ORDER BY created_at DESC');
}

async function getImportBatchDetail(batchNo) {
  const batch = await getOne('SELECT * FROM import_batches WHERE batch_no = ?', [batchNo]);
  if (batch && batch.failed_details) {
    batch.failed_details = JSON.parse(batch.failed_details);
  }
  return batch;
}

module.exports = {
  importReadingsFromCsv,
  exportReviewsToCsv,
  getImportBatchList,
  getImportBatchDetail
};
