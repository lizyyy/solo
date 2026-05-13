const express = require('express');
const router = express.Router();
const db = require('../utils/db');

router.get('/', async (req, res) => {
  try {
    const { category, status, author, keyword, page = 1, pageSize = 20 } = req.query;
    let sql = `SELECT * FROM articles WHERE 1=1`;
    const params = [];

    if (category) {
      sql += ` AND category = ?`;
      params.push(category);
    }
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    if (author) {
      sql += ` AND author = ?`;
      params.push(author);
    }
    if (keyword) {
      sql += ` AND (title LIKE ? OR content LIKE ?)`;
      params.push(`%${keyword}%`, `%${keyword}%`);
    }

    sql += ` ORDER BY updated_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), (parseInt(page) - 1) * parseInt(pageSize));

    const articles = await db.query(sql, params);
    
    let countSql = `SELECT COUNT(*) as total FROM articles WHERE 1=1`;
    const countParams = params.slice(0, -2);
    const countResult = await db.get(countSql, countParams);

    res.json({
      success: true,
      data: articles,
      total: countResult.total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const totalArticles = await db.get(`SELECT COUNT(*) as total FROM articles`);
    const publishedArticles = await db.get(`SELECT COUNT(*) as total FROM articles WHERE status = 'published'`);
    const reviewingArticles = await db.get(`SELECT COUNT(*) as total FROM articles WHERE status = 'reviewing'`);
    const indexErrors = await db.get(`SELECT COUNT(*) as total FROM articles WHERE search_index_status = 'failed'`);
    const publishErrors = await db.get(`SELECT COUNT(*) as total FROM publish_records WHERE status = 'failed'`);

    res.json({
      success: true,
      data: {
        totalArticles: totalArticles.total,
        publishedArticles: publishedArticles.total,
        reviewingArticles: reviewingArticles.total,
        indexErrors: indexErrors.total,
        publishErrors: publishErrors.total
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/anomalies', async (req, res) => {
  try {
    const anomalies = await db.query(`
      SELECT 
        a.id,
        a.title,
        a.status,
        a.search_index_status,
        pr.error_message,
        pr.created_at as error_time
      FROM articles a
      LEFT JOIN publish_records pr ON a.id = pr.article_id
      WHERE a.search_index_status = 'failed' OR pr.status = 'failed'
      ORDER BY pr.created_at DESC
    `);

    res.json({ success: true, data: anomalies });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const article = await db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id]);
    if (!article) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    const versions = await db.query(`SELECT * FROM article_versions WHERE article_id = ? ORDER BY version_number DESC`, [req.params.id]);
    const reviews = await db.query(`SELECT * FROM reviews WHERE article_id = ? ORDER BY created_at DESC`, [req.params.id]);
    const publishRecords = await db.query(`SELECT * FROM publish_records WHERE article_id = ? ORDER BY created_at DESC`, [req.params.id]);
    const rollbackRecords = await db.query(`SELECT * FROM rollback_records WHERE article_id = ? ORDER BY created_at DESC`, [req.params.id]);
    const adjustments = await db.query(`SELECT * FROM manual_adjustments WHERE article_id = ? ORDER BY created_at DESC`, [req.params.id]);

    res.json({
      success: true,
      data: {
        article,
        versions,
        reviews,
        publishRecords,
        rollbackRecords,
        adjustments
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const { title, content, category, author } = req.body;
    const result = await db.run(
      `INSERT INTO articles (title, content, category, author, status) VALUES (?, ?, ?, ?, 'draft')`,
      [title, content, category, author]
    );

    await db.run(
      `INSERT INTO article_versions (article_id, version_number, title, content, author, change_log) VALUES (?, 1, ?, ?, ?, '初始版本创建')`,
      [result.lastID, title, content, author]
    );

    res.json({ success: true, id: result.lastID });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { title, content, category, status, changeLog, operator } = req.body;
    const article = await db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id]);
    
    if (!article) {
      return res.status(404).json({ success: false, message: '文章不存在' });
    }

    const beforeValue = JSON.stringify({ status: article.status });
    const afterValue = JSON.stringify({ status });

    await db.run(
      `UPDATE articles SET title = ?, content = ?, category = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [title, content, category, status, req.params.id]
    );

    const newVersion = article.current_version + 1;
    await db.run(
      `UPDATE articles SET current_version = ? WHERE id = ?`,
      [newVersion, req.params.id]
    );

    await db.run(
      `INSERT INTO article_versions (article_id, version_number, title, content, author, change_log) VALUES (?, ?, ?, ?, ?, ?)`,
      [req.params.id, newVersion, title, content, article.author, changeLog || '版本更新']
    );

    await db.run(
      `INSERT INTO publish_records (article_id, version_id, publish_type, operator, before_value, after_value, status) VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [req.params.id, newVersion, 'update', operator || 'system', beforeValue, afterValue]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/review', async (req, res) => {
  try {
    const { versionId, reviewer, comment, status } = req.body;
    await db.run(
      `INSERT INTO reviews (article_id, version_id, reviewer, comment, status) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, versionId, reviewer, comment, status]
    );

    if (status === 'approved') {
      await db.run(`UPDATE articles SET status = 'approved' WHERE id = ?`, [req.params.id]);
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/publish', async (req, res) => {
  try {
    const { operator } = req.body;
    const article = await db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id]);

    if (article.status !== 'approved') {
      return res.status(400).json({ success: false, message: '文章未通过审核，不能发布' });
    }

    const beforeValue = JSON.stringify({ status: article.status });
    const afterValue = JSON.stringify({ status: 'published' });

    const searchIndexSuccess = Math.random() > 0.1;

    await db.run(
      `UPDATE articles SET status = 'published', published_at = CURRENT_TIMESTAMP, search_index_status = ? WHERE id = ?`,
      [searchIndexSuccess ? 'success' : 'failed', req.params.id]
    );

    await db.run(
      `INSERT INTO publish_records (article_id, version_id, publish_type, operator, before_value, after_value, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [req.params.id, article.current_version, 'first_publish', operator || 'system', beforeValue, afterValue, searchIndexSuccess ? 'success' : 'failed']
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/:id/rollback', async (req, res) => {
  try {
    const { toVersionId, operator, reason } = req.body;
    const article = await db.get(`SELECT * FROM articles WHERE id = ?`, [req.params.id]);
    const toVersion = await db.get(`SELECT * FROM article_versions WHERE id = ?`, [toVersionId]);

    if (!toVersion) {
      return res.status(404).json({ success: false, message: '目标版本不存在' });
    }

    const beforeValue = JSON.stringify({ version: article.current_version });
    const afterValue = JSON.stringify({ version: toVersion.version_number });

    await db.run(
      `UPDATE articles SET title = ?, content = ?, current_version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [toVersion.title, toVersion.content, toVersion.version_number, req.params.id]
    );

    await db.run(
      `INSERT INTO rollback_records (article_id, from_version_id, to_version_id, operator, reason) VALUES (?, ?, ?, ?, ?)`,
      [req.params.id, article.current_version, toVersionId, operator || 'system', reason]
    );

    await db.run(
      `INSERT INTO publish_records (article_id, version_id, publish_type, operator, before_value, after_value, status) VALUES (?, ?, ?, ?, ?, ?, 'success')`,
      [req.params.id, toVersionId, 'rollback', operator || 'system', beforeValue, afterValue]
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
