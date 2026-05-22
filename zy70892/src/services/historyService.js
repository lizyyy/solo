const { ProcessHistory, RepairRecord, Batch, Defect } = require('../models');
const { Op } = require('sequelize');

class HistoryService {
  static async addHistory(recordId, action, operator, options = {}) {
    const { previousStatus, newStatus, reason, remark } = options;
    return await ProcessHistory.create({
      recordId,
      action,
      previousStatus,
      newStatus,
      reason,
      operator,
      operatedAt: new Date(),
      remark
    });
  }

  static async getHistoriesByRecordId(recordId) {
    return await ProcessHistory.findAll({
      where: { recordId },
      order: [['operatedAt', 'DESC']]
    });
  }

  static async getAllHistories(options = {}) {
    const { page = 1, pageSize = 20, operator, action, workstation, defectType, batchNo, startDate, endDate } = options;
    
    const recordIds = await this.getFilteredRecordIds({ workstation, defectType, batchNo });
    
    const where = {};
    
    if (operator) where.operator = operator;
    if (action) where.action = action;
    if (startDate && endDate) {
      where.operatedAt = { [Op.between]: [new Date(startDate), new Date(endDate)] };
    }
    if (recordIds.length > 0) {
      where.recordId = { [Op.in]: recordIds };
    }

    return await ProcessHistory.findAndCountAll({
      where,
      limit: Number(pageSize),
      offset: (Number(page) - 1) * Number(pageSize),
      order: [['operatedAt', 'DESC']]
    });
  }

  static async getFilteredRecordIds({ workstation, defectType, batchNo }) {
    if (!workstation && !defectType && !batchNo) {
      return [];
    }

    const recordIds = new Set();

    if (workstation) {
      const repairRecords = await RepairRecord.findAll({
        where: { workstation },
        attributes: ['id']
      });
      repairRecords.forEach(r => recordIds.add(r.id));

      const batches = await Batch.findAll({
        where: { workstation },
        attributes: ['id']
      });
      batches.forEach(b => recordIds.add(b.id));

      const defects = await Defect.findAll({
        where: {
          [Op.or]: [
            { workstation },
            { responsibleStation: workstation }
          ]
        },
        attributes: ['id']
      });
      defects.forEach(d => recordIds.add(d.id));

      const repairRecordsFromBatch = await RepairRecord.findAll({
        include: [{
          model: Batch,
          as: 'batch',
          where: { workstation },
          attributes: []
        }],
        attributes: ['id']
      });
      repairRecordsFromBatch.forEach(r => recordIds.add(r.id));

      const defectsFromBatch = await Defect.findAll({
        include: [{
          model: Batch,
          as: 'batch',
          where: { workstation },
          attributes: []
        }],
        attributes: ['id']
      });
      defectsFromBatch.forEach(d => recordIds.add(d.id));
    }

    if (defectType) {
      const defects = await Defect.findAll({
        where: { defectType: { [Op.like]: `%${defectType}%` } },
        attributes: ['id', 'repairRecordId']
      });
      defects.forEach(d => {
        recordIds.add(d.id);
        if (d.repairRecordId) recordIds.add(d.repairRecordId);
      });
    }

    if (batchNo) {
      const batches = await Batch.findAll({
        where: { batchNo: { [Op.like]: `%${batchNo}%` } },
        attributes: ['id']
      });
      batches.forEach(b => recordIds.add(b.id));

      const batchIds = batches.map(b => b.id);
      
      const repairRecords = await RepairRecord.findAll({
        where: { batchId: { [Op.in]: batchIds } },
        attributes: ['id']
      });
      repairRecords.forEach(r => recordIds.add(r.id));

      const defects = await Defect.findAll({
        where: { batchId: { [Op.in]: batchIds } },
        attributes: ['id']
      });
      defects.forEach(d => recordIds.add(d.id));
    }

    return Array.from(recordIds);
  }
}

module.exports = HistoryService;
