const { db } = require('../database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const config = require('../config');

const generateCertificateNumber = () => {
  const dateStr = moment().format('YYYYMMDD');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${config.CERTIFICATE_PREFIX}-${dateStr}-${random}`;
};

const generateComplianceView = (request, executionResults, summary) => {
  const deletedItems = executionResults.filter(e => e.action === 'physical_delete');
  const retainedItems = executionResults.filter(e => e.action === 'retain_with_anonymization');

  const retainedByCategory = {};
  retainedItems.forEach(item => {
    if (item.retention_category) {
      if (!retainedByCategory[item.retention_category]) {
        retainedByCategory[item.retention_category] = [];
      }
      retainedByCategory[item.retention_category].push({
        data_type: config.DATA_TYPES[item.data_type] || item.data_type,
        record_summary: item.record_summary,
        reason: item.retention_reason
      });
    }
  });

  return {
    certificate_type: 'compliance_view',
    request_id: request.id,
    customer_id: request.customer_id,
    customer_name: request.customer_name,
    customer_email: request.customer_email,
    request_type: request.request_type,
    data_scope: request.data_scope,
    requested_at: request.requested_at,
    completed_at: request.completed_at,
    summary: {
      total_records: summary.total,
      deleted: summary.deletable,
      retained: summary.retained,
      by_data_type: summary.byType
    },
    deleted_records: deletedItems.map(item => ({
      data_type: config.DATA_TYPES[item.data_type] || item.data_type,
      record_summary: item.record_summary,
      action: item.action,
      executed_at: item.executed_at
    })),
    retained_records: retainedByCategory,
    legal_compliance_notes: [
      '本删除操作符合《中华人民共和国个人信息保护法》要求',
      '所有删除操作均已记录审计日志',
      '保留数据已进行脱敏处理，仅保留法规要求的最小必要信息'
    ],
    issued_by: '合规管理系统',
    issued_at: moment().toISOString()
  };
};

const generateCustomerView = (request, summary) => {
  return {
    certificate_type: 'customer_view',
    customer_name: request.customer_name,
    confirmation: `您的个人数据删除请求已处理完成`,
    summary: {
      records_processed: summary.total,
      records_deleted: summary.deletable,
      records_retained: summary.retained
    },
    retained_records_notice: summary.retained > 0
      ? '部分数据因法律或账务要求需暂时保留，我们已对这些数据进行脱敏处理，仅保留法规要求的必要信息。保留期限届满后将自动删除。'
      : '您的所有个人数据已完全删除。',
    request_reference: request.id,
    certificate_number: null,
    issued_at: moment().toISOString(),
    note: '本证明仅供客户参考，如需详细处理报告请联系客服。'
  };
};

const createCertificate = (requestId) => {
  const request = db.prepare(`SELECT * FROM deletion_requests WHERE id = ?`).get(requestId);
  if (!request) {
    throw new Error('删除请求不存在');
  }

  const executionResults = db.prepare(`
    SELECT de.*, sr.record_summary, sr.retention_reason, sr.retention_category
    FROM deletion_executions de
    LEFT JOIN scan_results sr ON de.scan_result_id = sr.id
    WHERE de.request_id = ?
  `).all(requestId);

  const summary = calculateSummary(requestId);
  const certificateNumber = generateCertificateNumber();
  const certificateId = uuidv4();

  const complianceView = generateComplianceView(request, executionResults, summary);
  const customerView = generateCustomerView(request, summary);

  customerView.certificate_number = certificateNumber;

  const insertCertificate = db.prepare(`
    INSERT INTO deletion_certificates (
      id, request_id, certificate_number, issued_at, issued_by, 
      compliance_view, customer_view
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertCertificate.run(
    certificateId,
    requestId,
    certificateNumber,
    moment().toISOString(),
    '合规管理系统',
    JSON.stringify(complianceView),
    JSON.stringify(customerView)
  );

  return {
    certificate_id: certificateId,
    certificate_number: certificateNumber,
    compliance_view: complianceView,
    customer_view: customerView
  };
};

const calculateSummary = (requestId) => {
  const results = db.prepare(`
    SELECT can_delete, COUNT(*) as count
    FROM scan_results 
    WHERE request_id = ?
    GROUP BY can_delete
  `).all(requestId);

  const summary = {
    total: 0,
    deletable: 0,
    retained: 0,
    byType: {}
  };

  results.forEach(result => {
    summary.total += result.count;
    if (result.can_delete === 1) {
      summary.deletable += result.count;
    } else {
      summary.retained += result.count;
    }
  });

  const byTypeResults = db.prepare(`
    SELECT data_type, can_delete, COUNT(*) as count
    FROM scan_results 
    WHERE request_id = ?
    GROUP BY data_type, can_delete
  `).all(requestId);

  byTypeResults.forEach(result => {
    const typeName = config.DATA_TYPES[result.data_type] || result.data_type;
    if (!summary.byType[typeName]) {
      summary.byType[typeName] = {
        total: 0,
        deletable: 0,
        retained: 0
      };
    }
    summary.byType[typeName].total += result.count;
    if (result.can_delete === 1) {
      summary.byType[typeName].deletable += result.count;
    } else {
      summary.byType[typeName].retained += result.count;
    }
  });

  return summary;
};

const getCertificateById = (certificateId) => {
  const certificate = db.prepare(`SELECT * FROM deletion_certificates WHERE id = ?`).get(certificateId);
  if (!certificate) return null;

  return {
    ...certificate,
    compliance_view: certificate.compliance_view ? JSON.parse(certificate.compliance_view) : null,
    customer_view: certificate.customer_view ? JSON.parse(certificate.customer_view) : null
  };
};

const getCertificateByNumber = (certificateNumber) => {
  const certificate = db.prepare(`SELECT * FROM deletion_certificates WHERE certificate_number = ?`).get(certificateNumber);
  if (!certificate) return null;

  return {
    ...certificate,
    compliance_view: certificate.compliance_view ? JSON.parse(certificate.compliance_view) : null,
    customer_view: certificate.customer_view ? JSON.parse(certificate.customer_view) : null
  };
};

const getCertificateByRequest = (requestId) => {
  const certificate = db.prepare(`SELECT * FROM deletion_certificates WHERE request_id = ?`).get(requestId);
  if (!certificate) return null;

  return {
    ...certificate,
    compliance_view: certificate.compliance_view ? JSON.parse(certificate.compliance_view) : null,
    customer_view: certificate.customer_view ? JSON.parse(certificate.customer_view) : null
  };
};

module.exports = {
  createCertificate,
  getCertificateById,
  getCertificateByNumber,
  getCertificateByRequest
};
