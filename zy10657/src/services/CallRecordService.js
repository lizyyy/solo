const db = require('../database/memoryDB');
const { CALL_STATUS } = require('../models/CallRecord');

const STATUS_TRANSITIONS = {
  [CALL_STATUS.PENDING]: [CALL_STATUS.INTERCEPTED, CALL_STATUS.CALLED, CALL_STATUS.ARCHIVED],
  [CALL_STATUS.INTERCEPTED]: [CALL_STATUS.PENDING, CALL_STATUS.CALLED, CALL_STATUS.ARCHIVED],
  [CALL_STATUS.CALLED]: [CALL_STATUS.ARCHIVED],
  [CALL_STATUS.ARCHIVED]: []
};

class CallRecordService {
  canTransition(fromStatus, toStatus) {
    const allowed = STATUS_TRANSITIONS[fromStatus] || [];
    return allowed.includes(toStatus);
  }

  createCallRecord(taskBatchId, phoneNumber, customerName, importData = {}) {
    if (!phoneNumber || phoneNumber.trim() === '') {
      throw new Error('手机号码不能为空');
    }
    
    const phoneRegex = /^1[3-9]\d{9}$/;
    if (!phoneRegex.test(phoneNumber.trim())) {
      throw new Error('手机号码格式不正确');
    }
    
    if (!taskBatchId) {
      throw new Error('任务批次ID不能为空');
    }
    
    const taskBatch = db.taskBatches.get(parseInt(taskBatchId));
    if (!taskBatch) {
      throw new Error('任务批次不存在');
    }
    
    return db.addCallRecord(parseInt(taskBatchId), phoneNumber.trim(), customerName, importData);
  }

  updateCallRecord(id, updates) {
    const record = db.callRecords.get(parseInt(id));
    if (!record) {
      throw new Error('呼叫记录不存在');
    }
    
    const allowedUpdates = ['customerName'];
    for (const key of Object.keys(updates)) {
      if (allowedUpdates.includes(key)) {
        record[key] = updates[key];
      }
    }
    
    record.updatedAt = new Date();
    return record;
  }

  reviewCallRecord(id, operator, approved, comment) {
    const record = db.callRecords.get(parseInt(id));
    if (!record) {
      throw new Error('呼叫记录不存在');
    }
    
    if (record.status !== CALL_STATUS.INTERCEPTED) {
      throw new Error('只有已拦截状态的记录才能审核');
    }
    
    const previousStatus = record.status;
    record.reviewedBy = operator;
    record.reviewTime = new Date();
    record.reviewComment = comment;
    
    if (approved) {
      record.status = CALL_STATUS.PENDING;
      record.interceptReason = null;
      record.interceptTime = null;
      
      db.addHistoryLog(
        record.id,
        'review_approve',
        operator,
        `审核通过：${comment || '同意取消拦截，恢复待呼叫状态'}`,
        previousStatus,
        CALL_STATUS.PENDING
      );
      
      const taskBatch = db.taskBatches.get(record.taskBatchId);
      if (taskBatch) {
        taskBatch.interceptedNumbers--;
        taskBatch.totalNumbers++;
        taskBatch.updatedAt = new Date();
      }
    } else {
      record.status = CALL_STATUS.ARCHIVED;
      
      db.addHistoryLog(
        record.id,
        'review_reject',
        operator,
        `审核驳回：${comment || '确认拦截，归档处理'}`,
        previousStatus,
        CALL_STATUS.ARCHIVED
      );
    }
    
    record.updatedAt = new Date();
    return record;
  }

  withdrawCallRecord(id, operator, reason) {
    const record = db.callRecords.get(parseInt(id));
    if (!record) {
      throw new Error('呼叫记录不存在');
    }
    
    if (!this.canTransition(record.status, CALL_STATUS.ARCHIVED)) {
      throw new Error(`当前状态 ${record.status} 无法撤回`);
    }
    
    const previousStatus = record.status;
    record.status = CALL_STATUS.ARCHIVED;
    
    db.addHistoryLog(
      record.id,
      'withdraw',
      operator,
      `撤回：${reason || '人工撤回呼叫'}`,
      previousStatus,
      CALL_STATUS.ARCHIVED
    );
    
    record.updatedAt = new Date();
    return record;
  }

  markAsCalled(id, callResult) {
    const record = db.callRecords.get(parseInt(id));
    if (!record) {
      throw new Error('呼叫记录不存在');
    }
    
    if (!this.canTransition(record.status, CALL_STATUS.CALLED)) {
      throw new Error(`当前状态 ${record.status} 无法标记为已呼叫`);
    }
    
    const previousStatus = record.status;
    record.status = CALL_STATUS.CALLED;
    record.callResult = callResult;
    record.callTime = new Date();
    
    db.addHistoryLog(
      record.id,
      'mark_called',
      'system',
      `呼叫完成，结果：${callResult || '未知'}`,
      previousStatus,
      CALL_STATUS.CALLED
    );
    
    const taskBatch = db.taskBatches.get(record.taskBatchId);
    if (taskBatch) {
      taskBatch.calledNumbers++;
      if (previousStatus === CALL_STATUS.PENDING) {
        taskBatch.totalNumbers--;
      }
      taskBatch.updatedAt = new Date();
    }
    
    record.updatedAt = new Date();
    return record;
  }

  getCallRecordById(id) {
    const record = db.callRecords.get(parseInt(id));
    if (!record) {
      throw new Error('呼叫记录不存在');
    }
    
    const history = db.getHistoryLogsByCallRecordId(record.id);
    const duplicates = db.findCallRecordsByPhone(record.phoneNumber)
      .filter(r => r.id !== record.id);
    
    return {
      ...record,
      history,
      duplicates
    };
  }

  getCallRecords(filters = {}) {
    return db.getCallRecords(filters);
  }

  getTaskBatches() {
    return Array.from(db.taskBatches.values());
  }

  getCustomers() {
    return Array.from(db.customers.values());
  }

  bulkImport(taskBatchId, records, operator) {
    const results = {
      success: [],
      failed: [],
      total: records.length
    };
    
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        const callRecord = this.createCallRecord(
          taskBatchId,
          record.phoneNumber,
          record.customerName,
          { rowNumber: i + 1, ...record }
        );
        results.success.push(callRecord);
      } catch (error) {
        results.failed.push({
          rowNumber: i + 1,
          record: records[i],
          error: error.message
        });
        
        const id = db.counters.callRecord++;
        const badRecord = {
          id,
          taskBatchId: parseInt(taskBatchId),
          phoneNumber: records[i].phoneNumber,
          customerName: records[i].customerName,
          status: 'import_error',
          importError: error.message,
          importData: { rowNumber: i + 1, ...records[i] },
          createdAt: new Date(),
          updatedAt: new Date()
        };
        db.callRecords.set(id, badRecord);
        
        db.addHistoryLog(
          id,
          'import_error',
          operator,
          `导入失败：${error.message}`,
          null,
          'import_error'
        );
      }
    }
    
    return results;
  }
}

module.exports = new CallRecordService();
