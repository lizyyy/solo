import express from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { analyzeError, ERROR_TAGS } from '../utils/musicTheory.js';

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

// 开始新的练习会话
router.post('/start',
  validate([
    body('userId').isInt(),
    body('knowledgePointId').optional().isInt(),
    body('questionType').optional().isString(),
    body('count').optional().isInt({ min: 1, max: 50 })
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, knowledgePointId, questionType, count = 10 } = req.body;
      
      // 创建练习会话
      const sessionResult = db.prepare(`
        INSERT INTO practice_sessions (user_id, knowledge_point_id, total_questions)
        VALUES (?, ?, ?)
      `).run(userId, knowledgePointId || null, count);
      
      const sessionId = sessionResult.lastInsertRowid;
      
      // 随机选择题目
      let questionQuery = `
        SELECT id FROM questions WHERE 1=1
      `;
      const params = [];
      
      if (knowledgePointId) {
        questionQuery += ' AND knowledge_point_id = ?';
        params.push(knowledgePointId);
      }
      
      if (questionType) {
        questionQuery += ' AND type = ?';
        params.push(questionType);
      }
      
      questionQuery += ' ORDER BY RANDOM() LIMIT ?';
      params.push(count);
      
      const questions = db.prepare(questionQuery).all(...params);
      const questionIds = questions.map(q => q.id);
      
      res.json({
        data: {
          sessionId,
          questionIds,
          totalQuestions: questionIds.length
        }
      });
    } catch (error) {
      console.error('Error starting practice session:', error);
      res.status(500).json({ error: 'Failed to start practice session' });
    }
  }
);

// 获取练习题目（隐藏正确答案）
router.get('/question/:id',
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
      
      // 解析 JSON 字段，但隐藏正确答案
      const parsedQuestion = {
        ...question,
        content: JSON.parse(question.content),
        options: question.options ? JSON.parse(question.options) : null,
        tags: question.tags ? JSON.parse(question.tags) : null
      };
      
      // 移除正确答案
      delete parsedQuestion.correct_answer;
      
      res.json({ data: parsedQuestion });
    } catch (error) {
      console.error('Error fetching question:', error);
      res.status(500).json({ error: 'Failed to fetch question' });
    }
  }
);

// 提交答案并评分
router.post('/submit',
  validate([
    body('userId').isInt(),
    body('questionId').isInt(),
    body('sessionId').optional().isInt(),
    body('userAnswer').exists(),
    body('timeSpent').optional().isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { userId, questionId, sessionId, userAnswer, timeSpent } = req.body;
      
      // 获取题目信息
      const question = db.prepare('SELECT * FROM questions WHERE id = ?').get(parseInt(questionId));
      
      if (!question) {
        return res.status(404).json({ error: 'Question not found' });
      }
      
      const correctAnswer = JSON.parse(question.correct_answer);
      
      // 比较答案（支持深度比较）
      const isCorrect = compareAnswers(userAnswer, correctAnswer);
      
      // 分析错误原因
      let errorTags = [];
      if (!isCorrect) {
        errorTags = analyzeError(question, userAnswer, correctAnswer);
      }
      
      // 记录答题
      const answerResult = db.prepare(`
        INSERT INTO answers (user_id, question_id, session_id, user_answer, is_correct, error_tags, time_spent)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId,
        questionId,
        sessionId || null,
        JSON.stringify(userAnswer),
        isCorrect ? 1 : 0,
        errorTags.length > 0 ? JSON.stringify(errorTags) : null,
        timeSpent || null
      );
      
      const answerId = answerResult.lastInsertRowid;
      
      // 如果答错，添加到错题本
      if (!isCorrect) {
        // 检查是否已存在于错题本
        const existingWrongNote = db.prepare(`
          SELECT id FROM wrong_notes WHERE user_id = ? AND question_id = ? AND status = 'active'
        `).get(userId, questionId);
        
        if (!existingWrongNote) {
          db.prepare(`
            INSERT INTO wrong_notes (user_id, question_id, answer_id, error_tags, status)
            VALUES (?, ?, ?, ?, 'active')
          `).run(userId, questionId, answerId, JSON.stringify(errorTags));
        }
      }
      
      // 更新会话统计
      if (sessionId) {
        if (isCorrect) {
          db.prepare(`
            UPDATE practice_sessions 
            SET correct_count = correct_count + 1 
            WHERE id = ?
          `).run(sessionId);
        }
      }
      
      res.json({
        data: {
          isCorrect,
          correctAnswer,
          userAnswer,
          errorTags: errorTags.map(tag => ({
            key: tag,
            label: ERROR_TAGS[tag]?.label || tag,
            description: ERROR_TAGS[tag]?.description || ''
          })),
          explanation: question.explanation
        }
      });
    } catch (error) {
      console.error('Error submitting answer:', error);
      res.status(500).json({ error: 'Failed to submit answer' });
    }
  }
);

// 结束练习会话
router.post('/end/:sessionId',
  validate([
    param('sessionId').isInt()
  ]),
  async (req, res) => {
    try {
      const db = req.app.get('db');
      const { sessionId } = req.params;
      
      // 更新会话结束时间
      db.prepare(`
        UPDATE practice_sessions 
        SET end_time = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(parseInt(sessionId));
      
      // 获取会话统计
      const session = db.prepare(`
        SELECT * FROM practice_sessions WHERE id = ?
      `).get(parseInt(sessionId));
      
      // 获取本次会话的答题详情
      const answers = db.prepare(`
        SELECT a.*, q.type, q.difficulty, q.content
        FROM answers a
        JOIN questions q ON a.question_id = q.id
        WHERE a.session_id = ?
        ORDER BY a.created_at
      `).all(parseInt(sessionId));
      
      // 统计错因分布
      const errorTagCounts = {};
      answers.forEach(answer => {
        if (answer.error_tags) {
          const tags = JSON.parse(answer.error_tags);
          tags.forEach(tag => {
            errorTagCounts[tag] = (errorTagCounts[tag] || 0) + 1;
          });
        }
      });
      
      res.json({
        data: {
          session,
          answers: answers.map(a => ({
            ...a,
            content: JSON.parse(a.content),
            user_answer: JSON.parse(a.user_answer),
            error_tags: a.error_tags ? JSON.parse(a.error_tags) : null
          })),
          statistics: {
            total: session.total_questions,
            correct: session.correct_count,
            wrong: session.total_questions - session.correct_count,
            accuracy: session.total_questions > 0 
              ? Math.round((session.correct_count / session.total_questions) * 100) 
              : 0,
            errorTagCounts
          }
        }
      });
    } catch (error) {
      console.error('Error ending practice session:', error);
      res.status(500).json({ error: 'Failed to end practice session' });
    }
  }
);

// 答案比较函数
const compareAnswers = (userAnswer, correctAnswer) => {
  // 简单类型比较
  if (typeof userAnswer !== typeof correctAnswer) {
    return false;
  }
  
  // null 比较
  if (userAnswer === null && correctAnswer === null) {
    return true;
  }
  
  // 基本类型比较
  if (typeof userAnswer !== 'object') {
    return userAnswer === correctAnswer;
  }
  
  // 数组比较
  if (Array.isArray(userAnswer) && Array.isArray(correctAnswer)) {
    if (userAnswer.length !== correctAnswer.length) {
      return false;
    }
    // 排序后比较（适用于和弦音等顺序无关的答案）
    const sortedUser = [...userAnswer].sort();
    const sortedCorrect = [...correctAnswer].sort();
    return sortedUser.every((val, idx) => compareAnswers(val, sortedCorrect[idx]));
  }
  
  // 对象比较
  const userKeys = Object.keys(userAnswer);
  const correctKeys = Object.keys(correctAnswer);
  
  if (userKeys.length !== correctKeys.length) {
    return false;
  }
  
  return userKeys.every(key => {
    if (!correctAnswer.hasOwnProperty(key)) {
      return false;
    }
    return compareAnswers(userAnswer[key], correctAnswer[key]);
  });
};

export default router;
