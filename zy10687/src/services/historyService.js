const { ReceivableHistory } = require('../models');
const { v4: uuidv4 } = require('uuid');

class HistoryService {
  static async createHistory(data) {
    return await ReceivableHistory.create({
      id: uuidv4(),
      ...data
    });
  }

  static async getHistoriesByReceivableId(receivableId) {
    return await ReceivableHistory.findAll({
      where: { receivableId },
      order: [['createdAt', 'DESC']]
    });
  }

  static async getHistoriesByReceivableNo(receivableNo) {
    return await ReceivableHistory.findAll({
      where: { receivableNo },
      order: [['createdAt', 'DESC']]
    });
  }

  static async getAllHistories(params = {}) {
    const { page = 1, pageSize = 20, receivableNo, operationType, operator, startDate, endDate } = params;
    const where = {};
    
    if (receivableNo) where.receivableNo = receivableNo;
    if (operationType) where.operationType = operationType;
    if (operator) where.operator = operator;
    if (startDate && endDate) {
      where.createdAt = { [require('sequelize').Op.between]: [startDate, endDate] };
    }

    return await ReceivableHistory.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });
  }
}

module.exports = HistoryService;