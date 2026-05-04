import express from 'express';
import { body, param, query, validationResult } from 'express-validator';

const router = express.Router();

// 验证中间件
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

// 获取题目列表（支持筛选）
router.get('/', 
  validate([
    query('type').optional().isString(),
    query('knowledgePointId').optional().isInt(),
    query('difficulty').optional().isInt({ min: 1, max: 5 }),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { type, knowledgePointId, difficulty, page = 1, limit = 20 } = req.query;
      
      let query = 'SELECT * FROM questions WHERE 1=1';
      const params = [];
      
      if (type) {
        query += ' AND type = ?';
        params.push(type);
      }
      
      if (knowledgePointId) {
        query += ' AND knowledge_point_id = ?';
        params.push(parseInt(knowledgePointId));
      }
      
      if (difficulty) {
        query += ' AND difficulty = ?';
        params.push(parseInt(difficulty));
      }
      
      // 统计总数
      const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = db.prepare(countQuery).get(...params);
      const total = countResult.total;
      
      // 分页
      const offset = (parseInt(page) - 1) * parseInt(limit);
      query += ' ORDER BY id LIMIT ? OFFSET ?';
      params.push(parseInt(limit), offset);
      
      const questions = db.prepare(query).all(...params);
      
      // 解析 JSON 字段
      const parsedQuestions = questions.map(q => ({
        ...q,
        content: JSON.parse(q.content),
        options: q.options ? JSON.parse(q.options) : null,
        correct_answer: JSON.parse(q.correct_answer),
        tags: q.tags ? JSON.parse(q.tags) : null
      }));
      
      res.json({
        data: parsedQuestions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching questions:', error);
      res.status(500).json({ error: 'Failed to fetch questions' });
    }
  }
);

// 获取单个题目
router.get('/:id',
  validate([
    param('id').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      
      const question = db.prepare(`
        SELECT q.*, kp.name as knowledge_point_name
        FROM questions q
        LEFT JOIN knowledge_points kp ON q.knowledge_point_id = kp.id
        WHERE q.id = ?
      `).get(parseInt(id));
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      // 解析 JSON 字段
      const parsedQuestion = {
        ...question,
        content: JSON.parse(question.content),
        options: question.options ? JSON.parse(question.options) : null,
        correct_answer: JSON.parse(question.correct_answer),
        tags: question.tags ? JSON.parse(question.tags) : null
      };
      
      res.json({ data: parsedQuestion });
    } catch (error) {
      console.error('Error fetching question:', error);
      res.status(500).json({ error: 'Failed to fetch question' });
    }
  }
);

// 创建题目
router.post('/',
  validate([
    body('type').isString().isIn([
      'scale_identification',
      'chord_construction',
      'inversion',
      'roman_numeral',
      'cadence'
    ]),
    body('difficulty').optional().isInt({ min: 1, max: 5 }),
    body('content').isObject(),
    body('correct_answer').isObject(),
    body('explanation').optional().isString(),
    body('tags').optional().isArray()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { type, difficulty = 1, knowledge_point_id, content, options, correct_answer, explanation, tags } = req.body;
      
      const result = db.prepare(`
        INSERT INTO questions (type, difficulty, knowledge_point_id, content, options, correct_answer, explanation, tags)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        type,
        difficulty,
        knowledge_point_id || null,
        JSON.stringify(content),
        options ? JSON.stringify(options) : null,
        JSON.stringify(correct_answer),
        explanation || null,
        tags ? JSON.stringify(tags) : null
      );
      
      res.status(201).json({
        data: {
          id: result.lastInsertRowid,
          type,
          difficulty,
          knowledge_point_id,
          content,
          options,
          correct_answer,
          explanation,
          tags
        }
      });
    } catch (error) {
      console.error('Error creating question:', error);
      res.status(500).json({ error: 'Failed to create question' });
    }
  }
);

// 更新题目
router.put('/:id',
  validate([
    param('id').isInt(),
    body('type').optional().isString().isIn([
      'scale_identification',
      'chord_construction',
      'inversion',
      'roman_numeral',
      'cadence'
    ]),
    body('difficulty').optional().isInt({ min: 1, max: 5 })
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      const { type, difficulty, knowledge_point_id, content, options, correct_answer, explanation, tags } = req.body;
      
      // 检查题目是否存在
      const existingQuestion = db.prepare('SELECT * FROM questions WHERE id = ?').get(parseInt(id));
      if (!existingQuestion) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      const updates = [];
      const params = [];
      
      if (type) { updates.push('type = ?'); params.push(type); }
      if (difficulty !== undefined) { updates.push('difficulty = ?'); params.push(difficulty); }
      if (knowledge_point_id !== undefined) { updates.push('knowledge_point_id = ?'); params.push(knowledge_point_id); }
      if (content) { updates.push('content = ?'); params.push(JSON.stringify(content)); }
      if (options !== undefined) { updates.push('options = ?'); params.push(options ? JSON.stringify(options) : null); }
      if (correct_answer) { updates.push('correct_answer = ?'); params.push(JSON.stringify(correct_answer)); }
      if (explanation !== undefined) { updates.push('explanation = ?'); params.push(explanation); }
      if (tags !== undefined) { updates.push('tags = ?'); params.push(tags ? JSON.stringify(tags) : null); }
      
      if (updates.length === 0) {
        return res.status(400).json({ error: 'No fields to update' });
      }
      
      updates.push('updated_at = CURRENT_TIMESTAMP');
      params.push(parseInt(id));
      
      db.prepare(`
        UPDATE questions SET ${updates.join(', ')} WHERE id = ?
      `).run(...params);
      
      res.json({ message: 'Question updated successfully' });
    } catch (error) {
      console.error('Error updating question:', error);
      res.status(500).json({ error: 'Failed to update question' });
    }
  }
);

// 删除题目
router.delete('/:id',
  validate([
    param('id').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { id } = req.params;
      
      const result = db.prepare('DELETE FROM questions WHERE id = ?').run(parseInt(id));
      
      if (result.changes === 0) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      res.json({ message: 'Question deleted successfully' });
    } catch (error) {
      console.error('Error deleting question:', error);
      res.status(500).json({ error: 'Failed to delete question' });
    }
  }
);

// 获取知识点列表
router.get('/knowledge-points/list', async (req, res) => {
  try {
    const db = req.app.get('db');
    const knowledgePoints = db.prepare(`
      SELECT * FROM knowledge_points ORDER BY category, id
    `).all();
    
    // 按类别分组
    const grouped = knowledgePoints.reduce((acc, kp) => {
      if (!acc[kp.category]) {
        acc[kp.category] = [];
      }
      acc[kp.category].push(kp);
      return acc;
    }, {});
    
    res.json({ data: grouped });
  } catch (error) {
    console.error('Error fetching knowledge points:', error);
    res.status(500).json({ error: 'Failed to fetch knowledge points' });
  }
});

export default router;
