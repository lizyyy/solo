const moment = require('moment');
const { db } = require('../database');
const config = require('../config');

const analyzeDeletionEligibility = (requestId) => {
  const scanResults = db.prepare(`
    SELECT sr.* FROM scan_results sr
    WHERE sr.request_id = ?
  `).all(requestId);

  const analysis = [];
  const now = moment();

  for (const result of scanResults) {
    const analysisItem = analyzeSingleRecord(result, now);
    analysis.push(analysisItem);
  }

  return analysis;
};

const analyzeSingleRecord = (scanResult, now) => {
  let canDelete = true;
  let retentionReason = null;
  let retentionCategory = null;

  switch (scanResult.data_type) {
    case 'order':
      canDelete = analyzeOrder(scanResult, now);
      if (!canDelete) {
        retentionReason = '订单在账务保留期内（1年），根据《会计法》和税务法规要求必须保留';
        retentionCategory = '财务保留';
      }
      break;

    case 'ticket':
      canDelete = analyzeTicket(scanResult, now);
      if (!canDelete) {
        retentionReason = '工单未关闭或在服务保留期内（90天），需保留用于售后服务和争议解决';
        retentionCategory = '服务保留';
      }
      break;

    case 'log':
      canDelete = analyzeLog(scanResult, now);
      if (!canDelete) {
        retentionReason = '日志在合规监控期内（180天），根据《网络安全法》要求需保留审计轨迹';
        retentionCategory = '合规保留';
      }
      break;

    case 'user_profile':
      canDelete = true;
      break;

    case 'marketing':
      canDelete = true;
      break;

    default:
      canDelete = true;
  }

  return {
    scanResultId: scanResult.id,
    dataType: scanResult.data_type,
    recordId: scanResult.record_id,
    recordSummary: scanResult.record_summary,
    canDelete,
    retentionReason,
    retentionCategory
  };
};

const getRecordByTypeAndId = (dataType, recordId) => {
  switch (dataType) {
    case 'order':
      return db.prepare(`SELECT * FROM mock_orders WHERE id = ?`).get(recordId);
    case 'ticket':
      return db.prepare(`SELECT * FROM mock_support_tickets WHERE id = ?`).get(recordId);
    case 'log':
      return db.prepare(`SELECT * FROM mock_log_indexes WHERE id = ?`).get(recordId);
    case 'user_profile':
      return db.prepare(`SELECT * FROM mock_user_profiles WHERE id = ?`).get(recordId);
    case 'marketing':
      return db.prepare(`SELECT * FROM mock_marketing_records WHERE id = ?`).get(recordId);
    default:
      return null;
  }
};

const analyzeOrder = (scanResult, now) => {
  const order = db.prepare(`
    SELECT * FROM mock_orders WHERE id = ?
  `).get(scanResult.record_id);

  if (!order) return true;

  const orderDate = moment(order.order_date);
  const retentionDays = config.RETENTION_PERIOD_DAYS.order;
  const daysSinceOrder = now.diff(orderDate, 'days');

  return daysSinceOrder > retentionDays;
};

const analyzeTicket = (scanResult, now) => {
  const ticket = db.prepare(`
    SELECT * FROM mock_support_tickets WHERE id = ?
  `).get(scanResult.record_id);

  if (!ticket) return true;

  if (ticket.status !== 'closed') {
    return false;
  }

  const ticketCreated = moment(ticket.created_at);
  const retentionDays = config.RETENTION_PERIOD_DAYS.ticket;
  const daysSinceCreation = now.diff(ticketCreated, 'days');

  return daysSinceCreation > retentionDays;
};

const analyzeLog = (scanResult, now) => {
  const log = db.prepare(`
    SELECT * FROM mock_log_indexes WHERE id = ?
  `).get(scanResult.record_id);

  if (!log) return true;

  const logCreated = moment(log.created_at);
  const retentionDays = config.RETENTION_PERIOD_DAYS.log;
  const daysSinceCreation = now.diff(logCreated, 'days');

  return daysSinceCreation > retentionDays;
};

const updateScanResultsWithAnalysis = (analysis) => {
  const updateStmt = db.prepare(`
    UPDATE scan_results 
    SET can_delete = ?, retention_reason = ?, retention_category = ?
    WHERE id = ?
  `);

  const transaction = db.transaction((items) => {
    for (const item of items) {
      updateStmt.run(
        item.canDelete ? 1 : 0,
        item.retentionReason,
        item.retentionCategory,
        item.scanResultId
      );
    }
  });

  transaction(analysis);
};

const getDeletionSummary = (requestId) => {
  const summary = {
    total: 0,
    deletable: 0,
    retained: 0,
    byType: {},
    retainedByCategory: {}
  };

  const results = db.prepare(`
    SELECT data_type, can_delete, retention_category, COUNT(*) as count
    FROM scan_results 
    WHERE request_id = ?
    GROUP BY data_type, can_delete, retention_category
  `).all(requestId);

  for (const result of results) {
    const dataType = result.data_type;
    const typeName = config.DATA_TYPES[dataType] || dataType;
    
    if (!summary.byType[typeName]) {
      summary.byType[typeName] = {
        total: 0,
        deletable: 0,
        retained: 0
      };
    }

    summary.total += result.count;
    summary.byType[typeName].total += result.count;

    if (result.can_delete === 1) {
      summary.deletable += result.count;
      summary.byType[typeName].deletable += result.count;
    } else {
      summary.retained += result.count;
      summary.byType[typeName].retained += result.count;

      if (result.retention_category) {
        if (!summary.retainedByCategory[result.retention_category]) {
          summary.retainedByCategory[result.retention_category] = 0;
        }
        summary.retainedByCategory[result.retention_category] += result.count;
      }
    }
  }

  return summary;
};

module.exports = {
  analyzeDeletionEligibility,
  updateScanResultsWithAnalysis,
  getDeletionSummary
};
