const db = require('../config/database');

class QueryController {
  async getDoctorConfirmed(req, res) {
    try {
      const { doctor_name, start_date, end_date } = req.query;
      
      let sql = `
        SELECT DISTINCT
          cv.id,
          cv.patient_id,
          cv.patient_name,
          cv.ward,
          cv.test_item,
          cv.test_result,
          cv.critical_level,
          cv.report_time,
          cb.call_time,
          cb.receiver as doctor_name,
          cb.callback_content,
          cb.confirm_time,
          pr.created_at as process_time
        FROM critical_values cv
        INNER JOIN callbacks cb ON cv.id = cb.critical_value_id
        LEFT JOIN processing_records pr ON cv.id = pr.critical_value_id
        WHERE cb.callback_status = 'confirmed'
        AND cb.receiver_role = 'doctor'
      `;
      let params = [];

      if (doctor_name) {
        sql += ` AND cb.receiver LIKE ?`;
        params.push(`%${doctor_name}%`);
      }
      if (start_date) {
        sql += ` AND date(cb.confirm_time) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(cb.confirm_time) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY cb.confirm_time DESC`;

      const data = await db.all(sql, params);
      res.json({ 
        success: true, 
        data, 
        count: data.length,
        type: 'doctor_confirmed'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getNurseForwarded(req, res) {
    try {
      const { nurse_name, start_date, end_date } = req.query;
      
      let sql = `
        SELECT DISTINCT
          cv.id,
          cv.patient_id,
          cv.patient_name,
          cv.ward,
          cv.test_item,
          cv.test_result,
          cv.critical_level,
          cv.report_time,
          cb.call_time,
          cb.caller as nurse_name,
          cb.receiver,
          cb.receiver_role,
          cb.callback_content,
          pr.created_at as forward_time
        FROM critical_values cv
        INNER JOIN callbacks cb ON cv.id = cb.critical_value_id
        LEFT JOIN processing_records pr ON cv.id = pr.critical_value_id
          AND pr.operator_role = 'nurse'
        WHERE 1=1
      `;
      let params = [];

      if (nurse_name) {
        sql += ` AND cb.caller LIKE ?`;
        params.push(`%${nurse_name}%`);
      }
      if (start_date) {
        sql += ` AND date(cb.call_time) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(cb.call_time) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY cb.call_time DESC`;

      const data = await db.all(sql, params);
      res.json({ 
        success: true, 
        data, 
        count: data.length,
        type: 'nurse_forwarded'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getDirectorReviewed(req, res) {
    try {
      const { director_name, start_date, end_date } = req.query;
      
      let sql = `
        SELECT DISTINCT
          cv.id,
          cv.patient_id,
          cv.patient_name,
          cv.ward,
          cv.test_item,
          cv.test_result,
          cv.critical_level,
          cv.report_time,
          pr.operator as director_name,
          pr.reason as review_comment,
          pr.created_at as review_time
        FROM critical_values cv
        INNER JOIN processing_records pr ON cv.id = pr.critical_value_id
        WHERE pr.operator_role = 'director'
      `;
      let params = [];

      if (director_name) {
        sql += ` AND pr.operator LIKE ?`;
        params.push(`%${director_name}%`);
      }
      if (start_date) {
        sql += ` AND date(pr.created_at) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(pr.created_at) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY pr.created_at DESC`;

      const data = await db.all(sql, params);
      res.json({ 
        success: true, 
        data, 
        count: data.length,
        type: 'director_reviewed'
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getAuditTrail(req, res) {
    try {
      const { critical_value_id } = req.params;
      
      const sql = `
        SELECT 
          'callback' as type,
          created_at,
          caller as operator,
          receiver_role as role,
          callback_content as content,
          callback_status as status
        FROM callbacks 
        WHERE critical_value_id = ?
        UNION ALL
        SELECT 
          'processing' as type,
          created_at,
          operator,
          operator_role as role,
          reason as content,
          new_status as status
        FROM processing_records 
        WHERE critical_value_id = ?
        ORDER BY created_at
      `;

      const data = await db.all(sql, [critical_value_id, critical_value_id]);
      res.json({ success: true, data });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getStatistics(req, res) {
    try {
      const { start_date, end_date } = req.query;
      
      let dateFilter = '';
      let params = [];
      
      if (start_date && end_date) {
        dateFilter = ` AND date(cv.created_at) BETWEEN ? AND ?`;
        params.push(start_date, end_date);
      }

      const total = await db.get(
        `SELECT COUNT(*) as count FROM critical_values cv WHERE 1=1 ${dateFilter}`,
        params
      );

      const confirmed = await db.get(
        `SELECT COUNT(DISTINCT cv.id) as count 
         FROM critical_values cv
         INNER JOIN callbacks cb ON cv.id = cb.critical_value_id
         WHERE cb.callback_status = 'confirmed' ${dateFilter}`,
        params
      );

      const timeout = await db.get(
        `SELECT COUNT(*) as count FROM critical_values cv WHERE timeout_flag = 1 ${dateFilter}`,
        params.slice(params.length - 2)
      );

      const multiple = await db.get(
        `SELECT COUNT(*) as count FROM critical_values cv WHERE has_multiple_records = 1 ${dateFilter}`,
        params.slice(params.length - 2)
      );

      const handover = await db.get(
        `SELECT COUNT(*) as count FROM critical_values cv WHERE handover_gap = 1 ${dateFilter}`,
        params.slice(params.length - 2)
      );

      res.json({
        success: true,
        data: {
          total: total.count,
          doctor_confirmed: confirmed.count,
          timeout: timeout.count,
          multiple_records: multiple.count,
          handover_gap: handover.count
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new QueryController();
