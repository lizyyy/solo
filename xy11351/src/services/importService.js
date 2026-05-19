const { sequelize, PaperBatch, PrintBatch, LabRecord, ReworkRecord } = require('../models');
const { validate, paperBatchSchema, printBatchSchema, labRecordSchema, reworkRecordSchema, calculateLabDelta } = require('./validationService');
const { Op } = require('sequelize');

class ImportService {
  async importPaperBatches(dataList, operator) {
    const result = {
      success: [],
      failed: [],
      skipped: [],
      total: dataList.length
    };

    for (let i = 0; i < dataList.length; i++) {
      const data = { ...dataList[i], createdBy: operator };
      const validation = validate(paperBatchSchema, data);
      
      if (!validation.isValid) {
        result.failed.push({
          index: i,
          data: data,
          errors: validation.errors
        });
        continue;
      }

      const existing = await PaperBatch.findOne({
        where: { batchNo: data.batchNo }
      });

      if (existing) {
        result.skipped.push({
          index: i,
          batchNo: data.batchNo,
          reason: '批次号已存在'
        });
        continue;
      }

      try {
        const record = await PaperBatch.create(validation.value);
        result.success.push({
          index: i,
          batchNo: record.batchNo,
          id: record.id
        });
      } catch (error) {
        result.failed.push({
          index: i,
          data: data,
          error: error.message
        });
      }
    }

    return result;
  }

  async importPrintBatches(dataList, operator) {
    const result = {
      success: [],
      failed: [],
      skipped: [],
      total: dataList.length
    };

    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      const validation = validate(printBatchSchema, data);
      
      if (!validation.isValid) {
        result.failed.push({
          index: i,
          data: data,
          errors: validation.errors
        });
        continue;
      }

      const existing = await PrintBatch.findOne({
        where: { batchNo: data.batchNo }
      });

      if (existing) {
        result.skipped.push({
          index: i,
          batchNo: data.batchNo,
          reason: '批次号已存在'
        });
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        let paperBatchId = null;
        if (data.paperBatchNo) {
          const paperBatch = await PaperBatch.findOne({
            where: { batchNo: data.paperBatchNo },
            transaction
          });
          paperBatchId = paperBatch?.id;
        }

        const record = await PrintBatch.create({
          ...validation.value,
          paperBatchId
        }, { transaction });

        await transaction.commit();
        result.success.push({
          index: i,
          batchNo: record.batchNo,
          id: record.id
        });
      } catch (error) {
        await transaction.rollback();
        result.failed.push({
          index: i,
          data: data,
          error: error.message
        });
      }
    }

    return result;
  }

  async importLabRecords(dataList, operator) {
    const result = {
      success: [],
      failed: [],
      skipped: [],
      total: dataList.length,
      affectedPrintBatches: []
    };

    const affectedBatchSet = new Set();

    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      const validation = validate(labRecordSchema, data);
      
      if (!validation.isValid) {
        result.failed.push({
          index: i,
          data: data,
          errors: validation.errors
        });
        continue;
      }

      const printBatch = await PrintBatch.findOne({
        where: { batchNo: data.printBatchNo }
      });

      if (!printBatch) {
        result.failed.push({
          index: i,
          data: data,
          error: `印刷批次 ${data.printBatchNo} 不存在`
        });
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        const target = {
          L: printBatch.targetL || 0,
          A: printBatch.targetA || 0,
          B: printBatch.targetB || 0
        };
        const measure = {
          L: data.measureL,
          A: data.measureA,
          B: data.measureB
        };
        const delta = calculateLabDelta(target, measure);

        const record = await LabRecord.create({
          ...validation.value,
          printBatchId: printBatch.id,
          ...delta
        }, { transaction });

        await transaction.commit();
        result.success.push({
          index: i,
          id: record.id,
          printBatchNo: data.printBatchNo
        });
        affectedBatchSet.add(printBatch.id);
      } catch (error) {
        await transaction.rollback();
        result.failed.push({
          index: i,
          data: data,
          error: error.message
        });
      }
    }

    result.affectedPrintBatches = Array.from(affectedBatchSet);
    return result;
  }

  async importReworkRecords(dataList, operator) {
    const result = {
      success: [],
      failed: [],
      skipped: [],
      total: dataList.length
    };

    for (let i = 0; i < dataList.length; i++) {
      const data = dataList[i];
      const validation = validate(reworkRecordSchema, data);
      
      if (!validation.isValid) {
        result.failed.push({
          index: i,
          data: data,
          errors: validation.errors
        });
        continue;
      }

      const printBatch = await PrintBatch.findOne({
        where: { batchNo: data.printBatchNo }
      });

      if (!printBatch) {
        result.failed.push({
          index: i,
          data: data,
          error: `印刷批次 ${data.printBatchNo} 不存在`
        });
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        const reworkCount = printBatch.reworkCount + 1;
        const reworkNo = `RW-${data.printBatchNo}-${String(reworkCount).padStart(3, '0')}`;

        await ReworkRecord.create({
          ...validation.value,
          printBatchId: printBatch.id,
          reworkNo,
          reworkCount,
          beforeQualityLevel: printBatch.qualityLevel
        }, { transaction });

        await printBatch.update({
          reworkCount,
          status: 'reworked'
        }, { transaction });

        await transaction.commit();
        result.success.push({
          index: i,
          reworkNo,
          printBatchNo: data.printBatchNo
        });
      } catch (error) {
        await transaction.rollback();
        result.failed.push({
          index: i,
          data: data,
          error: error.message
        });
      }
    }

    return result;
  }

  retryFailedImport(failedItems, importFn, operator) {
    const dataList = failedItems.map(item => item.data);
    return importFn(dataList, operator);
  }
}

module.exports = new ImportService();
