const { Parser } = require('json2csv');
const verificationService = require('./verificationService');
const { maskPhone } = require('../utils/security');

class ReportService {
  async generateCSVReport(filters = {}) {
    const records = await verificationService.getVerificationRecords(filters);
    
    const fields = [
      { label: '核验时间', value: 'created_at' },
      { label: '核验类型', value: 'verification_type' },
      { label: '标识', value: 'identifier' },
      { label: '姓名', value: 'name' },
      { label: '手机号', value: 'phone' },
      { label: '车牌号', value: 'license_plate' },
      { label: '状态', value: 'status' },
      { label: '结果', value: 'result' },
      { label: '原因', value: 'reason' },
      { label: '操作人', value: 'operator' },
      { label: '门岗', value: 'gate' }
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);

    return {
      csv,
      totalRecords: records.length,
      filters
    };
  }

  async generateDetailedReport(filters = {}) {
    const records = await verificationService.getVerificationRecords(filters);
    const stats = await verificationService.getStatistics(filters);

    const reportData = records.map(r => ({
      核验时间: r.created_at,
      核验类型: this.getTypeName(r.verification_type),
      标识: r.identifier,
      姓名: r.name || '-',
      手机号: r.phone ? maskPhone(r.phone) : '-',
      车牌号: r.license_plate || '-',
      状态: this.getStatusName(r.status),
      结果: r.result === 'passed' ? '通过' : '拦截',
      原因: r.reason,
      操作人: r.operator,
      门岗: r.gate || '-'
    }));

    const fields = [
      '核验时间', '核验类型', '标识', '姓名', '手机号', '车牌号',
      '状态', '结果', '原因', '操作人', '门岗'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(reportData);

    return {
      csv,
      summary: {
        ...stats.summary,
        generatedAt: new Date().toISOString(),
        filters
      },
      breakdowns: {
        byOperator: stats.byOperator,
        byStatus: stats.byStatus,
        byType: stats.byType
      },
      records: reportData
    };
  }

  getTypeName(type) {
    const types = {
      'visitor': '访客预约',
      'plate': '临时车牌',
      'unauthorized': '越权放行'
    };
    return types[type] || type;
  }

  getStatusName(status) {
    const statuses = {
      'passed': '通过',
      'blocked': '拦截',
      'manual_release': '人工放行'
    };
    return statuses[status] || status;
  }
}

module.exports = new ReportService();
