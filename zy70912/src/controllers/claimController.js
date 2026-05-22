const { searchClaims, getClaimDetail, exportClaims } = require('../services/queryService');
const { processClaim, batchProcess, getClaimLogs } = require('../services/processingService');

async function searchClaimsHandler(req, res) {
  try {
    const filters = {
      baggage_tag_no: req.query.baggage_tag_no,
      responsible_segment: req.query.responsible_segment,
      compensation_level: req.query.compensation_level,
      status: req.query.status,
      batch_id: req.query.batch_id,
      is_overdue: req.query.is_overdue !== undefined ? req.query.is_overdue === 'true' : undefined,
      needs_manual_review: req.query.needs_manual_review !== undefined ? req.query.needs_manual_review === 'true' : undefined
    };

    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 50;

    const result = await searchClaims(filters, page, pageSize);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getClaimHandler(req, res) {
  try {
    const { id } = req.params;
    const claim = await getClaimDetail(id);
    
    if (!claim) {
      return res.status(404).json({ error: '申诉记录不存在' });
    }
    
    res.json({ success: true, data: claim });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function processClaimHandler(req, res) {
  try {
    const { id } = req.params;
    const { action, handler, reason } = req.body;

    if (!action || !handler) {
      return res.status(400).json({ error: '操作类型和处理人不能为空' });
    }

    const result = await processClaim(id, action, handler, reason);
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
}

async function batchProcessHandler(req, res) {
  try {
    const { claim_ids, action, handler, reason } = req.body;

    if (!claim_ids || !action || !handler) {
      return res.status(400).json({ error: '申诉ID列表、操作类型和处理人不能为空' });
    }

    const results = await batchProcess(claim_ids, action, handler, reason);
    res.json({ success: true, results });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function exportClaimsHandler(req, res) {
  try {
    const filters = {
      baggage_tag_no: req.query.baggage_tag_no,
      responsible_segment: req.query.responsible_segment,
      compensation_level: req.query.compensation_level,
      status: req.query.status,
      batch_id: req.query.batch_id,
      is_overdue: req.query.is_overdue !== undefined ? req.query.is_overdue === 'true' : undefined,
      needs_manual_review: req.query.needs_manual_review !== undefined ? req.query.needs_manual_review === 'true' : undefined
    };

    const result = await exportClaims(filters);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="claims_export_${Date.now()}.csv"`);
    res.send('\uFEFF' + result.csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

async function getClaimLogsHandler(req, res) {
  try {
    const { id } = req.params;
    const logs = await getClaimLogs(id);
    res.json({ success: true, data: logs });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  searchClaimsHandler,
  getClaimHandler,
  processClaimHandler,
  batchProcessHandler,
  exportClaimsHandler,
  getClaimLogsHandler
};
