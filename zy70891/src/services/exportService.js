const { Parser } = require('json2csv');
const { getDailySummaries, getBatchStats } = require('./batchService');

async function exportToCSV(batchId) {
  const summaries = await getDailySummaries(batchId);
  const stats = await getBatchStats(batchId);

  if (!summaries || summaries.length === 0) {
    return null;
  }

  const fields = [
    { label: '日期', value: 'summary_date' },
    { label: '对象ID', value: 'object_id' },
    { label: '对象姓名', value: 'object_name' },
    { label: '风险等级', value: 'risk_level' },
    { label: '签到状态', value: 'checkin_status' },
    { label: '签到来源', value: 'checkin_sources' },
    { label: '请假状态', value: 'leave_status' },
    { label: '请假覆盖范围', value: 'leave_coverage' },
    { label: '定位状态', value: 'location_status' },
    { label: '定位缺口小时数', value: 'location_gap_hours' },
    { label: '定位来源', value: 'location_sources' },
    { label: '最终处理结果', value: 'final_result' },
    { label: '处理原因说明', value: 'final_reason' },
    { label: '处理人', value: 'processed_by' }
  ];

  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(summaries);

  return {
    csv,
    stats,
    recordCount: summaries.length
  };
}

module.exports = {
  exportToCSV
};
