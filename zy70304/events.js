const dbModule = require('./database');
const config = require('./config');
const signature = require('./signature');
const business = require('./business');

let db = null;

function ensureDb() {
  if (!db) {
    db = dbModule;
  }
  return db;
}

function addAudit(eventId, action, actor, details) {
  ensureDb().prepare(`
    INSERT INTO audits (event_id, action, actor, timestamp, details)
    VALUES (?, ?, ?, ?, ?)
  `).run(eventId || null, action, actor || 'system', Date.now(), details ? JSON.stringify(details) : null);
}

async function receiveWebhook(req) {
  const now = Date.now();
  const nowSec = Math.floor(now / 1000);
  
  const eventId = req.headers['x-event-id'] || req.headers['X-Event-Id'];
  const provider = req.headers['x-provider'] || req.headers['X-Provider'] || 'unknown';
  const eventType = req.headers['x-event-type'] || req.headers['X-Event-Type'] || 'unknown';
  const sig = req.headers['x-signature'] || req.headers['X-Signature'] || '';
  const ts = req.headers['x-timestamp'] || req.headers['X-Timestamp'] || '';
  
  const rawBody = req.rawBody || JSON.stringify(req.body);
  
  if (!eventId) {
    return { httpStatus: 400, error: 'Missing X-Event-Id header' };
  }

  const existing = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  
  if (existing) {
    addAudit(eventId, 'duplicate_received', null, { existing_status: existing.status });
    return {
      httpStatus: 200,
      message: 'Duplicate event received, already stored',
      event_id: eventId,
      existing_status: existing.status,
      is_duplicate: true
    };
  }

  const headersInfo = signature.hashHeaders(req.headers);
  const sigCheck = signature.verifySignature(rawBody, sig, ts, config.SIGNATURE_SECRET);
  
  const sigValid = sigCheck.valid ? 1 : 0;
  const sigError = sigCheck.error || null;
  
  let tsValid = 1;
  let tsError = null;
  const timestampInt = parseInt(ts);
  if (!isNaN(timestampInt)) {
    const diff = Math.abs(nowSec - timestampInt);
    if (diff > config.TIMESTAMP_EXPIRATION_SECONDS) {
      tsValid = 0;
      tsError = `Timestamp expired: ${diff}s > ${config.TIMESTAMP_EXPIRATION_SECONDS}s`;
    }
  } else if (ts) {
    tsValid = 0;
    tsError = 'Invalid timestamp format';
  }

  let initialStatus = 'pending';
  let lastError = null;
  let businessSummary = null;

  if (!sigValid || !tsValid) {
    initialStatus = 'signature_failed';
    lastError = sigError || tsError;
  }

  ensureDb().prepare(`
    INSERT INTO events (
      event_id, provider, event_type, raw_body, headers_hash, headers_summary,
      signature, timestamp, received_at, signature_valid, signature_error,
      timestamp_valid, timestamp_error, status, last_attempt_at,
      attempt_count, last_error, business_summary
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    eventId, provider, eventType, rawBody, headersInfo.hash, headersInfo.summary,
    sig ? '[REDACTED]' : null, ts ? parseInt(ts) : null, now,
    sigValid, sigError, tsValid, tsError, initialStatus,
    null, 0, lastError, businessSummary
  );

  if (sigValid && tsValid) {
    const attemptResult = await attemptProcessing(eventId, rawBody, eventType, 'full', true);
    initialStatus = attemptResult.success ? 'success' : 'failed';
  }

  addAudit(eventId, 'event_received', null, {
    provider,
    event_type: eventType,
    signature_valid: !!sigValid,
    timestamp_valid: !!tsValid,
    status: initialStatus
  });

  return {
    httpStatus: initialStatus === 'success' ? 200 : 202,
    message: initialStatus === 'success' ? 'Event processed successfully' : 'Event stored, processing pending',
    event_id: eventId,
    signature_valid: !!sigValid,
    timestamp_valid: !!tsValid,
    event_status: initialStatus
  };
}

async function attemptProcessing(eventId, rawBody, eventType, mode, isInitial) {
  const startedAt = Date.now();
  const details = { mode };
  let success = false;
  let errorMsg = null;
  let summary = null;

  try {
    if (mode === 'verify_signature_only') {
      return {
        success: true,
        summary: 'Signature verification mode - business processing skipped',
        details: { mode }
      };
    }

    const result = await business.processBusinessEvent(eventType, rawBody);
    success = true;
    summary = JSON.stringify(result);
    details.business_result = result;
  } catch (e) {
    errorMsg = e.message;
    success = false;
  }

  const endedAt = Date.now();
  
  const attemptNumberStmt = ensureDb().prepare('SELECT COUNT(*) as count FROM attempts WHERE event_id = ?');
  const attemptCount = attemptNumberStmt.get(eventId).count + 1;

  ensureDb().prepare(`
    INSERT INTO attempts (event_id, attempt_number, mode, started_at, ended_at, success, error, details)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(eventId, attemptCount, mode, startedAt, endedAt, success ? 1 : 0, errorMsg, JSON.stringify(details));

  ensureDb().prepare(`
    UPDATE events 
    SET status = ?, last_attempt_at = ?, attempt_count = attempt_count + 1, 
        last_error = ?, business_summary = COALESCE(business_summary, ?)
    WHERE event_id = ?
  `).run(
    success ? 'success' : 'failed',
    endedAt,
    errorMsg,
    summary,
    eventId
  );

  addAudit(eventId, success ? 'process_success' : 'process_failed', null, {
    attempt_number: attemptCount,
    mode,
    error: errorMsg
  });

  return { success, error: errorMsg, summary };
}

function getEventById(eventId) {
  const event = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  if (!event) return null;

  const attempts = ensureDb().prepare('SELECT * FROM attempts WHERE event_id = ? ORDER BY attempt_number ASC').all(eventId);
  const audits = ensureDb().prepare('SELECT * FROM audits WHERE event_id = ? ORDER BY timestamp ASC').all(eventId);

  return {
    ...event,
    signature_valid: !!event.signature_valid,
    timestamp_valid: !!event.timestamp_valid,
    confirmed_completed: !!event.confirmed_completed,
    replay_disabled: !!event.replay_disabled,
    attempts: attempts.map(a => ({
      ...a,
      success: !!a.success,
      details: a.details ? JSON.parse(a.details) : null
    })),
    audits: audits.map(a => ({
      ...a,
      details: a.details ? JSON.parse(a.details) : null
    }))
  };
}

function listEvents(filters) {
  const where = [];
  const params = [];
  
  if (filters.status) {
    where.push('status = ?');
    params.push(filters.status);
  }
  if (filters.event_type) {
    where.push('event_type = ?');
    params.push(filters.event_type);
  }
  if (filters.provider) {
    where.push('provider = ?');
    params.push(filters.provider);
  }

  const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const events = ensureDb().prepare(`SELECT * FROM events ${whereClause} ORDER BY received_at DESC LIMIT 100`).all(...params);
  
  return events.map(e => ({
    ...e,
    signature_valid: !!e.signature_valid,
    timestamp_valid: !!e.timestamp_valid,
    confirmed_completed: !!e.confirmed_completed,
    replay_disabled: !!e.replay_disabled
  }));
}

async function replayEvent(eventId, mode, actor) {
  const event = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  
  if (!event) {
    return { httpStatus: 404, error: 'Event not found' };
  }

  if (event.replay_disabled) {
    addAudit(eventId, 'replay_rejected_disabled', actor, { mode });
    return { httpStatus: 403, error: 'Replay is disabled for this event' };
  }

  if (event.confirmed_completed) {
    addAudit(eventId, 'replay_warning_confirmed', actor, { mode });
    return { 
      httpStatus: 409, 
      error: 'Event is already confirmed as completed', 
      note: 'If you still need to replay, first unconfirm the event'
    };
  }

  const nowSec = Math.floor(Date.now() / 1000);
  const hoursDiff = (nowSec - event.received_at / 1000) / 3600;
  if (hoursDiff > config.REPLAY_WINDOW_HOURS) {
    addAudit(eventId, 'replay_rejected_window', actor, { mode, hours_ago: hoursDiff });
    return { httpStatus: 403, error: `Replay window expired: ${hoursDiff.toFixed(1)}h > ${config.REPLAY_WINDOW_HOURS}h` };
  }

  addAudit(eventId, 'replay_started', actor, { mode });

  let sigValidForReplay = true;
  let sigErrorForReplay = null;

  if (mode === 'full' || mode === 'verify_signature_only') {
    if (event.timestamp) {
      const tsStr = String(event.timestamp);
      const rawBody = event.raw_body;
      const check = signature.verifySignature(rawBody, '[REDACTED_SKIP]', tsStr, config.SIGNATURE_SECRET);
      sigValidForReplay = check.valid || check.error?.startsWith('Missing');
      sigErrorForReplay = check.error;
    }
  }

  const result = await attemptProcessing(eventId, event.raw_body, event.event_type, mode, false);

  return {
    httpStatus: result.success ? 200 : 202,
    event_id: eventId,
    mode,
    success: result.success,
    error: result.error,
    signature_checked: mode !== 'business_only',
    signature_valid_in_replay: sigValidForReplay,
    signature_note: sigErrorForReplay
  };
}

function disableReplay(eventId, reason, actor) {
  const event = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  if (!event) return { httpStatus: 404, error: 'Event not found' };

  ensureDb().prepare('UPDATE events SET replay_disabled = 1 WHERE event_id = ?').run(eventId);
  addAudit(eventId, 'replay_disabled', actor, { reason });
  
  return { httpStatus: 200, event_id: eventId, replay_disabled: true };
}

function confirmCompleted(eventId, actor) {
  const event = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  if (!event) return { httpStatus: 404, error: 'Event not found' };

  ensureDb().prepare('UPDATE events SET confirmed_completed = 1, status = ? WHERE event_id = ?').run('confirmed', eventId);
  addAudit(eventId, 'confirmed_completed', actor, {});
  
  return { httpStatus: 200, event_id: eventId, confirmed_completed: true };
}

function unconfirmCompleted(eventId, actor) {
  const event = ensureDb().prepare('SELECT * FROM events WHERE event_id = ?').get(eventId);
  if (!event) return { httpStatus: 404, error: 'Event not found' };

  ensureDb().prepare('UPDATE events SET confirmed_completed = 0, status = ? WHERE event_id = ?').run(
    event.attempt_count > 0 ? 'failed' : 'pending',
    eventId
  );
  addAudit(eventId, 'unconfirmed_completed', actor, {});
  
  return { httpStatus: 200, event_id: eventId, confirmed_completed: false };
}

module.exports = {
  receiveWebhook,
  getEventById,
  listEvents,
  replayEvent,
  disableReplay,
  confirmCompleted,
  unconfirmCompleted
};
