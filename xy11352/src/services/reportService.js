const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const moment = require('moment');
const { OperationLogger } = require('../utils/logger');
const SecurityUtils = require('../utils/security');
const db = require('../models/database');

class ReportService {
  static async generateVerificationReport(options = {}) {
    const records = await OperationLogger.getVerificationRecords({
      startDate: options.startDate,
      endDate: options.endDate,
      limit: 5000
    });
    
    const data = records.map(record => ({
      时间: record.created_at,
      核验类型: record.verify_type === 'phone' ? '手机号' : '车牌',
      标识: this.maskIdentifier(record.verify_type, record.identifier),
      结果: record.result === 'success' ? '通过' : record.result === 'forced' ? '人工放行' : '拦截',
      操作: this.translateAction(record.action),
      原因: record.reason,
      门岗: record.gate || '-',
      操作员: record.operator_name || '-'
    }));
    
    return data;
  }

  static async generateAppointmentReport(options = {}) {
    let sql = 'SELECT * FROM appointments WHERE 1=1';
    const params = [];
    
    if (options.startDate) {
      sql += ' AND visit_date >= ?';
      params.push(options.startDate);
    }
    if (options.endDate) {
      sql += ' AND visit_date <= ?';
      params.push(options.endDate);
    }
    
    sql += ' ORDER BY created_at DESC LIMIT 5000';
    const records = await db.all(sql, params);
    
    const data = records.map(record => ({
      创建时间: record.created_at,
      访客姓名: record.visitor_name,
      访客手机: SecurityUtils.maskPhone(record.visitor_phone),
      车牌号: record.plate_number || '-',
      访问日期: record.visit_date,
      开始时间: record.start_time,
      结束时间: record.end_time,
      状态: this.translateStatus(record.status),
      审批人: record.approved_by || '-',
      门岗: record.gate || '-',
      备注: record.notes || '-'
    }));
    
    return data;
  }

  static async generateBlacklistReport(options = {}) {
    let sql = 'SELECT * FROM blacklist WHERE 1=1';
    const params = [];
    
    if (options.is_active !== undefined) {
      sql += ' AND is_active = ?';
      params.push(options.is_active ? 1 : 0);
    }
    
    sql += ' ORDER BY added_at DESC LIMIT 5000';
    const records = await db.all(sql, params);
    
    const data = records.map(record => ({
      添加时间: record.added_at,
      类型: record.type === 'phone' ? '手机号' : record.type === 'plate' ? '车牌' : '身份证',
      值: this.maskIdentifier(record.type, record.value),
      原因: record.reason,
      添加人: record.added_by,
      过期时间: record.expires_at || '永久',
      状态: record.is_active ? '有效' : '已移除',
      备注: record.notes || '-'
    }));
    
    return data;
  }

  static async generateDailyReport(date) {
    const targetDate = date || moment().format('YYYY-MM-DD');
    const startOfDay = `${targetDate} 00:00:00`;
    const endOfDay = `${targetDate} 23:59:59`;
    
    const verifications = await OperationLogger.getVerificationRecords({
      startDate: startOfDay,
      endDate: endOfDay,
      limit: 10000
    });
    
    const appointments = await db.all(
      'SELECT * FROM appointments WHERE visit_date = ? ORDER BY created_at DESC',
      [targetDate]
    );
    
    const report = {
      date: targetDate,
      generated_at: moment().format('YYYY-MM-DD HH:mm:ss'),
      summary: {
        totalVerifications: verifications.length,
        passedVerifications: verifications.filter(r => r.result === 'success').length,
        blockedVerifications: verifications.filter(r => r.result === 'failed').length,
        forcedVerifications: verifications.filter(r => r.result === 'forced').length,
        totalAppointments: appointments.length,
        approvedAppointments: appointments.filter(a => a.status === 'approved').length,
        pendingAppointments: appointments.filter(a => a.status === 'pending').length,
        cancelledAppointments: appointments.filter(a => a.status === 'cancelled').length
      },
      topBlockReasons: this.getTopBlockReasons(verifications, 5),
      busiestGates: this.getBusiestGates(verifications)
    };
    
    report.summary.successRate = report.summary.totalVerifications > 0 
      ? ((report.summary.passedVerifications / report.summary.totalVerifications) * 100).toFixed(2) + '%' 
      : '0%';
    
    return report;
  }

  static exportToCSV(data, filename) {
    try {
      const parser = new Parser();
      const csv = parser.parse(data);
      
      const exportsDir = path.join(process.cwd(), 'exports');
      if (!fs.existsSync(exportsDir)) {
        fs.mkdirSync(exportsDir, { recursive: true });
      }
      
      const filePath = path.join(exportsDir, filename);
      fs.writeFileSync(filePath, '\ufeff' + csv, 'utf8');
      
      return { success: true, filePath, filename };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async exportVerificationReport(startDate, endDate) {
    const data = await this.generateVerificationReport({ startDate, endDate });
    const filename = `核验记录_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    return this.exportToCSV(data, filename);
  }

  static async exportAppointmentReport(startDate, endDate) {
    const data = await this.generateAppointmentReport({ startDate, endDate });
    const filename = `预约记录_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    return this.exportToCSV(data, filename);
  }

  static async exportBlacklistReport() {
    const data = await this.generateBlacklistReport({ is_active: true });
    const filename = `黑名单_${moment().format('YYYYMMDD_HHmmss')}.csv`;
    return this.exportToCSV(data, filename);
  }

  static maskIdentifier(type, value) {
    if (!value) return '-';
    if (type === 'phone') {
      return SecurityUtils.maskPhone(value);
    }
    if (type === 'id_card') {
      return SecurityUtils.maskIdCard(value);
    }
    return value;
  }

  static translateAction(action) {
    const actions = {
      'allow': '放行',
      'block': '拦截',
      'force_allow': '人工放行'
    };
    return actions[action] || action;
  }

  static translateStatus(status) {
    const statuses = {
      'pending': '待审批',
      'approved': '已通过',
      'cancelled': '已取消',
      'active': '有效',
      'revoked': '已吊销'
    };
    return statuses[status] || status;
  }

  static getTopBlockReasons(records, limit = 5) {
    const blocked = records.filter(r => r.action === 'block');
    const reasons = {};
    
    blocked.forEach(record => {
      const key = record.reason.split('：')[0];
      reasons[key] = (reasons[key] || 0) + 1;
    });
    
    return Object.entries(reasons)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([reason, count]) => ({ reason, count }));
  }

  static getBusiestGates(records) {
    const gates = {};
    
    records.forEach(record => {
      if (record.gate) {
        gates[record.gate] = (gates[record.gate] || 0) + 1;
      }
    });
    
    return Object.entries(gates)
      .sort((a, b) => b[1] - a[1])
      .map(([gate, count]) => ({ gate, count }));
  }
}

module.exports = ReportService;
