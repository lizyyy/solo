const db = require('./database');

const HEARTBEAT_TIMEOUT = 30000;

const aggregateHeartbeats = async (roomId, timeWindow = 60000) => {
  const now = Date.now();
  const startTime = now - timeWindow;
  
  const heartbeats = await db.allQuery(
    `SELECT user_id, session_id, COUNT(*) as count, MAX(timestamp) as last_time
     FROM heartbeat_events 
     WHERE room_id = ? AND timestamp >= ?
     GROUP BY user_id, session_id`,
    [roomId, startTime]
  );
  
  return heartbeats;
};

const identifyDisconnections = async () => {
  const now = Date.now();
  const cutoffTime = now - HEARTBEAT_TIMEOUT;
  
  const sessions = await db.allQuery(
    `SELECT cs.*, MAX(he.timestamp) as last_heartbeat
     FROM connection_sessions cs
     LEFT JOIN heartbeat_events he ON cs.id = he.session_id
     WHERE cs.status = 'connected'
     GROUP BY cs.id
     HAVING last_heartbeat < ? OR last_heartbeat IS NULL`,
    [cutoffTime]
  );
  
  const anomalies = [];
  for (const session of sessions) {
    const disconnectId = db.uuidv4();
    await db.runQuery(
      `INSERT INTO disconnect_reasons (id, session_id, reason_code, reason_message, detected_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [disconnectId, session.id, 'HEARTBEAT_TIMEOUT', '心跳超时未收到', now, JSON.stringify({ lastHeartbeat: session.last_heartbeat })]
    );
    
    await db.runQuery(
      `UPDATE connection_sessions 
       SET status = 'disconnected', disconnected_at = ?, disconnect_reason = ?, updated_at = ?
       WHERE id = ?`,
      [now, 'HEARTBEAT_TIMEOUT', now, session.id]
    );
    
    await db.runQuery(
      `UPDATE room_members 
       SET is_online = 0, left_at = ?
       WHERE session_id = ?`,
      [now, session.id]
    );
    
    const anomalyId = db.uuidv4();
    await db.runQuery(
      `INSERT INTO anomaly_queue (id, type, severity, session_id, room_id, user_id, description, metadata, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [anomalyId, 'disconnection', 'high', session.id, session.room_id, session.user_id, 
       '连接因心跳超时而断开', JSON.stringify({ lastHeartbeat: session.last_heartbeat }), 'pending', now]
    );
    
    anomalies.push({ id: anomalyId, sessionId: session.id });
  }
  
  return anomalies;
};

const takeRoomSnapshot = async (roomId) => {
  const now = Date.now();
  
  const members = await db.allQuery(
    `SELECT user_id, session_id, is_online
     FROM room_members
     WHERE room_id = ? AND is_online = 1`,
    [roomId]
  );
  
  const onlineCount = members.length;
  const snapshotId = db.uuidv4();
  
  await db.runQuery(
    `INSERT INTO online_snapshots (id, room_id, online_count, member_list, snapshot_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [snapshotId, roomId, onlineCount, JSON.stringify(members), now, now]
  );
  
  return { id: snapshotId, roomId, onlineCount, members };
};

const mergeDuplicateConnections = async (userId, roomId) => {
  const now = Date.now();
  
  const sessions = await db.allQuery(
    `SELECT * FROM connection_sessions
     WHERE user_id = ? AND room_id = ? AND status = 'connected'
     ORDER BY connected_at DESC`,
    [userId, roomId]
  );
  
  if (sessions.length <= 1) {
    return { merged: 0, kept: sessions[0]?.id };
  }
  
  const [keptSession, ...duplicateSessions] = sessions;
  const mergedCount = duplicateSessions.length;
  
  for (const dup of duplicateSessions) {
    await db.runQuery(
      `UPDATE connection_sessions 
       SET status = 'merged', disconnected_at = ?, disconnect_reason = 'DUPLICATE_MERGE', updated_at = ?
       WHERE id = ?`,
      [now, now, dup.id]
    );
    
    await db.runQuery(
      `UPDATE room_members 
       SET is_online = 0, left_at = ?
       WHERE session_id = ?`,
      [now, dup.id]
    );
    
    await db.runQuery(
      `UPDATE heartbeat_events 
       SET session_id = ?
       WHERE session_id = ?`,
      [keptSession.id, dup.id]
    );
    
    const anomalyId = db.uuidv4();
    await db.runQuery(
      `INSERT INTO anomaly_queue (id, type, severity, session_id, room_id, user_id, description, metadata, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [anomalyId, 'duplicate_connection', 'medium', dup.id, roomId, userId, 
       '重复连接已被合并', JSON.stringify({ mergedInto: keptSession.id }), 'resolved', now]
    );
  }
  
  return { merged: mergedCount, kept: keptSession.id };
};

const generateAuditExport = async (filters = {}) => {
  const { roomId, userId, startTime, endTime } = filters;
  
  let whereClauses = [];
  let params = [];
  
  if (roomId) {
    whereClauses.push('cs.room_id = ?');
    params.push(roomId);
  }
  if (userId) {
    whereClauses.push('cs.user_id = ?');
    params.push(userId);
  }
  if (startTime) {
    whereClauses.push('cs.connected_at >= ?');
    params.push(startTime);
  }
  if (endTime) {
    whereClauses.push('cs.connected_at <= ?');
    params.push(endTime);
  }
  
  const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
  
  const sessions = await db.allQuery(
    `SELECT cs.*, dr.reason_message, dr.reason_code
     FROM connection_sessions cs
     LEFT JOIN disconnect_reasons dr ON cs.id = dr.session_id
     ${whereSql}
     ORDER BY cs.connected_at DESC`,
    params
  );
  
  const heartbeats = await db.allQuery(
    `SELECT * FROM heartbeat_events
     WHERE session_id IN (SELECT id FROM connection_sessions cs ${whereSql})
     ORDER BY timestamp DESC`,
    params
  );
  
  const snapshots = await db.allQuery(
    `SELECT * FROM online_snapshots
     ${roomId ? 'WHERE room_id = ?' : ''}
     ORDER BY snapshot_at DESC`,
    roomId ? [roomId] : []
  );
  
  let anomalyWhere = [];
  let anomalyParams = [];
  if (roomId) { anomalyWhere.push('room_id = ?'); anomalyParams.push(roomId); }
  if (userId) { anomalyWhere.push('user_id = ?'); anomalyParams.push(userId); }
  const anomalyWhereSql = anomalyWhere.length > 0 ? `WHERE ${anomalyWhere.join(' AND ')}` : '';
  
  const anomalies = await db.allQuery(
    `SELECT * FROM anomaly_queue
     ${anomalyWhereSql}
     ORDER BY created_at DESC`,
    anomalyParams
  );
  
  return {
    exportTime: Date.now(),
    filters,
    summary: {
      totalSessions: sessions.length,
      totalHeartbeats: heartbeats.length,
      totalSnapshots: snapshots.length,
      totalAnomalies: anomalies.length
    },
    sessions,
    heartbeats,
    snapshots,
    anomalies
  };
};

module.exports = {
  aggregateHeartbeats,
  identifyDisconnections,
  takeRoomSnapshot,
  mergeDuplicateConnections,
  generateAuditExport
};
