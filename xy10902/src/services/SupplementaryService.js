const SupplementaryDeduction = require('../models/SupplementaryDeduction');
const Vehicle = require('../models/Vehicle');
const DeductionRecord = require('../models/DeductionRecord');

class SupplementaryService {
  static async createApplication(data) {
    return await SupplementaryDeduction.create(data);
  }

  static async reviewApplication(supplementaryNo, action, reviewer, reviewRemark) {
    const supplementary = await SupplementaryDeduction.findBySupplementaryNo(supplementaryNo);
    if (!supplementary) {
      throw new Error('补扣申请不存在');
    }

    if (supplementary.status !== 'pending') {
      throw new Error(`当前状态为${supplementary.status}，无法审核`);
    }

    if (!['approved', 'rejected', 'compensated'].includes(action)) {
      throw new Error('无效的审核操作');
    }

    await SupplementaryDeduction.updateStatus(supplementary.id, action, reviewer, reviewRemark);

    if (action === 'approved') {
      return await this.executeDeduction(supplementary.id);
    }

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
      throw new Error('补扣申请不存在');
    }

    const vehicle = await Vehicle.findByPlate(supplementary.plate_number);
    if (!vehicle) {
      return {
        success: false,
        supplementary_no: supplementary.supplementary_no,
        status: 'failed',
        message: '车辆未注册，无法执行补扣'
      };
    }

    if (vehicle.balance < supplementary.amount) {
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
