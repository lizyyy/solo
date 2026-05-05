const express = require('express');
const router = express.Router();
const { db, getSchemaVersion, migrateDraftData } = require('../database');

const CURRENT_SCHEMA_VERSION = getSchemaVersion();

router.get('/', (req, res) => {
  try {
    const submissions = db.prepare(`
      SELECT id, draft_id, title, schema_version, submitted_at, submitter
      FROM submissions
      ORDER BY submitted_at DESC
    `).all();

    const submissionsWithStatus = submissions.map(sub => ({
      ...sub,
      isSchemaOutdated: sub.schema_version < CURRENT_SCHEMA_VERSION
    }));

    res.json({ success: true, data: submissionsWithStatus });
  } catch (error) {
    console.error('获取提交记录失败:', error);
    res.status(500).json({ success: false, error: '获取提交记录失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const submission = db.prepare(`
      SELECT * FROM submissions WHERE id = ?
    `).get(req.params.id);

    if (!submission) {
      return res.status(404).json({ success: false, error: '提交记录不存在' });
    }

    let data = JSON.parse(submission.data);
    const isSchemaOutdated = submission.schema_version < CURRENT_SCHEMA_VERSION;
    
    if (isSchemaOutdated) {
      data = migrateDraftData(data, submission.schema_version);
    }

    res.json({
      success: true,
      data: {
        ...submission,
        data,
        isSchemaOutdated
      }
    });
  } catch (error) {
    console.error('获取提交记录失败:', error);
    res.status(500).json({ success: false, error: '获取提交记录失败' });
  }
});

module.exports = router;
