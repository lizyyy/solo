import * as settlementDao from '../dao/settlementDao';
import * as weighingDao from '../dao/weighingDao';
import * as priceDao from '../dao/priceDao';
import { SettlementReport, SettlementItem } from '../types';
import { createExceptionRecord } from '../dao/settlementDao';

export const generateSettlementReport = async (customerId: number, startDate: string, endDate: string, generatedBy: string): Promise<{ reportId: number; reportNo: string }> => {
  try {
    const unsettledRecords = await weighingDao.getUnsettledRecordsByCustomer(customerId);
    
    if (unsettledRecords.length === 0) {
      throw new Error('该客户暂无待结算记录');
    }

    const pricedRecords = unsettledRecords.filter(r => r.status === 'priced');
    if (pricedRecords.length === 0) {
      throw new Error('所有记录均未录入价格，无法结算');
    }

    const reportNo = `S${Date.now()}${Math.floor(Math.random() * 1000)}`;
    let totalAmount = 0;
    const items: Omit<SettlementItem, 'report_id'>[] = [];

    for (const record of pricedRecords) {
      const priceVersion = await priceDao.getCurrentPrice(record.category_id, record.weigh_time || new Date().toISOString());
      if (!priceVersion) continue;

      const netWeight = record.net_weight || (record.gross_weight - record.tare_weight);
      const deductionRatio = record.deduction_ratio || 0;
      const finalWeight = netWeight * (1 - deductionRatio);
      const amount = finalWeight * priceVersion.price;

      items.push({
        weighing_record_id: record.id!,
        net_weight: finalWeight,
        unit_price: priceVersion.price,
        amount
      });

      totalAmount += amount;
    }

    const reportId = await settlementDao.createSettlementReport({
      report_no: reportNo,
      customer_id: customerId,
      start_date: startDate,
      end_date: endDate,
      total_amount: totalAmount,
      status: 'draft',
      generated_by: generatedBy
    });

    for (const item of items) {
      await settlementDao.createSettlementItem({
        ...item,
        report_id: reportId
      });
    }

    return { reportId, reportNo: reportNo };
  } catch (error: any) {
    await createExceptionRecord({
      type: 'GENERATE_SETTLEMENT_ERROR',
      original_input: JSON.stringify({ customerId, startDate, endDate, generatedBy }),
      error_message: error.message
    });
    throw error;
  }
};

export const confirmSettlement = async (reportId: number): Promise<void> => {
  try {
    const report = await settlementDao.getSettlementReportById(reportId);
    if (!report) {
      throw new Error('结算报告不存在');
    }

    if (report.status === 'confirmed') {
      throw new Error('该报告已确认，不能重复确认');
    }

    const items = await settlementDao.getSettlementItemsByReportId(reportId);

    for (const item of items) {
      const record = await weighingDao.getWeighingRecordById(item.weighing_record_id);
      if (record && record.status === 'settled') {
        throw new Error(`称重记录 ${item.weighing_record_id} 已结算，禁止重复结算`);
      }
    }

    await settlementDao.updateSettlementReportStatus(reportId, 'confirmed');

    for (const item of items) {
      await weighingDao.updateWeighingRecordStatus(item.weighing_record_id, 'settled', {
        settled_time: new Date().toISOString()
      });
    }
  } catch (error: any) {
    await createExceptionRecord({
      type: 'CONFIRM_SETTLEMENT_ERROR',
      original_input: JSON.stringify({ reportId }),
      error_message: error.message
    });
    throw error;
  }
};

export const getReportWithDetails = async (reportId: number): Promise<{
  report: SettlementReport;
  items: SettlementItem[];
}> => {
  const report = await settlementDao.getSettlementReportById(reportId);
  if (!report) {
    throw new Error('结算报告不存在');
  }

  const items = await settlementDao.getSettlementItemsByReportId(reportId);

  return { report, items };
};
