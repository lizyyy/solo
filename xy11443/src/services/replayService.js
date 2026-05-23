const { 
  Batch, 
  DeliveryNote, 
  WeighingRecord, 
  Photo, 
  LossRecord,
  AuditLog
} = require('../models');
const moment = require('moment');

class ReplayService {
  static async getAnomalyList(params = {}) {
    const { page = 1, pageSize = 20, batchId, lossType, isManualAdjusted } = params;
    const where = { status: ['confirmed', 'adjusted'] };

    if (batchId) where.batchId = batchId;
    if (lossType) where.lossType = lossType;
    if (isManualAdjusted !== undefined) where.isManualAdjusted = isManualAdjusted;

    const { count, rows } = await LossRecord.findAndCountAll({
      where,
      include: [{ model: Batch, as: 'batch', attributes: ['batchNo', 'supplierName', 'deliveryDate'] }],
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

  static async getReplayTimeline(batchId) {
    const auditLogs = await AuditLog.findAll({
      where: { batchId },
      order: [['createdAt', 'ASC']]
    });

    const timeline = [];
    const stateSnapshots = [];
    let currentState = {
      batch: null,
      deliveryNotes: {},
      weighingRecords: {},
      photos: {},
      lossRecords: {}
    };

    for (const log of auditLogs) {
      const event = {
        timestamp: log.createdAt,
        operator: log.operator,
        action: log.action,
        entityType: log.entityType,
        entityNo: log.entityNo,
        actionDetail: log.actionDetail,
        remark: log.remark,
        diff: log.diffData ? JSON.parse(log.diffData) : null
      };

      timeline.push(event);

      if (log.afterData) {
        const afterData = JSON.parse(log.afterData);
        
        if (log.entityType === 'batch') {
          currentState.batch = afterData;
        } else if (log.entityType === 'delivery_note') {
          currentState.deliveryNotes[log.entityId] = afterData;
        } else if (log.entityType === 'weighing_record') {
          currentState.weighingRecords[log.entityId] = afterData;
        } else if (log.entityType === 'photo') {
          currentState.photos[log.entityId] = afterData;
        } else if (log.entityType === 'loss_record') {
          currentState.lossRecords[log.entityId] = afterData;
        }
      }

      stateSnapshots.push({
        timestamp: log.createdAt,
        event: `${log.action} - ${log.entityType}`,
        state: this.summarizeState(currentState)
      });
    }

    return {
      timeline,
      stateSnapshots,
      finalState: this.summarizeState(currentState)
    };
  }

  static summarizeState(state) {
    return {
      batchStatus: state.batch?.status,
      deliveryNoteCount: Object.values(state.deliveryNotes).filter(n => n.status === 'active').length,
      weighingRecordCount: Object.values(state.weighingRecords).filter(r => r.status === 'active').length,
      photoCount: Object.values(state.photos).filter(p => p.status === 'active').length,
      lossRecordCount: Object.values(state.lossRecords).filter(l => ['confirmed', 'adjusted'].includes(l.status)).length,
      totalLossWeight: Object.values(state.lossRecords)
        .filter(l => ['confirmed', 'adjusted'].includes(l.status) && l.isDeducted)
        .reduce((sum, l) => sum + parseFloat(l.lossWeight || 0), 0)
    };
  }

  static async getLossDetail(lossId) {
    const loss = await LossRecord.findByPk(lossId, {
      include: [{ model: Batch, as: 'batch' }]
    });

    if (!loss) {
      throw new Error('损耗记录不存在');
    }

    const auditLogs = await AuditLog.findAll({
      where: { entityType: 'loss_record', entityId: lossId },
      order: [['createdAt', 'ASC']]
    });

    const versionHistory = [];
    let current = loss;
    while (current) {
      versionHistory.push({
        version: current.version,
        lossWeight: current.lossWeight,
        deductionAmount: current.deductionAmount,
        status: current.status,
        isManualAdjusted: current.isManualAdjusted,
        manualAdjustReason: current.manualAdjustReason,
        adjustedBy: current.adjustedBy,
        adjustedAt: current.adjustedAt,
        createdAt: current.createdAt
      });

      if (current.previousId) {
        current = await LossRecord.findByPk(current.previousId);
      } else {
        break;
      }
    }

    const relatedPhotos = [];
    if (loss.relatedPhotoIds) {
      const photoIds = JSON.parse(loss.relatedPhotoIds);
      for (const photoId of photoIds) {
        const photo = await Photo.findByPk(photoId);
        if (photo) relatedPhotos.push(photo);
      }
    }

    return {
      loss,
      versionHistory: versionHistory.reverse(),
      auditLogs,
      relatedPhotos
    };
  }

  static async compareVersions(lossId) {
    const loss = await LossRecord.findByPk(lossId);
    if (!loss) throw new Error('损耗记录不存在');

    const versions = [];
    let current = loss;
    
    while (current) {
      versions.unshift(current);
      if (current.previousId) {
        current = await LossRecord.findByPk(current.previousId);
      } else {
        break;
      }
    }

    const comparisons = [];
    for (let i = 1; i < versions.length; i++) {
      const before = versions[i - 1];
      const after = versions[i];
      
      comparisons.push({
        version: `${before.version} -> ${after.version}`,
        adjustedBy: after.adjustedBy,
        adjustedAt: after.adjustedAt,
        reason: after.manualAdjustReason,
        changes: {
          lossWeight: { before: before.lossWeight, after: after.lossWeight, diff: after.lossWeight - before.lossWeight },
          deductionAmount: { before: before.deductionAmount, after: after.deductionAmount, diff: after.deductionAmount - before.deductionAmount }
        }
      });
    }

    return {
      currentVersion: loss,
      comparisons
    };
  }
}

module.exports = ReplayService;
