const DbHelper = require('../utils/dbHelper');
const moment = require('moment');

class RenewalController {
  static async createRenewal(req, res) {
    try {
      const {
        plate_number,
        transaction_no,
        amount,
        payment_method,
        renewal_months,
        handler,
        remarks
      } = req.body;

      if (await DbHelper.checkDuplicateTransaction(transaction_no)) {
        return res.status(400).json({ success: false, message: '重复提交：该交易号已存在' });
      }

      if (await DbHelper.checkBlacklist(plate_number)) {
        return res.status(400).json({ success: false, message: '黑名单拦截：该车牌在黑名单中，需先解除' });
      }

      const binding = await DbHelper.get(
        'SELECT * FROM plate_bindings WHERE plate_number = ?',
        [plate_number]
      );

      if (!binding) {
        return res.status(404).json({ success: false, message: '未找到该车牌的绑定记录' });
      }

      const arrears = await DbHelper.get(
        'SELECT SUM(amount - paid_amount) as total_arrears FROM arrears_ledger WHERE plate_number = ? AND status = ?',
        [plate_number, 'unpaid']
      );

      let remainingAmount = amount;
      let newValidTo;

      if (arrears && arrears.total_arrears > 0) {
        const arrearsAmount = parseFloat(arrears.total_arrears);
        if (amount < arrearsAmount) {
          return res.status(400).json({ success: false, message: '临停抵扣拦截：支付金额不足以抵扣欠费，需先缴清欠费' });
        }
        remainingAmount = amount - arrearsAmount;

        await DbHelper.run(
          'UPDATE arrears_ledger SET status = ?, paid_amount = amount, paid_at = ?, handler = ? WHERE plate_number = ? AND status = ?',
          ['paid', new Date().toISOString(), handler, plate_number, 'unpaid']
        );
      }

      const currentValidTo = binding.valid_to ? moment(binding.valid_to) : moment();
      const baseDate = currentValidTo.isAfter(moment()) ? currentValidTo : moment();
      newValidTo = baseDate.add(renewal_months, 'months').format('YYYY-MM-DD');

      const result = await DbHelper.run(
        `INSERT INTO renewal_payments 
         (plate_number, transaction_no, amount, payment_method, payment_time, renewal_months, new_valid_to, status, handler, remarks) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [plate_number, transaction_no, amount, payment_method, new Date().toISOString(), renewal_months, newValidTo, 'completed', handler, remarks]
      );

      await DbHelper.run(
        'UPDATE plate_bindings SET valid_to = ?, updated_at = ? WHERE plate_number = ?',
        [newValidTo, new Date().toISOString(), plate_number]
      );

      const updatedBinding = await DbHelper.get(
        'SELECT * FROM plate_bindings WHERE plate_number = ?',
        [plate_number]
      );

      await DbHelper.saveFlowRecord('renewal', result.id, 'create', null, { plate_number, amount, renewal_months, newValidTo }, handler, remarks);
      await DbHelper.saveFlowRecord('plate_binding', binding.id, 'update', { valid_to: binding.valid_to }, { valid_to: newValidTo }, handler, '续费更新有效期');

      res.json({ success: true, data: { id: result.id, plate_number, new_valid_to: newValidTo } });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async updateRenewal(req, res) {
    try {
      const { id } = req.params;
      const { amount, payment_method, status, handler, remarks } = req.body;

      const oldRecord = await DbHelper.get('SELECT * FROM renewal_payments WHERE id = ?', [id]);
      if (!oldRecord) {
        return res.status(404).json({ success: false, message: '记录不存在' });
      }

      const oldValue = { amount: oldRecord.amount, payment_method: oldRecord.payment_method, status: oldRecord.status };

      await DbHelper.run(
        'UPDATE renewal_payments SET amount = ?, payment_method = ?, status = ?, handler = ?, remarks = ?, updated_at = ? WHERE id = ?',
        [amount, payment_method, status, handler, remarks, new Date().toISOString(), id]
      );

      const newValue = { amount, payment_method, status };
      await DbHelper.saveFlowRecord('renewal', id, 'update', oldValue, newValue, handler, remarks);

      res.json({ success: true, message: '更新成功' });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  static async getRenewals(req, res) {
    try {
      const { plate_number, status, start_date, end_date, handler, page = 1, pageSize = 20 } = req.query;
      
      let sql = 'SELECT * FROM renewal_payments WHERE 1=1';
      let countSql = 'SELECT COUNT(*) as total FROM renewal_payments WHERE 1=1';
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

      if (handler) {
        sql += ' AND handler = ?';
        countSql += ' AND handler = ?';
        params.push(handler);
        countParams.push(handler);
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

module.exports = RenewalController;
