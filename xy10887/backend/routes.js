const express = require('express');
const router = express.Router();
const db = require('./database');
const PDFDocument = require('pdfkit');
const { v4: uuidv4 } = require('uuid');

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function(err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

router.post('/templates', async (req, res) => {
  try {
    const { version, title, content, applicable_scope, published_by } = req.body;
    
    const existing = await dbGet('SELECT * FROM templates WHERE version = ?', [version]);
    if (existing) {
      return res.status(400).json({ error: '版本号已存在，不能重复发布' });
    }

    const result = await dbRun(
      'INSERT INTO templates (version, title, content, applicable_scope, published_by) VALUES (?, ?, ?, ?, ?)',
      [version, title, content, applicable_scope || '', published_by || 'system']
    );

    const template = await dbGet('SELECT * FROM templates WHERE id = ?', [result.lastID]);
    res.status(201).json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates', async (req, res) => {
  try {
    const templates = await dbAll('SELECT * FROM templates');
    templates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }));
    res.json(templates);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/templates/:version', async (req, res) => {
  try {
    const template = await dbGet('SELECT * FROM templates WHERE version = ?', [req.params.version]);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }
    res.json(template);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signatures', async (req, res) => {
  try {
    const { template_version, patient_id, patient_name, signature_data } = req.body;
    
    const template = await dbGet('SELECT * FROM templates WHERE version = ?', [template_version]);
    if (!template) {
      return res.status(404).json({ error: '模板不存在' });
    }

    const existingActive = await dbGet(
      'SELECT * FROM signatures WHERE patient_id = ? AND template_version = ? AND status = "active"',
      [patient_id, template_version]
    );
    if (existingActive) {
      return res.status(400).json({ error: '该患者已签署此版本，不能重复签署' });
    }

    const result = await dbRun(
      'INSERT INTO signatures (template_id, template_version, patient_id, patient_name, signature_data) VALUES (?, ?, ?, ?, ?)',
      [template.id, template_version, patient_id, patient_name, signature_data]
    );

    const pendingTasks = await dbAll(
      'UPDATE resign_tasks SET status = "completed", completed_at = CURRENT_TIMESTAMP WHERE patient_id = ? AND new_template_version = ? AND status = "pending"',
      [patient_id, template_version]
    );

    const signature = await dbGet('SELECT * FROM signatures WHERE id = ?', [result.lastID]);
    res.status(201).json(signature);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/signatures/patient/:patient_id', async (req, res) => {
  try {
    const signatures = await dbAll(
      'SELECT s.*, t.title as template_title, t.content as template_content FROM signatures s JOIN templates t ON s.template_id = t.id WHERE s.patient_id = ? ORDER BY s.signed_at DESC',
      [req.params.patient_id]
    );
    res.json(signatures);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/signatures/:id/withdraw', async (req, res) => {
  try {
    const { reason } = req.body;
    const signature = await dbGet('SELECT * FROM signatures WHERE id = ?', [req.params.id]);
    
    if (!signature) {
      return res.status(404).json({ error: '签署记录不存在' });
    }
    if (signature.status === 'withdrawn') {
      return res.status(400).json({ error: '该签署已被撤回' });
    }

    await dbRun(
      'UPDATE signatures SET status = "withdrawn", withdrawn_at = CURRENT_TIMESTAMP, withdrawn_reason = ? WHERE id = ?',
      [reason || '用户撤回', req.params.id]
    );

    const updated = await dbGet('SELECT * FROM signatures WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/resign-tasks/generate', async (req, res) => {
  try {
    const { new_template_version, reason } = req.body;
    
    const newTemplate = await dbGet('SELECT * FROM templates WHERE version = ?', [new_template_version]);
    if (!newTemplate) {
      return res.status(404).json({ error: '新模板不存在' });
    }

    const oldSignatures = await dbAll(
      'SELECT DISTINCT patient_id, patient_name, template_id, template_version FROM signatures WHERE status = "active" AND template_version != ?',
      [new_template_version]
    );

    const tasks = [];
    for (const sig of oldSignatures) {
      const existingTask = await dbGet(
        'SELECT * FROM resign_tasks WHERE patient_id = ? AND new_template_version = ? AND status = "pending"',
        [sig.patient_id, new_template_version]
      );
      
      if (!existingTask) {
        const result = await dbRun(
          'INSERT INTO resign_tasks (patient_id, patient_name, old_template_id, old_template_version, new_template_id, new_template_version, reason) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [sig.patient_id, sig.patient_name, sig.template_id, sig.template_version, newTemplate.id, new_template_version, reason || '模板版本更新']
        );
        tasks.push(await dbGet('SELECT * FROM resign_tasks WHERE id = ?', [result.lastID]));
      }
    }

    res.json({ generated: tasks.length, tasks });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/resign-tasks', async (req, res) => {
  try {
    const { patient_id, status } = req.query;
    let sql = 'SELECT * FROM resign_tasks WHERE 1=1';
    let params = [];
    
    if (patient_id) {
      sql += ' AND patient_id = ?';
      params.push(patient_id);
    }
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    sql += ' ORDER BY created_at DESC';
    
    const tasks = await dbAll(sql, params);
    res.json(tasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/patient-status/:patient_id', async (req, res) => {
  try {
    const patientId = req.params.patient_id;
    
    const signatures = await dbAll(
      'SELECT s.*, t.title as template_title FROM signatures s JOIN templates t ON s.template_id = t.id WHERE s.patient_id = ? ORDER BY s.signed_at DESC',
      [patientId]
    );

    const activeSignature = signatures.find(s => s.status === 'active');
    const templates = await dbAll('SELECT * FROM templates');
    const latestTemplate = templates.sort((a, b) => b.version.localeCompare(a.version, undefined, { numeric: true, sensitivity: 'base' }))[0];
    
    const resignTasks = await dbAll(
      'SELECT * FROM resign_tasks WHERE patient_id = ? AND status = "pending"',
      [patientId]
    );

    let status = 'unknown';
    let resignReason = null;
    let noResignReason = null;

    if (activeSignature) {
      if (latestTemplate && activeSignature.template_version === latestTemplate.version) {
        status = 'up-to-date';
        noResignReason = '已签署最新版本，无需补签';
      } else if (resignTasks.length > 0) {
        status = 'needs-resign';
        resignReason = resignTasks[0].reason;
      } else {
        status = 'outdated-but-no-task';
        noResignReason = '版本非最新，但未生成补签任务';
      }
    } else {
      status = 'not-signed';
      noResignReason = '未签署任何版本';
    }

    res.json({
      patient_id: patientId,
      status,
      active_signature: activeSignature,
      all_signatures: signatures,
      latest_template: latestTemplate,
      pending_resign_tasks: resignTasks,
      resign_reason: resignReason,
      no_resign_reason: noResignReason
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/proof/:signature_id', async (req, res) => {
  try {
    const signature = await dbGet(
      'SELECT s.*, t.title, t.content FROM signatures s JOIN templates t ON s.template_id = t.id WHERE s.id = ?',
      [req.params.signature_id]
    );

    if (!signature) {
      return res.status(404).json({ error: '签署记录不存在' });
    }

    const doc = new PDFDocument();
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => {
      const pdfBuffer = Buffer.concat(buffers);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="consent-proof-${signature.id}.pdf"`);
      res.send(pdfBuffer);
    });

    doc.fontSize(20).text('知情同意书签署证明', { align: 'center' });
    doc.moveDown();
    doc.fontSize(14).text(`模板标题: ${signature.title}`);
    doc.text(`版本号: ${signature.template_version}`);
    doc.text(`患者ID: ${signature.patient_id}`);
    doc.text(`患者姓名: ${signature.patient_name}`);
    doc.text(`签署时间: ${signature.signed_at}`);
    doc.text(`状态: ${signature.status === 'active' ? '有效' : '已撤回'}`);
    doc.moveDown();
    doc.fontSize(12).text('模板内容:');
    doc.text(signature.content.substring(0, 500) + (signature.content.length > 500 ? '...' : ''));
    doc.moveDown();
    doc.text(`签署数据: ${signature.signature_data}`);
    doc.text(`证明编号: ${uuidv4()}`);
    doc.text(`生成时间: ${new Date().toISOString()}`);

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;