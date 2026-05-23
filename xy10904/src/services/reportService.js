const db = require('../config/database');
const { Parser } = require('json2csv');

const getConsumptionReport = async (filters = {}) => {
  return new Promise((resolve, reject) => {
    let sql = `
      SELECT 
        cc.id,
        cc.member_id,
        m.name as member_name,
        m.phone as member_phone,
        cc.coach_id,
        c.name as coach_name,
        cc.appointment_id,
        a.appointment_date,
        a.appointment_time,
        cc.consumption_date,
        cc.before_remaining,
        cc.after_remaining,
        cc.operator,
        cc.remark
      FROM course_consumptions cc
      LEFT JOIN members m ON cc.member_id = m.id
      LEFT JOIN coaches c ON cc.coach_id = c.id
      LEFT JOIN appointments a ON cc.appointment_id = a.id
      WHERE 1=1
    `;
    const params = [];
    
    if (filters.start_date) {
      sql += ' AND DATE(cc.consumption_date) >= ?';
      params.push(filters.start_date);
    }
    if (filters.end_date) {
      sql += ' AND DATE(cc.consumption_date) <= ?';
      params.push(filters.end_date);
    }
    if (filters.coach_id) {
      sql += ' AND cc.coach_id = ?';
      params.push(filters.coach_id);
    }
    if (filters.member_id) {
      sql += ' AND cc.member_id = ?';
      params.push(filters.member_id);
    }
    
    sql += ' ORDER BY cc.consumption_date DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const exportConsumptionReportCSV = async (filters = {}) => {
  const data = await getConsumptionReport(filters);
  const fields = [
    'id', 'member_id', 'member_name', 'member_phone',
    'coach_id', 'coach_name', 'appointment_id',
    'appointment_date', 'appointment_time', 'consumption_date',
    'before_remaining', 'after_remaining', 'operator', 'remark'
  ];
  
  const json2csvParser = new Parser({ fields });
  return json2csvParser.parse(data);
};

const getCoachStatistics = async (startDate, endDate) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        c.id as coach_id,
        c.name as coach_name,
        COUNT(cc.id) as total_consumptions,
        COUNT(DISTINCT cc.member_id) as member_count
      FROM coaches c
      LEFT JOIN course_consumptions cc ON c.id = cc.coach_id 
        AND DATE(cc.consumption_date) >= ? 
        AND DATE(cc.consumption_date) <= ?
      GROUP BY c.id, c.name
      ORDER BY total_consumptions DESC
    `;
    db.all(sql, [startDate, endDate], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const getMemberCardSummary = async (memberId) => {
  return new Promise((resolve, reject) => {
    const sql = `
      SELECT 
        mc.id,
        cp.name as package_name,
        mc.total_lessons,
        mc.remaining_lessons,
        mc.start_date,
        mc.end_date,
        mc.status,
        c.name as coach_name,
        COUNT(cc.id) as used_lessons
      FROM membership_cards mc
      LEFT JOIN course_packages cp ON mc.course_package_id = cp.id
      LEFT JOIN coaches c ON mc.coach_id = c.id
      LEFT JOIN course_consumptions cc ON mc.id = cc.membership_card_id
      WHERE mc.member_id = ?
      GROUP BY mc.id
      ORDER BY mc.created_at DESC
    `;
    db.all(sql, [memberId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

module.exports = {
  getConsumptionReport,
  exportConsumptionReportCSV,
  getCoachStatistics,
  getMemberCardSummary
};
