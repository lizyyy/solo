const express = require('express');
const router = express.Router();
const db = require('./database');
const rules = require('./rules');

const auditLog = async (requestId, action, input, result, responsibleNode, status, errorMessage = null) => {
  const logId = db.uuidv4();
  const now = Date.now();
  await db.runQuery(
    `INSERT INTO audit_logs (id, request_id, action, input_data, result_data, responsible_node, status, error_message, timestamp, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [logId, requestId, action, JSON.stringify(input), JSON.stringify(result), responsibleNode, status, errorMessage, now, now]
  );
};

const generateRequestId = () => `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

router.post('/session/connect', async (req, res) => {
  const requestId = generateRequestId();
  const { userId, roomId, deviceId, deviceType, deviceInfo, ipAddress } = req.body;
  
  try {
    const now = Date.now();
    const sessionId = db.uuidv4();
    
    await db.runQuery(
      `INSERT INTO connection_sessions (id, user_id, device_id, room_id, status, connected_at, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [sessionId, userId, deviceId, roomId, 'connected', now, now, now]
    );
    
    const deviceRecordId = db.uuidv4();
    await db.runQuery(
      `INSERT OR REPLACE INTO user_devices (id, user_id, device_type, device_info, ip_address, last_seen, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [deviceRecordId, userId, deviceType, JSON.stringify(deviceInfo), ipAddress, now, now]
    );
    
    const memberId = db.uuidv4();
    await db.runQuery(
      `INSERT INTO room_members (id, room_id, user_id, session_id, joined_at, is_online, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [memberId, roomId, userId, sessionId, now, 1, now]
    );
    
    const mergeResult = await rules.mergeDuplicateConnections(userId, roomId);
    
    const snapshot = await rules.takeRoomSnapshot(roomId);
    
    const result = { sessionId, userId, roomId, status: 'connected', merged: mergeResult.merged, snapshot };
    await auditLog(requestId, 'session_connect', req.body, result, 'connection-manager', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'session_connect', req.body, null, 'connection-manager', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/session/heartbeat', async (req, res) => {
  const requestId = generateRequestId();
  const { sessionId, userId, roomId, payload } = req.body;
  
  try {
    const now = Date.now();
    const heartbeatId = db.uuidv4();
    
    await db.runQuery(
      `INSERT INTO heartbeat_events (id, session_id, user_id, room_id, timestamp, payload, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [heartbeatId, sessionId, userId, roomId, now, JSON.stringify(payload), now]
    );
    
    await db.runQuery(
      `UPDATE user_devices SET last_seen = ? WHERE user_id = ?`,
      [now, userId]
    );
    
    const aggregated = await rules.aggregateHeartbeats(roomId);
    
    const result = { heartbeatId, timestamp: now, aggregated };
    await auditLog(requestId, 'session_heartbeat', req.body, result, 'heartbeat-processor', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'session_heartbeat', req.body, null, 'heartbeat-processor', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/session/disconnect', async (req, res) => {
  const requestId = generateRequestId();
  const { sessionId, reason } = req.body;
  
  try {
    const now = Date.now();
    
    const session = await db.getQuery(`SELECT * FROM connection_sessions WHERE id = ?`, [sessionId]);
    if (!session) {
      throw new Error('Session not found');
    }
    
    await db.runQuery(
      `UPDATE connection_sessions 
       SET status = 'disconnected', disconnected_at = ?, disconnect_reason = ?, updated_at = ?
       WHERE id = ?`,
      [now, reason || 'USER_INITIATED', now, sessionId]
    );
    
    await db.runQuery(
      `UPDATE room_members 
       SET is_online = 0, left_at = ?
       WHERE session_id = ?`,
      [now, sessionId]
    );
    
    const disconnectId = db.uuidv4();
    await db.runQuery(
      `INSERT INTO disconnect_reasons (id, session_id, reason_code, reason_message, detected_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [disconnectId, sessionId, reason || 'USER_INITIATED', '用户主动断开', now, '{}']
    );
    
    const snapshot = await rules.takeRoomSnapshot(session.room_id);
    
    const result = { sessionId, status: 'disconnected', reason, snapshot };
    await auditLog(requestId, 'session_disconnect', req.body, result, 'connection-manager', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'session_disconnect', req.body, null, 'connection-manager', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/status/advance', async (req, res) => {
  const requestId = generateRequestId();
  const { sessionId, newStatus, metadata } = req.body;
  
  try {
    const now = Date.now();
    
    await db.runQuery(
      `UPDATE connection_sessions SET status = ?, updated_at = ? WHERE id = ?`,
      [newStatus, now, sessionId]
    );
    
    const result = { sessionId, newStatus, timestamp: now };
    await auditLog(requestId, 'status_advance', req.body, result, 'state-machine', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'status_advance', req.body, null, 'state-machine', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/sessions', async (req, res) => {
  const requestId = generateRequestId();
  const { roomId, userId, status } = req.query;
  
  try {
    let sql = `SELECT * FROM connection_sessions`;
    let params = [];
    let conditions = [];
    
    if (roomId) { conditions.push('room_id = ?'); params.push(roomId); }
    if (userId) { conditions.push('user_id = ?'); params.push(userId); }
    if (status) { conditions.push('status = ?'); params.push(status); }
    
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ORDER BY connected_at DESC LIMIT 100`;
    
    const sessions = await db.allQuery(sql, params);
    
    await auditLog(requestId, 'query_sessions', req.query, { count: sessions.length }, 'query-service', 'success');
    
    res.json({ success: true, data: sessions, requestId });
  } catch (error) {
    await auditLog(requestId, 'query_sessions', req.query, null, 'query-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/anomalies', async (req, res) => {
  const requestId = generateRequestId();
  const { status } = req.query;
  
  try {
    let sql = `SELECT * FROM anomaly_queue`;
    let params = [];
    
    if (status) {
      sql += ` WHERE status = ?`;
      params.push(status);
    }
    sql += ` ORDER BY created_at DESC LIMIT 100`;
    
    const anomalies = await db.allQuery(sql, params);
    
    await auditLog(requestId, 'query_anomalies', req.query, { count: anomalies.length }, 'query-service', 'success');
    
    res.json({ success: true, data: anomalies, requestId });
  } catch (error) {
    await auditLog(requestId, 'query_anomalies', req.query, null, 'query-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/anomalies/:id/resolve', async (req, res) => {
  const requestId = generateRequestId();
  const { id } = req.params;
  
  try {
    const now = Date.now();
    
    await db.runQuery(
      `UPDATE anomaly_queue SET status = 'resolved', resolved_at = ? WHERE id = ?`,
      [now, id]
    );
    
    const result = { anomalyId: id, status: 'resolved', resolvedAt: now };
    await auditLog(requestId, 'resolve_anomaly', { id }, result, 'anomaly-resolver', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'resolve_anomaly', { id }, null, 'anomaly-resolver', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/snapshots/:roomId', async (req, res) => {
  const requestId = generateRequestId();
  const { roomId } = req.params;
  
  try {
    const snapshots = await db.allQuery(
      `SELECT * FROM online_snapshots WHERE room_id = ? ORDER BY snapshot_at DESC LIMIT 50`,
      [roomId]
    );
    
    await auditLog(requestId, 'query_snapshots', { roomId }, { count: snapshots.length }, 'query-service', 'success');
    
    res.json({ success: true, data: snapshots, requestId });
  } catch (error) {
    await auditLog(requestId, 'query_snapshots', { roomId }, null, 'query-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/audit-logs', async (req, res) => {
  const requestId = generateRequestId();
  
  try {
    const logs = await db.allQuery(
      `SELECT * FROM audit_logs ORDER BY timestamp DESC LIMIT 100`
    );
    
    res.json({ success: true, data: logs, requestId });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/history/:sessionId', async (req, res) => {
  const requestId = generateRequestId();
  const { sessionId } = req.params;
  
  try {
    const session = await db.getQuery(`SELECT * FROM connection_sessions WHERE id = ?`, [sessionId]);
    const heartbeats = await db.allQuery(`SELECT * FROM heartbeat_events WHERE session_id = ? ORDER BY timestamp DESC`, [sessionId]);
    const disconnectReason = await db.getQuery(`SELECT * FROM disconnect_reasons WHERE session_id = ?`, [sessionId]);
    
    const result = { session, heartbeats, disconnectReason };
    await auditLog(requestId, 'query_history', { sessionId }, { hasSession: !!session, heartbeatCount: heartbeats.length }, 'query-service', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'query_history', { sessionId }, null, 'query-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/export', async (req, res) => {
  const requestId = generateRequestId();
  const filters = req.body;
  
  try {
    const exportData = await rules.generateAuditExport(filters);
    
    await auditLog(requestId, 'audit_export', filters, exportData.summary, 'export-service', 'success');
    
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-export-${Date.now()}.json"`);
    res.json({ success: true, data: exportData, requestId });
  } catch (error) {
    await auditLog(requestId, 'audit_export', filters, null, 'export-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.post('/rules/check-disconnections', async (req, res) => {
  const requestId = generateRequestId();
  
  try {
    const anomalies = await rules.identifyDisconnections();
    
    const result = { detected: anomalies.length, anomalies };
    await auditLog(requestId, 'check_disconnections', {}, result, 'rules-engine', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'check_disconnections', {}, null, 'rules-engine', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

router.get('/rooms/:roomId/online', async (req, res) => {
  const requestId = generateRequestId();
  const { roomId } = req.params;
  
  try {
    const members = await db.allQuery(
      `SELECT rm.*, cs.status, cs.device_id, ud.device_type, ud.last_seen
       FROM room_members rm
       JOIN connection_sessions cs ON rm.session_id = cs.id
       JOIN user_devices ud ON cs.user_id = ud.user_id
       WHERE rm.room_id = ? AND rm.is_online = 1`,
      [roomId]
    );
    
    const result = { roomId, onlineCount: members.length, members };
    await auditLog(requestId, 'query_online_users', { roomId }, { onlineCount: members.length }, 'query-service', 'success');
    
    res.json({ success: true, data: result, requestId });
  } catch (error) {
    await auditLog(requestId, 'query_online_users', { roomId }, null, 'query-service', 'error', error.message);
    res.status(500).json({ success: false, error: error.message, requestId });
  }
});

module.exports = router;
