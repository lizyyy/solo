const crypto = require('crypto');
const config = require('./config');

function generateHmac(payload, timestamp, secret) {
  const message = `${timestamp}.${payload}`;
  return crypto.createHmac('sha256', secret).update(message).digest('hex');
}

function verifySignature(payload, signature, timestamp, secret) {
  if (!timestamp || !signature) {
    return { valid: false, error: 'Missing timestamp or signature' };
  }

  const ts = parseInt(timestamp);
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - ts);

  if (diff > config.TIMESTAMP_EXPIRATION_SECONDS) {
    return { valid: false, error: `Timestamp expired: ${diff}s > ${config.TIMESTAMP_EXPIRATION_SECONDS}s` };
  }

  const expectedSignature = generateHmac(payload, timestamp, secret);
  const expectedBuf = Buffer.from(expectedSignature);
  const actualBuf = Buffer.from(signature);
  
  if (expectedBuf.length !== actualBuf.length) {
    return { valid: false, error: 'Signature mismatch' };
  }
  
  if (!crypto.timingSafeEqual(expectedBuf, actualBuf)) {
    return { valid: false, error: 'Signature mismatch' };
  }

  return { valid: true };
}

function hashHeaders(headers) {
  const sensitive = ['authorization', 'x-signature', 'cookie'];
  const summary = {};
  for (const [k, v] of Object.entries(headers)) {
    const lowerKey = k.toLowerCase();
    if (sensitive.includes(lowerKey)) {
      summary[k] = '[REDACTED]';
    } else {
      summary[k] = String(v).substring(0, 100);
    }
  }
  const summaryStr = JSON.stringify(summary);
  const hash = crypto.createHash('sha256').update(JSON.stringify(headers)).digest('hex');
  return { hash, summary: summaryStr };
}

module.exports = {
  generateHmac,
  verifySignature,
  hashHeaders
};
