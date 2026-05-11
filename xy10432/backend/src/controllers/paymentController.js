const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const paymentController = {
  processPayment: (req, res) => {
    const { appointment_id, amount, payment_method, staff_id, staff_name, description } = req.body;
    
    db.serialize(() => {
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      
      db.get(getAppointmentSql, [appointment_id], (err, appointment) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        
        const balanceDue = appointment.total_amount - appointment.paid_amount;
        if (amount > balanceDue) {
          return res.status(400).json({ 
            error: '支付金额超过应付金额',
            details: {
              total_amount: appointment.total_amount,
              paid_amount: appointment.paid_amount,
              balance_due: balanceDue,
              requested_amount: amount
            }
          });
        }
        
        const newPaidAmount = appointment.paid_amount + amount;
        const updateAppointmentSql = `
          UPDATE appointments 
          SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;
        
        db.run(updateAppointmentSql, [newPaidAmount, appointment_id], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const transactionId = uuidv4();
          const transactionDesc = description || '补交费用';
          const insertTransactionSql = `
            INSERT INTO transactions (id, appointment_id, type, amount, description, staff_id, staff_name)
            VALUES (?, ?, 'payment', ?, ?, ?, ?)
          `;
          
          db.run(insertTransactionSql, [transactionId, appointment_id, amount, transactionDesc, staff_id, staff_name], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({
              success: true,
              message: '缴费成功',
              data: {
                transaction_id: transactionId,
                appointment_id,
                amount,
                payment_method: payment_method || 'cash',
                total_amount: appointment.total_amount,
                paid_amount: newPaidAmount,
                balance_due: appointment.total_amount - newPaidAmount,
                staff_name
              }
            });
          });
        });
      });
    });
  },

  processRefund: (req, res) => {
    const { appointment_id, amount, reason, staff_id, staff_name } = req.body;
    
    db.serialize(() => {
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      
      db.get(getAppointmentSql, [appointment_id], (err, appointment) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        
        const maxRefund = appointment.paid_amount - appointment.total_amount;
        if (amount > maxRefund || maxRefund <= 0) {
          return res.status(400).json({ 
            error: '可退金额不足',
            details: {
              total_amount: appointment.total_amount,
              paid_amount: appointment.paid_amount,
              available_refund: maxRefund,
              requested_amount: amount
            }
          });
        }
        
        const newPaidAmount = appointment.paid_amount - amount;
        const updateAppointmentSql = `
          UPDATE appointments 
          SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP 
          WHERE id = ?
        `;
        
        db.run(updateAppointmentSql, [newPaidAmount, appointment_id], function(err) {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          
          const transactionId = uuidv4();
          const refundDesc = reason || '退款';
          const insertTransactionSql = `
            INSERT INTO transactions (id, appointment_id, type, amount, description, staff_id, staff_name)
            VALUES (?, ?, 'refund', ?, ?, ?, ?)
          `;
          
          db.run(insertTransactionSql, [transactionId, appointment_id, amount, refundDesc, staff_id, staff_name], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            res.json({
              success: true,
              message: '退款成功',
              data: {
                transaction_id: transactionId,
                appointment_id,
                amount,
                reason: refundDesc,
                total_amount: appointment.total_amount,
                paid_amount: newPaidAmount,
                balance_due: appointment.total_amount - newPaidAmount,
                staff_name
              }
            });
          });
        });
      });
    });
  },

  getTransactions: (req, res) => {
    const { appointment_id, start_date, end_date } = req.query;
    
    let sql = `
      SELECT t.*, a.customer_name, a.package_name, a.appointment_date
      FROM transactions t
      LEFT JOIN (
        SELECT a.id, c.name AS customer_name, p.name AS package_name, a.appointment_date
        FROM appointments a
        LEFT JOIN customers c ON a.customer_id = c.id
        LEFT JOIN packages p ON a.package_id = p.id
      ) a ON t.appointment_id = a.id
    `;
    const params = [];
    const conditions = [];
    
    if (appointment_id) {
      conditions.push('t.appointment_id = ?');
      params.push(appointment_id);
    }
    if (start_date) {
      conditions.push('DATE(t.created_at) >= ?');
      params.push(start_date);
    }
    if (end_date) {
      conditions.push('DATE(t.created_at) <= ?');
      params.push(end_date);
    }
    
    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    
    sql += ' ORDER BY t.created_at DESC';
    
    db.all(sql, params, (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      res.json(rows);
    });
  },

  updateItemReportStatus: (req, res) => {
    const { appointment_item_id, report_issued, staff_id, staff_name } = req.body;
    
    const sql = `
      UPDATE appointment_items 
      SET report_issued = ?, status = ?, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `;
    
    const status = report_issued ? 'completed' : 'pending';
    
    db.run(sql, [report_issued ? 1 : 0, status, appointment_item_id], function(err) {
      if (err) {
        return res.status(500).json({ error: err.message });
      }
      if (this.changes === 0) {
        return res.status(404).json({ error: 'Appointment item not found' });
      }
      
      res.json({
        success: true,
        message: report_issued ? '报告已出具' : '报告状态已重置',
        data: {
          appointment_item_id,
          report_issued: report_issued ? 1 : 0,
          status,
          staff_name
        }
      });
    });
  }
};

module.exports = paymentController;
