const DbHelper = require('../utils/dbHelper');
const { Parser } = require('json2csv');

class ReportController {
  static async exportReport(req, res) {
    try {
      const { type, handler, start_date, end_date, plate_number } = req.query;
      
      let data;
      let fields;
      let filename;

      switch (type) {
        case 'renewal':
          let sql = `SELECT rp.*, pb.owner_name, pb.phone 
                     FROM renewal_payments rp 
                     LEFT JOIN plate_bindings pb ON rp.plate_number = pb.plate_number 
                     WHERE 1=1`;
          let params = [];

          if (handler) {
            sql += ' AND rp.handler = ?';
            params.push(handler);
          }
          if (start_date) {
            sql += ' AND rp.created_at >= ?';
            params.push(start_date);
          }
          if (end_date) {
            sql += ' AND rp.created_at <= ?';
            params.push(end_date + ' 23:59:59');
          }
          if (plate_number) {
            sql += ' AND rp.plate_number LIKE ?';
            params.push(`%${plate_number}%`);
          }
          sql += ' ORDER BY rp.created_at DESC';
          
          data = await DbHelper.all(sql, params);
          fields = ['id', 'plate_number', 'transaction_no', 'amount', 'payment_method', 'renewal_months', 'new_valid_to', 'status', 'handler', 'created_at'];
          filename = `续费报表_${new Date().toISOString().slice(0, 10)}.csv`;
          break;

        case 'arrears':
          data = await DbHelper.all(
            `SELECT a.*, pb.owner_name, pb.phone 
             FROM arrears_ledger a 
             LEFT JOIN plate_bindings pb ON a.plate_number = pb.plate_number 
             ORDER BY a.created_at DESC`
          );
          fields = ['id', 'plate_number', 'bill_month', 'amount', 'paid_amount', 'status', 'payment_method', 'handler', 'created_at'];
          filename = `欠费报表_${new Date().toISOString().slice(0, 10)}.csv`;
          break;

        case 'flow':
          data = await DbHelper.all(
            `SELECT * FROM flow_records 
             WHERE created_at >= ? AND created_at <= ? 
             ORDER BY created_at DESC`,
            [start_date || '2020-01-01', end_date || new Date().toISOString()]
          );
          fields = ['id', 'business_type', 'business_id', 'action', 'old_value', 'new_value', 'operator', 'created_at'];
          filename = `流转记录报表_${new Date().toISOString().slice(0, 10)}.csv`;
          break;

        default:
          return res.status(400).json({ success: false, message: '不支持的报表类型' });
      }

      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.status(200).send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getFlowRecords(req, res) {
    try {
      const { business_type, business_id, operator, start_date, end_date, page = 1, pageSize = 20 } = req.query;
      
      let sql = 'SELECT * FROM flow_records WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM flow_records WHERE 1=1';
      let params = [];
      let countParams = [];

      if (business_type) {
        sql += ' AND business_type = ?';
        countSql += ' AND business_type = ?';
        params.push(business_type);
        countParams.push(business_type);
      }

      if (business_id) {
        sql += ' AND business_id = ?';
        countSql += ' AND business_id = ?';
        params.push(business_id);
        countParams.push(business_id);
      }

      if (operator) {
        sql += ' AND operator = ?';
        countSql += ' AND operator = ?';
        params.push(operator);
        countParams.push(operator);
      }

      if (start_date) {
        sql += ' AND created_at >= ?';
        countSql += ' AND created_at >= ?';
        params.push(start_date);
        countParams.push(start_date);
      }

      if (end_date) {
        sql += ' AND created_at <= ?';
        countSql += ' AND created_at <= ?';
        params.push(end_date + ' 23:59:59');
        countParams.push(end_date + ' 23:59:59');
      }

      sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

      const [list, countResult] = await Promise.all([
        DbHelper.all(sql, params),
        DbHelper.get(countSql, countParams)
      ]);

      res.json({ success: true, data: { list, total: countResult.total, page: parseInt(page), pageSize: parseInt(pageSize) } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ReportController;
