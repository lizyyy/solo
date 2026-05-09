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

router.get('/', async (req, res, next) => {
  try {
    const { status, candidate_id, search } = req.query;
    let sql = `SELECT o.* FROM offers o LEFT JOIN candidates c ON o.candidate_id = c.id WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND o.status = ?`;
      params.push(status);
    }
    if (candidate_id) {
      sql += ` AND o.candidate_id = ?`;
      params.push(candidate_id);
    }
    if (search) {
      sql += ` AND (c.name LIKE ? OR c.position LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm);
    }
    sql += ` ORDER BY o.updated_at DESC`;

    const offers = await db.all(sql, params);
    const populatedOffers = await Promise.all(offers.map(populateOffer));

    res.json({ success: true, offers: populatedOffers });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      res.json({ success: true, offer });
    } else {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('hr', 'hr_admin'), logAudit('create_offer', 'offer'), async (req, res, next) => {
  try {
    const {
      candidate_id, base_salary, bonus, benefits, start_date,
      probation_period, work_location, approver_ids, change_reason, parent_offer_id
    } = req.body;

    if (!candidate_id || !base_salary || !start_date || !approver_ids || approver_ids.length === 0) {
      return res.status(400).json({ success: false, message: '缺少必填字段：候选人、基本工资、入职日期、审批人' });
    }

    if (base_salary <= 0 || probation_period < 0 || probation_period > 6) {
      return res.status(400).json({ success: false, message: '薪资必须为正，试用期不能超过6个月' });
    }

    const candidate = await db.get(`SELECT * FROM candidates WHERE id = ?`, [candidate_id]);
    if (!candidate) {
      return res.status(404).json({ success: false, message: '候选人不存在' });
    }

    let version = 1;
    if (parent_offer_id) {
      const parentOffer = await db.get(`SELECT * FROM offers WHERE id = ?`, [parent_offer_id]);
      if (!parentOffer) {
        return res.status(404).json({ success: false, message: '父版本 Offer 不存在' });
      }
      if (parentOffer.status !== 'approved' && parentOffer.status !== 'rejected') {
        return res.status(400).json({ success: false, message: '只能基于已审批的 Offer 创建新版本' });
      }
      version = parentOffer.version + 1;
    }

    const id = uuidv4();
    await db.run(
      `INSERT INTO offers (id, candidate_id, version, base_salary, bonus, benefits, start_date, probation_period, work_location, approver_ids, current_approver_index, status, created_by, parent_offer_id, change_reason) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 'draft', ?, ?, ?)`,
      [
        id, candidate_id, version, base_salary, bonus || 0, benefits, start_date,
        probation_period || 3, work_location, JSON.stringify(approver_ids),
        req.session.userId, parent_offer_id, change_reason
      ]
    );

    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [id]);
    const populated = await populateOffer(offer);

    res.status(201).json({ success: true, offer: populated });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('hr', 'hr_admin'), logAudit('update_offer', 'offer'), async (req, res, next) => {
  try {
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只能修改草稿状态的 Offer' });
    }

    const {
      base_salary, bonus, benefits, start_date, probation_period,
      work_location, approver_ids, change_reason
    } = req.body;

    const currentApprovers = JSON.parse(offer.approver_ids);
    const newApprovers = approver_ids || currentApprovers;

    await db.run(
      `UPDATE offers SET base_salary = ?, bonus = ?, benefits = ?, start_date = ?, probation_period = ?, work_location = ?, approver_ids = ?, change_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`,
      [
        base_salary || offer.base_salary,
        bonus !== undefined ? bonus : offer.bonus,
        benefits !== undefined ? benefits : offer.benefits,
        start_date || offer.start_date,
        probation_period !== undefined ? probation_period : offer.probation_period,
        work_location !== undefined ? work_location : offer.work_location,
        JSON.stringify(newApprovers),
        change_reason !== undefined ? change_reason : offer.change_reason,
        req.params.id
      ]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', requireRole('hr', 'hr_admin'), logAudit('submit_offer', 'offer'), async (req, res, next) => {
  try {
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'draft') {
      return res.status(400).json({ success: false, message: '只有草稿状态的 Offer 可以提交审批' });
    }

    const approvers = JSON.parse(offer.approver_ids || '[]');
    if (approvers.length === 0) {
      return res.status(400).json({ success: false, message: '请至少选择一名审批人' });
    }

    await db.run(
      `UPDATE offers SET status = 'pending_approval', current_approver_index = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'draft'`,
      [req.params.id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated, message: 'Offer 已提交审批' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/withdraw', requireRole('hr', 'hr_admin'), logAudit('withdraw_offer', 'offer'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'pending_approval' && offer.status !== 'approved') {
      return res.status(400).json({ success: false, message: '只能撤回审批中或已审批的 Offer' });
    }

    await db.run(
      `UPDATE offers SET status = 'withdrawn', change_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || 'HR 撤回', req.params.id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated, message: 'Offer 已撤回' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/accept', requireRole('hr', 'hr_admin'), logAudit('accept_offer', 'offer'), async (req, res, next) => {
  try {
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'approved') {
      return res.status(400).json({ success: false, message: '只能确认已审批通过的 Offer' });
    }

    await db.run(
      `UPDATE offers SET is_accepted = 1, accepted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [req.params.id]
    );

    await db.run(
      `UPDATE candidates SET status = 'offer_accepted', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [offer.candidate_id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated, message: '候选人已确认接受 Offer' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/reject-candidate', requireRole('hr', 'hr_admin'), logAudit('reject_candidate_offer', 'offer'), async (req, res, next) => {
  try {
    const { reason } = req.body;
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);

    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'approved') {
      return res.status(400).json({ success: false, message: '只能处理已审批通过的 Offer' });
    }

    await db.run(
      `UPDATE offers SET status = 'rejected_by_candidate', change_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [reason || '候选人拒绝', req.params.id]
    );

    await db.run(
      `UPDATE candidates SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [offer.candidate_id]
    );

    const updated = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    const populated = await populateOffer(updated);

    res.json({ success: true, offer: populated, message: '候选人已拒绝 Offer' });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('hr_admin'), logAudit('delete_offer', 'offer'), async (req, res, next) => {
  try {
    const offer = await db.get(`SELECT * FROM offers WHERE id = ?`, [req.params.id]);
    if (!offer) {
      res.status(404).json({ success: false, message: 'Offer 不存在' });
    }

    if (offer.status !== 'draft' && offer.status !== 'withdrawn') {
      return res.status(400).json({ success: false, message: '只能删除草稿或已撤回的 Offer' });
    }

    await db.run(`DELETE FROM approval_records WHERE offer_id = ?`, [req.params.id]);
    await db.run(`DELETE FROM offers WHERE id = ?`, [req.params.id]);

    res.json({ success: true, message: 'Offer 已删除' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
