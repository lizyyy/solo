const { 
  Batch, 
  DeliveryNote, 
  WeighingRecord, 
  Photo, 
  LossRecord,
  sequelize
} = require('../models');
const AuditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

class BatchService {
  static async createBatch(data, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batchNo = `BATCH-${Date.now()}`;
      const batch = await Batch.create({
        id: uuidv4(),
        batchNo,
        ...data,
        createdBy: operator
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'create',
        operator,
        {
          batchId: batch.id,
          batchNo: batch.batchNo,
          after: batch.toJSON(),
          remark: '创建批次'
        }
      );

      await t.commit();
      return batch;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async submitBatch(batchId, operator, duplicateStrategy = 'error') {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      
      if (!batch) {
        throw new Error('批次不存在');
      }

      if (batch.isFrozen) {
        throw new Error('批次已冻结，无法提交');
      }

      const beforeData = batch.toJSON();

      if (batch.status === 'submitted' || batch.submitCount > 0) {
        switch (duplicateStrategy) {
          case 'ignore':
            await AuditService.logChange(
              'batch',
              batch.id,
              batch.batchNo,
              'ignore',
              operator,
              {
                batchId: batch.id,
                batchNo: batch.batchNo,
                before: beforeData,
                after: beforeData,
                actionDetail: '重复提交-忽略',
                remark: '批次已存在，忽略重复提交'
              }
            );
            await t.commit();
            return { batch, action: 'ignored', message: '批次已存在，忽略重复提交' };

          case 'overwrite':
            await batch.update({
              status: 'submitted',
              submitCount: batch.submitCount + 1,
              lastSubmittedAt: new Date()
            }, { transaction: t });
            
            await AuditService.logChange(
              'batch',
              batch.id,
              batch.batchNo,
              'overwrite',
              operator,
              {
                batchId: batch.id,
                batchNo: batch.batchNo,
                before: beforeData,
                after: batch.toJSON(),
                actionDetail: '重复提交-覆盖',
                remark: '覆盖原有提交'
              }
            );
            await t.commit();
            return { batch, action: 'overwritten', message: '已覆盖原有提交' };

          case 'append':
            await batch.update({
              status: 'submitted',
              submitCount: batch.submitCount + 1,
              lastSubmittedAt: new Date()
            }, { transaction: t });
            
            await AuditService.logChange(
              'batch',
              batch.id,
              batch.batchNo,
              'append',
              operator,
              {
                batchId: batch.id,
                batchNo: batch.batchNo,
                before: beforeData,
                after: batch.toJSON(),
                actionDetail: '重复提交-追加',
                remark: '追加提交记录'
              }
            );
            await t.commit();
            return { batch, action: 'appended', message: '已追加提交记录' };

          default:
            throw new Error(`批次已提交过${batch.submitCount}次，请指定处理策略：ignore/overwrite/append`);
        }
      }

      await batch.update({
        status: 'submitted',
        submitCount: 1,
        lastSubmittedAt: new Date()
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'submit',
        operator,
        {
          batchId: batch.id,
          batchNo: batch.batchNo,
          before: beforeData,
          after: batch.toJSON(),
          remark: '提交批次'
        }
      );

      await t.commit();
      return { batch, action: 'submitted', message: '批次提交成功' };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async withdrawBatch(batchId, operator, reason) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      
      if (!batch) {
        throw new Error('批次不存在');
      }

      if (batch.isFrozen) {
        throw new Error('批次已冻结，无法撤回');
      }

      if (batch.status !== 'submitted') {
        throw new Error('只有已提交的批次才能撤回');
      }

      const beforeData = batch.toJSON();

      await batch.update({
        status: 'withdrawn',
        submitCount: 0,
        lastSubmittedAt: null
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'withdraw',
        operator,
        {
          batchId: batch.id,
          batchNo: batch.batchNo,
          before: beforeData,
          after: batch.toJSON(),
          remark: reason || '撤回批次'
        }
      );

      await t.commit();
      return batch;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async freezeBatch(batchId, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      
      if (!batch) {
        throw new Error('批次不存在');
      }

      if (batch.isFrozen) {
        throw new Error('批次已冻结');
      }

      const beforeData = batch.toJSON();

      await batch.update({
        isFrozen: true,
        frozenAt: new Date(),
        frozenBy: operator,
        status: 'frozen'
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'freeze',
        operator,
        {
          batchId: batch.id,
          batchNo: batch.batchNo,
          before: beforeData,
          after: batch.toJSON(),
          remark: '导出前冻结批次'
        }
      );

      await t.commit();
      return batch;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async unfreezeBatch(batchId, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      
      if (!batch) {
        throw new Error('批次不存在');
      }

      if (!batch.isFrozen) {
        throw new Error('批次未冻结');
      }

      const beforeData = batch.toJSON();

      await batch.update({
        isFrozen: false,
        status: 'submitted'
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'unfreeze',
        operator,
        {
          batchId: batch.id,
          batchNo: batch.batchNo,
          before: beforeData,
          after: batch.toJSON(),
          remark: '解冻批次'
        }
      );

      await t.commit();
      return batch;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getBatchDetail(batchId) {
    const batch = await Batch.findByPk(batchId, {
      include: [
        { association: 'deliveryNotes', where: { status: 'active' }, required: false },
        { association: 'weighingRecords', where: { status: 'active' }, required: false },
        { association: 'photos', where: { status: 'active' }, required: false },
        { association: 'lossRecords', where: { status: ['pending', 'confirmed', 'adjusted'] }, required: false },
        { association: 'auditLogs', required: false, order: [['createdAt', 'DESC']], limit: 20 },
        { association: 'reconciliations', required: false, order: [['createdAt', 'DESC']], limit: 5 }
      ]
    });

    if (!batch) {
      throw new Error('批次不存在');
    }

    return batch;
  }

  static async getBatchList(params = {}) {
    const { page = 1, pageSize = 20, status, supplierId, startDate, endDate } = params;
    const where = {};

    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;
    if (startDate) where.deliveryDate = { ...where.deliveryDate, [sequelize.Op.gte]: startDate };
    if (endDate) where.deliveryDate = { ...where.deliveryDate, [sequelize.Op.lte]: endDate };

    const { count, rows } = await Batch.findAndCountAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: pageSize,
      offset: (page - 1) * pageSize
    });

    return {
      total: count,
      page,
      pageSize,
      list: rows
    };
  }

  static async getBatchHistory(batchId) {
    return await AuditService.getBatchAuditTrail(batchId);
  }
}

module.exports = BatchService;
