const express = require('express');
const router = express.Router();
const uuid = require('uuid');
const multer = require('multer');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const qrcode = require('qrcode');
const archiver = require('archiver');
const path = require('path');
const fs = require('fs');

const storage = require('../storage');
const signature = require('../signature');
const stateMachine = require('../state-machine');
const config = require('../../config');

const upload = multer({ dest: '/tmp/' });

function getClientInfo(req) {
  return {
    operator: 'volunteer',
    ipAddress: req.ip || req.connection.remoteAddress,
    userAgent: req.get('User-Agent')
  };
}

router.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

router.post('/participants', async (req, res) => {
  try {
    const { name, email, phone, metadata } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '姓名不能为空' });
    }
    
    const participantId = uuid.v4();
    
    await storage.run(`
      INSERT INTO participants (id, name, email, phone, metadata, status)
      VALUES (?, ?, ?, ?, ?, 'registered')
    `, [participantId, name, email || null, phone || null, metadata ? JSON.stringify(metadata) : null]);
    
    res.json({
      success: true,
      participant: {
        id: participantId,
        name,
        email,
        phone,
        metadata
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/participants', async (req, res) => {
  try {
    const { status, search } = req.query;
    
    let sql = `SELECT * FROM participants WHERE 1=1`;
    let params = [];
    
    if (status) {
      sql += ` AND status = ?`;
      params.push(status);
    }
    
    if (search) {
      sql += ` AND (name LIKE ? OR email LIKE ? OR phone LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    sql += ` ORDER BY created_at DESC`;
    
    const participants = await storage.all(sql, params);
    
    res.json({
      success: true,
      participants: participants.map(p => ({
        ...p,
        metadata: p.metadata ? JSON.parse(p.metadata) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/participants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const participant = await storage.get(`
      SELECT * FROM participants WHERE id = ?
    `, [id]);
    
    if (!participant) {
      return res.status(404).json({ error: '参与者不存在' });
    }
    
    const credentials = await storage.all(`
      SELECT * FROM credentials WHERE participant_id = ? ORDER BY issued_at DESC
    `, [id]);
    
    res.json({
      success: true,
      participant: {
        ...participant,
        metadata: participant.metadata ? JSON.parse(participant.metadata) : null
      },
      credentials: credentials.map(c => ({
        ...c,
        credentialData: c.credential_data ? JSON.parse(c.credential_data) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/credentials/issue', async (req, res) => {
  try {
    const { participantId, validFrom, validUntil, metadata } = req.body;
    
    const participant = await storage.get(`
      SELECT * FROM participants WHERE id = ?
    `, [participantId]);
    
    if (!participant) {
      return res.status(404).json({ error: '参与者不存在' });
    }
    
    const credentialOptions = {
      metadata: metadata || {}
    };
    
    if (validFrom) {
      credentialOptions.validFrom = new Date(validFrom).getTime();
    }
    
    if (validUntil) {
      credentialOptions.validUntil = new Date(validUntil).getTime();
    }
    
    const credential = signature.createCredential(participant, credentialOptions);
    
    const qrCodeDataUrl = await qrcode.toDataURL(credential.token, {
      width: config.qrcode.width,
      margin: config.qrcode.margin,
      color: config.qrcode.color
    });
    
    const clientInfo = getClientInfo(req);
    
    const issueResult = await stateMachine.issueCredential(
      { ...credential, qrCode: qrCodeDataUrl },
      clientInfo
    );
    
    if (!issueResult.success) {
      return res.status(400).json({ error: issueResult.error });
    }
    
    res.json({
      success: true,
      credential: {
        id: credential.payload.id,
        participantId: credential.payload.participant_id,
        token: credential.token,
        qrCode: qrCodeDataUrl,
        payload: credential.payload,
        signature: credential.signature
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/credentials/verify', async (req, res) => {
  try {
    const { token } = req.body;
    
    if (!token) {
      return res.status(400).json({ error: '凭证令牌不能为空' });
    }
    
    const verifyResult = signature.verifyCredential(token);
    
    const clientInfo = getClientInfo(req);
    
    if (!verifyResult.valid) {
      await stateMachine.logAudit('verify_failed', {
        details: { error: verifyResult.error, errorCode: verifyResult.errorCode },
        ...clientInfo,
        result: 'failed'
      });
      
      return res.json({
        success: false,
        valid: false,
        error: verifyResult.error,
        errorCode: verifyResult.errorCode,
        payload: verifyResult.payload
      });
    }
    
    const credentialId = verifyResult.payload.id;
    
    const stateVerifyResult = await stateMachine.verifyCredential(credentialId, clientInfo);
    
    if (!stateVerifyResult.success) {
      return res.json({
        success: false,
        valid: false,
        error: stateVerifyResult.error,
        errorCode: 'NOT_FOUND',
        payload: verifyResult.payload
      });
    }
    
    res.json({
      success: true,
      valid: stateVerifyResult.isActive,
      state: stateVerifyResult.state,
      isActive: stateVerifyResult.isActive,
      isCheckedIn: stateVerifyResult.isCheckedIn,
      isRevoked: stateVerifyResult.isRevoked,
      isExpired: stateVerifyResult.isExpired,
      payload: verifyResult.payload,
      credential: stateVerifyResult.credential
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/credentials/checkin', async (req, res) => {
  try {
    const { credentialId, token } = req.body;
    
    let targetCredentialId = credentialId;
    
    if (token && !credentialId) {
      const parseResult = signature.parseCredential(token);
      if (parseResult.valid) {
        targetCredentialId = parseResult.payload.id;
      }
    }
    
    if (!targetCredentialId) {
      return res.status(400).json({ error: '无法确定凭证ID' });
    }
    
    const clientInfo = getClientInfo(req);
    
    const checkInResult = await stateMachine.checkInCredential(targetCredentialId, clientInfo);
    
    if (!checkInResult.success) {
      return res.json({
        success: false,
        error: checkInResult.error,
        errorCode: checkInResult.errorCode
      });
    }
    
    res.json({
      success: true,
      state: checkInResult.state,
      credentialId: checkInResult.credentialId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/credentials/revoke', async (req, res) => {
  try {
    const { credentialId, reason } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: '凭证ID不能为空' });
    }
    
    const clientInfo = getClientInfo(req);
    
    const revokeResult = await stateMachine.revokeCredential(
      credentialId,
      reason || '手动撤销',
      clientInfo
    );
    
    if (!revokeResult.success) {
      return res.status(400).json({ error: revokeResult.error });
    }
    
    res.json({
      success: true,
      state: revokeResult.state,
      credentialId: revokeResult.credentialId,
      revocationId: revokeResult.revocationId
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/credentials', async (req, res) => {
  try {
    const { status, participantId, search } = req.query;
    
    let sql = `
      SELECT c.*, p.name as participant_name, p.email as participant_email
      FROM credentials c
      LEFT JOIN participants p ON c.participant_id = p.id
      WHERE 1=1
    `;
    let params = [];
    
    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }
    
    if (participantId) {
      sql += ` AND c.participant_id = ?`;
      params.push(participantId);
    }
    
    if (search) {
      sql += ` AND (p.name LIKE ? OR p.email LIKE ? OR c.id LIKE ?)`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern);
    }
    
    sql += ` ORDER BY c.issued_at DESC`;
    
    const credentials = await storage.all(sql, params);
    
    res.json({
      success: true,
      credentials: credentials.map(c => ({
        ...c,
        credentialData: c.credential_data ? JSON.parse(c.credential_data) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/credentials/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const credential = await storage.get(`
      SELECT c.*, p.name as participant_name, p.email as participant_email, p.phone as participant_phone
      FROM credentials c
      LEFT JOIN participants p ON c.participant_id = p.id
      WHERE c.id = ?
    `, [id]);
    
    if (!credential) {
      return res.status(404).json({ error: '凭证不存在' });
    }
    
    const revocation = await storage.get(`
      SELECT * FROM revocation_list WHERE credential_id = ? ORDER BY revoked_at DESC LIMIT 1
    `, [id]);
    
    res.json({
      success: true,
      credential: {
        ...credential,
        credentialData: credential.credential_data ? JSON.parse(credential.credential_data) : null
      },
      revocation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/review', async (req, res) => {
  try {
    const { credentialId, reviewResult, notes } = req.body;
    
    if (!credentialId) {
      return res.status(400).json({ error: '凭证ID不能为空' });
    }
    
    const clientInfo = getClientInfo(req);
    
    const result = await stateMachine.reviewCredential(
      credentialId,
      { reviewResult, notes, timestamp: new Date().toISOString() },
      clientInfo
    );
    
    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }
    
    res.json({
      success: true,
      state: result.state,
      reviewResult: result.reviewResult
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { action, credentialId, participantId, result, limit = 100, offset = 0 } = req.query;
    
    let sql = `SELECT * FROM audit_logs WHERE 1=1`;
    let params = [];
    
    if (action) {
      sql += ` AND action = ?`;
      params.push(action);
    }
    
    if (credentialId) {
      sql += ` AND credential_id = ?`;
      params.push(credentialId);
    }
    
    if (participantId) {
      sql += ` AND participant_id = ?`;
      params.push(participantId);
    }
    
    if (result) {
      sql += ` AND result = ?`;
      params.push(result);
    }
    
    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), parseInt(offset));
    
    const logs = await storage.all(sql, params);
    
    const countResult = await storage.get(`
      SELECT COUNT(*) as total FROM audit_logs
      ${sql.replace(/SELECT \* FROM audit_logs WHERE 1=1/, '').replace(/ORDER BY.*LIMIT.*OFFSET.*/, '')}
    `, params.slice(0, -2));
    
    res.json({
      success: true,
      logs: logs.map(l => ({
        ...l,
        details: l.details ? JSON.parse(l.details) : null
      })),
      pagination: {
        total: countResult.total,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要导入的CSV文件' });
    }
    
    const results = [];
    const errors = [];
    
    await new Promise((resolve) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve);
    });
    
    const importedParticipants = [];
    
    for (const row of results) {
      try {
        const name = row.name || row.姓名 || row.Name;
        const email = row.email || row.邮箱 || row.Email || '';
        const phone = row.phone || row.电话 || row.Phone || '';
        
        if (!name) {
          errors.push({ row, error: '缺少姓名字段' });
          continue;
        }
        
        const participantId = uuid.v4();
        
        await storage.run(`
          INSERT INTO participants (id, name, email, phone, status)
          VALUES (?, ?, ?, ?, 'registered')
        `, [participantId, name, email || null, phone || null]);
        
        importedParticipants.push({
          id: participantId,
          name,
          email,
          phone
        });
      } catch (error) {
        errors.push({ row, error: error.message });
      }
    }
    
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    
    res.json({
      success: true,
      imported: importedParticipants.length,
      errors: errors.length,
      participants: importedParticipants,
      errorDetails: errors
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const { type } = req.query;
    
    let data = [];
    let fields = [];
    
    if (type === 'participants' || !type) {
      const participants = await storage.all(`
        SELECT * FROM participants ORDER BY created_at
      `);
      data = participants.map(p => ({
        ID: p.id,
        姓名: p.name,
        邮箱: p.email || '',
        电话: p.phone || '',
        状态: p.status,
        注册时间: new Date(p.created_at).toLocaleString()
      }));
      fields = ['ID', '姓名', '邮箱', '电话', '状态', '注册时间'];
    } else if (type === 'credentials') {
      const credentials = await storage.all(`
        SELECT c.*, p.name as participant_name
        FROM credentials c
        LEFT JOIN participants p ON c.participant_id = p.id
        ORDER BY c.issued_at
      `);
      data = credentials.map(c => ({
        凭证ID: c.id,
        参与者ID: c.participant_id,
        参与者姓名: c.participant_name,
        状态: c.status,
        签发时间: new Date(c.issued_at).toLocaleString(),
        有效期至: c.valid_until ? new Date(c.valid_until).toLocaleString() : '',
        最后核验时间: c.last_verified_at ? new Date(c.last_verified_at).toLocaleString() : ''
      }));
      fields = ['凭证ID', '参与者ID', '参与者姓名', '状态', '签发时间', '有效期至', '最后核验时间'];
    } else if (type === 'audit-logs') {
      const logs = await storage.all(`
        SELECT * FROM audit_logs ORDER BY created_at
      `);
      data = logs.map(l => ({
        日志ID: l.id,
        操作: l.action,
        凭证ID: l.credential_id || '',
        参与者ID: l.participant_id || '',
        操作前状态: l.status_before || '',
        操作后状态: l.status_after || '',
        操作者: l.operator || '',
        结果: l.result,
        时间: new Date(l.created_at).toLocaleString()
      }));
      fields = ['日志ID', '操作', '凭证ID', '参与者ID', '操作前状态', '操作后状态', '操作者', '结果', '时间'];
    }
    
    const json2csvParser = new Parser({ fields });
    const csvData = json2csvParser.parse(data);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type || 'participants'}_${Date.now()}.csv"`);
    
    res.send('\uFEFF' + csvData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/json', async (req, res) => {
  try {
    const { type } = req.query;
    
    let data = {};
    
    const participants = await storage.all(`SELECT * FROM participants ORDER BY created_at`);
    const credentials = await storage.all(`
      SELECT c.*, p.name as participant_name
      FROM credentials c
      LEFT JOIN participants p ON c.participant_id = p.id
      ORDER BY c.issued_at
    `);
    const logs = await storage.all(`SELECT * FROM audit_logs ORDER BY created_at`);
    const revocations = await storage.all(`SELECT * FROM revocation_list ORDER BY revoked_at`);
    
    data = {
      exportTime: new Date().toISOString(),
      exportVersion: '1.0',
      participants: participants.map(p => ({
        ...p,
        metadata: p.metadata ? JSON.parse(p.metadata) : null
      })),
      credentials: credentials.map(c => ({
        ...c,
        credentialData: c.credential_data ? JSON.parse(c.credential_data) : null
      })),
      auditLogs: logs.map(l => ({
        ...l,
        details: l.details ? JSON.parse(l.details) : null
      })),
      revocations
    };
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="checkin_export_${Date.now()}.json"`);
    
    res.send(JSON.stringify(data, null, 2));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/export/markdown', async (req, res) => {
  try {
    const participants = await storage.all(`SELECT * FROM participants ORDER BY created_at`);
    const credentials = await storage.all(`
      SELECT c.*, p.name as participant_name
      FROM credentials c
      LEFT JOIN participants p ON c.participant_id = p.id
      ORDER BY c.issued_at
    `);
    const logs = await storage.all(`SELECT * FROM audit_logs ORDER BY created_at`);
    
    let md = `# 签到凭证审计报告\n\n`;
    md += `**生成时间**: ${new Date().toLocaleString()}\n\n`;
    md += `---\n\n`;
    
    md += `## 统计概览\n\n`;
    md += `- 参与者总数: ${participants.length}\n`;
    md += `- 签发凭证数: ${credentials.length}\n`;
    md += `- 已入场: ${credentials.filter(c => c.status === 'checked_in').length}\n`;
    md += `- 已撤销: ${credentials.filter(c => c.status === 'revoked').length}\n`;
    md += `- 审计日志数: ${logs.length}\n\n`;
    
    md += `---\n\n`;
    
    md += `## 参与者列表\n\n`;
    md += `| ID | 姓名 | 邮箱 | 电话 | 状态 |\n`;
    md += `|----|------|------|------|------|\n`;
    for (const p of participants) {
      md += `| ${p.id} | ${p.name} | ${p.email || '-'} | ${p.phone || '-'} | ${p.status} |\n`;
    }
    md += `\n`;
    
    md += `---\n\n`;
    
    md += `## 凭证状态\n\n`;
    md += `| 凭证ID | 参与者 | 状态 | 签发时间 | 有效期至 |\n`;
    md += `|--------|--------|------|----------|----------|\n`;
    for (const c of credentials) {
      md += `| ${c.id} | ${c.participant_name} | ${c.status} | ${new Date(c.issued_at).toLocaleString()} | ${c.valid_until ? new Date(c.valid_until).toLocaleString() : '-'} |\n`;
    }
    md += `\n`;
    
    md += `---\n\n`;
    
    md += `## 审计日志\n\n`;
    md += `| 时间 | 操作 | 凭证ID | 结果 |\n`;
    md += `|------|------|--------|------|\n`;
    for (const l of logs.slice(-50)) {
      md += `| ${new Date(l.created_at).toLocaleString()} | ${l.action} | ${l.credential_id || '-'} | ${l.result} |\n`;
    }
    md += `\n`;
    
    md += `---\n\n`;
    md += `*此报告由签到凭证演练台自动生成*\n`;
    
    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="checkin_report_${Date.now()}.md"`);
    
    res.send(md);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const participantCount = await storage.get(`SELECT COUNT(*) as count FROM participants`);
    const credentialCount = await storage.get(`SELECT COUNT(*) as count FROM credentials`);
    const checkedInCount = await storage.get(`SELECT COUNT(*) as count FROM credentials WHERE status = 'checked_in'`);
    const revokedCount = await storage.get(`SELECT COUNT(*) as count FROM credentials WHERE status = 'revoked'`);
    const expiredCount = await storage.get(`SELECT COUNT(*) as count FROM credentials WHERE status = 'expired'`);
    const logCount = await storage.get(`SELECT COUNT(*) as count FROM audit_logs`);
    
    const recentLogs = await storage.all(`
      SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10
    `);
    
    res.json({
      success: true,
      statistics: {
        participants: participantCount.count,
        credentials: credentialCount.count,
        checkedIn: checkedInCount.count,
        revoked: revokedCount.count,
        expired: expiredCount.count,
        auditLogs: logCount.count
      },
      recentLogs: recentLogs.map(l => ({
        ...l,
        details: l.details ? JSON.parse(l.details) : null
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
