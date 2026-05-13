const axios = require('axios');
const db = require('../db');
const { now } = require('../utils');
const { getTransaction, updateTransaction, createTransactionStep } = require('./transactionService');

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

async function sendCallback(transactionId, meetingId, eventType, data) {
  const transaction = getTransaction(transactionId);
  if (!transaction) {
    console.error(`[Callback] Transaction not found: ${transactionId}`);
    return { success: false, error: 'Transaction not found' };
  }

  const callbackUrl = transaction.callback_url;
  if (!callbackUrl) {
    console.log(`[Callback] No callback URL for transaction ${transactionId}`);
    return { success: true, skipped: true };
  }

  updateTransaction(transactionId, {
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

      createTransactionStep(
        transactionId,
        99,
        'send_callback',
        'completed',
        { attempt, statusCode: response.status }
      );

      updateTransaction(transactionId, {
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
        console.log(`[Callback] Retrying in ${RETRY_DELAY_MS}ms...`);
        await sleep(RETRY_DELAY_MS * attempt);
      }
    }
  }

  console.error(`[Callback] All ${MAX_RETRIES} attempts failed`);
  
  createTransactionStep(
    transactionId,
    99,
    'send_callback',
    'failed',
    null,
    lastError
  );

  updateTransaction(transactionId, {
    status: 'callback_failed',
    retry_count: transaction.retry_count + 1,
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
