const BedModel = require('../models/BedModel');
const PatientModel = require('../models/PatientModel');
const PatientTransferModel = require('../models/PatientTransferModel');
const CleaningOrderModel = require('../models/CleaningOrderModel');
const TrackingRecordModel = require('../models/TrackingRecordModel');
const OperationLogModel = require('../models/OperationLogModel');
const moment = require('moment');

class BusinessService {
  static async findRecordByIdentifier(recordIdentifier) {
    const isRecordNo = String(recordIdentifier).startsWith('REC-');
    if (isRecordNo) {
      return TrackingRecordModel.findByRecordNo(recordIdentifier);
    } else {
      const result = await TrackingRecordModel.getFullRecord(recordIdentifier);
      return result;
    }
  }

  static async processPatientTransfer(transferId, handler, remarks = null) {
    const transfer = await PatientTransferModel.findByTransferId(transferId);
    if (!transfer) throw new Error('流转记录不存在');

    const fromBed = await BedModel.findByBedNo(transfer.from_bed);
    const toBed = await BedModel.findByBedNo(transfer.to_bed);

    let issues = [];

    if (toBed && toBed.status === 'locked') {
      issues.push('目标床位因转科已被锁定');
    }

    if (toBed && toBed.status === 'occupied' && toBed.patient_id) {
      issues.push('目标床位已被占用，存在重复占床风险');
    }

    const cleaningOrders = await CleaningOrderModel.findByBedNo(transfer.to_bed);
    const pendingCleaning = cleaningOrders.find(o => o.status !== 'completed');
    if (pendingCleaning) {
      const isTimeout = await CleaningOrderModel.checkTimeout(pendingCleaning.order_id);
      if (isTimeout) {
        issues.push('床位清洁已超时');
      }
    }

    const recordData = {
      bed_no: transfer.to_bed,
      patient_id: transfer.patient_id,
      transfer_id: transferId,
      ward: toBed ? toBed.ward : null,
      department: transfer.to_department,
      record_type: 'patient_transfer',
      status: issues.length > 0 ? 'pending_review' : 'processing',
      reason: issues.length > 0 ? issues.join('; ') : '患者转科处理中',
      handler: handler,
      remarks: remarks
    };

    const record = await TrackingRecordModel.create(recordData);

    if (toBed) {
      await BedModel.updateStatus(transfer.to_bed, 'locked', transfer.patient_id);
    }

    await OperationLogModel.create({
      record_id: record.id,
      operation: 'transfer_process',
      before_status: 'pending',
      after_status: issues.length > 0 ? 'pending_review' : 'processing',
      reason: issues.length > 0 ? issues.join('; ') : '患者转科处理',
      operator: handler,
      remarks: remarks
    });

    await PatientTransferModel.updateStatus(transferId, 'processing');

    return { recordId: record.id, recordNo: record.recordNo, issues };
  }

  static async approveRecord(recordId, handler, reason, remarks = null) {
    const record = await this.findRecordByIdentifier(recordId);
    if (!record) throw new Error('记录不存在');

    const beforeStatus = record.status;

    await TrackingRecordModel.updateStatus(
      recordId, 'approved', reason, handler, remarks
    );

    await OperationLogModel.create({
      record_id: record.id,
      operation: 'approve',
      before_status: beforeStatus,
      after_status: 'approved',
      reason: reason,
      operator: handler,
      remarks: remarks
    });

    if (record.record_type === 'patient_transfer') {
      const transfer = await PatientTransferModel.findByTransferId(record.transfer_id);
      if (transfer) {
        await PatientTransferModel.updateStatus(record.transfer_id, 'completed');
        if (transfer.from_bed) {
          await BedModel.updateStatus(transfer.from_bed, 'available', null);
        }
        if (transfer.to_bed) {
          await BedModel.updateStatus(transfer.to_bed, 'occupied', transfer.patient_id);
        }
      }
    }

    return { success: true, recordNo: record.record_no };
  }

  static async rejectRecord(recordId, handler, reason, remarks = null) {
    const record = await this.findRecordByIdentifier(recordId);
    if (!record) throw new Error('记录不存在');

    const beforeStatus = record.status;

    await TrackingRecordModel.updateStatus(
      recordId, 'rejected', reason, handler, remarks
    );

    await OperationLogModel.create({
      record_id: record.id,
      operation: 'reject',
      before_status: beforeStatus,
      after_status: 'rejected',
      reason: reason,
      operator: handler,
      remarks: remarks
    });

    if (record.record_type === 'patient_transfer') {
      const transfer = await PatientTransferModel.findByTransferId(record.transfer_id);
      if (transfer) {
        await PatientTransferModel.updateStatus(record.transfer_id, 'rejected');
        if (transfer.to_bed) {
          await BedModel.updateStatus(transfer.to_bed, 'available', null);
        }
      }
    }

    return { success: true, recordNo: record.record_no };
  }

  static async sendBackForModification(recordId, handler, reason, remarks = null) {
    const record = await this.findRecordByIdentifier(recordId);
    if (!record) throw new Error('记录不存在');

    const beforeStatus = record.status;

    await TrackingRecordModel.updateStatus(
      recordId, 'send_back', reason, handler, remarks
    );

    await OperationLogModel.create({
      record_id: record.id,
      operation: 'send_back',
      before_status: beforeStatus,
      after_status: 'send_back',
      reason: reason,
      operator: handler,
      remarks: remarks
    });

    return { success: true, recordNo: record.record_no };
  }

  static async getRecordDetail(recordId) {
    const record = await TrackingRecordModel.getFullRecord(recordId);
    if (!record) throw new Error('记录不存在');

    const logs = await OperationLogModel.findByRecordId(record.id);

    return {
      basic: record,
      operationHistory: logs,
      auditTrail: this.generateAuditTrail(record, logs)
    };
  }

  static generateAuditTrail(record, logs) {
    const trail = [`记录编号: ${record.record_no}`];
    trail.push(`记录类型: ${record.record_type}`);
    trail.push(`当前状态: ${record.status}`);
    trail.push(`处理人: ${record.handler}`);
    trail.push(`处理时间: ${record.handled_at}`);
    
    if (record.reason) {
      trail.push(`处理原因: ${record.reason}`);
    }
    
    trail.push('\n操作历史:');
    logs.forEach((log, index) => {
      trail.push(`${index + 1}. [${log.operated_at}] ${log.operator} 执行了 ${log.operation}`);
      if (log.before_status && log.after_status) {
        trail.push(`   状态变更: ${log.before_status} → ${log.after_status}`);
      }
      if (log.reason) {
        trail.push(`   原因: ${log.reason}`);
      }
      if (log.remarks) {
        trail.push(`   备注: ${log.remarks}`);
      }
    });

    return trail.join('\n');
  }

  static async checkTimeoutOrders() {
    const orders = await CleaningOrderModel.getAll();
    const timeoutOrders = [];

    for (const order of orders) {
      if (order.status !== 'completed') {
        const isTimeout = await CleaningOrderModel.checkTimeout(order.order_id);
        if (isTimeout) {
          timeoutOrders.push(order);
          
          const existingRecords = await TrackingRecordModel.findByBedNo(order.bed_no);
          const hasTimeoutRecord = existingRecords.some(r => 
            r.record_type === 'cleaning_timeout' && r.order_id === order.order_id
          );

          if (!hasTimeoutRecord) {
            await TrackingRecordModel.create({
              order_id: order.order_id,
              bed_no: order.bed_no,
              ward: order.ward,
              record_type: 'cleaning_timeout',
              status: 'pending_review',
              reason: '保洁工单已超时未完成',
              handler: 'system'
            });
          }
        }
      }
    }

    return timeoutOrders;
  }
}

module.exports = BusinessService;
