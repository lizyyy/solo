const { AuditLog, Key, Order, ExchangeRecord } = require('../models');
const { Parser } = require('json2csv');
const { Op } = require('sequelize');
const moment = require('moment');

class AuditService {
  async getAllAuditLogs(filters = {}) {
    const where = {};
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.action) where.action = filters.action;
    if (filters.startDate) where.timestamp = { [Op.gte]: filters.startDate };
    if (filters.endDate) {
      where.timestamp = { ...where.timestamp, [Op.lte]: filters.endDate };
    }

    return await AuditLog.findAll({
      where,
      order: [['timestamp', 'DESC']],
    });
  }

  async getAuditTrail(entityType, entityId) {
    return await AuditLog.findAll({
      where: {
        entityType,
        entityId,
      },
      order: [['timestamp', 'ASC']],
    });
  }

  async getExchangeHistory(keyId = null, orderId = null, operator = null) {
    const where = {};
    if (keyId) where.keyId = keyId;
    if (orderId) where.orderId = orderId;
    if (operator) where.operator = operator;

    return await ExchangeRecord.findAll({
      where,
      include: [
        { model: Key, attributes: ['keyCode', 'customerName', 'address', 'cabinetNumber'] },
        { model: Order, attributes: ['orderNumber', 'serviceType'] }
      ],
      order: [['timestamp', 'DESC']],
    });
  }

  async exportAuditReport(format = 'csv', filters = {}) {
    const logs = await this.getAllAuditLogs(filters);
    
    if (format === 'csv') {
      const fields = [
        'timestamp',
        'action',
        'entityType',
        'entityId',
        'operator',
        'oldValue',
        'newValue',
        'remarks'
      ];
      
      const json2csvParser = new Parser({ fields });
      return json2csvParser.parse(logs.map(log => ({
        ...log.toJSON(),
        timestamp: moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        oldValue: log.oldValue ? this._formatJSON(log.oldValue) : '-',
        newValue: log.newValue ? this._formatJSON(log.newValue) : '-',
      })));
    }
    
    return JSON.stringify(logs, null, 2);
  }

  async exportKeyTimeline(keyId) {
    const key = await Key.findByPk(keyId);
    if (!key) throw new Error('钥匙不存在');
    
    const history = await this.getExchangeHistory(keyId);
    const auditTrail = await this.getAuditTrail('Key', keyId);
    
    const timeline = [];
    
    for (const record of history) {
      timeline.push({
        time: moment(record.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        type: record.type === 'pickup' ? '领取' : record.type === 'return' ? '归还' : '临时借用',
        operator: record.operator,
        operatorRole: record.operatorRole,
        orderNumber: record.Order?.orderNumber || '-',
        remarks: record.remarks || '-',
        status: record.status,
      });
    }
    
    for (const log of auditTrail) {
      timeline.push({
        time: moment(log.timestamp).format('YYYY-MM-DD HH:mm:ss'),
        type: '审计记录',
        action: log.action,
        operator: log.operator,
        remarks: log.remarks || '-',
        oldValue: log.oldValue ? this._formatJSON(log.oldValue) : '-',
        newValue: log.newValue ? this._formatJSON(log.newValue) : '-',
      });
    }
    
    timeline.sort((a, b) => moment(a.time).diff(moment(b.time)));
    
    return {
      keyInfo: {
        keyCode: key.keyCode,
        customerName: key.customerName,
        address: key.address,
        cabinetNumber: key.cabinetNumber,
        currentStatus: key.status,
      },
      timeline,
    };
  }

  async getStatusDiff(entityType, entityId) {
    const auditTrail = await this.getAuditTrail(entityType, entityId);
    
    const diffs = [];
    for (let i = 1; i < auditTrail.length; i++) {
      const prev = auditTrail[i - 1];
      const curr = auditTrail[i];
      
      diffs.push({
        timestamp: curr.timestamp,
        operator: curr.operator,
        action: curr.action,
        oldValue: prev.newValue,
        newValue: curr.newValue,
        remarks: curr.remarks,
      });
    }
    
    return diffs;
  }

  _formatJSON(jsonString) {
    try {
      const obj = JSON.parse(jsonString);
      return Object.entries(obj)
        .filter(([key]) => !['id', 'createdAt', 'updatedAt'].includes(key))
        .map(([key, value]) => `${key}: ${value}`)
        .join('; ');
    } catch {
      return jsonString;
    }
  }
}

module.exports = new AuditService();
