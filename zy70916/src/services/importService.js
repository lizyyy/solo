const fs = require('fs');
const csv = require('csv-parser');
const db = require('../models/database');
const helpers = require('../utils/helpers');

async function importServiceOrdersCsv(filePath, batchId, createdBy) {
  const results = [];
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (row) => results.push(row))
      .on('end', () => {
        try {
          const imported = processServiceOrders(results, batchId, createdBy);
          resolve(imported);
        } catch (error) {
          reject(error);
        }
      })
      .on('error', reject);
  });
}

function processServiceOrders(rows, batchId, createdBy) {
  const insertOrder = db.prepare(`
    INSERT OR IGNORE INTO service_orders 
    (order_no, batch_id, elderly_id, service_type, service_items, scheduled_date, scheduled_time, address, district, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
  `);

  const insertTrack = db.prepare(`
    INSERT INTO track_records 
    (record_no, service_order_id, batch_id, elderly_id, service_type, status, action, reason, handled_by, source_type, source_id)
    VALUES (?, ?, ?, ?, ?, 'pending', 'import', '批量导入服务单', ?, 'csv', ?)
  `);

  const updateBatch = db.prepare(`
    UPDATE batches SET total_count = total_count + ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?
  `);

  let count = 0;
  const transaction = db.transaction((rows) => {
    for (const row of rows) {
      const orderNo = row.order_no || helpers.generateOrderNo();
      const elderlyId = row.elderly_id || row.elderlyId || row.老人编号;
      const serviceType = row.service_type || row.serviceType || row.服务类型 || '常规护理';
      const serviceItems = row.service_items || row.serviceItems || row.服务项目 || '';
      const scheduledDate = row.scheduled_date || row.scheduledDate || row.预约日期;
      const scheduledTime = row.scheduled_time || row.scheduledTime || row.预约时间;
      const address = row.address || row.地址 || '';
      const district = row.district || row.区域 || '';

      const result = insertOrder.run(
        orderNo, batchId, elderlyId, serviceType, serviceItems, scheduledDate, scheduledTime, address, district
      );

      if (result.changes > 0) {
          count++;
          const orderId = result.lastInsertRowid;
          insertTrack.run(
            helpers.generateRecordNo(), orderId, batchId, elderlyId, serviceType, createdBy, orderNo
          );
      }
    }
    updateBatch.run(count, batchId);
  });

  transaction(rows);
  return { count, total: rows.length };
}

function importNurseCalendarJson(jsonData, createdBy) {
  const data = Array.isArray(jsonData) ? jsonData : [jsonData];
  const insertNurse = db.prepare(`
    INSERT OR REPLACE INTO nurses 
    (nurse_id, name, gender, phone, qualifications, skills, district, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
  `);

  const insertCalendar = db.prepare(`
    INSERT OR REPLACE INTO nurse_calendars 
    (nurse_id, date, time_slot, status, service_order_id)
    VALUES (?, ?, ?, ?, NULL)
  `);

  let nurseCount = 0;
  let calendarCount = 0;

  const transaction = db.transaction((data) => {
    for (const item of data) {
      const nurseId = item.nurse_id || item.nurseId || item.护士编号;
      const name = item.name || item.姓名 || '';
      const gender = item.gender || item.性别 || '';
      const phone = item.phone || item.电话 || '';
      const qualifications = item.qualifications || item.资质 || '';
      const skills = Array.isArray(item.skills) ? item.skills.join(',') : (item.skills || item.技能 || '');
      const district = item.district || item.区域 || '';

      insertNurse.run(nurseId, name, gender, phone, qualifications, skills, district);
      nurseCount++;

      if (item.calendar || item.schedules) {
        const schedules = item.calendar || item.schedules;
        for (const schedule of schedules) {
          const date = schedule.date || schedule.日期;
          const timeSlot = schedule.time_slot || schedule.timeSlot || schedule.时段;
          const status = schedule.status || 'available';
          insertCalendar.run(nurseId, date, timeSlot, status);
          calendarCount++;
        }
      }
    }
  });

  transaction(data);
  return { nurseCount, calendarCount };
}

function importElderlyProfiles(profiles, createdBy) {
  const data = Array.isArray(profiles) ? profiles : [profiles];
  const insertElderly = db.prepare(`
    INSERT OR REPLACE INTO elderly_profiles 
    (elderly_id, name, gender, age, id_card, phone, address, district, health_status, care_level, requirements)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let count = 0;
  const transaction = db.transaction((data) => {
    for (const item of data) {
      const elderlyId = item.elderly_id || item.elderlyId || item.老人编号;
      const name = item.name || item.姓名 || '';
      const gender = item.gender || item.性别 || '';
      const age = item.age || item.年龄 || null;
      const idCard = item.id_card || item.idCard || item.身份证号 || '';
      const phone = item.phone || item.电话 || '';
      const address = item.address || item.地址 || '';
      const district = item.district || item.区域 || '';
      const healthStatus = item.health_status || item.healthStatus || item.健康状况 || '';
      const careLevel = item.care_level || item.careLevel || item.护理等级 || '';
      const requirements = item.requirements || item.需求 || '';

      insertElderly.run(elderlyId, name, gender, age, idCard, phone, address, district, healthStatus, careLevel, requirements);
      count++;
    }
  });

  transaction(data);
  return { count };
}

module.exports = {
  importServiceOrdersCsv,
  importNurseCalendarJson,
  importElderlyProfiles
};
