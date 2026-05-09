const TransferExecutionService = require('./transfer-execution.service');
const FeeService = require('./fee.service');
const AccessService = require('./access.service');
const HistoryService = require('./history.service');

class DormTransferOrchestrator {
  static async completeTransferWorkflow(applicationId, operator = 'system') {
    const steps = [];
    
    try {
      steps.push({
        step: 1,
        name: '执行换寝',
        status: 'pending',
        description: '释放原床位，占用新床位，更新学生信息'
      });
      
      const transferResult = TransferExecutionService.executeTransfer(applicationId, operator);
      steps[0].status = 'completed';
      steps[0].result = transferResult;
      
      steps.push({
        step: 2,
        name: '费用重算',
        status: 'pending',
        description: '根据入住时间计算原床位退款和新床位费用'
      });
      
      const feeResult = FeeService.recalculateFee(applicationId, operator);
      steps[1].status = 'completed';
      steps[1].result = feeResult;
      
      steps.push({
        step: 3,
        name: '门禁同步',
        status: 'pending',
        description: '更新门禁卡权限，添加新床位，移除旧床位'
      });
      
      const accessResult = AccessService.syncAccessAfterTransfer(applicationId, operator);
      steps[2].status = 'completed';
      steps[2].result = accessResult;
      
      return {
        success: true,
        application_id: applicationId,
        workflow_status: 'completed',
        steps: steps,
        summary: {
          transfer_status: 'completed',
          fee_adjustment: feeResult.net_adjustment,
          access_sync: 'success',
          total_steps: 3,
          completed_steps: 3
        },
        message: '换寝流程全部完成'
      };
      
    } catch (error) {
      const failedStep = steps.find(s => s.status === 'pending') || steps[steps.length - 1];
      if (failedStep) {
        failedStep.status = 'failed';
        failedStep.error = error.message;
      }
      
      HistoryService.logOperation(
        'TRANSFER_WORKFLOW_FAILED',
        'transfer_applications',
        applicationId,
        operator,
        `换寝流程失败: ${error.message}`
      );
      
      return {
        success: false,
        application_id: applicationId,
        workflow_status: 'failed',
        failed_at_step: failedStep ? failedStep.step : 'unknown',
        steps: steps,
        error: error.message,
        message: '换寝流程执行失败，请检查日志后重试'
      };
    }
  }
  
  static getWorkflowStatus(applicationId) {
    const TransferService = require('./transfer.service');
    const app = TransferService.getApplicationById(applicationId);
    
    if (!app) {
      return { error: '申请不存在' };
    }
    
    const status = {
      application_id: applicationId,
      application_no: app.application_no,
      status: app.status,
      student: {
        id: app.student_id,
        name: app.student_name,
        student_no: app.student_no
      },
      beds: {
        original: {
          bed_code: app.original_bed_code,
          room_code: app.original_room_code,
          building: app.original_building_name
        },
        target: {
          bed_code: app.target_bed_code,
          room_code: app.target_room_code,
          building: app.target_building_name
        }
      },
      steps: []
    };
    
    if (['approved', 'completed', 'reversed'].includes(app.status)) {
      status.steps.push({
        name: '换寝执行',
        status: app.status === 'completed' || app.status === 'reversed' ? 'completed' : 'pending',
        completed_at: app.completed_at
      });
      
      const adjustments = FeeService.getFeeAdjustments(app.student_id);
      const relatedAdjustment = adjustments.find(a => 
        a.original_fee_id || a.new_fee_id
      );
      
      status.steps.push({
        name: '费用重算',
        status: relatedAdjustment ? 'completed' : 'pending',
        completed_at: relatedAdjustment?.created_at,
        amount: relatedAdjustment?.adjustment_amount
      });
      
      const syncLogs = AccessService.getSyncLogs(app.student_id, 10);
      const relatedSync = syncLogs.find(log => {
        const oldBeds = log.old_bed_ids || [];
        const newBeds = log.new_bed_ids || [];
        return oldBeds.includes(app.original_bed_id) || newBeds.includes(app.target_bed_id);
      });
      
      status.steps.push({
        name: '门禁同步',
        status: relatedSync ? 'completed' : 'pending',
        completed_at: relatedSync?.synced_at,
        sync_no: relatedSync?.sync_no
      });
    }
    
    return status;
  }
}

module.exports = DormTransferOrchestrator;