const fs = require('fs');
const content = `const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const db = require('../models/database');

class ImportService {
  async createBatch(batchType, sourceFile, createdBy, remark = '') {
    const batchNo = 'BATCH' + moment().format('YYYYMMDDHHmmss') + Math.floor(Math.random() * 1000);
    const result = await db.run(
      'INSERT INTO batches (batch_no, batch_type, source_file, created_by, remark) VALUES (?, ?, ?, ?, ?)',
      [batchNo, batchType, sourceFile, createdBy, remark]
    );
    return { batchId: result.lastID, batchNo };
  }

  async updateBatchCount(batchId, count) {
    await db.run(
      'UPDATE batches SET total_count = ?, status = ? WHERE id = ?',
      [count, 'completed', batchId]
    );
  }

  async validateRouteSchedule(routeNo, shiftNo) {
    if (!routeNo || !shiftNo) return { valid: true, exists: false };
    const schedule = await db.get(
      'SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? LIMIT 1',
      [routeNo, shiftNo]
    );
    return { valid: true, exists: !!schedule, schedule };
  }

  async importLostItemsFromCSV(filePath, batchId, operator, validateRoute = true) {
    const results = [];
    const errors = [];
    let successCount = 0;
    let routeValidationWarnings = [];
    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv({ encoding: 'utf-8' }))
        .on('data', (data) => results.push(data))
        .on('end', async () => {
          try {
            await db.beginTransaction();
            for (const row of results) {
              try {
                const itemNo = 'ITEM' + moment().format('YYYYMMDD') + Math.floor(Math.random() * 100000);
                const routeNo = row.route_no || row.route || '';
                const shiftNo = row.shift_no || row.shift || '';
                let importRemark = '';
                if (validateRoute && routeNo && shiftNo) {
                  const routeValidation = await this.validateRouteSchedule(routeNo, shiftNo);
                  if (!routeValidation.exists) {
                    routeValidationWarnings.push({
                      itemName: row.item_name || row.name || '',
                      routeNo,
                      shiftNo,
                      warning: '线路班次不存在: ' + routeNo + '路 ' + shiftNo
                    });
                    importRemark = '警告: 线路班次 ' + routeNo + '路 ' + shiftNo + ' 未在系统中登记';
                  }
                }
                await db.run(
                  'INSERT INTO lost_items (item_no, item_name, item_description, item_category, found_time, found_location, route_no, shift_no, driver_name, driver_phone, finder_name, finder_phone, image_ids, batch_id, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                  [
                    itemNo,
                    row.item_name || row.name || '',
                    row.item_description || row.description || row.desc || '',
                    row.item_category || row.category || '',
                    row.found_time || row.time || moment().format('YYYY-MM-DD HH:mm:ss'),
                    row.found_location || row.location || '',
                    routeNo,
                    shiftNo,
                    row.driver_name || row.driver || '',
                    row.driver_phone || '',
                    row.finder_name || row.finder || '',
                    row.finder_phone || '',
                    row.image_ids || row.images || '',
                    batchId,
                    'pending'
                  ]
                );
                const itemResult = await db.get('SELECT last_insert_rowid() as id');
                const itemId = itemResult.id;
                await this.addProcessingHistory(itemId, 'import', '导入失物数据', operator, null, 'pending', importRemark);
                successCount++;
              } catch (rowError) {
                errors.push({ row: row, error: rowError.message });
              }
            }
            await this.updateBatchCount(batchId, successCount);
            await db.commit();
            resolve({ successCount, errors, total: results.length, routeValidationWarnings });
          } catch (error) {
            await db.rollback();
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async importRouteSchedulesFromJSON(filePath, batchId, operator) {
    const content = fs.readFileSync(filePath, 'utf-8');
    const schedules = JSON.parse(content);
    const errors = [];
    let successCount = 0;
    await db.beginTransaction();
    try {
      for (const schedule of schedules) {
        try {
          await db.run(
            'INSERT OR IGNORE INTO route_schedules (route_no, shift_no, driver_name, driver_phone, vehicle_no, departure_time, arrival_time, start_station, end_station, batch_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            [
              schedule.route_no || schedule.route || '',
              schedule.shift_no || schedule.shift || '',
              schedule.driver_name || schedule.driver || '',
              schedule.driver_phone || '',
              schedule.vehicle_no || schedule.vehicle || '',
              schedule.departure_time || schedule.departure || '',
              schedule.arrival_time || schedule.arrival || '',
              schedule.start_station || schedule.start || '',
              schedule.end_station || schedule.end || '',
              batchId
            ]
          );
          successCount++;
        } catch (rowError) {
          errors.push({ schedule: schedule, error: rowError.message });
        }
      }
      await this.updateBatchCount(batchId, successCount);
      await db.commit();
      return { successCount, errors, total: schedules.length };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async importImageIndex(imageDataList, batchNo, uploadedBy) {
    const errors = [];
    let successCount = 0;
    await db.beginTransaction();
    try {
      for (const imageData of imageDataList) {
        try {
          await db.run(
            'INSERT OR IGNORE INTO image_index (image_code, file_path, upload_batch_no, uploaded_by) VALUES (?, ?, ?, ?)',
            [
              imageData.image_code || imageData.code || uuidv4(),
              imageData.file_path || imageData.path || '',
              batchNo,
              uploadedBy
            ]
          );
          successCount++;
        } catch (rowError) {
          errors.push({ image: imageData, error: rowError.message });
        }
      }
      await db.commit();
      return { successCount, errors, total: imageDataList.length };
    } catch (error) {
      await db.rollback();
      throw error;
    }
  }

  async addProcessingHistory(itemId, action, reason, operator, oldStatus, newStatus, remark = '') {
    await db.run(
      'INSERT INTO processing_history (item_id, action, action_reason, operator, old_status, new_status, remark) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [itemId, action, reason, operator, oldStatus, newStatus, remark]
    );
  }

  async getBatchInfo(batchId) {
    return await db.get('SELECT * FROM batches WHERE id = ?', [batchId]);
  }

  async listBatches(page = 1, pageSize = 20) {
    const offset = (page - 1) * pageSize;
    const list = await db.all('SELECT * FROM batches ORDER BY created_at DESC LIMIT ? OFFSET ?', [pageSize, offset]);
    const total = await db.get('SELECT COUNT(*) as count FROM batches');
    return { list, total: total.count, page, pageSize };
  }

  async getRouteSchedule(routeNo, shiftNo) {
    return await db.get('SELECT * FROM route_schedules WHERE route_no = ? AND shift_no = ? ORDER BY departure_time DESC LIMIT 1', [routeNo, shiftNo]);
  }

  async listRouteSchedules(page = 1, pageSize = 50) {
    const offset = (page - 1) * pageSize;
    const list = await db.all('SELECT * FROM route_schedules ORDER BY route_no, departure_time DESC LIMIT ? OFFSET ?', [pageSize, offset]);
    const total = await db.get('SELECT COUNT(*) as count FROM route_schedules');
    return { list, total: total.count, page, pageSize };
  }
}

module.exports = new ImportService();
`;

fs.writeFileSync('/Users/lzy/pro/solo/workspaces/zy70852/src/services/importService.js', content);
console.log('importService.js created successfully');
