const db = require('../config/database');

const approveAppointment = (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '只能审批待审批状态的预约' });
    }

    db.get('SELECT * FROM employees WHERE id = ? AND status = "active"', [appointment.employee_id], (err, employee) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      if (!employee) {
        return res.status(400).json({ code: 400, message: '被访人已失效，无法审批通过' });
      }

      db.run(`UPDATE visitor_appointments SET 
        status = 'approved',
        approved_by = ?,
        approved_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
        WHERE id = ?`, [userId, id], (err) => {
        if (err) {
          return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
        }

        db.get(`SELECT a.*, 
          e.employee_no, e.name as employee_name, e.department
          FROM visitor_appointments a
          LEFT JOIN employees e ON a.employee_id = e.id
          WHERE a.id = ?`, [id], (err, updatedAppointment) => {
          if (err) {
            return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
          }
          res.json({
            code: 200,
            message: '审批通过',
            data: updatedAppointment
          });
        });
      });
    });
  });
};

const rejectAppointment = (req, res) => {
  const { id } = req.params;
  const { reason } = req.body;
  const userId = req.user.id;

  db.get('SELECT * FROM visitor_appointments WHERE id = ?', [id], (err, appointment) => {
    if (err) {
      return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
    }

    if (!appointment) {
      return res.status(404).json({ code: 404, message: '预约不存在' });
    }

    if (appointment.status !== 'pending') {
      return res.status(400).json({ code: 400, message: '只能审批待审批状态的预约' });
    }

    db.run(`UPDATE visitor_appointments SET 
      status = 'rejected',
      approved_by = ?,
      approved_at = CURRENT_TIMESTAMP,
      updated_at = CURRENT_TIMESTAMP
      WHERE id = ?`, [userId, id], (err) => {
      if (err) {
        return res.status(500).json({ code: 500, message: '服务器错误', error: err.message });
      }

      res.json({
        code: 200,
        message: '预约已拒绝'
      });
    });
  });
};

module.exports = {
  approveAppointment,
  rejectAppointment
};
