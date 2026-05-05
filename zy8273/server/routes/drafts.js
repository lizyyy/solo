const express = require('express');
const router = express.Router();
const { db, getSchemaVersion, migrateDraftData } = require('../database');
const { v4: uuidv4 } = require('uuid');

const CURRENT_SCHEMA_VERSION = getSchemaVersion();

router.get('/', (req, res) => {
  try {
    const drafts = db.prepare(`
      SELECT id, title, current_step, version, schema_version, 
             last_edited_by, created_at, updated_at
      FROM drafts
      ORDER BY updated_at DESC
    `).all();

    const draftsWithStatus = drafts.map(draft => ({
      ...draft,
      isSchemaOutdated: draft.schema_version < CURRENT_SCHEMA_VERSION,
      progress: Math.round((draft.current_step / 4) * 100)
    }));

    res.json({ success: true, data: draftsWithStatus });
  } catch (error) {
    console.error('获取草稿列表失败:', error);
    res.status(500).json({ success: false, error: '获取草稿列表失败' });
  }
});

router.get('/:id', (req, res) => {
  try {
    const draft = db.prepare(`
      SELECT * FROM drafts WHERE id = ?
    `).get(req.params.id);

    if (!draft) {
      return res.status(404).json({ success: false, error: '草稿不存在' });
    }

    let data = JSON.parse(draft.data);
    const isSchemaOutdated = draft.schema_version < CURRENT_SCHEMA_VERSION;
    
    if (isSchemaOutdated) {
      data = migrateDraftData(data, draft.schema_version);
    }

    res.json({
      success: true,
      data: {
        ...draft,
        data,
        isSchemaOutdated,
        currentSchemaVersion: CURRENT_SCHEMA_VERSION
      }
    });
  } catch (error) {
    console.error('获取草稿失败:', error);
    res.status(500).json({ success: false, error: '获取草稿失败' });
  }
});

router.post('/', (req, res) => {
  try {
    const { title } = req.body;
    const id = uuidv4();
    const initialData = {
      applicationInfo: {
        applicant: '',
        department: '',
        applicationDate: new Date().toISOString().split('T')[0],
        projectName: '',
        projectDescription: '',
        totalAmount: 0
      },
      supplierComparison: [],
      budgetItems: [],
      attachments: []
    };

    const insertStmt = db.prepare(`
      INSERT INTO drafts (id, title, current_step, data, schema_version, version, created_at, updated_at)
      VALUES (?, ?, 0, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `);

    insertStmt.run(id, title || '新建采购申请', JSON.stringify(initialData), CURRENT_SCHEMA_VERSION);

    res.json({
      success: true,
      data: {
        id,
        title: title || '新建采购申请',
        current_step: 0,
        data: initialData,
        version: 1,
        schema_version: CURRENT_SCHEMA_VERSION
      }
    });
  } catch (error) {
    console.error('创建草稿失败:', error);
    res.status(500).json({ success: false, error: '创建草稿失败' });
  }
});

router.put('/:id', (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const { id } = req.params;
      const { current_step, data, version, sessionId, isAutoSave } = req.body;

      const existingDraft = db.prepare(`
        SELECT * FROM drafts WHERE id = ?
      `).get(id);

      if (!existingDraft) {
        return { status: 404, response: { success: false, error: '草稿不存在' } };
      }

      if (version !== undefined && existingDraft.version !== version) {
        let serverData;
        try {
          serverData = JSON.parse(existingDraft.data);
        } catch {
          serverData = {};
        }

        const isSchemaOutdated = existingDraft.schema_version < CURRENT_SCHEMA_VERSION;
        if (isSchemaOutdated) {
          serverData = migrateDraftData(serverData, existingDraft.schema_version);
        }

        return {
          status: 409,
          response: {
            success: false,
            error: '版本冲突',
            conflict: true,
            serverVersion: {
              ...existingDraft,
              data: serverData,
              isSchemaOutdated
            },
            clientVersion: version
          }
        };
      }

      const newVersion = existingDraft.version + 1;
      const dataToSave = data || JSON.parse(existingDraft.data);
      const stepToSave = current_step !== undefined ? current_step : existingDraft.current_step;

      db.prepare(`
        UPDATE drafts
        SET current_step = ?, data = ?, version = ?, updated_at = CURRENT_TIMESTAMP, last_edited_by = ?
        WHERE id = ?
      `).run(stepToSave, JSON.stringify(dataToSave), newVersion, sessionId, id);

      if (!isAutoSave) {
        db.prepare(`
          INSERT INTO draft_versions (draft_id, data, schema_version, version, session_id, created_at)
          VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `).run(id, JSON.stringify(dataToSave), CURRENT_SCHEMA_VERSION, newVersion, sessionId);
      }

      return {
        status: 200,
        response: {
          success: true,
          data: {
            id,
            version: newVersion,
            updated_at: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      console.error('保存草稿失败:', error);
      return { status: 500, response: { success: false, error: '保存草稿失败' } };
    }
  });

  const result = transaction();
  res.status(result.status).json(result.response);
});

router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;

    const draft = db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(id);
    if (!draft) {
      return res.status(404).json({ success: false, error: '草稿不存在' });
    }

    db.prepare(`DELETE FROM draft_versions WHERE draft_id = ?`).run(id);
    db.prepare(`DELETE FROM drafts WHERE id = ?`).run(id);

    res.json({ success: true, message: '草稿已删除' });
  } catch (error) {
    console.error('删除草稿失败:', error);
    res.status(500).json({ success: false, error: '删除草稿失败' });
  }
});

router.post('/:id/submit', (req, res) => {
  const transaction = db.transaction(() => {
    try {
      const { id } = req.params;
      const { submitter } = req.body;

      const draft = db.prepare(`SELECT * FROM drafts WHERE id = ?`).get(id);
      if (!draft) {
        return { status: 404, response: { success: false, error: '草稿不存在' } };
      }

      const submissionId = db.prepare(`
        INSERT INTO submissions (draft_id, title, data, schema_version, submitted_at, submitter)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      `).run(id, draft.title, draft.data, draft.schema_version, submitter || '系统管理员').lastInsertRowid;

      db.prepare(`DELETE FROM draft_versions WHERE draft_id = ?`).run(id);
      db.prepare(`DELETE FROM drafts WHERE id = ?`).run(id);

      return {
        status: 200,
        response: {
          success: true,
          data: {
            submissionId,
            title: draft.title,
            submitted_at: new Date().toISOString()
          }
        }
      };
    } catch (error) {
      console.error('提交申请失败:', error);
      return { status: 500, response: { success: false, error: '提交申请失败' } };
    }
  });

  const result = transaction();
  res.status(result.status).json(result.response);
});

module.exports = router;
