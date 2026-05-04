import express from 'express';
import { query, validationResult } from 'express-validator';

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

// 获取用户总体进度统计
router.get('/overview',
  validate([
    query('userId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId } = req.query;
      
      // 总练习次数
      const totalSessions = db.prepare(`
        SELECT COUNT(*) as count FROM practice_sessions WHERE user_id = ?
      `).get(parseInt(userId)).count;
      
      // 总答题数
      const totalAnswers = db.prepare(`
        SELECT COUNT(*) as count FROM answers WHERE user_id = ?
      `).get(parseInt(userId)).count;
      
      // 正确率
      const correctAnswers = db.prepare(`
        SELECT COUNT(*) as count FROM answers WHERE user_id = ? AND is_correct = 1
      `).get(parseInt(userId)).count;
      
      const accuracy = totalAnswers > 0 ? Math.round((correctAnswers / totalAnswers) * 100) : 0;
      
      // 活跃错题数
      const activeWrongNotes = db.prepare(`
        SELECT COUNT(*) as count FROM wrong_notes WHERE user_id = ? AND status = 'active'
      `).get(parseInt(userId)).count;
      
      // 最近7天的练习趋势
      const last7Days = db.prepare(`
        SELECT 
          date(created_at) as day,
          COUNT(*) as total,
          SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) as correct
        FROM answers 
        WHERE user_id = ? AND created_at >= date('now', '-7 days')
        GROUP BY date(created_at)
        ORDER BY day
      `).all(parseInt(userId));
      
      res.json({
        data: {
          totalSessions,
          totalAnswers,
          correctAnswers,
          accuracy,
          activeWrongNotes,
          last7Days
        }
      });
    } catch (error) {
      console.error('Error fetching progress overview:', error);
      res.status(500).json({ error: 'Failed to fetch progress overview' });
    }
  }
);

// 按知识点统计正确率
router.get('/by-knowledge-point',
  validate([
    query('userId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId } = req.query;
      
      const stats = db.prepare(`
        SELECT 
          kp.id,
          kp.name,
          kp.category,
          COUNT(a.id) as total_answers,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
          ROUND(
            CASE WHEN COUNT(a.id) > 0 
              THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
              ELSE 0 
            END, 2
          ) as accuracy
        FROM knowledge_points kp
        LEFT JOIN questions q ON kp.id = q.knowledge_point_id
        LEFT JOIN answers a ON q.id = a.question_id AND a.user_id = ?
        GROUP BY kp.id, kp.name, kp.category
        ORDER BY accuracy ASC
      `).all(parseInt(userId));
      
      res.json({ data: stats });
    } catch (error) {
      console.error('Error fetching progress by knowledge point:', error);
      res.status(500).json({ error: 'Failed to fetch progress by knowledge point' });
    }
  }
);

// 按题目类型统计
router.get('/by-question-type',
  validate([
    query('userId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId } = req.query;
      
      const stats = db.prepare(`
        SELECT 
          q.type,
          COUNT(a.id) as total_answers,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
          ROUND(
            CASE WHEN COUNT(a.id) > 0 
              THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
              ELSE 0 
            END, 2
          ) as accuracy
        FROM questions q
        LEFT JOIN answers a ON q.id = a.question_id AND a.user_id = ?
        GROUP BY q.type
        ORDER BY accuracy ASC
      `).all(parseInt(userId));
      
      // 转换题目类型为中文描述
      const typeDescriptions = {
        'scale_identification': '音阶音级识别',
        'chord_construction': '和弦构成',
        'inversion': '转位判断',
        'roman_numeral': '罗马数字和弦功能',
        'cadence': '终止式判断'
      };
      
      const formattedStats = stats.map(s => ({
        ...s,
        type_name: typeDescriptions[s.type] || s.type
      }));
      
      res.json({ data: formattedStats });
    } catch (error) {
      console.error('Error fetching progress by question type:', error);
      res.status(500).json({ error: 'Failed to fetch progress by question type' });
    }
  }
);

// 练习历史记录
router.get('/history',
  validate([
    query('userId').isInt(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, page = 1, limit = 20 } = req.query;
      
      // 统计总数
      const countResult = db.prepare(`
        SELECT COUNT(*) as total FROM practice_sessions WHERE user_id = ?
      `).get(parseInt(userId));
      const total = countResult.total;
      
      // 分页查询
      const offset = (parseInt(page) - 1) * parseInt(limit);
      const sessions = db.prepare(`
        SELECT 
          ps.*,
          kp.name as knowledge_point_name,
          ROUND(
            CASE WHEN ps.total_questions > 0 
              THEN (ps.correct_count * 100.0 / ps.total_questions) 
              ELSE 0 
            END, 2
          ) as accuracy
        FROM practice_sessions ps
        LEFT JOIN knowledge_points kp ON ps.knowledge_point_id = kp.id
        WHERE ps.user_id = ?
        ORDER BY ps.created_at DESC
        LIMIT ? OFFSET ?
      `).all(parseInt(userId), parseInt(limit), offset);
      
      res.json({
        data: sessions,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching practice history:', error);
      res.status(500).json({ error: 'Failed to fetch practice history' });
    }
  }
);

// 获取薄弱知识点推荐
router.get('/weak-points',
  validate([
    query('userId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId } = req.query;
      
      // 找出正确率低于60%的知识点
      const weakKnowledgePoints = db.prepare(`
        SELECT 
          kp.id,
          kp.name,
          kp.category,
          COUNT(a.id) as total_answers,
          SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) as correct_answers,
          ROUND(
            CASE WHEN COUNT(a.id) > 0 
              THEN (SUM(CASE WHEN a.is_correct = 1 THEN 1 ELSE 0 END) * 100.0 / COUNT(a.id)) 
              ELSE 0 
            END, 2
          ) as accuracy
        FROM knowledge_points kp
        JOIN questions q ON kp.id = q.knowledge_point_id
        JOIN answers a ON q.id = a.question_id AND a.user_id = ?
        GROUP BY kp.id, kp.name, kp.category
        HAVING accuracy < 60 AND total_answers >= 3
        ORDER BY accuracy ASC
        LIMIT 5
      `).all(parseInt(userId));
      
      // 找出高频错因
      const topErrorTags = db.prepare(`
        SELECT 
          json_extract(value, '$') as tag,
          COUNT(*) as count
        FROM wrong_notes wn,
             json_each(wn.error_tags)
        WHERE wn.user_id = ? AND wn.status = 'active'
        GROUP BY tag
        ORDER BY count DESC
        LIMIT 5
      `).all(parseInt(userId));
      
      res.json({
        data: {
          weakKnowledgePoints,
          topErrorTags
        }
      });
    } catch (error) {
      console.error('Error fetching weak points:', error);
      res.status(500).json({ error: 'Failed to fetch weak points' });
    }
  }
);

export default router;
