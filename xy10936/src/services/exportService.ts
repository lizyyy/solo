import { Parser } from 'json2csv';
import * as settlementDao from '../dao/settlementDao';
import * as weighingDao from '../dao/weighingDao';
import * as customerDao from '../dao/customerDao';
import * as categoryDao from '../dao/categoryDao';
import { createExceptionRecord } from '../dao/settlementDao';

export const exportSettlementReportToCSV = async (reportId: number): Promise<string> => {
  try {
    const report = await settlementDao.getSettlementReportById(reportId);
    if (!report) {
      throw new Error('结算报告不存在');
    }

    const customer = await customerDao.getCustomerById(report.customer_id);
    const items = await settlementDao.getSettlementItemsByReportId(reportId);

    const detailedItems = [];
    for (const item of items) {
      const record = await weighingDao.getWeighingRecordById(item.weighing_record_id);
      if (record) {
        const category = await categoryDao.getCategoryById(record.category_id);
        detailedItems.push({
          record_no: record.record_no,
          category: category?.name || '未知',
          gross_weight: record.gross_weight,
          tare_weight: record.tare_weight,
          net_weight: item.net_weight.toFixed(2),
          unit_price: item.unit_price.toFixed(2),
          amount: item.amount.toFixed(2),
          weigh_time: record.weigh_time
        });
      }
    }

    const reportInfo = [
      { field: '结算单号', value: report.report_no },
      { field: '客户名称', value: customer?.name || '未知' },
      { field: '开始日期', value: report.start_date },
      { field: '结束日期', value: report.end_date },
      { field: '总金额', value: report.total_amount.toFixed(2) },
      { field: '状态', value: report.status === 'confirmed' ? '已确认' : '草稿' },
      { field: '生成时间', value: report.generated_at },
      {},
      { field: '称重单号', value: '品类', net_weight: '净重(kg)', unit_price: '单价(元/kg)', amount: '金额(元)', weigh_time: '称重时间' }
    ];

    const fields = ['record_no', 'category', 'gross_weight', 'tare_weight', 'net_weight', 'unit_price', 'amount', 'weigh_time'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(detailedItems);

    return csv;
  } catch (error: any) {
    await createExceptionRecord({
      type: 'EXPORT_ERROR',
      original_input: JSON.stringify({ reportId }),
      error_message: error.message
    });
    throw error;
  }
};

export const exportWeighingRecordsToCSV = async (customerId?: number, status?: string): Promise<string> => {
  try {
    let records;
    if (customerId) {
      records = await weighingDao.getWeighingRecordsByCustomer(customerId);
    } else if (status) {
      records = await weighingDao.getWeighingRecordsByStatus(status);
    } else {
      records = await weighingDao.getAllWeighingRecords();
    }

    const detailedRecords = [];
    for (const record of records) {
      const customer = await customerDao.getCustomerById(record.customer_id);
      const category = await categoryDao.getCategoryById(record.category_id);
      
      detailedRecords.push({
        record_no: record.record_no,
        customer: customer?.name || '未知',
        category: category?.name || '未知',
        gross_weight: record.gross_weight.toFixed(2),
        tare_weight: record.tare_weight.toFixed(2),
        net_weight: (record.net_weight || 0).toFixed(2),
        deduction_ratio: ((record.deduction_ratio || 0) * 100).toFixed(1) + '%',
        status: getStatusText(record.status || ''),
        created_at: record.created_at
      });
    }

    const fields = ['record_no', 'customer', 'category', 'gross_weight', 'tare_weight', 'net_weight', 'deduction_ratio', 'status', 'created_at'];
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(detailedRecords);

    return csv;
  } catch (error: any) {
    await createExceptionRecord({
      type: 'EXPORT_ERROR',
      original_input: JSON.stringify({ customerId, status }),
      error_message: error.message
    });
    throw error;
  }
};

function getStatusText(status: string): string {
  const statusMap: Record<string, string> = {
    'pending': '待复核',
    'verified': '已复核',
    'priced': '已录价',
    'settled': '已结算'
  };
  return statusMap[status] || status;
}
