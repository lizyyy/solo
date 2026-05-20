const { db } = require('../models/database');
const { maskPhone } = require('../utils/security');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

class VerificationService {
  async checkBlacklist(identifier, type) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM blacklist WHERE identifier = ? AND type = ? AND status = 'active'`,
        [identifier, type],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  async getVisitorByPhoneOrPlate(phone, plate) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM visitors WHERE status = 'approved'`;
      let params = [];
      
      if (phone) {
        query += ` AND phone = ?`;
        params.push(phone);
      }
      if (plate) {
        if (phone) {
          query += ` OR license_plate = ?`;
        } else {
          query += ` AND license_plate = ?`;
        }
        params.push(plate);
      }
      
      db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || null);
      });
    });
  }

  async getTemporaryPlate(plateNumber) {
    return new Promise((resolve, reject) => {
      db.get(
        `SELECT * FROM temporary_plates WHERE plate_number = ? AND status = 'active'`,
        [plateNumber],
        (err, row) => {
          if (err) reject(err);
          else resolve(row || null);
        }
      );
    });
  }

  isExpiredAppointment(visitor) {
    const now = moment();
    const visitEnd = moment(`${visitor.visit_date} ${visitor.end_time}`);
    return now.isAfter(visitEnd);
  }

  isWithinValidTime(visitor) {
    const now = moment();
    const visitStart = moment(`${visitor.visit_date} ${visitor.start_time}`);
    const visitEnd = moment(`${visitor.visit_date} ${visitor.end_time}`);
    return now.isBetween(visitStart, visitEnd);
  }

  isPlateExpired(plate) {
    const now = moment();
    const validTo = moment(plate.valid_to);
    return now.isAfter(validTo);
  }

  async verifyVisitor(data, operator, gate) {
    const { phone, license_plate, name } = data;
    const now = moment().format();
    const recordId = uuidv4();
    
    const baseRecord = {
      id: recordId,
      verification_type: 'visitor',
      identifier: phone || license_plate,
      name,
      phone,
      license_plate,
      operator,
      gate,
      created_at: now
    };

    const blacklistChecks = [];
    if (phone) blacklistChecks.push(this.checkBlacklist(phone, 'phone'));
    if (license_plate) blacklistChecks.push(this.checkBlacklist(license_plate, 'plate'));
    
    const blacklistResults = await Promise.all(blacklistChecks);
    const inBlacklist = blacklistResults.find(r => r !== null);
    
    if (inBlacklist) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: `黑名单拦截：${inBlacklist.reason}`
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: record.reason,
        recordId,
        maskedPhone: phone ? maskPhone(phone) : null
      };
    }

    const visitor = await this.getVisitorByPhoneOrPlate(phone, license_plate);
    if (!visitor) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: '未找到有效预约记录'
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: '未找到有效预约记录',
        recordId,
        maskedPhone: phone ? maskPhone(phone) : null
      };
    }

    baseRecord.visitor_id = visitor.id;
    baseRecord.name = visitor.name;

    if (this.isExpiredAppointment(visitor)) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: '预约已过期'
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: '预约已过期',
        recordId,
        maskedPhone: maskPhone(visitor.phone),
        visitor: {
          id: visitor.id,
          name: visitor.name,
          visitDate: visitor.visit_date
        }
      };
    }

    if (!this.isWithinValidTime(visitor)) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: `不在预约时段内，有效时间：${visitor.start_time} - ${visitor.end_time}`
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: record.reason,
        recordId,
        maskedPhone: maskPhone(visitor.phone),
        visitor: {
          id: visitor.id,
          name: visitor.name,
          visitDate: visitor.visit_date
        }
      };
    }

    const record = {
      ...baseRecord,
      status: 'passed',
      result: 'passed',
      reason: '核验通过，预约有效且在有效期内'
    };
    await this.createVerificationRecord(record);

    return {
      success: true,
      passed: true,
      reason: record.reason,
      recordId,
      maskedPhone: maskPhone(visitor.phone),
      visitor: {
        id: visitor.id,
        name: visitor.name,
        hostName: visitor.host_name,
        visitPurpose: visitor.visit_purpose,
        visitDate: visitor.visit_date
      }
    };
  }

  async verifyPlate(data, operator, gate) {
    const { plate_number } = data;
    const now = moment().format();
    const recordId = uuidv4();
    
    const baseRecord = {
      id: recordId,
      verification_type: 'plate',
      identifier: plate_number,
      license_plate: plate_number,
      operator,
      gate,
      created_at: now
    };

    const inBlacklist = await this.checkBlacklist(plate_number, 'plate');
    if (inBlacklist) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: `黑名单拦截：${inBlacklist.reason}`
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: record.reason,
        recordId
      };
    }

    const tempPlate = await this.getTemporaryPlate(plate_number);
    if (!tempPlate) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: '未找到有效临时车牌记录'
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: '未找到有效临时车牌记录',
        recordId
      };
    }

    baseRecord.name = tempPlate.driver_name;
    baseRecord.phone = tempPlate.driver_phone;

    if (this.isPlateExpired(tempPlate)) {
      const record = {
        ...baseRecord,
        status: 'blocked',
        result: 'blocked',
        reason: `临时车牌已过期，有效期至：${tempPlate.valid_to}`
      };
      await this.createVerificationRecord(record);
      return {
        success: false,
        blocked: true,
        reason: record.reason,
        recordId
      };
    }

    const record = {
      ...baseRecord,
      status: 'passed',
      result: 'passed',
      reason: '核验通过，临时车牌在有效期内'
    };
    await this.createVerificationRecord(record);

    return {
      success: true,
      passed: true,
      reason: record.reason,
      recordId,
      plate: {
        id: tempPlate.id,
        plateNumber: tempPlate.plate_number,
        validFrom: tempPlate.valid_from,
        validTo: tempPlate.valid_to
      }
    };
  }

  async verifyUnauthorizedRelease(data, operator, gate) {
    const { identifier, reason, type } = data;
    const now = moment().format();
    const recordId = uuidv4();

    const record = {
      id: recordId,
      verification_type: type || 'unauthorized',
      identifier,
      status: 'manual_release',
      result: 'passed',
      reason: `人工放行：${reason}`,
      operator,
      gate,
      created_at: now
    };

    await this.createVerificationRecord(record);

    return {
      success: true,
      passed: true,
      reason: record.reason,
      recordId,
      warning: '此操作已被记录，请确保放行理由充分'
    };
  }

  async createVerificationRecord(record) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(record);
      const placeholders = fields.map(() => '?').join(',');
      const values = fields.map(f => record[f]);
      
      db.run(
        `INSERT INTO verification_records (${fields.join(',')}) VALUES (${placeholders})`,
        values,
        function(err) {
          if (err) reject(err);
          else resolve(record.id);
        }
      );
    });
  }

  async getVerificationRecords(filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `SELECT * FROM verification_records WHERE 1=1`;
      let params = [];

      if (filters.operator) {
        query += ` AND operator = ?`;
        params.push(filters.operator);
      }

      if (filters.status) {
        query += ` AND status = ?`;
        params.push(filters.status);
      }

      if (filters.startTime) {
        query += ` AND created_at >= ?`;
        params.push(filters.startTime);
      }

      if (filters.endTime) {
        query += ` AND created_at <= ?`;
        params.push(filters.endTime);
      }

      if (filters.exceptionType) {
        if (filters.exceptionType === 'blacklist') {
          query += ` AND reason LIKE '%黑名单%'`;
        } else if (filters.exceptionType === 'expired') {
          query += ` AND reason LIKE '%过期%'`;
        } else if (filters.exceptionType === 'no_record') {
          query += ` AND reason LIKE '%未找到%'`;
        } else if (filters.exceptionType === 'unauthorized') {
          query += ` AND reason LIKE '%人工放行%'`;
        }
      }

      if (filters.verificationType) {
        query += ` AND verification_type = ?`;
        params.push(filters.verificationType);
      }

      query += ` ORDER BY created_at DESC`;

      if (filters.limit) {
        query += ` LIMIT ?`;
        params.push(filters.limit);
      }

      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          const masked = rows.map(r => ({
            ...r,
            phone: r.phone ? maskPhone(r.phone) : null
          }));
          resolve(masked);
        }
      });
    });
  }

  async getStatistics(filters = {}) {
    const records = await this.getVerificationRecords(filters);
    const total = records.length;
    const passed = records.filter(r => r.result === 'passed').length;
    const blocked = records.filter(r => r.result === 'blocked').length;
    const manual = records.filter(r => r.status === 'manual_release').length;

    const byOperator = {};
    const byStatus = {};
    const byType = {};

    records.forEach(r => {
      byOperator[r.operator] = (byOperator[r.operator] || 0) + 1;
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
      byType[r.verification_type] = (byType[r.verification_type] || 0) + 1;
    });

    return {
      summary: {
        total,
        passed,
        blocked,
        manualRelease: manual,
        passRate: total > 0 ? ((passed / total) * 100).toFixed(2) + '%' : '0%'
      },
      byOperator,
      byStatus,
      byType
    };
  }
}

module.exports = new VerificationService();
