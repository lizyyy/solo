import { SettlementModel } from '../models/SettlementModel';
import { DeductionModel } from '../models/DeductionModel';
import { createObjectCsvStringifier } from 'csv-writer';
import { Settlement, DeductionType } from '../types';
import dayjs from 'dayjs';

export interface SettlementReport {
  settlement: {
    id: string;
    settlementNo: string;
    cleanerName: string;
    startDate: string;
    endDate: string;
    status: string;
  };
  summary: {
    totalTasks: number;
    totalBaseAmount: number;
    totalReworkCount: number;
    totalReworkDeduction: number;
    totalOvertimeDeduction: number;
    totalComplaintDeduction: number;
    totalPhotoDeduction: number;
    totalOtherDeduction: number;
    totalDeduction: number;
    netAmount: number;
  };
  deductionBreakdown: Array<{
    type: string;
    typeName: string;
    amount: number;
    percentage: string;
    count: number;
  }>;
  items: Array<{
    taskNo: string;
    homestayName: string;
    baseAmount: number;
    reworkDeduction: number;
    overtimeDeduction: number;
    complaintDeduction: number;
    photoDeduction: number;
    otherDeduction: number;
    totalDeduction: number;
    netAmount: number;
  }>;
  generatedAt: string;
}

export class ReportGenerator {
  static generateSettlementReport(settlementId: string): SettlementReport {
    const data = SettlementModel.getItemsBySettlementId(settlementId);
    const settlement = data.settlement!;

    const deductions = DeductionModel.getBySettlementId(settlementId);
    
    const deductionByType = new Map<DeductionType, { amount: number; count: number }>();
    for (const deduction of deductions) {
      const existing = deductionByType.get(deduction.type) || { amount: 0, count: 0 };
      existing.amount += deduction.amount;
      existing.count += 1;
      deductionByType.set(deduction.type, existing);
    }

    const deductionTypeNames: Record<DeductionType, string> = {
      [DeductionType.MISSING_PHOTOS]: '缺图扣款',
      [DeductionType.OVERTIME]: '超时扣款',
      [DeductionType.COMPLAINT]: '客诉扣款',
      [DeductionType.REWORK]: '返工扣款',
      [DeductionType.DAMAGE]: '损坏扣款',
      [DeductionType.OTHER]: '其他扣款'
    };

    const deductionBreakdown: SettlementReport['deductionBreakdown'] = [];
    for (const [type, info] of deductionByType.entries()) {
      deductionBreakdown.push({
        type,
        typeName: deductionTypeNames[type] || type,
        amount: info.amount,
        percentage: settlement.totalBaseAmount > 0 
          ? ((info.amount / settlement.totalBaseAmount) * 100).toFixed(2) + '%'
          : '0%',
        count: info.count
      });
    }

    return {
      settlement: {
        id: settlement.id,
        settlementNo: settlement.settlementNo,
        cleanerName: settlement.cleanerName,
        startDate: settlement.startDate,
        endDate: settlement.endDate,
        status: settlement.status
      },
      summary: {
        totalTasks: settlement.totalTasks,
        totalBaseAmount: settlement.totalBaseAmount,
        totalReworkCount: settlement.totalReworkCount,
        totalReworkDeduction: settlement.totalReworkDeduction,
        totalOvertimeDeduction: settlement.totalOvertimeDeduction,
        totalComplaintDeduction: settlement.totalComplaintDeduction,
        totalPhotoDeduction: settlement.totalPhotoDeduction,
        totalOtherDeduction: settlement.totalOtherDeduction,
        totalDeduction: settlement.totalDeduction,
        netAmount: settlement.netAmount
      },
      deductionBreakdown,
      items: data.items.map(item => ({
        taskNo: item.taskNo,
        homestayName: item.homestayName,
        baseAmount: item.baseAmount,
        reworkDeduction: item.reworkDeduction,
        overtimeDeduction: item.overtimeDeduction,
        complaintDeduction: item.complaintDeduction,
        photoDeduction: item.photoDeduction,
        otherDeduction: item.otherDeduction,
        totalDeduction: item.totalDeduction,
        netAmount: item.netAmount
      })),
      generatedAt: dayjs().toISOString()
    };
  }

  static async exportSettlementToCSV(settlementId: string): Promise<string> {
    const report = this.generateSettlementReport(settlementId);

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'taskNo', title: '任务编号' },
        { id: 'homestayName', title: '民宿名称' },
        { id: 'baseAmount', title: '基础金额' },
        { id: 'reworkDeduction', title: '返工扣款' },
        { id: 'overtimeDeduction', title: '超时扣款' },
        { id: 'complaintDeduction', title: '客诉扣款' },
        { id: 'photoDeduction', title: '缺图扣款' },
        { id: 'otherDeduction', title: '其他扣款' },
        { id: 'totalDeduction', title: '扣款合计' },
        { id: 'netAmount', title: '实发金额' }
      ]
    });

    const summaryRows = [
      { taskNo: '结算单号', homestayName: report.settlement.settlementNo },
      { taskNo: '保洁员', homestayName: report.settlement.cleanerName },
      { taskNo: '结算周期', homestayName: `${report.settlement.startDate} 至 ${report.settlement.endDate}` },
      { taskNo: '任务总数', homestayName: report.summary.totalTasks.toString() },
      { taskNo: '基础总额', homestayName: report.summary.totalBaseAmount.toString() },
      { taskNo: '返工次数', homestayName: report.summary.totalReworkCount.toString() },
      { taskNo: '扣款总额', homestayName: report.summary.totalDeduction.toString() },
      { taskNo: '实发总额', homestayName: report.summary.netAmount.toString() },
      {},
      { taskNo: '任务编号', homestayName: '民宿名称', baseAmount: '基础金额', reworkDeduction: '返工扣款', overtimeDeduction: '超时扣款', complaintDeduction: '客诉扣款', photoDeduction: '缺图扣款', otherDeduction: '其他扣款', totalDeduction: '扣款合计', netAmount: '实发金额' }
    ];

    const header = csvStringifier.getHeaderString();
    const records = csvStringifier.stringifyRecords(report.items);

    return `民宿保洁结算单\n${report.settlement.settlementNo}\n保洁员: ${report.settlement.cleanerName}\n周期: ${report.settlement.startDate} 至 ${report.settlement.endDate}\n生成时间: ${dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}\n\n汇总\n任务总数: ${report.summary.totalTasks}\n基础总额: ${report.summary.totalBaseAmount}\n返工扣款: ${report.summary.totalReworkDeduction}\n超时扣款: ${report.summary.totalOvertimeDeduction}\n客诉扣款: ${report.summary.totalComplaintDeduction}\n缺图扣款: ${report.summary.totalPhotoDeduction}\n其他扣款: ${report.summary.totalOtherDeduction}\n扣款总额: ${report.summary.totalDeduction}\n实发总额: ${report.summary.netAmount}\n\n明细\n${header}${records}`;
  }

  static generateValidationReport(taskId: string) {
    const ValidationEngine = require('../rules/ValidationEngine').ValidationEngine;
    return ValidationEngine.validateTaskById(taskId);
  }
}
