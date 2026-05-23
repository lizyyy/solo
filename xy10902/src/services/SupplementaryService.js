const SupplementaryDeduction = require('../models/SupplementaryDeduction');
const Vehicle = require('../models/Vehicle');
const DeductionRecord = require('../models/DeductionRecord');
const ExceptionLog = require('../models/ExceptionLog');

class SupplementaryService {
  static async createApplication(data) {
    return await SupplementaryDeduction.create(data);
  }

  static async reviewApplication(supplementaryNo, action, reviewer, reviewRemark) {
    const supplementary = await SupplementaryDeduction.findBySupplementaryNo(supplementaryNo);
    if (!supplementary) {
      await ExceptionLog.create({
        exception_type: 'supplementary_not_found',
        raw_input: { supplementaryNo, action, reviewer, reviewRemark },
        error_message: '补扣申请不存在',
        processing_result: '抛出错误返回400',
        api_path: '/api/v1/supplementary/review'
      });
      throw new Error('补扣申请不存在');
    }

    if (supplementary.status !== 'pending') {
      await ExceptionLog.create({
        exception_type: 'supplementary_invalid_status',
        raw_input: { supplementaryNo, currentStatus: supplementary.status, action, reviewer },
        error_message: `当前状态为${supplementary.status}，无法审核`,
        processing_result: '抛出错误返回400',
        api_path: '/api/v1/supplementary/review'
      });
      throw new Error(`当前状态为${supplementary.status}，无法审核`);
    }

    if (!['approved', 'rejected', 'compensated'].includes(action)) {
      await ExceptionLog.create({
        exception_type: 'supplementary_invalid_action',
        raw_input: { supplementaryNo, action, reviewer },
        error_message: `无效的审核操作: ${action}`,
        processing_result: '抛出错误返回400',
        api_path: '/api/v1/supplementary/review'
      });
      throw new Error('无效的审核操作');
    }

    await SupplementaryDeduction.updateStatus(supplementary.id, action, reviewer, reviewRemark);

    if (action === 'approved') {
      return await this.executeDeduction(supplementary.id);
    }

    await ExceptionLog.create({
      exception_type: `supplementary_${action}`,
      raw_input: { supplementaryNo, action, reviewer, reviewRemark },
      error_message: `补扣申请${action === 'rejected' ? '已驳回' : '已补偿免扣'}`,
      processing_result: `状态更新为${action}`,
      api_path: '/api/v1/supplementary/review'
    });

    return {
      success: true,
      supplementary_no: supplementaryNo,
      status: action,
      message: action === 'rejected' ? '已驳回' : '已补偿免扣'
    };
  }

  static async executeDeduction(supplementaryId) {
    const supplementary = await SupplementaryDeduction.findById(supplementaryId);
    if (!supplementary) {
      await ExceptionLog.create({
        exception_type: 'supplementary_not_found',
        raw_input: { supplementaryId },
        error_message: '补扣申请不存在',
        processing_result: '抛出错误',
        api_path: '/api/v1/supplementary/execute'
      });
      throw new Error('补扣申请不存在');
    }

    const vehicle = await Vehicle.findByPlate(supplementary.plate_number);
    if (!vehicle) {
      await ExceptionLog.create({
        exception_type: 'supplementary_vehicle_not_found',
        raw_input: supplementary,
        error_message: '车辆未注册，无法执行补扣',
        processing_result: '返回失败状态',
        api_path: '/api/v1/supplementary/execute'
      });
      return {
        success: false,
        supplementary_no: supplementary.supplementary_no,
        status: 'failed',
        message: '车辆未注册，无法执行补扣'
      };
    }

    if (vehicle.balance < supplementary.amount) {
      await ExceptionLog.create({
        exception_type: 'supplementary_balance_insufficient',
        raw_input: { ...supplementary, currentBalance: vehicle.balance },
        error_message: `余额不足: 当前${vehicle.balance}元, 需${supplementary.amount}元`,
        processing_result: '返回余额不足状态',
        api_path: '/api/v1/supplementary/execute'
      });
      return {
        success: false,
        supplementary_no: supplementary.supplementary_no,
        status: 'balance_insufficient',
        current_balance: vehicle.balance,
        required_amount: supplementary.amount,
        message: '余额不足'
      };
    }

    const balanceBefore = vehicle.balance;
    const balanceAfter = balanceBefore - supplementary.amount;
    await Vehicle.updateBalance(vehicle.id, balanceAfter);

    await DeductionRecord.create({
      plate_number: supplementary.plate_number,
      vehicle_id: vehicle.id,
      event_id: supplementary.original_event_id,
      amount: supplementary.amount,
      deduction_type: 'supplementary',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      remark: `补扣执行: ${supplementary.reason}`
    });

    await SupplementaryDeduction.markDeducted(supplementary.id);

    await ExceptionLog.create({
      exception_type: 'supplementary_deducted',
      raw_input: supplementary,
      error_message: `补扣执行成功: ${supplementary.amount}元`,
      processing_result: '补扣成功，余额已更新',
      api_path: '/api/v1/supplementary/execute'
    });

    return {
      success: true,
      supplementary_no: supplementary.supplementary_no,
      status: 'deducted',
      amount: supplementary.amount,
      balance_after: balanceAfter
    };
  }

  static getStatusFlow() {
    return {
      pending: ['approved', 'rejected', 'compensated'],
      approved: ['deducted'],
      rejected: [],
      compensated: [],
      deducted: []
    };
  }
}

module.exports = SupplementaryService;
