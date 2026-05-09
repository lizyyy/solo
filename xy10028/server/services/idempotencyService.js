const { v4: uuidv4 } = require('uuid');
const db = require('../models');

const idempotencyService = {
  async registerRequest(requestId, operationType, payload, userId, transaction) {
    try {
      return await db.OperationRequest.create({
        id: uuidv4(),
        requestId,
        operationType,
        payload: JSON.stringify(payload),
        status: 'PENDING',
        userId
      }, { transaction });
    } catch (error) {
      if (error.name === 'SequelizeUniqueConstraintError') {
        const existing = await db.OperationRequest.findOne({ where: { requestId } });
        return existing;
      }
      throw error;
    }
  },

  async isRequestProcessed(requestId) {
    const request = await db.OperationRequest.findOne({ where: { requestId } });
    if (!request) {
      return { processed: false };
    }
    
    if (request.status === 'COMPLETED') {
      return {
        processed: true,
        result: request.result ? JSON.parse(request.result) : null,
        isDuplicate: false
      };
    }
    
    if (request.status === 'DUPLICATE') {
      return {
        processed: true,
        result: request.result ? JSON.parse(request.result) : null,
        isDuplicate: true
      };
    }
    
    if (request.status === 'PROCESSING') {
      return {
        processed: false,
        isProcessing: true
      };
    }
    
    return { processed: false };
  },

  async markProcessing(requestId, transaction) {
    return await db.OperationRequest.update(
      { status: 'PROCESSING' },
      { where: { requestId }, transaction }
    );
  },

  async markCompleted(requestId, result, transaction) {
    return await db.OperationRequest.update(
      {
        status: 'COMPLETED',
        result: JSON.stringify(result),
        completedAt: new Date()
      },
      { where: { requestId }, transaction }
    );
  },

  async markDuplicate(requestId, existingResult, transaction) {
    return await db.OperationRequest.update(
      {
        status: 'DUPLICATE',
        result: JSON.stringify(existingResult),
        completedAt: new Date()
      },
      { where: { requestId }, transaction }
    );
  },

  async cleanupOldRequests(days = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);
    
    return await db.OperationRequest.destroy({
      where: {
        createdAt: {
          [db.Sequelize.Op.lt]: cutoffDate
        },
        status: ['COMPLETED', 'DUPLICATE']
      }
    });
  }
};

module.exports = idempotencyService;
