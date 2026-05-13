const axios = require('axios');
const db = require('../db');
const { generateId, now } = require('../utils');

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const CALLBACK_TIMEOUT_MS = 10000;

const CALLBACK_STATUSES = {
  PENDING: 'pending',
  SENDING: 'sending',
  SUCCESS: 'success',
  FAILED: 'failed',
};

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function getTransactionById(transactionId) {
  return db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId);
}

function updateTransactionById(transactionId, updates) {
  const validUpdates = { ...updates, updated_at: now() };
  const setClauses = Object.keys(validUpdates).map(field => `${field} = ?`);
  const values = [...Object.values(validUpdates), transactionId];

  const stmt = db.prepare(`UPDATE transactions SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...values);
  return getTransactionById(transactionId);
}

function createTransactionStepRecord(transactionId, stepOrder, stepName, status, result = null, errorMessage = null) {
  const id = generateId();
  const stmt = db.prepare(`
    INSERT INTO transaction_steps (
      id, transaction_id, step_order, step_name, status, result, error_message, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, transactionId, stepOrder, stepName, status,
    result ? JSON.stringify(result) : null,
    errorMessage,
    now(),
    now()
  );
  return id;
}

async function sendCallback(transactionId, meetingId, eventType, data) {
  const transaction = getTransactionById(transactionId);
  if (!transaction) {
    console.error(`[Callback] Transaction not found: ${transactionId}`);
    return { success: false, error: 'Transaction not found' };
  }

  const callbackUrl = transaction.callback_url;
  if (!callbackUrl) {
    console.log(`[Callback] No callback URL for transaction ${transactionId}`);
    return { success: true, skipped: true };
  }

  updateTransactionById(transactionId, {
    status: 'callback',
    step: 'send_callback',
  });

  const payload = {
    transaction_id: transactionId,
    meeting_id: meetingId,
    event_type: eventType,
    status: transaction.status,
    data: data,
    timestamp: now(),
  };

  let lastError = null;
  
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    console.log(`[Callback] Attempt ${attempt}/${MAX_RETRIES} to ${callbackUrl}`);
    
    try {
      const response = await axios.post(callbackUrl, payload, {
        timeout: CALLBACK_TIMEOUT_MS,
        headers: {
          'Content-Type': 'application/json',
          'X-Callback-Attempt': attempt,
        },
      });

      console.log(`[Callback] Success: ${response.status}`);

      createTransactionStepRecord(
        transactionId,
        99,
        'send_callback',
        'completed',
        { attempt, statusCode: response.status }
      );

      updateTransactionById(transactionId, {
        status: transaction.status === 'compensating' ? 'failed' : transaction.status,
        step: null,
      });

      return {
        success: true,
        attempt,
        statusCode: response.status,
      };
    } catch (err) {
      lastError = err.message;
      console.error(`[Callback] Attempt ${attempt} failed: ${err.message}`);

      if (attempt < MAX_RETRIES) {
        console.log(`[Callback] Retrying in ${RETRY_DELAY_MS * attempt}ms...`);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(`[Callback] All ${MAX_RETRIES} attempts failed`);
  
  createTransactionStepRecord(
    transactionId,
    99,
    'send_callback',
    'failed',
    null,
    lastError
  );

  updateTransactionById(transactionId, {
    status: 'callback_failed',
    retry_count: (transaction.retry_count || 0) + 1,
    error_message: lastError,
  });

  return {
    success: false,
    error: 'All callback attempts failed',
    lastError,
    attempts: MAX_RETRIES,
  };
}

function getPendingCallbacks() {
  return db.prepare(`
    SELECT * FROM transactions
    WHERE status = ? AND callback_url IS NOT NULL
    ORDER BY created_at ASC
  `).all('callback_failed');
}

async function retryPendingCallbacks() {
  const pending = getPendingCallbacks();
  console.log(`[Callback Retry] Found ${pending.length} pending callbacks`);

  const results = [];
  for (const tx of pending) {
    const result = await sendCallback(
      tx.id,
      tx.meeting_id,
      tx.type,
      {
        old_start_time: tx.old_start_time,
        new_start_time: tx.new_start_time,
      }
    );
    results.push({
      transactionId: tx.id,
      ...result,
    });
  }

  return results;
}

function startCallbackRetryScheduler(intervalMs = 60000) {
  console.log(`[Callback Scheduler] Started with ${intervalMs}ms interval`);
  
  setInterval(async () => {
    try {
      await retryPendingCallbacks();
    } catch (err) {
      console.error('[Callback Scheduler] Error:', err);
    }
  }, intervalMs);
}

module.exports = {
  MAX_RETRIES,
  RETRY_DELAY_MS,
  CALLBACK_TIMEOUT_MS,
  CALLBACK_STATUSES,
  sendCallback,
  getPendingCallbacks,
  retryPendingCallbacks,
  startCallbackRetryScheduler,
};
