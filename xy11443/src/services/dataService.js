const { 
  DeliveryNote, 
  WeighingRecord, 
  Photo, 
  LossRecord,
  Batch,
  sequelize
} = require('../models');
const AuditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

class DataService {
  static async addDeliveryNote(batchId, data, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      const noteNo = `DN-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const note = await DeliveryNote.create({
        id: uuidv4(),
        batchId,
        noteNo,
        ...data,
        createdBy: operator
      }, { transaction: t });

      await AuditService.logChange(
        'delivery_note',
        note.id,
        note.noteNo,
        'create',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: note.toJSON(),
          remark: '添加送货单'
        }
      );

      await t.commit();
      return note;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async addWeighingRecord(batchId, data, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      const recordNo = `WR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const record = await WeighingRecord.create({
        id: uuidv4(),
        batchId,
        recordNo,
        ...data,
        createdBy: operator
      }, { transaction: t });

      await AuditService.logChange(
        'weighing_record',
        record.id,
        record.recordNo,
        'create',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: record.toJSON(),
          remark: '添加称重记录'
        }
      );

      await t.commit();
      return record;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async addPhoto(batchId, data, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      const photoNo = `PH-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const photo = await Photo.create({
        id: uuidv4(),
        batchId,
        photoNo,
        ...data,
        uploadedBy: operator
      }, { transaction: t });

      await AuditService.logChange(
        'photo',
        photo.id,
        photo.photoNo,
        'create',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: photo.toJSON(),
          remark: data.isAnomaly ? '添加异常照片' : '添加照片'
        }
      );

      await t.commit();
      return photo;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async addLossRecord(batchId, data, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      const lossNo = `LR-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`;
      const loss = await LossRecord.create({
        id: uuidv4(),
        batchId,
        lossNo,
        ...data,
        createdBy: operator
      }, { transaction: t });

      await AuditService.logChange(
        'loss_record',
        loss.id,
        loss.lossNo,
        'create',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: loss.toJSON(),
          remark: `添加${data.lossType === 'bad_fruit' ? '坏果扣款' : data.lossType === 'secondary_sorting' ? '二次分拣损耗' : '损耗'}记录`
        }
      );

      await t.commit();
      return loss;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async confirmLossRecord(lossId, operator) {
    const t = await sequelize.transaction();
    
    try {
      const loss = await LossRecord.findByPk(lossId, { transaction: t });
      if (!loss) throw new Error('损耗记录不存在');

      const batch = await Batch.findByPk(loss.batchId, { transaction: t });
      if (batch.isFrozen) throw new Error('批次已冻结');

      const beforeData = loss.toJSON();
      await loss.update({
        status: 'confirmed',
        confirmedBy: operator,
        confirmedAt: new Date()
      }, { transaction: t });

      await AuditService.logChange(
        'loss_record',
        loss.id,
        loss.lossNo,
        'confirm',
        operator,
        {
          batchId: loss.batchId,
          batchNo: batch.batchNo,
          before: beforeData,
          after: loss.toJSON(),
          remark: '确认损耗记录'
        }
      );

      await t.commit();
      return loss;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async adjustLossRecord(lossId, data, operator, reason) {
    const t = await sequelize.transaction();
    
    try {
      const loss = await LossRecord.findByPk(lossId, { transaction: t });
      if (!loss) throw new Error('损耗记录不存在');

      const batch = await Batch.findByPk(loss.batchId, { transaction: t });
      if (batch.isFrozen) throw new Error('批次已冻结');

      const beforeData = loss.toJSON();

      const newLoss = await LossRecord.create({
        id: uuidv4(),
        batchId: loss.batchId,
        lossNo: loss.lossNo + '-V' + (loss.version + 1),
        ...loss.toJSON(),
        ...data,
        status: 'adjusted',
        version: loss.version + 1,
        previousId: loss.id,
        isManualAdjusted: true,
        manualAdjustReason: reason,
        adjustedBy: operator,
        adjustedAt: new Date(),
        createdBy: operator
      }, { transaction: t });

      await loss.update({
        status: 'replaced'
      }, { transaction: t });

      await AuditService.logChange(
        'loss_record',
        newLoss.id,
        newLoss.lossNo,
        'adjust',
        operator,
        {
          batchId: loss.batchId,
          batchNo: batch.batchNo,
          before: beforeData,
          after: newLoss.toJSON(),
          remark: `人工改判: ${reason}`
        }
      );

      await t.commit();
      return newLoss;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async batchAdd(batchId, data, operator) {
    const t = await sequelize.transaction();
    const results = {
      success: [],
      failed: []
    };

    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      if (data.deliveryNotes) {
        for (const item of data.deliveryNotes) {
          try {
            const note = await this.addDeliveryNote(batchId, item, operator);
            results.success.push({ type: 'delivery_note', data: note });
          } catch (error) {
            results.failed.push({ type: 'delivery_note', data: item, error: error.message });
          }
        }
      }

      if (data.weighingRecords) {
        for (const item of data.weighingRecords) {
          try {
            const record = await this.addWeighingRecord(batchId, item, operator);
            results.success.push({ type: 'weighing_record', data: record });
          } catch (error) {
            results.failed.push({ type: 'weighing_record', data: item, error: error.message });
          }
        }
      }

      if (data.photos) {
        for (const item of data.photos) {
          try {
            const photo = await this.addPhoto(batchId, item, operator);
            results.success.push({ type: 'photo', data: photo });
          } catch (error) {
            results.failed.push({ type: 'photo', data: item, error: error.message });
          }
        }
      }

      if (data.lossRecords) {
        for (const item of data.lossRecords) {
          try {
            const loss = await this.addLossRecord(batchId, item, operator);
            results.success.push({ type: 'loss_record', data: loss });
          } catch (error) {
            results.failed.push({ type: 'loss_record', data: item, error: error.message });
          }
        }
      }

      await t.commit();
      return results;
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }
}

module.exports = DataService;
