const config = require('../config');
const dayjs = require('dayjs');
const ReplacementApplication = require('../models/ReplacementApplication');
const Device = require('../models/Device');
const RecycleRecord = require('../models/RecycleRecord');
const StatusHistoryService = require('./StatusHistoryService');
const OperationLogService = require('./OperationLogService');
const IdempotencyService = require('./IdempotencyService');

class RecycleService {
  canStartRecycle(application) {
    const allowedStatuses = [
      config.business.status.SHIPPED,
      config.business.status.WAITING_RECYCLE,
      config.business.status.RECYCLING
    ];
    return allowedStatuses.includes(application.status);
  }

  canCompleteRecycle(application) {
    const allowedStatuses = [
      config.business.status.WAITING_RECYCLE,
      config.business.status.RECYCLING,
      config.business.status.RECYCLE_OVERDUE
    ];
    return allowedStatuses.includes(application.status);
  }

  startRecycleProcess(applicationId, recycleData, operator) {
    const requestKey = IdempotencyService.generateRequestKey('recycle_start', applicationId);
    
    return IdempotencyService.checkAndExecute(requestKey, 'recycle_start', applicationId, () => {
      const application = ReplacementApplication.findById(applicationId);
      if (!application) {
        throw new Error('申请单不存在');
      }

      if (!this.canStartRecycle(application)) {
        throw new Error(`当前状态 ${application.status} 不允许启动回收流程`);
      }

      let recycleRecord = RecycleRecord.findByApplicationId(applicationId);
      
      if (recycleRecord) {
        return {
          application,
          recycleRecord,
          isDuplicate: true,
          message: '回收流程已启动'
        };
      }

      const defaultTimeoutDays = config.business.recycle.defaultTimeoutDays;
      const expectedReceiveDate = recycleData.expected_receive_date || 
        dayjs().add(defaultTimeoutDays, 'day').format('YYYY-MM-DD');

      recycleRecord = RecycleRecord.create({
        application_id: applicationId,
        original_device_id: application.original_device_id,
        recycle_tracking_no: recycleData.recycle_tracking_no,
        recycle_company: recycleData.recycle_company,
        recycle_address: recycleData.recycle_address,
        status: config.business.recycleStatus.IN_PROGRESS,
        expected_receive_date: expectedReceiveDate,
        operator
      });

      OperationLogService.recordOperation(
        applicationId,
        'RECYCLE_START',
        'RECYCLE',
        operator,
        null,
        recycleRecord,
        `启动原机回收，预计回收日期: ${expectedReceiveDate}`
      );

      const result = StatusHistoryService.updateApplicationStatus(
        applicationId,
        config.business.status.RECYCLING,
        'RECYCLE',
        operator,
        '原机回收中',
        {
          expected_receive_date: expectedReceiveDate,
          tracking_no: recycleData.recycle_tracking_no
        }
      );

      return {
        application: result.application,
        recycleRecord
      };
    });
  }

  confirmReceive(applicationId, receiveData, operator) {
    const recycleRecord = RecycleRecord.findByApplicationId(applicationId);
    if (!recycleRecord) {
      throw new Error('该申请单没有回收记录');
    }

    const application = ReplacementApplication.findById(applicationId);
    if (!this.canCompleteRecycle(application)) {
      throw new Error(`当前状态 ${application.status} 不允许确认回收`);
    }

    const beforeRecycle = { ...recycleRecord };

    RecycleRecord.update(recycleRecord.id, {
      status: config.business.recycleStatus.RECEIVED,
      actual_receive_date: receiveData.actual_receive_date || new Date().toISOString(),
      operator
    });

    OperationLogService.recordOperation(
      applicationId,
      'RECYCLE_RECEIVE',
      'RECYCLE',
      operator,
      beforeRecycle,
      { ...beforeRecycle, status: 'RECEIVED' },
      '原机已收到'
    );

    StatusHistoryService.updateApplicationStatus(
      applicationId,
      config.business.status.RECYCLED,
      'RECYCLE',
      operator,
      '原机回收完成',
      {
        actual_receive_date: receiveData.actual_receive_date || new Date().toISOString()
      }
    );

    return {
      recycleRecord: RecycleRecord.findById(recycleRecord.id),
      application: ReplacementApplication.findById(applicationId)
    };
  }

  completeInspection(applicationId, inspectionData, operator) {
    const recycleRecord = RecycleRecord.findByApplicationId(applicationId);
    if (!recycleRecord) {
      throw new Error('该申请单没有回收记录');
    }

    const beforeRecycle = { ...recycleRecord };

    RecycleRecord.update(recycleRecord.id, {
      status: config.business.recycleStatus.COMPLETED,
      inspection_notes: inspectionData.inspection_notes,
      operator
    });

    const originalDevice = Device.findById(recycleRecord.original_device_id);
    if (originalDevice) {
      const beforeDevice = { ...originalDevice };
      Device.update(originalDevice.id, {
        is_new: 0,
        current_owner_id: null
      });
      
      OperationLogService.recordOperation(
        applicationId,
        'RECYCLE_INSPECT',
        'RECYCLE',
        operator,
        beforeDevice,
        { ...beforeDevice, is_new: 0, current_owner_id: null },
        inspectionData.inspection_notes || '原机检验完成'
      );
    }

    OperationLogService.recordOperation(
      applicationId,
      'RECYCLE_COMPLETE',
      'RECYCLE',
      operator,
      beforeRecycle,
      { ...beforeRecycle, status: 'COMPLETED' },
      inspectionData.inspection_notes || '原机回收检验完成'
    );

    return {
      recycleRecord: RecycleRecord.findById(recycleRecord.id),
      application: ReplacementApplication.findById(applicationId)
    };
  }

  checkOverdue() {
    const overdueRecords = RecycleRecord.findOverdueRecords();
    
    const results = [];
    for (const record of overdueRecords) {
      const application = ReplacementApplication.findById(record.application_id);
      if (application && application.status !== config.business.status.RECYCLE_OVERDUE) {
        const beforeRecycle = { ...record };
        
        RecycleRecord.update(record.id, {
          status: config.business.recycleStatus.OVERDUE
        });

        OperationLogService.recordOperation(
          record.application_id,
          'RECYCLE_OVERDUE',
          'RECYCLE',
          'SYSTEM',
          beforeRecycle,
          { ...beforeRecycle, status: 'OVERDUE' },
          '系统检测：原机回收逾期'
        );

        StatusHistoryService.updateApplicationStatus(
          record.application_id,
          config.business.status.RECYCLE_OVERDUE,
          'RECYCLE',
          'SYSTEM',
          '原机回收逾期，请联系客户',
          {
            overdue_date: new Date().toISOString(),
            expected_date: record.expected_receive_date
          }
        );

        results.push({
          application_id: record.application_id,
          application_no: application.application_no,
          overdue_days: dayjs().diff(dayjs(record.expected_receive_date), 'day')
        });
      }
    }

    return results;
  }

  getRecycleRecord(applicationId) {
    return RecycleRecord.findByApplicationId(applicationId);
  }

  getAllOverdue() {
    return this.checkOverdue();
  }
}

module.exports = new RecycleService();
