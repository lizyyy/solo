const fs = require('fs');
const path = require('path');
const { 
  Batch, 
  DeliveryNote, 
  WeighingRecord, 
  Photo, 
  LossRecord,
  Reconciliation,
  ExportRecord,
  sequelize
} = require('../models');
const AuditService = require('./auditService');
const { v4: uuidv4 } = require('uuid');

class ExportService {
  static async getBatchExportData(batchId) {
    const batch = await Batch.findByPk(batchId);
    if (!batch) throw new Error('批次不存在');

    const deliveryNotes = await DeliveryNote.findAll({
      where: { batchId, status: 'active' }
    });
    
    const weighingRecords = await WeighingRecord.findAll({
      where: { batchId, status: 'active' }
    });
    
    const photos = await Photo.findAll({
      where: { batchId, status: 'active' }
    });
    
    const lossRecords = await LossRecord.findAll({
      where: { batchId, status: ['confirmed', 'adjusted'] }
    });

    const reconciliations = await Reconciliation.findAll({
      where: { batchId, status: 'completed' }
    });

    const auditLogs = await AuditService.getBatchAuditTrail(batchId);

    return {
      batch: batch.toJSON(),
      deliveryNotes: deliveryNotes.map(n => n.toJSON()),
      weighingRecords: weighingRecords.map(r => r.toJSON()),
      photos: photos.map(p => p.toJSON()),
      lossRecords: lossRecords.map(l => l.toJSON()),
      reconciliations: reconciliations.map(r => r.toJSON()),
      auditLogs: auditLogs.map(a => a.toJSON()),
      exportTime: new Date().toISOString()
    };
  }

  static async exportBatch(batchId, operator, format = 'json') {
    const t = await sequelize.transaction();
    
    try {
      const batch = await Batch.findByPk(batchId, { transaction: t });
      if (!batch) throw new Error('批次不存在');

      if (!batch.isFrozen) {
        throw new Error('批次必须先冻结才能导出');
      }

      const exportData = await this.getBatchExportData(batchId);

      const exportNo = `EXP-${Date.now()}`;
      const fileName = `${exportNo}_batch_${batch.batchNo}.${format}`;
      const exportDir = path.join(__dirname, '../../exports');
      
      if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
      }

      const filePath = path.join(exportDir, fileName);
      let fileContent = '';

      if (format === 'json') {
        fileContent = JSON.stringify(exportData, null, 2);
      } else if (format === 'csv') {
        fileContent = this.convertToCSV(exportData);
      }

      fs.writeFileSync(filePath, fileContent, 'utf8');
      const fileSize = fs.statSync(filePath).size;

      const recordCount = 
        exportData.deliveryNotes.length + 
        exportData.weighingRecords.length + 
        exportData.photos.length + 
        exportData.lossRecords.length;

      const exportRecord = await ExportRecord.create({
        id: uuidv4(),
        exportNo,
        batchIds: JSON.stringify([batchId]),
        batchNos: JSON.stringify([batch.batchNo]),
        exportType: 'single_batch',
        exportFormat: format,
        fileName,
        filePath,
        fileSize,
        recordCount,
        exportData: JSON.stringify(exportData),
        exportedBy: operator
      }, { transaction: t });

      await batch.update({
        status: 'exported'
      }, { transaction: t });

      await AuditService.logChange(
        'batch',
        batch.id,
        batch.batchNo,
        'export',
        operator,
        {
          batchId,
          batchNo: batch.batchNo,
          after: exportRecord.toJSON(),
          remark: `导出批次数据 - ${format}格式`
        }
      );

      await t.commit();

      return {
        exportRecord,
        filePath,
        recordCount,
        fileSize
      };
    } catch (error) {
      await t.rollback();
      throw error;
    }
  }

  static convertToCSV(data) {
    const lines = [];
    
    lines.push('=== 批次信息 ===');
    lines.push('批次号,供应商,送货日期,状态');
    lines.push(`${data.batch.batchNo},${data.batch.supplierName},${data.batch.deliveryDate},${data.batch.status}`);
    lines.push('');

    lines.push('=== 送货单 ===');
    lines.push('单号,商品,数量,单位,单价,金额');
    for (const note of data.deliveryNotes) {
      lines.push(`${note.noteNo},${note.productName},${note.quantity},${note.unit},${note.unitPrice || ''},${note.totalAmount || ''}`);
    }
    lines.push('');

    lines.push('=== 称重记录 ===');
    lines.push('记录号,类型,商品,重量,单位,时间');
    for (const record of data.weighingRecords) {
      lines.push(`${record.recordNo},${record.weighType},${record.productName},${record.weight},${record.unit},${record.weighTime}`);
    }
    lines.push('');

    lines.push('=== 损耗记录 ===');
    lines.push('记录号,类型,商品,损耗重量,损耗率,扣款金额,状态');
    for (const loss of data.lossRecords) {
      lines.push(`${loss.lossNo},${loss.lossType},${loss.productName},${loss.lossWeight},${loss.lossRate || ''}%,${loss.deductionAmount || ''},${loss.status}`);
    }
    lines.push('');

    lines.push('=== 操作历史 ===');
    lines.push('时间,操作人,操作,实体类型,实体编号,备注');
    for (const log of data.auditLogs) {
      lines.push(`${log.createdAt},${log.operator},${log.action},${log.entityType},${log.entityNo || ''},${log.remark || ''}`);
    }

    return lines.join('\n');
  }

  static async getExportHistory(params = {}) {
    const { page = 1, pageSize = 20 } = params;
    const { count, rows } = await ExportRecord.findAndCountAll({
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
}

module.exports = ExportService;
