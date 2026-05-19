const { Parser } = require('json2csv');
const cleaningService = require('./cleaningService');

class ExportService {
  async exportToCSV(filters = {}) {
    const result = await cleaningService.getRecords(filters);
    const records = result.records;

    const fields = [
      { label: 'ID', value: 'id' },
      { label: '房间号', value: 'room_number' },
      { label: '保洁员', value: 'cleaner_name' },
      { label: '入住日期', value: 'checkin_date' },
      { label: '退房日期', value: 'checkout_date' },
      { label: '开始时间', value: 'start_time' },
      { label: '结束时间', value: 'end_time' },
      { label: '照片数量', value: 'photo_count' },
      { label: '状态', value: 'status' },
      { label: '异常类型', value: 'exception_types' },
      { label: '得分', value: 'score' },
      { label: '扣款金额', value: 'deduction_amount' },
      { label: '返工次数', value: 'rework_count' },
      { label: '是否返工', value: row => row.is_reworked ? '是' : '否' },
      { label: '审核人', value: 'auditor_name' },
      { label: '审核时间', value: 'audit_time' },
      { label: '审核备注', value: 'audit_remark' },
      { label: '创建时间', value: 'created_at' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    return {
      csv,
      summary: result.summary,
      filename: `保洁记录_${new Date().toISOString().split('T')[0]}.csv`
    };
  }

  async getExportData(filters = {}) {
    const result = await cleaningService.getRecords(filters);

    return {
      ...result,
      filters,
      exportTime: new Date().toISOString()
    };
  }
}

module.exports = new ExportService();
