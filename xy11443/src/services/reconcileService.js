const { 
  Batch, 
  DeliveryNote, 
  WeighingRecord, 
  LossRecord,
  Reconciliation,
  sequelize
} = require('../models');
const AuditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

class ReconcileService {
  static async calculateBatchData(batchId) {
    const deliveryNotes = await DeliveryNote.findAll({
      where: { batchId, status: 'active' }
    });
    
    const weighingRecords = await WeighingRecord.findAll({
      where: { batchId, status: 'active' }
    });
    
    const lossRecords = await LossRecord.findAll({
      where: { batchId, status: ['confirmed', 'adjusted'] }
    });

    const deliveryWeight = deliveryNotes.reduce((sum, note) => sum + parseFloat(note.quantity || 0), 0);
    
    const grossWeight = weighingRecords.filter(r => r.weighType === 'gross').reduce((sum, r) => sum + parseFloat(r.weight || 0), 0);
    const tareWeight = weighingRecords.filter(r => r.weighType === 'tare').reduce((sum, r) => sum + parseFloat(r.weight || 0), 0);
    const netWeight = weighingRecords.filter(r => r.weighType === 'net').reduce((sum, r) => sum + parseFloat(r.weight || 0), 0) || (grossWeight - tareWeight);
    const sortingWeight = weighingRecords.filter(r => r.weighType === 'sorting').reduce((sum, r) => sum + parseFloat(r.weight || 0), 0);

    const badFruitLoss = lossRecords.filter(r => r.lossType === 'bad_fruit' && r.isDeducted).reduce((sum, r) => sum + parseFloat(r.lossWeight || 0), 0);
    const secondarySortingLoss = lossRecords.filter(r => r.lossType === 'secondary_sorting' && r.isDeducted).reduce((sum, r) => sum + parseFloat(r.lossWeight || 0), 0);
    const otherLoss = lossRecords.filter(r => !['bad_fruit', 'secondary_sorting'].includes(r.lossType) && r.isDeducted).reduce((sum, r) => sum + parseFloat(r.lossWeight || 0), 0);
    
    const totalLossWeight = badFruitLoss + secondarySortingLoss + otherLoss;
    const totalLossRate = deliveryWeight > 0 ? (totalLossWeight / deliveryWeight * 100) : 0;
    const totalDeduction = lossRecords.filter(r => r.isDeducted).reduce((sum, r) => sum + parseFloat(r.deductionAmount || 0), 0);

    const calculatedSortingWeight = netWeight - totalLossWeight;
    const differenceWeight = sortingWeight > 0 ? sortingWeight - calculatedSortingWeight : 0;

    return {
      deliveryWeight,
      grossWeight,
      tareWeight,
      netWeight,
      sortingWeight,
      badFruitLoss,
      secondarySortingLoss,
      otherLoss,
      totalLossWeight,
      totalLossRate: Math.round(totalLossRate * 100) / 100,
      totalDeduction,
      differenceWeight,
      deliveryNotes,
      weighingRecords,
      lossRecords
    };
  }

  static async reconcile(batchId, operator) {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');
      if (batch.isFrozen) throw new Error('批次已冻结');

      const beforeData = await this.calculateBatchData(batchId);

      const reconcileNo = `REC-${Date.now()}`;
      const reconciliation = await Reconciliation.create({
        id: uuidv4(),
        batchId,
        reconcileNo,
        deliveryWeight: beforeData.deliveryWeight,
        netWeight: beforeData.netWeight,
        sortingWeight: beforeData.sortingWeight,
        totalLossWeight: beforeData.totalLossWeight,
        badFruitLoss: beforeData.badFruitLoss,
        secondarySortingLoss: beforeData.secondarySortingLoss,
        otherLoss: beforeData.otherLoss,
        totalLossRate: beforeData.totalLossRate,
        totalDeduction: beforeData.totalDeduction,
        differenceWeight: beforeData.differenceWeight,
        beforeData: JSON.stringify({
          deliveryNotes: beforeData.deliveryNotes.map(n => n.toJSON()),
          weighingRecords: beforeData.weighingRecords.map(r => r.toJSON()),
          lossRecords: beforeData.lossRecords.map(r => r.toJSON())
        }),
        status: 'completed',
        reconciledBy: operator
      }, { transaction: t });

      await batch.update({
        status: 'reconciled'
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'reconcile',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: reconciliation.toJSON(),
          remark: '完成对账'
        }
      );

      await t.commit();

      return {
        reconciliation,
        summary: {
          deliveryWeight: beforeData.deliveryWeight,
          netWeight: beforeData.netWeight,
          sortingWeight: beforeData.sortingWeight,
          totalLossWeight: beforeData.totalLossWeight,
          totalLossRate: beforeData.totalLossRate,
          badFruitLoss: beforeData.badFruitLoss,
          secondarySortingLoss: beforeData.secondarySortingLoss,
          totalDeduction: beforeData.totalDeduction,
          differenceWeight: beforeData.differenceWeight
        },
        details: {
          deliveryCount: beforeData.deliveryNotes.length,
          weighingCount: beforeData.weighingRecords.length,
          lossCount: beforeData.lossRecords.length
        }
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static async getReconciliation(batchId) {
    return await Reconciliation.findAll({
      where: { batchId },
      order: [['createdAt', 'DESC']]
    });
  }

  static async getReconciliationDetail(reconcileId) {
    return await Reconciliation.findByPk(reconcileId);
  }

  static async compareReconciliations(reconcileId1, reconcileId2) {
    const rec1 = await this.getReconciliationDetail(reconcileId1);
    const rec2 = await this.getReconciliationDetail(reconcileId2);

    if (!rec1 || !rec2) {
      throw new Error('对账记录不存在');
    }

    const diff = {
      deliveryWeight: {
        before: rec1.deliveryWeight,
        after: rec2.deliveryWeight,
        diff: rec2.deliveryWeight - rec1.deliveryWeight
      },
      totalLossWeight: {
        before: rec1.totalLossWeight,
        after: rec2.totalLossWeight,
        diff: rec2.totalLossWeight - rec1.totalLossWeight
      },
      badFruitLoss: {
        before: rec1.badFruitLoss,
        after: rec2.badFruitLoss,
        diff: rec2.badFruitLoss - rec1.badFruitLoss
      },
      secondarySortingLoss: {
        before: rec1.secondarySortingLoss,
        after: rec2.secondarySortingLoss,
        diff: rec2.secondarySortingLoss - rec1.secondarySortingLoss
      },
      totalDeduction: {
        before: rec1.totalDeduction,
        after: rec2.totalDeduction,
        diff: rec2.totalDeduction - rec1.totalDeduction
      }
    };

    return {
      reconcile1: rec1,
      reconcile2: rec2,
      diff
    };
  }
}

module.exports = ReconcileService;
