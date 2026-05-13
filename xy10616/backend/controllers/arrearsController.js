const DbHelper = require('../utils/dbHelper');

class ArrearsController {
  static async createArrear(req, res) {
    try {
      const { plate_number, bill_month, amount, handler, remarks } = req.body;

      const existing = await DbHelper.get(
        'SELECT id FROM arrears_ledger WHERE plate_number = ? AND bill_month = ?',
        [plate_number, bill_month]
      );
      if (existing) {
        return res.status(400).json({ success: false, message: '该车牌当月账单已存在' });
      }

      const result = await DbHelper.run(
        `INSERT INTO arrears_ledger 
         (plate_number, bill_month, amount, handler, remarks) 
         VALUES (?, ?, ?, ?, ?)`,
        [plate_number, bill_month, amount, handler, remarks]
      );

      await DbHelper.saveFlowRecord('arrears', result.id, 'create', null, { plate_number, bill_month, amount }, handler || 'system');

      res.json({ success: true, data: { id: result.id, plate_number } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateArrear(req, res) {
    try {
      const { id } = req.params;
      const { amount, paid_amount, status, payment_method, handler, remarks } = req.body;

      const oldRecord = await DbHelper.get('SELECT * FROM arrears_ledger WHERE id = ?', [id]);
      if (!oldRecord) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const oldValue = {
        amount: oldRecord.amount,
        paid_amount: oldRecord.paid_amount,
        status: oldRecord.status
      };

      await DbHelper.run(
        `UPDATE arrears_ledger 
         SET amount = ?, paid_amount = ?, status = ?, payment_method = ?, paid_at = ?, handler = ?, remarks = ?, updated_at = ? 
         WHERE id = ?`,
        [amount, paid_amount, status, payment_method, status === 'paid' ? new Date().toISOString() : null, handler, remarks, new Date().toISOString(), id]
      );

      const newValue = { amount, paid_amount, status };
      await DbHelper.saveFlowRecord('arrears', id, 'update', oldValue, newValue, handler || 'system');

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getArrears(req, res) {
    try {
      const { plate_number, status, bill_month, page = 1, pageSize = 20 } = req.query;
      
      let sql = 'SELECT * FROM arrears_ledger WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM arrears_ledger WHERE 1=1';
      let params = [];
      let countParams = [];

      if (plate_number) {
        sql += ' AND plate_number LIKE ?';
        countSql += ' AND plate_number LIKE ?';
        params.push(`%${plate_number}%`);
        countParams.push(`%${plate_number}%`);
      }

      if (status) {
        sql += ' AND status = ?';
        countSql += ' AND status = ?';
        params.push(status);
        countParams.push(status);
      }

      if (bill_month) {
        sql += ' AND bill_month = ?';
        countSql += ' AND bill_month = ?';
        params.push(bill_month);
        countParams.push(bill_month);
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

  static async getArrearDetail(req, res) {
    try {
      const { id } = req.params;
      const arrear = await DbHelper.get('SELECT * FROM arrears_ledger WHERE id = ?', [id]);
      
      if (!arrear) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const flowRecords = await DbHelper.all(
        'SELECT * FROM flow_records WHERE business_type = ? AND business_id = ? ORDER BY created_at DESC',
        ['arrears', id]
      );

      res.json({ success: true, data: { ...arrear, flowRecords } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = ArrearsController;
