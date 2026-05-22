const MaterialRecord = require('../models/MaterialRecord');
const Inventory = require('../models/Inventory');
const ExceptionLog = require('../models/ExceptionLog');
const AuditLog = require('../models/AuditLog');
const RepairOrder = require('../models/RepairOrder');
const { generateRecordId, generateLogId } = require('../utils/idGenerator');

class MaterialService {
  static async createRecord(recordData) {
    try {
      const record = new MaterialRecord({
        ...recordData,
        recordId: generateRecordId()
      });

      record.addAuditTrail('创建', recordData.applicant || 'system', recordData.reason);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '创建记录',
        operator: recordData.applicant || 'system',
        reason: recordData.reason,
        newStatus: 'pending'
      });

      if (recordData.recordType === 'emergency') {
        await this.createExceptionLog(record, 'emergency_usage', {
          quantity: recordData.requestedQuantity,
          reason: recordData.reason || '紧急领用',
          handler: recordData.applicant || 'system'
        });
      }

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async createBatch(recordsData) {
    try {
      const results = [];
      
      for (const recordData of recordsData) {
        const result = await this.createRecord(recordData);
        results.push(result);
      }

      return { success: true, total: results.length, results };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async markProcessing(recordId, handler, reason) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      record.markProcessing(handler, reason);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '标记处理',
        previousStatus,
        newStatus: 'processing',
        operator: handler,
        reason
      });

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async approveRecord(recordId, handler, reason, actualQuantity) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      
      if (actualQuantity !== undefined) {
        record.actualQuantity = actualQuantity;
      }

      record.approve(handler, reason);
      await record.save();

      await this.updateInventoryAfterApproval(record);

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '审核通过',
        previousStatus,
        newStatus: 'approved',
        operator: handler,
        reason,
        changes: { actualQuantity }
      });

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async rejectRecord(recordId, handler, rejectionReason) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      record.reject(handler, rejectionReason);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '审核拒绝',
        previousStatus,
        newStatus: 'rejected',
        operator: handler,
        reason: rejectionReason
      });

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async returnForRevision(recordId, handler, returnReason) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      record.returnForRevision(handler, returnReason);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '退回修改',
        previousStatus,
        newStatus: 'returned',
        operator: handler,
        reason: returnReason
      });

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async completeRecord(recordId, handler, reason) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      record.complete(handler, reason);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '完成',
        previousStatus,
        newStatus: 'completed',
        operator: handler,
        reason
      });

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async processReturn(recordId, returnedQuantity, handler, reason) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const difference = record.actualQuantity - record.returnedQuantity - returnedQuantity;
      
      if (difference !== 0) {
        await this.createExceptionLog(record, 'return_difference', {
          expectedQuantity: record.actualQuantity - record.returnedQuantity,
          actualQuantity: returnedQuantity,
          quantity: difference,
          reason,
          handler
        });
      }

      record.returnedQuantity += returnedQuantity;
      record.recordType = 'return';
      await record.save();

      await this.updateInventoryAfterReturn(record, returnedQuantity);

      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async updateInventoryAfterApproval(record) {
    try {
      const inventory = await Inventory.findOne({
        materialCode: record.materialCode,
        batchNumber: record.batchNumber
      });

      if (inventory) {
        inventory.quantity -= record.actualQuantity;
        await inventory.save();

        if (inventory.quantity < 0) {
          await this.createExceptionLog(record, 'negative_stock', {
            quantity: inventory.quantity,
            reason: '库存负数',
            handler: 'system'
          });
        }
      }
    } catch (error) {
      console.error('更新库存失败:', error);
    }
  }

  static async updateInventoryAfterReturn(record, returnedQuantity) {
    try {
      const inventory = await Inventory.findOne({
        materialCode: record.materialCode,
        batchNumber: record.batchNumber
      });

      if (inventory) {
        inventory.quantity += returnedQuantity;
        await inventory.save();
      }
    } catch (error) {
      console.error('更新库存失败:', error);
    }
  }

  static async createExceptionLog(record, exceptionType, data) {
    try {
      const exceptionLog = new ExceptionLog({
        logId: generateLogId(),
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        exceptionType,
        materialCode: record.materialCode,
        materialName: record.materialName,
        batchNumber: record.batchNumber,
        quantity: data.quantity,
        expectedQuantity: data.expectedQuantity,
        actualQuantity: data.actualQuantity,
        reason: data.reason,
        handler: data.handler
      });

      await exceptionLog.save();

      record.recordException(exceptionType, data.reason, data.handler);
      await record.save();
    } catch (error) {
      console.error('创建异常日志失败:', error);
    }
  }

  static async createAuditLog(logData) {
    try {
      const auditLog = new AuditLog({
        logId: generateLogId(),
        ...logData
      });
      await auditLog.save();
    } catch (error) {
      console.error('创建审计日志失败:', error);
    }
  }

  static async getRecordById(recordId) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }
      return { success: true, data: record };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async getRecordWithAuditTrail(recordId) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const auditLogs = await AuditLog.find({ recordId }).sort({ createdAt: -1 });
      const exceptionLogs = await ExceptionLog.find({ recordId }).sort({ createdAt: -1 });

      return {
        success: true,
        data: {
          record,
          auditTrail: record.auditTrail,
          auditLogs,
          exceptionLogs
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async validateOrderNumber(orderNumber) {
    try {
      if (!orderNumber) {
        return {
          success: false,
          valid: false,
          error: '抢修单号不能为空'
        };
      }

      const repairOrder = await RepairOrder.findOne({ orderNumber });
      const relatedRecords = await MaterialRecord.find({ orderNumber });

      const orderPattern = /^[A-Za-z0-9]{3,20}$/;
      const formatValid = orderPattern.test(orderNumber);

      return {
        success: true,
        valid: repairOrder !== null,
        orderNumber,
        formatValid,
        repairOrder: repairOrder || null,
        relatedRecords: relatedRecords.length,
        message: repairOrder ? '抢修单号有效' : '抢修单号不存在'
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async confirmReceipt(recordId, receiver, receiptNotes) {
    try {
      const record = await MaterialRecord.findOne({ recordId });
      if (!record) {
        return { success: false, error: '记录不存在' };
      }

      const previousStatus = record.status;
      record.receivedBy = receiver;
      record.receivedAt = new Date();
      record.receiptNotes = receiptNotes;
      record.receiptConfirmed = true;

      record.addAuditTrail('收件回执', receiver, receiptNotes);
      await record.save();

      await this.createAuditLog({
        recordId: record.recordId,
        orderNumber: record.orderNumber,
        action: '收件回执',
        previousStatus,
        newStatus: record.status,
        operator: receiver,
        reason: receiptNotes,
        changes: { receiptConfirmed: true, receivedBy: receiver }
      });

      return {
        success: true,
        data: {
          recordId: record.recordId,
          receiver,
          receivedAt: record.receivedAt,
          receiptNotes,
          receiptConfirmed: true
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async reassignException(logId, newHandler, reason, remarks) {
    try {
      const exceptionLog = await ExceptionLog.findOne({ logId });
      if (!exceptionLog) {
        return { success: false, error: '异常日志不存在' };
      }

      const previousHandler = exceptionLog.handler;
      exceptionLog.handler = newHandler;
      exceptionLog.status = 'pending';
      exceptionLog.reassigned = true;
      exceptionLog.reassignedAt = new Date();
      exceptionLog.reassignedReason = reason;
      exceptionLog.reassignedBy = newHandler;

      if (!exceptionLog.reassignHistory) {
        exceptionLog.reassignHistory = [];
      }
      exceptionLog.reassignHistory.push({
        fromHandler: previousHandler,
        toHandler: newHandler,
        reason,
        remarks,
        reassignedAt: new Date()
      });

      await exceptionLog.save();

      const record = await MaterialRecord.findOne({ recordId: exceptionLog.recordId });
      if (record) {
        record.addAuditTrail('异常重派', newHandler, `原处理人: ${previousHandler}, 原因: ${reason}`);
        await record.save();
      }

      await this.createAuditLog({
        recordId: exceptionLog.recordId,
        orderNumber: exceptionLog.orderNumber,
        action: '异常重派',
        operator: newHandler,
        reason,
        remarks,
        changes: {
          previousHandler,
          newHandler
        }
      });

      return {
        success: true,
        data: {
          logId,
          previousHandler,
          newHandler,
          reason,
          reassignedAt: exceptionLog.reassignedAt,
          status: 'pending'
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  static async resolveException(logId, handler, resolution, remarks) {
    try {
      const exceptionLog = await ExceptionLog.findOne({ logId });
      if (!exceptionLog) {
        return { success: false, error: '异常日志不存在' };
      }

      exceptionLog.status = 'resolved';
      exceptionLog.resolution = resolution;
      exceptionLog.resolvedBy = handler;
      exceptionLog.resolvedTime = new Date();
      exceptionLog.remarks = remarks || exceptionLog.remarks;

      await exceptionLog.save();

      const record = await MaterialRecord.findOne({ recordId: exceptionLog.recordId });
      if (record) {
        record.addAuditTrail('异常解决', handler, `解决方案: ${resolution}`);
        await record.save();
      }

      await this.createAuditLog({
        recordId: exceptionLog.recordId,
        orderNumber: exceptionLog.orderNumber,
        action: '异常解决',
        operator: handler,
        reason: resolution,
        remarks,
        changes: {
          exceptionStatus: 'resolved'
        }
      });

      return {
        success: true,
        data: {
          logId,
          status: 'resolved',
          resolution,
          resolvedBy: handler,
          resolvedTime: exceptionLog.resolvedTime
        }
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

module.exports = MaterialService;
