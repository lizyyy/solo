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

  static async acceptCleaningOrder(orderId, handler, remarks = null) {
    const order = await CleaningOrderModel.findByOrderId(orderId);
    if (!order) throw new Error('保洁工单不存在');
    if (order.status === 'completed') throw new Error('工单已完成，无法接单');
    if (order.status === 'processing') throw new Error('工单已被接单');

    await CleaningOrderModel.startOrder(orderId);

    const trackingRecords = await TrackingRecordModel.findByBedNo(order.bed_no);
    const relatedRecord = trackingRecords.find(r => r.order_id === orderId);
    
    if (relatedRecord) {
      await TrackingRecordModel.updateStatus(
        relatedRecord.id, 'processing', '保洁人员已接单，正在清洁', handler, remarks
      );

      await OperationLogModel.create({
        record_id: relatedRecord.id,
        operation: 'accept_order',
        before_status: 'pending',
        after_status: 'processing',
        reason: '保洁人员接单',
        operator: handler,
        remarks: remarks
      });
    }

    return { success: true, orderId: orderId };
  }

  static async completeCleaningOrder(orderId, handler, remarks = null) {
    const order = await CleaningOrderModel.findByOrderId(orderId);
    if (!order) throw new Error('保洁工单不存在');
    if (order.status === 'completed') throw new Error('工单已完成');
    if (order.status === 'pending') throw new Error('工单尚未接单');

    await CleaningOrderModel.completeOrder(orderId);

    const trackingRecords = await TrackingRecordModel.findByBedNo(order.bed_no);
    const relatedRecord = trackingRecords.find(r => r.order_id === orderId);
    
    if (relatedRecord) {
      await TrackingRecordModel.updateStatus(
        relatedRecord.id, 'approved', '保洁已完成，床位可用', handler, remarks
      );

      await OperationLogModel.create({
        record_id: relatedRecord.id,
        operation: 'complete_order',
        before_status: 'processing',
        after_status: 'approved',
        reason: '保洁完成验收通过',
        operator: handler,
        remarks: remarks
      });
    }

    const bed = await BedModel.findByBedNo(order.bed_no);
    if (bed && bed.status === 'cleaning') {
      await BedModel.updateStatus(order.bed_no, 'available', null);
    }

    return { success: true, orderId: orderId };
  }

  static async getCleaningOrderHistory(filters = {}) {
    let records = await TrackingRecordModel.getHistory({});
    records = records.filter(r => r.record_type === 'cleaning_order' || r.record_type === 'cleaning_timeout');
    
    if (filters.assigned_to) {
      const orderIds = [];
      const allOrders = await CleaningOrderModel.getAll();
      for (const order of allOrders) {
        if (order.assigned_to === filters.assigned_to) {
          orderIds.push(order.order_id);
        }
      }
      records = records.filter(r => orderIds.includes(r.order_id));
    }
    
    if (filters.status) {
      records = records.filter(r => r.status === filters.status);
    }
    
    if (filters.ward) {
      records = records.filter(r => r.ward === filters.ward);
    }

    return records;
  }
}

module.exports = BusinessService;
