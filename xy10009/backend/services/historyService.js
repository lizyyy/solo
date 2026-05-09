const { HistoryRecord } = require('../models');

const historyService = {
  async createRecord(data) {
    try {
      const record = await HistoryRecord.create({
        module: data.module,
        action: data.action,
        entityId: data.entityId,
        entityType: data.entityType,
        entityName: data.entityName,
        oldValue: data.oldValue ? JSON.stringify(data.oldValue) : null,
        newValue: data.newValue ? JSON.stringify(data.newValue) : null,
        changedBy: data.changedBy || null,
        changedByName: data.changedByName || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
        remark: data.remark || null
      });
      return record;
    } catch (error) {
      console.error('记录历史记录失败:', error);
      return null;
    }
  },

  async logCreate(entity, user, req) {
    return this.createRecord({
      module: this.getModuleByEntity(entity.constructor.name),
      action: 'create',
      entityId: entity.id,
      entityType: entity.constructor.name,
      entityName: entity.name || entity.username || entity.taskNo || entity.id,
      newValue: entity.toJSON(),
      changedBy: user ? user.id : null,
      changedByName: user ? user.fullName : null,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null
    });
  },

  async logUpdate(oldEntity, newEntity, user, req, remark = '') {
    return this.createRecord({
      module: this.getModuleByEntity(oldEntity.constructor.name),
      action: 'update',
      entityId: oldEntity.id,
      entityType: oldEntity.constructor.name,
      entityName: newEntity.name || newEntity.username || newEntity.taskNo || newEntity.id,
      oldValue: oldEntity.toJSON(),
      newValue: newEntity.toJSON(),
      changedBy: user ? user.id : null,
      changedByName: user ? user.fullName : null,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null,
      remark: remark
    });
  },

  async logDelete(entity, user, req) {
    return this.createRecord({
      module: this.getModuleByEntity(entity.constructor.name),
      action: 'delete',
      entityId: entity.id,
      entityType: entity.constructor.name,
      entityName: entity.name || entity.username || entity.taskNo || entity.id,
      oldValue: entity.toJSON(),
      changedBy: user ? user.id : null,
      changedByName: user ? user.fullName : null,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null
    });
  },

  async logAction(action, entity, user, req, remark = '') {
    return this.createRecord({
      module: this.getModuleByEntity(entity.constructor.name),
      action: action,
      entityId: entity.id,
      entityType: entity.constructor.name,
      entityName: entity.name || entity.username || entity.taskNo || entity.id,
      newValue: entity.toJSON(),
      changedBy: user ? user.id : null,
      changedByName: user ? user.fullName : null,
      ipAddress: req ? req.ip : null,
      userAgent: req ? req.get('User-Agent') : null,
      remark: remark
    });
  },

  getModuleByEntity(entityName) {
    const map = {
      User: 'user',
      Warehouse: 'warehouse',
      Product: 'product',
      Inventory: 'inventory',
      CountTask: 'count_task',
      CountDetail: 'count_detail'
    };
    return map[entityName] || 'other';
  }
};

module.exports = historyService;