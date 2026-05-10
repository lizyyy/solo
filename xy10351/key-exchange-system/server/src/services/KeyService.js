const { Key, ExchangeRecord, AuditLog, Order } = require('../models');
const moment = require('moment');
const { Op } = require('sequelize');

class KeyService {
  async getAllKeys() {
    return await Key.findAll({
      order: [['cabinetNumber', 'ASC']],
    });
  }

  async getKeyById(id) {
    return await Key.findByPk(id);
  }

  async createKey(keyData, operator) {
    const key = await Key.create(keyData);
    
    await AuditLog.create({
      action: 'CREATE',
      entityType: 'Key',
      entityId: key.id,
      operator: operator.name,
      oldValue: null,
      newValue: JSON.stringify(keyData),
    });
    
    return key;
  }

  async updateKey(id, keyData, operator) {
    const key = await Key.findByPk(id);
    if (!key) throw new Error('钥匙不存在');
    
    const oldValue = JSON.stringify(key.toJSON());
    await key.update(keyData);
    const newValue = JSON.stringify(key.toJSON());
    
    await AuditLog.create({
      action: 'UPDATE',
      entityType: 'Key',
      entityId: id,
      operator: operator.name,
      oldValue,
      newValue,
    });
    
    return key;
  }

  async getActiveRecord(keyId) {
    return await ExchangeRecord.findOne({
      where: {
        keyId,
        status: 'active',
      },
      order: [['timestamp', 'DESC']],
    });
  }

  async checkKeyAvailable(keyId) {
    const key = await this.getKeyById(keyId);
    if (!key) throw new Error('钥匙不存在');
    
    if (key.status === 'maintenance') {
      throw new Error('钥匙正在维护中，无法领取');
    }
    
    const activeRecord = await this.getActiveRecord(keyId);
    if (activeRecord) {
      throw new Error('钥匙当前已被领取，无法重复领取');
    }
    
    return true;
  }

  async pickUpKey(keyId, operator, orderId = null, expectedReturnTime = null, remarks = '') {
    const key = await this.getKeyById(keyId);
    if (!key) throw new Error('钥匙不存在');
    
    await this.checkKeyAvailable(keyId);
    
    if (!orderId && operator.role === 'cleaner') {
      throw new Error('保洁员领取钥匙必须关联订单');
    }
    
    let order = null;
    if (orderId) {
      order = await Order.findByPk(orderId);
      if (!order) throw new Error('订单不存在');
      if (order.status === 'completed' || order.status === 'cancelled') {
        throw new Error('订单已完成或取消，无法领取钥匙');
      }
      if (order.cleanerName !== operator.name && operator.role === 'cleaner') {
        throw new Error('只能领取自己负责订单的钥匙');
      }
    }
    
    const expectedReturn = expectedReturnTime || 
      (order ? moment(order.scheduledDate).add(4, 'hours').toDate() : 
       moment().add(2, 'hours').toDate());
    
    const record = await ExchangeRecord.create({
      keyId,
      orderId,
      type: orderId ? 'pickup' : 'temporary_borrow',
      operator: operator.name,
      operatorRole: operator.role,
      expectedReturnTime: expectedReturn,
      remarks,
      status: 'active',
    });
    
    const oldValue = JSON.stringify(key.toJSON());
    await key.update({
      status: 'in_use',
      updatedAt: new Date(),
    });
    const newValue = JSON.stringify(key.toJSON());
    
    await AuditLog.create({
      action: 'PICKUP',
      entityType: 'Key',
      entityId: keyId,
      operator: operator.name,
      oldValue,
      newValue,
      remarks: `领取记录ID: ${record.id}`,
    });
    
    return { key, record };
  }

  async returnKey(keyId, operator, remarks = '') {
    const key = await this.getKeyById(keyId);
    if (!key) throw new Error('钥匙不存在');
    
    const activeRecord = await this.getActiveRecord(keyId);
    if (!activeRecord) {
      throw new Error('钥匙当前不在借出状态，无法归还');
    }
    
    const now = new Date();
    let isOverdue = false;
    let finalRemarks = remarks;
    
    if (activeRecord.expectedReturnTime && now > activeRecord.expectedReturnTime) {
      isOverdue = true;
      if (!remarks) {
        throw new Error('超时归还必须填写备注说明');
      }
      const overdueHours = moment(now).diff(activeRecord.expectedReturnTime, 'hours');
      finalRemarks = `${remarks} (超时${overdueHours}小时)`;
    }
    
    const oldRecordValue = JSON.stringify(activeRecord.toJSON());
    await activeRecord.update({
      actualReturnTime: now,
      isOverdue,
      remarks: finalRemarks,
      status: 'completed',
      updatedAt: now,
    });
    const newRecordValue = JSON.stringify(activeRecord.toJSON());
    
    await AuditLog.create({
      action: 'RETURN',
      entityType: 'ExchangeRecord',
      entityId: activeRecord.id,
      operator: operator.name,
      oldValue: oldRecordValue,
      newValue: newRecordValue,
      remarks: isOverdue ? '超时归还' : '正常归还',
    });
    
    const oldKeyValue = JSON.stringify(key.toJSON());
    await key.update({
      status: 'available',
      updatedAt: now,
    });
    const newKeyValue = JSON.stringify(key.toJSON());
    
    await AuditLog.create({
      action: 'RETURN',
      entityType: 'Key',
      entityId: keyId,
      operator: operator.name,
      oldValue: oldKeyValue,
      newValue: newKeyValue,
      remarks: isOverdue ? '钥匙归还（超时）' : '钥匙归还（正常）',
    });
    
    return { key, record: activeRecord, isOverdue };
  }

  async cancelRecord(recordId, operator, reason) {
    const record = await ExchangeRecord.findByPk(recordId);
    if (!record) throw new Error('记录不存在');
    
    if (record.status !== 'active') {
      throw new Error('只能取消进行中的记录');
    }
    
    const oldValue = JSON.stringify(record.toJSON());
    await record.update({
      status: 'cancelled',
      remarks: `取消原因: ${reason}`,
      updatedAt: new Date(),
    });
    const newValue = JSON.stringify(record.toJSON());
    
    await AuditLog.create({
      action: 'CANCEL',
      entityType: 'ExchangeRecord',
      entityId: recordId,
      operator: operator.name,
      oldValue,
      newValue,
      remarks: reason,
    });
    
    const key = await this.getKeyById(record.keyId);
    if (key) {
      const oldKeyValue = JSON.stringify(key.toJSON());
      await key.update({
        status: 'available',
        updatedAt: new Date(),
      });
      const newKeyValue = JSON.stringify(key.toJSON());
      
      await AuditLog.create({
        action: 'CANCEL_RELATED',
        entityType: 'Key',
        entityId: key.id,
        operator: operator.name,
        oldValue: oldKeyValue,
        newValue: newKeyValue,
        remarks: '因记录取消，钥匙状态恢复为可用',
      });
    }
    
    return record;
  }

  async modifyRecord(recordId, operator, newData, reason) {
    const oldRecord = await ExchangeRecord.findByPk(recordId);
    if (!oldRecord) throw new Error('记录不存在');
    
    const oldValue = JSON.stringify(oldRecord.toJSON());
    
    const newRecord = await ExchangeRecord.create({
      ...oldRecord.toJSON(),
      id: undefined,
      ...newData,
      status: 'modified',
      relatedRecordId: recordId,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    
    await oldRecord.update({
      status: 'modified',
      relatedRecordId: newRecord.id,
      updatedAt: new Date(),
    });
    
    await AuditLog.create({
      action: 'MODIFY',
      entityType: 'ExchangeRecord',
      entityId: recordId,
      operator: operator.name,
      oldValue,
      newValue: JSON.stringify(newRecord.toJSON()),
      remarks: reason,
    });
    
    return { oldRecord, newRecord };
  }

  async getKeyHistory(keyId) {
    return await ExchangeRecord.findAll({
      where: { keyId },
      order: [['timestamp', 'DESC']],
      include: [{ model: Order, attributes: ['orderNumber', 'serviceType'] }],
    });
  }

  async getOverdueKeys() {
    const now = new Date();
    const overdueRecords = await ExchangeRecord.findAll({
      where: {
        status: 'active',
        expectedReturnTime: { [Op.lt]: now },
      },
      include: [{ model: Key }, { model: Order }],
    });
    
    for (const record of overdueRecords) {
      if (record.Key) {
        await record.Key.update({ status: 'overdue' });
      }
    }
    
    return await Key.findAll({
      where: { status: 'overdue' },
      include: [{ 
        model: ExchangeRecord, 
        where: { status: 'active' },
        required: true,
        include: [{ model: Order }]
      }],
    });
  }
}

module.exports = new KeyService();
