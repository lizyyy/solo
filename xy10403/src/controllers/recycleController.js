const db = require('../config/database');
const moment = require('moment');
const cron = require('node-cron');
const { CRON_SCHEDULE } = require('../config');

const recycleExpiredAppointments = () => {
  return new Promise((resolve, reject) => {
    const now = moment().format('YYYY-MM-DD HH:mm:ss');
    
    db.all(`SELECT id FROM visitor_appointments 
      WHERE status IN ('pending', 'approved')
      AND visit_end_time < ?`, [now], (err, appointments) => {
      if (err) return reject(err);
      
      if (appointments.length === 0) {
        return resolve({ count: 0, appointments: [] });
      }

      const ids = appointments.map(a => a.id);
      const placeholders = ids.map(() => '?').join(',');

      db.run(`UPDATE visitor_appointments SET 
        status = 'expired',
        expired_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
        WHERE id IN (${placeholders})`, ids, (err) => {
        if (err) return reject(err);
        
        resolve({ count: ids.length, appointments: ids });
      });
    });
  });
};

const manualRecycle = async (req, res) => {
  try {
    const result = await recycleExpiredAppointments();
    res.json({
      code: 200,
      message: `回收完成，共回收 ${result.count} 个过期预约`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
  }
};

const startRecycleJob = () => {
  console.log('过期预约回收定时任务已启动');
  
  cron.schedule(CRON_SCHEDULE, async () => {
    try {
      const result = await recycleExpiredAppointments();
      if (result.count > 0) {
        console.log(`[${moment().format('YYYY-MM-DD HH:mm:ss')}] 自动回收了 ${result.count} 个过期预约`);
      }
    } catch (err) {
      console.error('定时回收任务失败:', err.message);
    }
  });
};

module.exports = {
  manualRecycle,
  startRecycleJob,
  recycleExpiredAppointments
};
