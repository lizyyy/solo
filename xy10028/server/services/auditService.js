const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const auditService = {
  async createLog({ inventoryId, userId, operationType, requestId, beforeState, afterState, changeDetails, transaction }) {
    return await db.OperationLog.create({
      id: uuidv4(),
      inventoryId,
      userId,
      operationType,
      requestId,
      beforeState: JSON.stringify(beforeState),
      afterState: JSON.stringify(afterState),
      changeDetails: JSON.stringify(changeDetails),
      status: 'SUCCESS',
      operationAt: new Date()
    }, { transaction });
  },

  async createPendingLog({ inventoryId, userId, operationType, requestId, beforeState, transaction }) {
    return await db.OperationLog.create({
      id: uuidv4(),
      inventoryId,
      userId,
      operationType,
      requestId,
      beforeState: JSON.stringify(beforeState),
      afterState: JSON.stringify({}),
      changeDetails: JSON.stringify({}),
      status: 'PENDING',
      operationAt: new Date()
    }, { transaction });
  },

  async completeLog(logId, afterState, changeDetails, transaction) {
    const log = await db.OperationLog.findByPk(logId);
    if (log) {
      return await log.update({
        afterState: JSON.stringify(afterState),
        changeDetails: JSON.stringify(changeDetails),
        status: 'SUCCESS'
      }, { transaction });
    }
    return log;
  },

  async failLog(logId, errorMessage, transaction) {
    const log = await db.OperationLog.findByPk(logId);
    if (log) {
      return await log.update({
        status: 'FAILED',
        errorMessage
      }, { transaction });
    }
    return log;
  },

  async getLogsByInventory(inventoryId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    return await db.OperationLog.findAndCountAll({
      where: { inventoryId },
      include: [{
        model: db.User,
        attributes: ['id', 'name', 'username']
      }],
      order: [['sequence', 'DESC']],
      limit,
      offset
    });
  },

  async getLogsByDateRange(startDate, endDate, options = {}) {
    const { operationType, status, limit = 100, offset = 0 } = options;
    const where = {
      operationAt: {
        [db.Sequelize.Op.between]: [startDate, endDate]
      }
    };
    if (operationType) where.operationType = operationType;
    if (status) where.status = status;

    return await db.OperationLog.findAndCountAll({
      where,
      include: [
        { model: db.User, attributes: ['id', 'name', 'username'] },
        { model: db.Inventory, include: [{ model: db.Product }, { model: db.Store }] }
      ],
      order: [['sequence', 'DESC']],
      limit,
      offset
    });
  },

  async getOperationById(logId) {
    return await db.OperationLog.findByPk(logId, {
      include: [
        { model: db.User, attributes: ['id', 'name', 'username'] },
        { model: db.Inventory, include: [{ model: db.Product }, { model: db.Store }] }
      ]
    });
  },

  async replayOperation(logId) {
    const log = await this.getOperationById(logId);
    if (!log) {
      throw new Error('操作记录不存在');
    }

    const beforeState = JSON.parse(log.beforeState);
    const afterState = JSON.parse(log.afterState);
    const changeDetails = JSON.parse(log.changeDetails);

    return {
      log,
      beforeState,
      afterState,
      changeDetails,
      replayInfo: {
        operationType: log.operationType,
        operator: log.User?.name,
        operationTime: log.operationAt,
        status: log.status
      }
    };
  }
};

module.exports = auditService;
