const ContentModel = require('../models/ContentModel');
const { Parser } = require('json2csv');

class ExportService {
  static async exportToCSV(filters = {}) {
    const data = await ContentModel.getAllForExport(filters);
    
    const fields = [
      { label: '内容ID', value: 'content_id' },
      { label: '内容类型', value: 'content_type' },
      { label: '内容摘要', value: 'content_text' },
      { label: '作者', value: 'author_name' },
      { label: '拦截时间', value: 'block_time' },
      { label: '内容状态', value: 'content_status' },
      { label: '申诉ID', value: 'appeal_id' },
      { label: '申诉状态', value: 'appeal_status' },
      { label: '申诉人', value: 'submitter_name' },
      { label: '申诉理由', value: 'appeal_reason' },
      { label: '处置类型', value: 'disposal_type' },
      { label: '处置备注', value: 'disposal_note' },
      { label: '审核员', value: 'assignee_name' },
      { label: '申诉时间', value: 'appeal_created_at' }
    ];

    const json2csvParser = new Parser({ fields });
    return json2csvParser.parse(data);
  }

  static async generateReport() {
    const allAppeals = await ContentModel.getAllForExport({});
    
    const stats = {
      total: allAppeals.length,
      pending: allAppeals.filter(a => a.appeal_status === 'pending').length,
      reviewing: allAppeals.filter(a => a.appeal_status === 'reviewing').length,
      approved: allAppeals.filter(a => a.appeal_status === 'approved').length,
      rejected: allAppeals.filter(a => a.appeal_status === 'rejected').length,
      escalated: allAppeals.filter(a => a.appeal_status === 'escalated').length,
      approvalRate: allAppeals.length > 0 
        ? ((allAppeals.filter(a => a.appeal_status === 'approved').length / allAppeals.length) * 100).toFixed(2) + '%'
        : '0%'
    };

    return {
      stats,
      data: allAppeals.slice(0, 100),
      generatedAt: new Date().toISOString()
    };
  }
}

module.exports = ExportService;
