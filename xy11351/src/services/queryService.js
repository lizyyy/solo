const { sequelize, Op } = require('sequelize');
const { PrintBatch, LabRecord, QualityOrder, ReworkRecord, PaperBatch } = require('../models');

class QueryService {
  async queryPrintBatches(params = {}) {
    const { 
      batchNo, 
      productName, 
      responsible, 
      status, 
      exceptionType, 
      paperBatchNo,
      startDate, 
      endDate,
      page = 1,
      pageSize = 20
    } = params;

    const where = {};
    
    if (batchNo) {
      where.batchNo = { [Op.like]: `%${batchNo}%` };
    }
    if (productName) {
      where.productName = { [Op.like]: `%${productName}%` };
    }
    if (responsible) {
      where.responsible = responsible;
    }
    if (status) {
      where.status = status;
    }
    if (exceptionType) {
      where.exceptionType = { [Op.like]: `%${exceptionType}%` };
    }
    if (paperBatchNo) {
      where.paperBatchNo = paperBatchNo;
    }
    if (startDate && endDate) {
      where.printDate = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await PrintBatch.findAndCountAll({
      where,
      include: [
        { model: LabRecord, as: 'labRecords', limit: 10 },
        { model: QualityOrder, as: 'qualityOrders', limit: 1 },
        { model: ReworkRecord, as: 'reworkRecords' }
      ],
      order: [['printDate', 'DESC'], ['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize),
      data: rows
    };
  }

  async getPrintBatchDetail(id) {
    const printBatch = await PrintBatch.findByPk(id, {
      include: [
        { model: LabRecord, as: 'labRecords' },
        { model: QualityOrder, as: 'qualityOrders' },
        { model: ReworkRecord, as: 'reworkRecords' }
      ]
    });

    if (!printBatch) {
      throw new Error('印刷批次不存在');
    }

    return printBatch;
  }

  async queryPaperBatches(params = {}) {
    const { batchNo, paperType, supplier, startDate, endDate, page = 1, pageSize = 20 } = params;

    const where = {};
    
    if (batchNo) {
      where.batchNo = { [Op.like]: `%${batchNo}%` };
    }
    if (paperType) {
      where.paperType = { [Op.like]: `%${paperType}%` };
    }
    if (supplier) {
      where.supplier = { [Op.like]: `%${supplier}%` };
    }
    if (startDate && endDate) {
      where.receiveDate = { [Op.between]: [startDate, endDate] };
    }

    const { count, rows } = await PaperBatch.findAndCountAll({
      where,
      include: [{ model: PrintBatch, as: 'printBatches', limit: 5 }],
      order: [['receiveDate', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      total: count,
      page: parseInt(page),
      pageSize: parseInt(pageSize),
      totalPages: Math.ceil(count / pageSize),
      data: rows
    };
  }

  async getResponsibleList() {
    const result = await PrintBatch.findAll({
      attributes: ['responsible'],
      where: {
        responsible: { [Op.not]: null }
      },
      group: ['responsible'],
      raw: true
    });

    return result.map(r => r.responsible).filter(Boolean);
  }

  async getStatusStats() {
    const result = await PrintBatch.findAll({
      attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
      group: ['status'],
      raw: true
    });

    return result;
  }
}

module.exports = new QueryService();
