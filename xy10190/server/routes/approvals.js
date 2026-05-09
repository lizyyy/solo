const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAuth, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const populateOffer = async (offer) => {
  if (!offer) return null;

  const candidate = await db.get(`SELECT * FROM candidates WHERE id = ?`, [offer.candidate_id]);
  const creator = await db.get(`SELECT id, name, role FROM users WHERE id = ?`, [offer.created_by]);
  const approverIds = JSON.parse(offer.approver_ids || '[]');
  const approvers = [];
  
  for (const id of approverIds) {
    const appr = await db.get(`SELECT id, name, role, department FROM users WHERE id = ?`, [id]);
    if (appr) approvers.push(appr);
  }

  const approvalRecords = await db.all(
    `SELECT ar.*, u.name as approver_name 
     FROM approval_records ar 
     LEFT JOIN users u ON ar.approver_id = u.id 
     WHERE ar.offer_id = ? 
     ORDER BY ar.approver_order, ar.created_at`,
    [offer.id]
  );

  const versions = await db.all(
    `SELECT id, version, status, created_at, change_reason 
     FROM offers 
     WHERE candidate_id = ? 
     ORDER BY version ASC`,
    [offer.candidate_id]
  );

  return {
    ...offer,
    approver_ids: approverIds,
    approvers,
    candidate,
    creator,
    approval_records: approvalRecords,
    versions
  };
};

router.get('/my-pending', async (req, res, next) => {
  try {
    const userId = req.session.userId;
    const offers = await db.all(
      `SELECT o.* FROM offers o WHERE o.status = 'pending_approval'`
    );

    const myPending = [];
    for (const offer of offers) {
      const approverIds = JSON.parse(offer.approver_ids || '[]');
      if (approverIds[offer.current_approver_index] === userId) {
        const populated = await populateOffer(offer);
        myPending.push(populated);
      }
    }

    res.json({ success: true, offers: myPending });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', requireRole('manager', 'director', 'hr_admin'), logAudit('approve_offer', 'offer'), async (req, res, next) => {
  try {
    const { comment } = req.body;
    const userId = req.session.userId;
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: '该 Offer 不在审批中' });
    }

    const approverIds = JSON.parse(offer.approver_ids || '[]');
    const currentApproverId = approverIds[offer.current_approver_index];

    if (currentApproverId !== userId) {
      return res.status(403).json({ success: false, message: '当前不是您的审批轮次' });
    }

    const approvalId = uuidv4();
    await db.run(
      `INSERT INTO approval_records (id, offer_id, approver_id, action, comment, approver_order) VALUES (?, ?, ?, 'approve', ?, ?)`,
      [approvalId, offer.id, userId, comment, offer.current_approver_index + 1]
    );

    const nextIndex = offer.current_approver_index + 1;
    let newStatus = offer.status;

    if (nextIndex >= approverIds.length) {
      newStatus = 'approved';
      await db.run(
        `UPDATE candidates SET status = 'offer_sent', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [offer.candidate_id]
      );
    }

    await db.run(
      `UPDATE offers SET current_approver_index = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [nextIndex, newStatus, offer.id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [offer.id]);
    const populated = await populateOffer(updated);

    const message = nextIndex >= approverIds.length 
      ? '审批通过，Offer 已生效' 
      : `已同意，等待下一位审批人`;

    res.json({ success: true, offer: populated, message });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject', requireRole('manager', 'director', 'hr_admin'), logAudit('reject_offer', 'offer'), async (req, res, next) => {
  try {
    const { comment } = req.body;
    const userId = req.session.userId;
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      return res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'pending_approval') {
      return res.status(400).json({ success: false, message: '该 Offer 不在审批中' });
    }

    const approverIds = JSON.parse(offer.approver_ids || '[]');
    const currentApproverId = approverIds[offer.current_approver_index];

    if (currentApproverId !== userId) {
      return res.status(403).json({ success: false, message: '当前不是您的审批轮次' });
    }

    if (!comment || comment.trim() === '') {
      return res.status(400).json({ success: false, message: '拒绝时必须填写原因' });
    }

    const approvalId = uuidv4();
    await db.run(
      `INSERT INTO approval_records (id, offer_id, approver_id, action, comment, approver_order) VALUES (?, ?, ?, 'reject', ?, ?)`,
      [approvalId, offer.id, userId, comment, offer.current_approver_index + 1]
    );

    await db.run(
      `UPDATE offers SET status = 'rejected', change_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [comment, offer.id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [offer.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated, message: '已拒绝该 Offer' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/history', async (req, res, next) => {
  try {
    const records = await db.all(
      `SELECT ar.*, u.name as approver_name, u.role as approver_role 
       FROM approval_records ar 
       LEFT JOIN users u ON ar.approver_id = u.id 
       WHERE ar.offer_id = ? 
       ORDER BY ar.approver_order, ar.created_at`,
      [req.params.id]
    );
    res.json({ success: true, records });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
