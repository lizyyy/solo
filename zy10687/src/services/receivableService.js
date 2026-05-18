const { Receivable, FinanceOrder, sequelize } = require('../models');
const HistoryService = require('./historyService');
const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');

class ReceivableService {
  static async createReceivable(data) {
    const { operationSource, operator, operatorId, ...receivableData } = data;
    
    const receivable = await Receivable.create({
      id: uuidv4(),
      ...receivableData,
      status: 'LOCKED',
      operationSource,
      currentOperator: operator
    });

    await HistoryService.createHistory({
      receivableId: receivable.id,
      receivableNo: receivable.receivableNo,
      operationType: '创建',
      operationSource: operationSource || 'WEB',
      operator,
      operatorId,
      oldStatus: null,
      newStatus: 'LOCKED',
      oldData: null,
      newData: receivable.toJSON(),
      remark: '创建应收账款',
      financeFrozen: receivable.financeFrozen
    });

    return receivable;
  }

  static async applyUnlock(id, data) {
    const { operationSource, operator, operatorId, unlockMaterials, remark } = data;
    
    const receivable = await Receivable.findByPk(id);
    if (!receivable) throw new Error('账款不存在');
    if (receivable.status !== 'LOCKED') throw new Error('只有已锁定状态才能申请解锁');

    const oldData = receivable.toJSON();
    
    receivable.status = 'UNLOCK_APPLY';
    receivable.unlockMaterials = unlockMaterials;
    receivable.operationSource = operationSource;
    receivable.currentOperator = operator;
    await receivable.save();

    await HistoryService.createHistory({
      receivableId: receivable.id,
      receivableNo: receivable.receivableNo,
      operationType: '申请解锁',
      operationSource: operationSource || 'WEB',
      operator,
      operatorId,
      oldStatus: 'LOCKED',
      newStatus: 'UNLOCK_APPLY',
      oldData,
      newData: receivable.toJSON(),
      remark: remark || '申请解锁',
      financeFrozen: receivable.financeFrozen
    });

    return receivable;
  }

  static async approveUnlock(id, data) {
    const { operationSource, operator, operatorId, remark } = data;
    
    const receivable = await Receivable.findByPk(id);
    if (!receivable) throw new Error('账款不存在');
    if (receivable.status !== 'UNLOCK_APPLY') throw new Error('只有解锁申请状态才能审核通过');

    const oldData = receivable.toJSON();
    
    receivable.status = 'UNLOCKED';
    receivable.operationSource = operationSource;
    receivable.currentOperator = operator;
    await receivable.save();

    await HistoryService.createHistory({
      receivableId: receivable.id,
      receivableNo: receivable.receivableNo,
      operationType: '审核通过',
      operationSource: operationSource || 'WEB',
      operator,
      operatorId,
      oldStatus: 'UNLOCK_APPLY',
      newStatus: 'UNLOCKED',
      oldData,
      newData: receivable.toJSON(),
      remark: remark || '审核通过解锁',
      financeFrozen: receivable.financeFrozen
    });

    return receivable;
  }

  static async rejectUnlock(id, data) {
    const { operationSource, operator, operatorId, rejectReason, remark } = data;
    
    const receivable = await Receivable.findByPk(id);
    if (!receivable) throw new Error('账款不存在');
    if (receivable.status !== 'UNLOCK_APPLY') throw new Error('只有解锁申请状态才能拒绝');

    const oldData = receivable.toJSON();
    
    receivable.status = 'REJECTED';
    receivable.rejectReason = rejectReason;
    receivable.operationSource = operationSource;
    receivable.currentOperator = operator;
    await receivable.save();

    await HistoryService.createHistory({
      receivableId: receivable.id,
      receivableNo: receivable.receivableNo,
      operationType: '审核拒绝',
      operationSource: operationSource || 'WEB',
      operator,
      operatorId,
      oldStatus: 'UNLOCK_APPLY',
      newStatus: 'REJECTED',
      oldData,
      newData: receivable.toJSON(),
      remark: remark || '审核拒绝解锁',
      financeFrozen: receivable.financeFrozen
    });

    return receivable;
  }

  static async getReceivableById(id) {
    const receivable = await Receivable.findByPk(id);
    if (!receivable) throw new Error('账款不存在');
    return receivable;
  }

  static async getReceivableDetailWithHistory(id) {
    const receivable = await Receivable.findByPk(id);
    if (!receivable) throw new Error('账款不存在');
    
    const histories = await HistoryService.getHistoriesByReceivableId(id);
    
    return {
      ...receivable.toJSON(),
      histories
    };
  }

  static async getReceivableList(params = {}) {
    const { page = 1, pageSize = 20, receivableNo, customerName, status, startDate, endDate } = params;
    const where = {};
    
    if (receivableNo) where.receivableNo = { [Op.like]: `%${receivableNo}%` };
    if (customerName) where.customerName = { [Op.like]: `%${customerName}%` };
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    return await Receivable.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
  }

  static async exportReceivables(params = {}) {
    const { receivableNo, customerName, status, startDate, endDate } = params;
    const where = {};
    
    if (receivableNo) where.receivableNo = { [Op.like]: `%${receivableNo}%` };
    if (customerName) where.customerName = { [Op.like]: `%${customerName}%` };
    if (status) where.status = status;
    if (startDate && endDate) {
      where.createdAt = { [Op.between]: [startDate, endDate] };
    }

    const receivables = await Receivable.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const result = [];
    for (const receivable of receivables) {
      const histories = await HistoryService.getHistoriesByReceivableId(receivable.id);
      result.push({
        ...receivable.toJSON(),
        histories: histories.map(h => h.toJSON()),
        hasFrozenFinance: receivable.financeFrozen
      });
    }
    
    return result;
  }
}

module.exports = ReceivableService;