const express = require('express');
const router = express.Router();
const {
  createNotice,
  updateNoticeStatus,
  sendReminder,
  completeMaterials,
  rejectNotice,
  sendToManualReview,
  getNoticeDetail,
  listNotices,
  NOTICE_STATUS
} = require('../services/noticeService');
const { getFullHistoryTimeline } = require('../services/historyService');
const { getConflictsByClaimId, resolveConflict } = require('../services/conflictService');
const { exportToCsv } = require('../services/importExportService');

router.post('/', (req, res) => {
  try {
    const notice = createNotice(req.body);
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', (req, res) => {
  try {
    const notices = listNotices(req.query);
    res.json({ success: true, data: notices });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const detail = getNoticeDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '通知不存在' });
    }
    res.json({ success: true, data: detail });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', (req, res) => {
  try {
    const { status, operator_id, operator_name, remark } = req.body;
    const notice = updateNoticeStatus(req.params.id, status, operator_id, operator_name, remark);
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/remind', (req, res) => {
  try {
    const { operator_id, operator_name } = req.body;
    const notice = sendReminder(req.params.id, operator_id, operator_name);
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/complete-materials', (req, res) => {
  try {
    const { claim_id, material_ids, operator_id, operator_name } = req.body;
    const materials = completeMaterials(claim_id, material_ids, operator_id, operator_name);
    res.json({ success: true, data: materials });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const { operator_id, operator_name, reason } = req.body;
    const notice = rejectNotice(req.params.id, operator_id, operator_name, reason);
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/manual-review', (req, res) => {
  try {
    const { operator_id, operator_name, reason } = req.body;
    const notice = sendToManualReview(req.params.id, operator_id, operator_name, reason);
    res.json({ success: true, data: notice });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/history', (req, res) => {
  try {
    const detail = getNoticeDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '通知不存在' });
    }
    const history = getFullHistoryTimeline(detail.claim_id);
    res.json({ success: true, data: history });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/conflicts', (req, res) => {
  try {
    const detail = getNoticeDetail(req.params.id);
    if (!detail) {
      return res.status(404).json({ success: false, error: '通知不存在' });
    }
    const conflicts = getConflictsByClaimId(detail.claim_id);
    res.json({ success: true, data: conflicts });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/conflicts/:conflictId/resolve', (req, res) => {
  try {
    const { resolution, resolved_by } = req.body;
    const conflict = resolveConflict(req.params.conflictId, resolution, resolved_by);
    res.json({ success: true, data: conflict });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/export/csv', (req, res) => {
  try {
    const csv = exportToCsv(req.query);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=notices.csv');
    res.send('\uFEFF' + csv);
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;
