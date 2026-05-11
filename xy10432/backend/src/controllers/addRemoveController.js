const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const addRemoveController = {
  addItem: (req, res) => {
    const { appointment_id, item_id, staff_id, staff_name } = req.body;
    
    db.serialize(() => {
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      const getItemSql = 'SELECT * FROM items WHERE id = ?';
      const getExistingItemSql = 'SELECT * FROM appointment_items WHERE appointment_id = ? AND item_id = ?';
      const getDepartmentSql = 'SELECT * FROM departments WHERE id = ?';
      const getDepartmentUsageSql = `
        SELECT COUNT(*) AS count 
        FROM appointment_items ai
        LEFT JOIN appointments a ON ai.appointment_id = a.id
        LEFT JOIN items i ON ai.item_id = i.id
        WHERE i.department_id = ? 
          AND DATE(a.appointment_date) = (SELECT DATE(appointment_date) FROM appointments WHERE id = ?)
          AND a.id != ?
      `;
      
      db.get(getAppointmentSql, [appointment_id], (err, appointment) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        
        db.get(getItemSql, [item_id], (err, item) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          if (!item) {
            return res.status(404).json({ error: 'Item not found' });
          }
          
          if (item.is_addable !== 1) {
            return res.status(400).json({ error: '该项目不可添加' });
          }
          
          db.get(getExistingItemSql, [appointment_id, item_id], (err, existingItem) => {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            if (existingItem) {
              return res.status(400).json({ error: '该项目已存在于预约中' });
            }
            
            db.get(getDepartmentSql, [item.department_id], (err, department) => {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              db.get(getDepartmentUsageSql, [item.department_id, appointment_id, appointment_id], (err, usage) => {
                if (err) {
                  return res.status(500).json({ error: err.message });
                }
                
                const currentUsage = usage.count + 1;
                if (currentUsage > department.daily_capacity) {
                  return res.status(400).json({ 
                    error: '科室容量不足',
                    details: {
                      department: department.name,
                      capacity: department.daily_capacity,
                      current_usage: usage.count,
                      requested: 1
                    }
                  });
                }
                
                const appointmentItemId = uuidv4();
                const insertItemSql = `
                  INSERT INTO appointment_items (id, appointment_id, item_id, item_type, price, status, report_issued)
                  VALUES (?, ?, ?, 'add', ?, 'pending', 0)
                `;
                
                db.run(insertItemSql, [appointmentItemId, appointment_id, item_id, item.price], function(err) {
                  if (err) {
                    return res.status(500).json({ error: err.message });
                  }
                  
                  const newTotalAmount = appointment.total_amount + item.price;
                  const updateAppointmentSql = `
                    UPDATE appointments 
                    SET total_amount = ?, updated_at = CURRENT_TIMESTAMP 
                    WHERE id = ?
                  `;
                  
                  db.run(updateAppointmentSql, [newTotalAmount, appointment_id], function(err) {
                    if (err) {
                      return res.status(500).json({ error: err.message });
                    }
                    
                    const recordId = uuidv4();
                    const insertRecordSql = `
                      INSERT INTO add_remove_records (id, appointment_id, item_id, action, price, staff_id, staff_name)
                      VALUES (?, ?, ?, 'add', ?, ?, ?)
                    `;
                    
                    db.run(insertRecordSql, [recordId, appointment_id, item_id, item.price, staff_id, staff_name], function(err) {
                      if (err) {
                        console.error('Error creating record:', err);
                      }
                      
                      const balanceDue = newTotalAmount - appointment.paid_amount;
                      res.json({
                        success: true,
                        message: '项目添加成功',
                        data: {
                          appointment_item_id: appointmentItemId,
                          item: {
                            id: item.id,
                            name: item.name,
                            price: item.price
                          },
                          total_amount: newTotalAmount,
                          balance_due: balanceDue,
                          department_usage: {
                            department: department.name,
                            current_usage: currentUsage,
                            capacity: department.daily_capacity
                          }
                        }
                      });
                    });
                  });
                });
              });
            });
          });
        });
      });
    });
  },

  removeItem: (req, res) => {
    const { appointment_id, item_id, staff_id, staff_name } = req.body;
    
    db.serialize(() => {
      const getAppointmentSql = 'SELECT * FROM appointments WHERE id = ?';
      const getAppointmentItemSql = `
        SELECT ai.*, i.name AS item_name 
        FROM appointment_items ai
        LEFT JOIN items i ON ai.item_id = i.id
        WHERE ai.appointment_id = ? AND ai.item_id = ?
      `;
      
      db.get(getAppointmentSql, [appointment_id], (err, appointment) => {
        if (err) {
          return res.status(500).json({ error: err.message });
        }
        if (!appointment) {
          return res.status(404).json({ error: 'Appointment not found' });
        }
        
        db.get(getAppointmentItemSql, [appointment_id, item_id], (err, appointmentItem) => {
          if (err) {
            return res.status(500).json({ error: err.message });
          }
          if (!appointmentItem) {
            return res.status(404).json({ error: '该项目不存在于预约中' });
          }
          
          if (appointmentItem.report_issued === 1) {
            return res.status(400).json({ 
              error: '已出报告的项目不能退',
              details: {
                item: appointmentItem.item_name,
                report_issued: true
              }
            });
          }
          
          if (appointmentItem.item_type === 'package') {
            return res.status(400).json({ 
              error: '套餐内项目不能单独退',
              details: {
                item: appointmentItem.item_name,
                item_type: 'package'
              }
            });
          }
          

          
          const deleteItemSql = 'DELETE FROM appointment_items WHERE id = ?';
          db.run(deleteItemSql, [appointmentItem.id], function(err) {
            if (err) {
              return res.status(500).json({ error: err.message });
            }
            
            const newTotalAmount = appointment.total_amount - appointmentItem.price;
            const updateAppointmentSql = `
              UPDATE appointments 
              SET total_amount = ?, updated_at = CURRENT_TIMESTAMP 
              WHERE id = ?
            `;
            
            db.run(updateAppointmentSql, [newTotalAmount, appointment_id], function(err) {
              if (err) {
                return res.status(500).json({ error: err.message });
              }
              
              const recordId = uuidv4();
              const insertRecordSql = `
                INSERT INTO add_remove_records (id, appointment_id, item_id, action, price, staff_id, staff_name)
                VALUES (?, ?, ?, 'remove', ?, ?, ?)
              `;
              
              db.run(insertRecordSql, [recordId, appointment_id, item_id, appointmentItem.price, staff_id, staff_name], function(err) {
                if (err) {
                  console.error('Error creating record:', err);
                }
                
                const refundAmount = appointment.paid_amount > newTotalAmount 
                  ? appointment.paid_amount - newTotalAmount 
                  : 0;
                
                if (refundAmount > 0) {
                  const transactionId = uuidv4();
                  const insertTransactionSql = `
                    INSERT INTO transactions (id, appointment_id, type, amount, description, staff_id, staff_name)
                    VALUES (?, ?, 'refund', ?, ?, ?, ?)
                  `;
                  db.run(insertTransactionSql, [transactionId, appointment_id, refundAmount, `退还${appointmentItem.item_name}费用`, staff_id, staff_name], function(err) {
                    if (err) {
                      console.error('Error creating refund transaction:', err);
                    }
                    
                    const updatePaidAmountSql = `
                      UPDATE appointments 
                      SET paid_amount = ?, updated_at = CURRENT_TIMESTAMP 
                      WHERE id = ?
                    `;
                    db.run(updatePaidAmountSql, [newTotalAmount, appointment_id], function(err) {
                      if (err) {
                        console.error('Error updating paid amount:', err);
                      }
                    });
                  });
                }
                
                res.json({
                  success: true,
                  message: '项目退项成功',
                  data: {
                    item: {
                      id: item_id,
                      name: appointmentItem.item_name,
                      price: appointmentItem.price
                    },
                    total_amount: newTotalAmount,
                    refund_amount: refundAmount,
                    balance_due: newTotalAmount - (refundAmount > 0 ? newTotalAmount : appointment.paid_amount)
                  }
                });
              });
            });
          });
        });
      });
    });
  }
};

module.exports = addRemoveController;
