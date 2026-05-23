const moment = require('moment');
const ReconciliationSummary = require('../models/ReconciliationSummary');
const DeductionRecord = require('../models/DeductionRecord');
const GateEvent = require('../models/GateEvent');
const Vehicle = require('../models/Vehicle');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

class ReconciliationService {
  static async generateSummary(date) {
    const summaryDate = moment(date).format('YYYY-MM-DD');
    const startOfDay = `${summaryDate} 00:00:00`;
    const endOfDay = `${summaryDate} 23:59:59`;

    const deductions = await DeductionRecord.listByDateRange(startOfDay, endOfDay);
    
    const renewalRecords = deductions.filter(d => d.deduction_type === 'monthly_renewal');
    const temporaryRecords = deductions.filter(d => d.deduction_type === 'temporary');
    const supplementaryRecords = deductions.filter(d => d.deduction_type === 'supplementary');

    const totalRenewals = renewalRecords.length;
    const renewalAmount = renewalRecords.reduce((sum, d) => sum + d.amount, 0);
    const totalTemporary = temporaryRecords.length;
    const temporaryAmount = temporaryRecords.reduce((sum, d) => sum + d.amount, 0);
    
    const gateEventCount = await GateEvent.countByDateRange(startOfDay, endOfDay);

    const supplementaryAmount = supplementaryRecords.reduce((sum, d) => sum + d.amount, 0);

    const calculatedTotal = renewalAmount + temporaryAmount + supplementaryAmount;
    const actualTotal = deductions.filter(d => d.amount > 0).reduce((sum, d) => sum + d.amount, 0);
    const discrepancyAmount = actualTotal - calculatedTotal;

    await ReconciliationSummary.create({
      summary_date: summaryDate,
      total_renewals: totalRenewals,
      renewal_amount: renewalAmount,
      total_temporary_deductions: totalTemporary,
      temporary_amount: temporaryAmount,
      total_gate_events: gateEventCount,
      total_supplementary: supplementaryRecords.length,
      supplementary_amount: supplementaryAmount,
      discrepancy_amount: discrepancyAmount,
      status: 'generated'
    });

    return {
      summary_date: summaryDate,
      total_renewals: totalRenewals,
      renewal_amount: renewalAmount,
      total_temporary_deductions: totalTemporary,
      temporary_amount: temporaryAmount,
      total_gate_events: gateEventCount,
      total_supplementary: supplementaryRecords.length,
      supplementary_amount: supplementaryAmount,
      discrepancy_amount: discrepancyAmount,
      total_amount: actualTotal
    };
  }

  static async exportToCsv(startDate, endDate, exportPath) {
    const start = moment(startDate).format('YYYY-MM-DD 00:00:00');
    const end = moment(endDate).format('YYYY-MM-DD 23:59:59');

    const deductions = await DeductionRecord.listByDateRange(start, end);

    const exportDir = path.dirname(exportPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const csvWriter = createCsvWriter({
      path: exportPath,
      header: [
        { id: 'deduction_no', title: '扣费单号' },
        { id: 'plate_number', title: '车牌号' },
        { id: 'amount', title: '金额' },
        { id: 'deduction_type', title: '扣费类型' },
        { id: 'deduction_time', title: '扣费时间' },
        { id: 'balance_before', title: '扣前余额' },
        { id: 'balance_after', title: '扣后余额' },
        { id: 'status', title: '状态' },
        { id: 'remark', title: '备注' }
      ]
    });

    const typeMapping = {
      'monthly_renewal': '月租续费',
      'temporary': '临停扣费',
      'supplementary': '补扣执行',
      'recharge': '账户充值'
    };

    const records = deductions.map(d => ({
      ...d,
      deduction_type: typeMapping[d.deduction_type] || d.deduction_type
    }));

    await csvWriter.writeRecords(records);

    return {
      success: true,
      file_path: exportPath,
      record_count: records.length,
      date_range: { start: startDate, end: endDate }
    };
  }

  static async manualCorrect(deductionNo, newAmount, reason, operator) {
    const deduction = await DeductionRecord.findByDeductionNo(deductionNo);
    if (!deduction) {
      throw new Error('扣费记录不存在');
    }

    const vehicle = await Vehicle.findById(deduction.vehicle_id);
    if (!vehicle) {
      throw new Error('车辆不存在');
    }

    const amountDiff = newAmount - deduction.amount;
    const newBalance = vehicle.balance - amountDiff;
    await Vehicle.updateBalance(vehicle.id, newBalance);

    await DeductionRecord.create({
      plate_number: deduction.plate_number,
      vehicle_id: vehicle.id,
      amount: -amountDiff,
      deduction_type: 'correction',
      balance_before: vehicle.balance,
      balance_after: newBalance,
      remark: `人工调账: ${reason}, 操作人: ${operator}, 原单号: ${deductionNo}`
    });

    return {
      success: true,
      original_deduction_no: deductionNo,
      original_amount: deduction.amount,
      new_amount: newAmount,
      amount_diff: amountDiff,
      new_balance: newBalance,
      reason: reason
    };
  }
}

module.exports = ReconciliationService;
