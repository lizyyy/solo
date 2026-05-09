const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const { requireAuth, requireRole, logAudit } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', async (req, res, next) => {
  try {
    const { status, search } = req.query;
    let sql = `SELECT * FROM candidates WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (search) {
      sql += ` AND (name LIKE ? OR position LIKE ? OR phone LIKE ? OR email LIKE ?)`;
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }
    sql += ` ORDER BY updated_at DESC`;

    const candidates = await db.all(sql, params);
    res.json({ success: true, candidates });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const candidate = await db.get(
      `SELECT * FROM candidates WHERE id = ?`,
      [req.params.id]
    );

    if (!candidate) {
      res.json({ success: true, candidate });
    } else {
      res.status(404).json({ success: false, message: '候选人不存在' });
    }
  } catch (err) {
    next(err);
  }
});

router.post('/', requireRole('hr', 'hr_admin'), logAudit('create_candidate', 'candidate'), async (req, res, next) => {
  try {
    const { name, phone, email, position, department, status } = req.body;

    if (!name || !position) {
      return res.status(400).json({ success: false, message: '姓名和职位为必填项' });
    }

    const id = uuidv4();
    const candidateStatus = status || 'interviewing';

    await db.run(
      `INSERT INTO candidates (id, name, phone, email, position, department, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, name, phone, email, position, department, candidateStatus]
    );

    const candidate = await db.get(`SELECT * FROM candidates WHERE id = ?`, [id]);
    res.status(201).json({ success: true, candidate });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', requireRole('hr', 'hr_admin'), logAudit('update_candidate', 'candidate'), async (req, res, next) => {
  try {
    const { name, phone, email, position, department, status } = req.body;
    const candidate = await db.get(`SELECT * FROM candidates WHERE id = ?`, [req.params.id]);

    if (!candidate) {
      await db.run(
        `UPDATE candidates SET name = ?, phone = ?, email = ?, position = ?, department = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [name || candidate.name, phone || candidate.phone, email || candidate.email, position || candidate.position, department || candidate.department, status || candidate.status, req.params.id]
      );
      const updated = await db.get(`SELECT * FROM candidates WHERE id = ?`, [req.params.id]);
      res.json({ success: true, candidate: updated });
    } else {
      res.status(404).json({ success: false, message: '候选人不存在' });
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', requireRole('hr_admin'), logAudit('delete_candidate', 'candidate'), async (req, res, next) => {
  try {
    const result = await db.run(`DELETE FROM candidates WHERE id = ?`, [req.params.id]);
    if (result.changes > 0) {
      res.json({ success: true, message: '候选人已删除' });
    } else {
      res.status(404).json({ success: false, message: '候选人不存在' });
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
