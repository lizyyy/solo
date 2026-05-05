const Papa = require('papaparse');
const dayjs = require('dayjs');
const { runQuery, allQuery } = require('./database');

const THRESHOLDS = {
  co2: { warning: 1000, danger: 1500 },
  pm25: { warning: 35, danger: 75 },
  tvoc: { warning: 0.6, danger: 3.0 }
};

function parseDateTime(value, format = null) {
  if (!value) return null;
  
  if (format) {
    const parsed = dayjs(value, format);
    if (parsed.isValid()) return parsed.toISOString();
  }
  
  if (dayjs(value, 'YYYY-MM-DD HH:mm:ss').isValid()) {
    return dayjs(value, 'YYYY-MM-DD HH:mm:ss').toISOString();
  }
  if (dayjs(value, 'YYYY/MM/DD HH:mm:ss').isValid()) {
    return dayjs(value, 'YYYY/MM/DD HH:mm:ss').toISOString();
  }
  if (dayjs(value, 'YYYY-MM-DD HH:mm').isValid()) {
    return dayjs(value, 'YYYY-MM-DD HH:mm').toISOString();
  }
  if (dayjs(value).isValid()) {
    return dayjs(value).toISOString();
  }
  
  return null;
}

function parseSensorCSV(content, room) {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const records = [];
          
          for (const row of results.data) {
            const timestamp = parseDateTime(row['时间'] || row['timestamp'] || row['Time']);
            if (!timestamp) continue;
            
            const co2 = parseFloat(row['CO2'] || row['co2'] || row['二氧化碳']) || null;
            const pm25 = parseFloat(row['PM2.5'] || row['pm25'] || row['PM25'] || row['细颗粒物']) || null;
            const tvoc = parseFloat(row['TVOC'] || row['tvoc'] || row['总挥发性有机物']) || null;
            
            if (co2 !== null || pm25 !== null || tvoc !== null) {
              records.push({
                room: room || '默认教室',
                timestamp,
                co2,
                pm25,
                tvoc
              });
            }
          }
          
          for (const record of records) {
            await runQuery(`
              INSERT OR REPLACE INTO sensor_data (room, timestamp, co2, pm25, tvoc)
              VALUES (?, ?, ?, ?, ?)
            `, [record.room, record.timestamp, record.co2, record.pm25, record.tvoc]);
          }
          
          resolve({ count: records.length, records: records.slice(0, 10) });
        } catch (err) {
          reject(err);
        }
      },
      error: reject
    });
  });
}

function parseVentilationCSV(content, room) {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const records = [];
          
          for (const row of results.data) {
            const startTime = parseDateTime(row['开始时间'] || row['start_time'] || row['StartTime']);
            const endTime = parseDateTime(row['结束时间'] || row['end_time'] || row['EndTime']);
            let type = (row['类型'] || row['type'] || 'window').toLowerCase();
            
            if (type === '开窗' || type === 'window') type = 'window';
            else if (type === '新风' || type === 'fresh_air' || type === 'freshair') type = 'fresh_air';
            
            if (!startTime) continue;
            
            records.push({
              room: room || '默认教室',
              start_time: startTime,
              end_time: endTime,
              type,
              status: endTime ? 'completed' : 'active',
              notes: row['备注'] || row['notes'] || null
            });
          }
          
          for (const record of records) {
            await runQuery(`
              INSERT INTO ventilation_records (room, start_time, end_time, type, status, notes)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [record.room, record.start_time, record.end_time, record.type, record.status, record.notes]);
          }
          
          resolve({ count: records.length, records });
        } catch (err) {
          reject(err);
        }
      },
      error: reject
    });
  });
}

function parseCourseCSV(content, room) {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const records = [];
          
          for (const row of results.data) {
            const startTime = parseDateTime(row['开始时间'] || row['start_time'] || row['StartTime']);
            const endTime = parseDateTime(row['结束时间'] || row['end_time'] || row['EndTime']);
            const courseName = row['课程名称'] || row['course_name'] || row['CourseName'] || '未命名课程';
            
            if (!startTime || !endTime) continue;
            
            records.push({
              room: room || '默认教室',
              course_name: courseName,
              start_time: startTime,
              end_time: endTime,
              teacher: row['教师'] || row['teacher'] || null,
              students_count: parseInt(row['学生人数'] || row['students_count']) || null
            });
          }
          
          for (const record of records) {
            await runQuery(`
              INSERT INTO course_bookings (room, course_name, start_time, end_time, teacher, students_count)
              VALUES (?, ?, ?, ?, ?, ?)
            `, [record.room, record.course_name, record.start_time, record.end_time, record.teacher, record.students_count]);
          }
          
          resolve({ count: records.length, records });
        } catch (err) {
          reject(err);
        }
      },
      error: reject
    });
  });
}

function parseCleaningCSV(content, room) {
  return new Promise((resolve, reject) => {
    Papa.parse(content, {
      header: true,
      skipEmptyLines: true,
      complete: async (results) => {
        try {
          const records = [];
          
          for (const row of results.data) {
            const timestamp = parseDateTime(row['时间'] || row['timestamp'] || row['Time']);
            let type = (row['类型'] || row['type'] || 'cleaning').toLowerCase();
            
            if (type === '清洁' || type === 'cleaning') type = 'cleaning';
            else if (type === '消毒' || type === 'disinfection') type = 'disinfection';
            
            if (!timestamp) continue;
            
            records.push({
              room: room || '默认教室',
              timestamp,
              type,
              staff: row['操作人员'] || row['staff'] || null,
              notes: row['备注'] || row['notes'] || null
            });
          }
          
          for (const record of records) {
            await runQuery(`
              INSERT INTO cleaning_records (room, timestamp, type, staff, notes)
              VALUES (?, ?, ?, ?, ?)
            `, [record.room, record.timestamp, record.type, record.staff, record.notes]);
          }
          
          resolve({ count: records.length, records });
        } catch (err) {
          reject(err);
        }
      },
      error: reject
    });
  });
}

module.exports = {
  parseSensorCSV,
  parseVentilationCSV,
  parseCourseCSV,
  parseCleaningCSV,
  THRESHOLDS
};