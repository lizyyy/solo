const db = require('../database/db');
const { Parser } = require('json2csv');

class ReportService {
  static async generateAppointmentReport(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          a.id,
          e.name as elder_name,
          e.room_number as elder_room,
          v.name as visitor_name,
          v.phone as visitor_phone,
          v.relation,
          ts.date,
          ts.start_time,
          ts.end_time,
          r.room_number,
          a.visitor_count,
          a.status,
          a.notes,
          a.created_at,
          a.created_by
        FROM appointments a
        JOIN elders e ON a.elder_id = e.id
        JOIN visitors v ON a.visitor_id = v.id
        JOIN time_slots ts ON a.time_slot_id = ts.id
        JOIN rooms r ON a.room_id = r.id
        WHERE ts.date >= ? AND ts.date <= ?
        ORDER BY ts.date, ts.start_time
      `;

      db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async exportToCSV(startDate, endDate) {
    const data = await this.generateAppointmentReport(startDate, endDate);
    
    const fields = [
      'id',
      'elder_name',
      'elder_room',
      'visitor_name',
      'visitor_phone',
      'relation',
      'date',
      'start_time',
      'end_time',
      'room_number',
      'visitor_count',
      'status',
      'notes',
      'created_at',
      'created_by'
    ];

    const opts = { fields };
    const parser = new Parser(opts);
    const csv = parser.parse(data);
    
    return csv;
  }

  static async getStatistics(date) {
    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const stats = {};

        db.get(`
          SELECT COUNT(*) as total,
                 SUM(CASE WHEN a.status = 'pending' THEN 1 ELSE 0 END) as pending,
                 SUM(CASE WHEN a.status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
                 SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
                 SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled,
                 SUM(a.visitor_count) as total_visitors
          FROM appointments a
          JOIN time_slots ts ON a.time_slot_id = ts.id
          WHERE ts.date = ?
        `, [date], (err, row) => {
          if (err) {
            reject(err);
            return;
          }
          stats.appointments = row;

          db.get(`
            SELECT COUNT(*) as total_exceptions,
                   SUM(CASE WHEN error_type = 'DUPLICATE_APPOINTMENT' THEN 1 ELSE 0 END) as duplicate_count,
                   SUM(CASE WHEN error_type = 'CAPACITY_EXCEEDED' THEN 1 ELSE 0 END) as capacity_exceeded_count,
                   SUM(CASE WHEN error_type = 'INVALID_STATUS_TRANSITION' THEN 1 ELSE 0 END) as invalid_transition_count
            FROM exception_logs
            WHERE DATE(created_at) = ?
          `, [date], (err, row) => {
            if (err) {
              reject(err);
            } else {
              stats.exceptions = row;
              resolve(stats);
            }
          });
        });
      });
    });
  }
}

module.exports = ReportService;
