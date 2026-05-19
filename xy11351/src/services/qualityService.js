const { sequelize, PrintBatch, LabRecord, QualityOrder, ReworkRecord } = require('../models');
const { STATUS, QUALITY_LEVEL, LAB_TOLERANCE } = require('../config');
const { calculateLabDelta } = require('./validationService');

class QualityService {
  async determineQuality(printBatchId, checker) {
    const printBatch = await PrintBatch.findByPk(printBatchId);
    if (!printBatch) {
      throw new Error('印刷批次不存在');
    }

    const labRecords = await LabRecord.findAll({
      where: { printBatchId }
    });

    if (labRecords.length === 0) {
      throw new Error('该批次暂无Lab检测记录');
    }

    const transaction = await sequelize.transaction();
    try {
      const totalCount = labRecords.length;
      const passedCount = labRecords.filter(r => r.isPassed).length;
      const passRate = parseFloat((passedCount / totalCount * 100).toFixed(2));

      const avgL = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureL), 0) / totalCount).toFixed(2));
      const avgA = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureA), 0) / totalCount).toFixed(2));
      const avgB = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureB), 0) / totalCount).toFixed(2));

      const maxDeltaE = Math.max(...labRecords.map(r => parseFloat(r.deltaE)));

      let qualityLevel;
      if (passRate === 100 && maxDeltaE <= 1.0) {
        qualityLevel = QUALITY_LEVEL.EXCELLENT;
      } else if (passRate >= 90) {
        qualityLevel = QUALITY_LEVEL.GOOD;
      } else if (passRate >= 70) {
        qualityLevel = QUALITY_LEVEL.ACCEPTABLE;
      } else {
        qualityLevel = QUALITY_LEVEL.UNACCEPTABLE;
      }

      const status = qualityLevel === QUALITY_LEVEL.UNACCEPTABLE 
        ? STATUS.REJECTED 
        : STATUS.CHECKED;

      let exceptionType = null;
      if (status === STATUS.REJECTED) {
        const failedRecords = labRecords.filter(r => !r.isPassed);
        const deltaLFailed = failedRecords.filter(r => Math.abs(r.deltaL) > LAB_TOLERANCE.L).length;
        const deltaAFailed = failedRecords.filter(r => Math.abs(r.deltaA) > LAB_TOLERANCE.A).length;
        const deltaBFailed = failedRecords.filter(r => Math.abs(r.deltaB) > LAB_TOLERANCE.B).length;

        const types = [];
        if (deltaLFailed > 0) types.push('L值超出公差');
        if (deltaAFailed > 0) types.push('A值超出公差');
        if (deltaBFailed > 0) types.push('B值超出公差');
        exceptionType = types.join(';');
      }

      await printBatch.update({
        status,
        qualityLevel,
        exceptionType,
        checker,
        checkTime: new Date()
      }, { transaction });

      await transaction.commit();

      return {
        printBatchId,
        summary: {
          totalCount,
          passedCount,
          passRate,
          avgL,
          avgA,
          avgB,
          maxDeltaE,
          qualityLevel,
          status,
          exceptionType
        }
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async reviewQuality(printBatchId, reviewer, reviewResult) {
    const printBatch = await PrintBatch.findByPk(printBatchId);
    if (!printBatch) {
      throw new Error('印刷批次不存在');
    }

    if (printBatch.status !== STATUS.CHECKED) {
      throw new Error('只有已检测的批次才能复核');
    }

    const transaction = await sequelize.transaction();
    try {
      const newStatus = reviewResult === 'pass' ? STATUS.APPROVED : STATUS.REJECTED;

      await printBatch.update({
        status: newStatus,
        reviewer,
        reviewTime: new Date()
      }, { transaction });

      await transaction.commit();

      return {
        printBatchId,
        previousStatus: STATUS.CHECKED,
        newStatus,
        reviewer
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async generateQualityOrder(printBatchId, generatedBy) {
    const printBatch = await PrintBatch.findByPk(printBatchId);
    if (!printBatch) {
      throw new Error('印刷批次不存在');
    }

    if (![STATUS.CHECKED, STATUS.APPROVED, STATUS.REJECTED].includes(printBatch.status)) {
      throw new Error('只有已检测或已复核的批次才能生成质检单');
    }

    const existingOrder = await QualityOrder.findOne({
      where: { printBatchId }
    });

    if (existingOrder) {
      return existingOrder;
    }

    const labRecords = await LabRecord.findAll({
      where: { printBatchId }
    });

    const transaction = await sequelize.transaction();
    try {
      const totalCount = labRecords.length;
      const passedCount = labRecords.filter(r => r.isPassed).length;
      const passRate = parseFloat((passedCount / totalCount * 100).toFixed(2));

      const avgL = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureL), 0) / totalCount).toFixed(2));
      const avgA = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureA), 0) / totalCount).toFixed(2));
      const avgB = parseFloat((labRecords.reduce((sum, r) => sum + parseFloat(r.measureB), 0) / totalCount).toFixed(2));
      const maxDeltaE = Math.max(...labRecords.map(r => parseFloat(r.deltaE)));

      let conclusion = '';
      if (printBatch.qualityLevel === 'excellent') {
        conclusion = '质量优秀，所有检测点均合格，色差控制良好。';
      } else if (printBatch.qualityLevel === 'good') {
        conclusion = '质量良好，合格率较高，可正常交付。';
      } else if (printBatch.qualityLevel === 'acceptable') {
        conclusion = '合格，部分检测点存在色差波动，建议重点关注后续批次。';
      } else {
        conclusion = '不合格，色差超出公差范围，建议返工处理。';
      }

      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const orderNo = `QO-${dateStr}-${String(printBatch.batchNo).slice(-4)}`;

      const qualityOrder = await QualityOrder.create({
        orderNo,
        printBatchId,
        printBatchNo: printBatch.batchNo,
        productName: printBatch.productName,
        paperBatchNo: printBatch.paperBatchNo,
        printDate: printBatch.printDate,
        quantity: printBatch.quantity,
        avgL,
        avgA,
        avgB,
        targetL: printBatch.targetL,
        targetA: printBatch.targetA,
        targetB: printBatch.targetB,
        maxDeltaE,
        passRate,
        qualityLevel: printBatch.qualityLevel,
        conclusion,
        responsible: printBatch.responsible,
        checker: printBatch.checker,
        reviewer: printBatch.reviewer,
        checkTime: printBatch.checkTime,
        reviewTime: printBatch.reviewTime,
        generatedBy,
        generateTime: new Date()
      }, { transaction });

      await transaction.commit();
      return qualityOrder;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getQualityTrends(params = {}) {
    const { startDate, endDate, responsible, status, exceptionType, paperBatchNo } = params;
    
    const where = {};
    if (startDate && endDate) {
      where.printDate = { [sequelize.Op.between]: [startDate, endDate] };
    }
    if (responsible) {
      where.responsible = responsible;
    }
    if (status) {
      where.status = status;
    }
    if (exceptionType) {
      where.exceptionType = { [sequelize.Op.like]: `%${exceptionType}%` };
    }
    if (paperBatchNo) {
      where.paperBatchNo = paperBatchNo;
    }

    const batches = await PrintBatch.findAll({
      where,
      include: [
        { model: LabRecord, as: 'labRecords' },
        { model: ReworkRecord, as: 'reworkRecords' }
      ],
      order: [['printDate', 'DESC']]
    });

    const totalBatches = batches.length;
    const approvedCount = batches.filter(b => b.status === STATUS.APPROVED).length;
    const rejectedCount = batches.filter(b => b.status === STATUS.REJECTED).length;
    const reworkedCount = batches.filter(b => b.reworkCount > 0).length;

    const qualityDistribution = {
      excellent: batches.filter(b => b.qualityLevel === QUALITY_LEVEL.EXCELLENT).length,
      good: batches.filter(b => b.qualityLevel === QUALITY_LEVEL.GOOD).length,
      acceptable: batches.filter(b => b.qualityLevel === QUALITY_LEVEL.ACCEPTABLE).length,
      unacceptable: batches.filter(b => b.qualityLevel === QUALITY_LEVEL.UNACCEPTABLE).length
    };

    const avgPassRate = batches.length > 0
      ? batches.reduce((sum, b) => {
          const records = b.labRecords || [];
          if (records.length === 0) return sum;
          const passRate = records.filter(r => r.isPassed).length / records.length * 100;
          return sum + passRate;
        }, 0) / batches.length
      : 0;

    return {
      summary: {
        totalBatches,
        approvedCount,
        rejectedCount,
        reworkedCount,
        approvalRate: totalBatches > 0 ? parseFloat((approvedCount / totalBatches * 100).toFixed(2)) : 0,
        avgPassRate: parseFloat(avgPassRate.toFixed(2)),
        qualityDistribution
      },
      details: batches.map(b => ({
        id: b.id,
        batchNo: b.batchNo,
        productName: b.productName,
        printDate: b.printDate,
        status: b.status,
        qualityLevel: b.qualityLevel,
        responsible: b.responsible,
        reworkCount: b.reworkCount,
        exceptionType: b.exceptionType
      }))
    };
  }
}

module.exports = new QualityService();
