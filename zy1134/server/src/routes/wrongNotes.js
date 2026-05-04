import express from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

const validate = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    next();
  };
};

// 获取错题本列表
router.get('/',
  validate([
    query('userId').isInt(),
    query('status').optional().isString(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, status, page = 1, limit = 20 } = req.query;
      
      let countQuery = `
        SELECT COUNT(*) as total FROM wrong_notes wn
        WHERE wn.user_id = ?
      `;
      const countParams = [parseInt(userId)];
      
      let dataQuery = `
        SELECT wn.*, 
               q.type, q.difficulty, q.content, q.explanation,
               a.user_answer, a.error_tags,
               kp.name as knowledge_point_name
        FROM wrong_notes wn
        JOIN questions q ON wn.question_id = q.id
        JOIN answers a ON wn.answer_id = a.id
        LEFT JOIN knowledge_points kp ON q.knowledge_point_id = kp.id
        WHERE wn.user_id = ?
      `;
      const dataParams = [parseInt(userId)];
      
      if (status) {
        countQuery += ' AND wn.status = ?';
        dataQuery += ' AND wn.status = ?';
        countParams.push(status);
        dataParams.push(status);
      }
      
      // 统计总数
      const countResult = db.prepare(countQuery).get(...countParams);
      const total = countResult.total;
      
      // 分页
      const offset = (parseInt(page) - 1) * parseInt(limit);
      dataQuery += ' ORDER BY wn.created_at DESC LIMIT ? OFFSET ?';
      dataParams.push(parseInt(limit), offset);
      
      const wrongNotes = db.prepare(dataQuery).all(...dataParams);
      
      // 解析 JSON 字段
      const parsedWrongNotes = wrongNotes.map(wn => ({
        ...wn,
        content: JSON.parse(wn.content),
        user_answer: JSON.parse(wn.user_answer),
        error_tags: wn.error_tags ? JSON.parse(wn.error_tags) : null
      }));
      
      res.json({
        data: parsedWrongNotes,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching wrong notes:', error);
      res.status(500).json({ error: 'Failed to fetch wrong notes' });
    }
  }
);

// 获取单个错题详情
router.get('/:id',
  validate([
    param('id').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      
      const wrongNote = db.prepare(`
        SELECT wn.*, 
               q.type, q.difficulty, q.content, q.correct_answer, q.explanation,
               a.user_answer, a.error_tags,
               kp.name as knowledge_point_name
        FROM wrong_notes wn
        JOIN questions q ON wn.question_id = q.id
        JOIN answers a ON wn.answer_id = a.id
        LEFT JOIN knowledge_points kp ON q.knowledge_point_id = kp.id
        WHERE wn.id = ?
      `).get(parseInt(id));
      
      if (!wrongNote) {
        return res.status(404).json({ error: 'Wrong note not found' });
      }
      
      // 获取批注
      const annotations = db.prepare(`
        SELECT a.*, u.username as teacher_name
        FROM annotations a
        JOIN users u ON a.user_id = u.id
        WHERE a.wrong_note_id = ?
        ORDER BY a.created_at
      `).all(parseInt(id));
      
      // 解析 JSON 字段
      const parsedWrongNote = {
        ...wrongNote,
        content: JSON.parse(wrongNote.content),
        correct_answer: JSON.parse(wrongNote.correct_answer),
        user_answer: JSON.parse(wrongNote.user_answer),
        error_tags: wrongNote.error_tags ? JSON.parse(wrongNote.error_tags) : null,
        annotations
      };
      
      res.json({ data: parsedWrongNote });
    } catch (error) {
      console.error('Error fetching wrong note:', error);
      res.status(500).json({ error: 'Failed to fetch wrong note' });
    }
  }
);

// 更新错题状态
router.put('/:id/status',
  validate([
    param('id').isInt(),
    body('status').isString().isIn(['active', 'reviewed', 'mastered'])
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      const { status } = req.body;
      
      // 检查错题是否存在
      const existingWrongNote = db.prepare('SELECT * FROM wrong_notes WHERE id = ?').get(parseInt(id));
      if (!existingWrongNote) {
        return res.status(404).json({ error: 'Wrong note not found' });
      }
      
      db.prepare(`
        UPDATE wrong_notes 
        SET status = ?, review_count = review_count + 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(status, parseInt(id));
      
      res.json({ message: 'Wrong note status updated successfully' });
    } catch (error) {
      console.error('Error updating wrong note status:', error);
      res.status(500).json({ error: 'Failed to update wrong note status' });
    }
  }
);

// 添加教师批注
router.post('/:id/annotations',
  validate([
    param('id').isInt(),
    body('userId').isInt(),
    body('content').isString().notEmpty()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      const { userId, content } = req.body;
      
      // 检查错题是否存在
      const existingWrongNote = db.prepare('SELECT * FROM wrong_notes WHERE id = ?').get(parseInt(id));
      if (!existingWrongNote) {
        return res.status(404).json({ error: 'Wrong note not found' });
      }
      
      const result = db.prepare(`
        INSERT INTO annotations (user_id, wrong_note_id, content)
        VALUES (?, ?, ?)
      `).run(parseInt(userId), parseInt(id), content);
      
      res.status(201).json({
        data: {
          id: result.lastInsertRowid,
          userId,
          wrongNoteId: parseInt(id),
          content,
          createdAt: new Date().toISOString()
        }
      });
    } catch (error) {
      console.error('Error adding annotation:', error);
      res.status(500).json({ error: 'Failed to add annotation' });
    }
  }
);

// 获取错因统计
router.get('/statistics/error-tags',
  validate([
    query('userId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId } = req.query;
      
      const wrongNotes = db.prepare(`
        SELECT wn.error_tags
        FROM wrong_notes wn
        WHERE wn.user_id = ? AND wn.status = 'active'
      `).all(parseInt(userId));
      
      const tagCounts = {};
      wrongNotes.forEach(wn => {
        if (wn.error_tags) {
          const tags = JSON.parse(wn.error_tags);
          tags.forEach(tag => {
            tagCounts[tag] = (tagCounts[tag] || 0) + 1;
          });
        }
      });
      
      // 按数量排序
      const sortedTags = Object.entries(tagCounts)
        .map(([tag, count]) => ({ tag, count }))
        .sort((a, b) => b.count - a.count);
      
      res.json({ data: sortedTags });
    } catch (error) {
      console.error('Error fetching error tag statistics:', error);
      res.status(500).json({ error: 'Failed to fetch error tag statistics' });
    }
  }
);

export default router;
