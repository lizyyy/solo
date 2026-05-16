const { v4: uuidv4 } = require('uuid');
const { run, get, all } = require('../config/database');
const { calculateRiskScore } = require('./riskScoringService');
const { transitionStatus, recordHistory } = require('./stateMachineService');

const createAccount = async (accountData) => {
  const now = Date.now();
  const accountId = uuidv4();

  await run(
    `INSERT INTO accounts 
     (id, account_no, username, department, role, status, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [accountId, accountData.account_no, accountData.username, 
     accountData.department, accountData.role, 'active', now, now]
  );

  return get('SELECT * FROM accounts WHERE id = ?', [accountId]);
};

const getOrCreateAccount = async (accountData) => {
  let account = await get('SELECT * FROM accounts WHERE account_no = ?', [accountData.account_no]);
  
  if (!account) {
    account = await createAccount(accountData);
  }
  
  return account;
};

const recordDeviceFingerprint = async (accountId, fingerprintData) => {
  const now = Date.now();
  
  let device = await get(
    'SELECT * FROM device_fingerprints WHERE account_id = ? AND fingerprint_hash = ?',
    [accountId, fingerprintData.fingerprint_hash]
  );

  if (device) {
    await run(
      'UPDATE device_fingerprints SET last_seen = ? WHERE id = ?',
      [now, device.id]
    );
    return get('SELECT * FROM device_fingerprints WHERE id = ?', [device.id]);
  }

  const deviceId = uuidv4();
  await run(
    `INSERT INTO device_fingerprints 
     (id, account_id, fingerprint_hash, user_agent, screen_resolution, timezone, 
      language, platform, canvas_fingerprint, webgl_fingerprint, fonts, plugins, 
      ip_address, is_trusted, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [deviceId, accountId, fingerprintData.fingerprint_hash, fingerprintData.user_agent,
     fingerprintData.screen_resolution, fingerprintData.timezone,
     fingerprintData.language, fingerprintData.platform, fingerprintData.canvas_fingerprint,
     fingerprintData.webgl_fingerprint, fingerprintData.fonts, fingerprintData.plugins,
     fingerprintData.ip_address, 0, now, now]
  );

  return get('SELECT * FROM device_fingerprints WHERE id = ?', [deviceId]);
};

const recordLoginLocation = async (accountId, ipAddress, locationData) => {
  const now = Date.now();
  
  let location = await get(
    'SELECT * FROM login_locations WHERE account_id = ? AND ip_address = ?',
    [accountId, ipAddress]
  );

  if (location) {
    await run(
      'UPDATE login_locations SET last_seen = ? WHERE id = ?',
      [now, location.id]
    );
    return get('SELECT * FROM login_locations WHERE id = ?', [location.id]);
  }

  const locationId = uuidv4();
  await run(
    `INSERT INTO login_locations 
     (id, account_id, ip_address, country, province, city, district, 
      latitude, longitude, isp, is_common_location, first_seen, last_seen)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [locationId, accountId, ipAddress, locationData.country, 
     locationData.province, locationData.city, locationData.district,
     locationData.latitude, locationData.longitude, locationData.isp, 0, now, now]
  );

  return get('SELECT * FROM login_locations WHERE id = ?', [locationId]);
};

const createRiskEvent = async (eventData) => {
  const now = Date.now();
  const eventId = uuidv4();

  const account = await getOrCreateAccount({
    account_no: eventData.account_no,
    username: eventData.username || '未知用户',
    department: eventData.department,
    role: eventData.role
  });

  const riskResult = await calculateRiskScore(account.id, {
    ...eventData,
    location: eventData.location || {}
  });

  const device = await recordDeviceFingerprint(account.id, eventData.device_fingerprint);
  const location = await recordLoginLocation(account.id, eventData.ip_address, eventData.location || {});

  await run(
    `INSERT INTO risk_events 
     (id, account_id, event_type, risk_score, risk_level, status, 
      source_ip, source_location_id, device_fingerprint_id, raw_input, 
      processing_rules, detected_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [eventId, account.id, eventData.event_type || 'suspicious_login',
     riskResult.score, riskResult.level, 'detected',
     eventData.ip_address, location.id, device.id,
     JSON.stringify(eventData), JSON.stringify(riskResult.appliedRules),
     now, now, now]
  );

  return getRiskEventDetail(eventId);
};

const getRiskEventDetail = async (eventId) => {
  return get(
    `SELECT 
      re.*,
      a.account_no,
      a.username,
      a.department,
      a.role,
      ll.country as location_country,
      ll.province as location_province,
      ll.city as location_city,
      df.user_agent as device_user_agent,
      df.platform as device_platform
    FROM risk_events re
    LEFT JOIN accounts a ON re.account_id = a.id
    LEFT JOIN login_locations ll ON re.source_location_id = ll.id
    LEFT JOIN device_fingerprints df ON re.device_fingerprint_id = df.id
    WHERE re.id = ?`,
    [eventId]
  );
};

const queryRiskEvents = async (filters = {}) => {
  let sql = `
    SELECT 
      re.*,
      a.account_no,
      a.username,
      a.department
    FROM risk_events re
    LEFT JOIN accounts a ON re.account_id = a.id
    WHERE 1=1
  `;
  const params = [];

  if (filters.account_no) {
    sql += ' AND a.account_no = ?';
    params.push(filters.account_no);
  }

  if (filters.risk_level) {
    sql += ' AND re.risk_level = ?';
    params.push(filters.risk_level);
  }

  if (filters.status) {
    sql += ' AND re.status = ?';
    params.push(filters.status);
  }

  if (filters.start_time) {
    sql += ' AND re.created_at >= ?';
    params.push(filters.start_time);
  }

  if (filters.end_time) {
    sql += ' AND re.created_at <= ?';
    params.push(filters.end_time);
  }

  sql += ' ORDER BY re.created_at DESC';

  if (filters.limit) {
    sql += ' LIMIT ?';
    params.push(filters.limit);
  }

  return all(sql, params);
};

const handleException = async (eventId, failureReason, operator) => {
  const now = Date.now();
  const event = await get('SELECT * FROM risk_events WHERE id = ?', [eventId]);
  
  if (!event) {
    throw new Error('风险事件不存在');
  }

  await run(
    'UPDATE risk_events SET failure_reason = ?, updated_at = ? WHERE id = ?',
    [failureReason, now, eventId]
  );

  await recordHistory(
    eventId,
    'failure_reason',
    event.failure_reason,
    failureReason,
    operator,
    'system',
    '异常处理记录'
  );

  return { success: true, eventId, failureReason };
};

const manualCorrect = async (eventId, updates, operator, reason) => {
  const event = await get('SELECT * FROM risk_events WHERE id = ?', [eventId]);
  
  if (!event) {
    throw new Error('风险事件不存在');
  }

  const allowedFields = ['risk_score', 'risk_level', 'event_type'];
  const now = Date.now();

  for (const field of allowedFields) {
    if (updates[field] !== undefined) {
      const oldValue = event[field];
      const newValue = updates[field];

      await run(
        `UPDATE risk_events SET ${field} = ?, updated_at = ? WHERE id = ?`,
        [newValue, now, eventId]
      );

      await recordHistory(
        eventId,
        field,
        String(oldValue),
        String(newValue),
        operator,
        'human',
        reason || '人工修正'
      );
    }
  }

  return { success: true, eventId, updates };
};

const getEventHistory = async (eventId) => {
  return all(
    'SELECT * FROM event_history WHERE risk_event_id = ? ORDER BY changed_at DESC',
    [eventId]
  );
};

const getDispositionActions = async (eventId) => {
  return all(
    'SELECT * FROM disposition_actions WHERE risk_event_id = ? ORDER BY executed_at DESC',
    [eventId]
  );
};

const getReviewConclusion = async (eventId) => {
  return get(
    'SELECT * FROM review_conclusions WHERE risk_event_id = ?',
    [eventId]
  );
};

module.exports = {
  createAccount,
  createRiskEvent,
  getRiskEventDetail,
  queryRiskEvents,
  handleException,
  manualCorrect,
  getEventHistory,
  getDispositionActions,
  getReviewConclusion
};
