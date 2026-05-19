const db = require('../config/database');

class DutyScheduleController {
  async createSchedule(req, res) {
    try {
      const { duty_date, shift_type, doctor_name, nurse_name, director_name } = req.body;
      
      const result = await db.run(
        `INSERT INTO duty_schedule (duty_date, shift_type, doctor_name, nurse_name, director_name)
         VALUES (?, ?, ?, ?, ?)`,
        [duty_date, shift_type, doctor_name, nurse_name, director_name]
      );

      const schedule = await db.get(`SELECT * FROM duty_schedule WHERE id = ?`, [result.lastID]);
      res.status(201).json({ success: true, data: schedule });
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        res.status(400).json({ success: false, message: '该日期该班次已存在值班安排' });
      } else {
        res.status(500).json({ success: false, message: error.message });
      }
    }
  }

  async getSchedules(req, res) {
    try {
      const { start_date, end_date, shift_type } = req.query;
      let sql = `SELECT * FROM duty_schedule WHERE 1=1`;
      let params = [];

      if (start_date) {
        sql += ` AND duty_date >= ?`;
        params.push(start_date);
      }
      if (end_date) {
        sql += ` AND duty_date <= ?`;
        params.push(end_date);
      }
      if (shift_type) {
        sql += ` AND shift_type = ?`;
        params.push(shift_type);
      }
      sql += ` ORDER BY duty_date DESC, shift_type`;

      const schedules = await db.all(sql, params);
      res.json({ success: true, data: schedules });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async updateSchedule(req, res) {
    try {
      const { id } = req.params;
      const { doctor_name, nurse_name, director_name } = req.body;

      await db.run(
        `UPDATE duty_schedule SET doctor_name = ?, nurse_name = ?, director_name = ? WHERE id = ?`,
        [doctor_name, nurse_name, director_name, id]
      );

      const schedule = await db.get(`SELECT * FROM duty_schedule WHERE id = ?`, [id]);
      res.json({ success: true, data: schedule });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }

  async getTodayDuty(req, res) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const schedules = await db.all(
        `SELECT * FROM duty_schedule WHERE duty_date = ? ORDER BY shift_type`,
        [today]
      );
      res.json({ success: true, data: schedules });
    } catch (error) {
      res.status(500).json({ success: false, message: error.message });
    }
  }
}

module.exports = new DutyScheduleController();
