const db = require('../config/database');
const { Parser } = require('json2csv');

class ExportController {
  async exportCriticalValues(req, res) {
    try {
      const { 
        batch_id, status, patient_id, patient_name,
        has_multiple_records, timeout_flag, handover_gap,
        start_date, end_date 
      } = req.query;

      let sql = `
        SELECT 
          cv.id,
          b.batch_no,
          cv.patient_id,
          cv.patient_name,
          cv.ward,
          cv.bed_no,
          cv.test_item,
          cv.test_result,
          cv.reference_range,
          cv.critical_level,
          cv.report_time,
          cv.status,
          cv.has_multiple_records,
          cv.timeout_flag,
          cv.handover_gap,
          cv.created_at as import_time,
          (SELECT COUNT(*) FROM callbacks WHERE critical_value_id = cv.id) as callback_count,
          (SELECT callback_content FROM callbacks WHERE critical_value_id = cv.id ORDER BY created_at DESC LIMIT 1) as latest_callback
        FROM critical_values cv
        LEFT JOIN batches b ON cv.batch_id = b.id
        WHERE 1=1
      `;
      let params = [];

      if (batch_id) {
        sql += ` AND cv.batch_id = ?`;
        params.push(batch_id);
      }
      if (status) {
        sql += ` AND cv.status = ?`;
        params.push(status);
      }
      if (patient_id) {
        sql += ` AND cv.patient_id LIKE ?`;
        params.push(`%${patient_id}%`);
      }
      if (patient_name) {
        sql += ` AND cv.patient_name LIKE ?`;
        params.push(`%${patient_name}%`);
      }
      if (has_multiple_records) {
        sql += ` AND cv.has_multiple_records = ?`;
        params.push(has_multiple_records);
      }
      if (timeout_flag) {
        sql += ` AND cv.timeout_flag = ?`;
        params.push(timeout_flag);
      }
      if (handover_gap) {
        sql += ` AND cv.handover_gap = ?`;
        params.push(handover_gap);
      }
      if (start_date) {
        sql += ` AND date(cv.report_time) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(cv.report_time) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY cv.created_at DESC`;

      const data = await db.all(sql, params);

      const fields = [
        'id', 'batch_no', 'patient_id', 'patient_name', 'ward', 'bed_no',
        'test_item', 'test_result', 'reference_range', 'critical_level',
        'report_time', 'status', 'has_multiple_records', 'timeout_flag',
        'handover_gap', 'callback_count', 'latest_callback'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.header('Content-Type', 'text/csv');
      res.attachment(`critical_values_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async exportProcessingRecords(req, res) {
    try {
      const { critical_value_id, start_date, end_date } = req.query;
      
      let sql = `
        SELECT 
          pr.id,
          pr.critical_value_id,
          cv.patient_name,
          cv.test_item,
          pr.action,
          pr.operator,
          pr.operator_role,
          pr.reason,
          pr.previous_status,
          pr.new_status,
          pr.created_at
        FROM processing_records pr
        LEFT JOIN critical_values cv ON pr.critical_value_id = cv.id
        WHERE 1=1
      `;
      let params = [];

      if (critical_value_id) {
        sql += ` AND pr.critical_value_id = ?`;
        params.push(critical_value_id);
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

      const fields = [
        'id', 'critical_value_id', 'patient_name', 'test_item',
        'action', 'operator', 'operator_role', 'reason',
        'previous_status', 'new_status', 'created_at'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.header('Content-Type', 'text/csv');
      res.attachment(`processing_records_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async exportCallbacks(req, res) {
    try {
      const { critical_value_id, callback_status, start_date, end_date } = req.query;
      
      let sql = `
        SELECT 
          cb.id,
          cb.critical_value_id,
          cv.patient_name,
          cv.test_item,
          cb.call_time,
          cb.caller,
          cb.receiver,
          cb.receiver_role,
          cb.callback_content,
          cb.callback_status,
          cb.confirm_time
        FROM callbacks cb
        LEFT JOIN critical_values cv ON cb.critical_value_id = cv.id
        WHERE 1=1
      `;
      let params = [];

      if (critical_value_id) {
        sql += ` AND cb.critical_value_id = ?`;
        params.push(critical_value_id);
      }
      if (callback_status) {
        sql += ` AND cb.callback_status = ?`;
        params.push(callback_status);
      }
      if (start_date) {
        sql += ` AND date(cb.call_time) >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND date(cb.call_time) <= ?`;
        params.push(end_date);
      }
      sql += ` ORDER BY cb.created_at DESC`;

      const data = await db.all(sql, params);

      const fields = [
        'id', 'critical_value_id', 'patient_name', 'test_item',
        'call_time', 'caller', 'receiver', 'receiver_role',
        'callback_content', 'callback_status', 'confirm_time'
      ];

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.header('Content-Type', 'text/csv');
      res.attachment(`callbacks_${new Date().toISOString().split('T')[0]}.csv`);
      res.send(csv);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new ExportController();
