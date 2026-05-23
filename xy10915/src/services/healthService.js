const db = require('../database/db');
const { v4: uuidv4 } = require('uuid');
const { AppointmentService, APPOINTMENT_STATUS } = require('./appointmentService');

class HealthService {
  static async submitDeclaration(appointmentId, visitorId, declarationData) {
    const { has_fever = 0, has_cough = 0, has_contact_history = 0, temperature, health_code_status = 'green' } = declarationData;

    const appointment = await AppointmentService.getAppointmentById(appointmentId);
    if (!appointment) {
      throw new Error('预约不存在');
    }

    if (appointment.status !== APPOINTMENT_STATUS.CONFIRMED && appointment.status !== APPOINTMENT_STATUS.PENDING) {
      throw new Error('只有待处理或已确认状态的预约才能提交健康申报');
    }

    return new Promise((resolve, reject) => {
      db.serialize(() => {
        const declarationId = uuidv4();
        const sql = `
          INSERT INTO health_declarations (id, appointment_id, visitor_id, has_fever, has_cough, has_contact_history, temperature, health_code_status)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(sql, [declarationId, appointmentId, visitorId, has_fever, has_cough, has_contact_history, temperature, health_code_status], async function(err) {
          if (err) {
            reject(err);
            return;
          }

          try {
            await AppointmentService.updateStatus(
              appointmentId, 
              APPOINTMENT_STATUS.HEALTH_DECLARATION_SUBMITTED, 
              '提交健康申报'
            );
            resolve({ id: declarationId, ...declarationData });
          } catch (statusError) {
            reject(statusError);
          }
        });
      });
    });
  }

  static async getDeclarationByAppointment(appointmentId) {
    return new Promise((resolve, reject) => {
      const sql = `SELECT * FROM health_declarations WHERE appointment_id = ? ORDER BY declaration_time DESC`;
      db.all(sql, [appointmentId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  static async validateHealthDeclaration(appointmentId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM health_declarations 
        WHERE appointment_id = ? 
        ORDER BY declaration_time DESC 
        LIMIT 1
      `;
      db.get(sql, [appointmentId], (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          resolve({ valid: false, message: '未找到健康申报记录' });
        } else if (row.has_fever || row.has_cough || row.has_contact_history) {
          resolve({ valid: false, message: '健康状况不符合探访要求', declaration: row });
        } else if (row.health_code_status !== 'green') {
          resolve({ valid: false, message: '健康码状态不符合要求', declaration: row });
        } else if (row.temperature && row.temperature > 37.3) {
          resolve({ valid: false, message: '体温异常', declaration: row });
        } else {
          resolve({ valid: true, declaration: row });
        }
      });
    });
  }
}

module.exports = HealthService;
