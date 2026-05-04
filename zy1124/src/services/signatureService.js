const crypto = require('crypto');

const SIGNATURE_ERRORS = {
  MISSING_HEADER: 'missing_signature_header',
  MISSING_TIMESTAMP: 'missing_timestamp',
  TIMESTAMP_EXPIRED: 'timestamp_expired',
  INVALID_SIGNATURE: 'invalid_signature',
  INVALID_ALGORITHM: 'invalid_algorithm',
};

function computeHmacSignature(rawBody, secret, algorithm = 'sha256') {
  const hmac = crypto.createHmac(algorithm, secret);
  hmac.update(rawBody);
  return hmac.digest('hex');
}

function extractEventIdFromBody(rawBody, eventIdKey = 'eventId') {
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed[eventIdKey]) {
      return String(parsed[eventIdKey]);
    }
    return null;
  } catch (e) {
    return null;
  }
}

function verifySignature(rawBody, headers, provider) {
  const signatureHeader = provider.signature_header || 'X-Signature';
  const timestampHeader = provider.timestamp_header || 'X-Timestamp';
  const tolerance = provider.tolerance_seconds || 300;
  const algorithm = provider.algorithm || 'sha256';
  
  const providedSignature = headers[signatureHeader.toLowerCase()] || headers[signatureHeader];
  if (!providedSignature) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.MISSING_HEADER,
      message: `Missing signature header: ${signatureHeader}`,
    };
  }
  
  const timestampStr = headers[timestampHeader.toLowerCase()] || headers[timestampHeader];
  if (!timestampStr) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.MISSING_TIMESTAMP,
      message: `Missing timestamp header: ${timestampHeader}`,
    };
  }
  
  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.MISSING_TIMESTAMP,
      message: 'Invalid timestamp format',
    };
  }
  
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.abs(now - timestamp);
  
  if (diff > tolerance) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.TIMESTAMP_EXPIRED,
      message: `Timestamp expired: diff=${diff}s, tolerance=${tolerance}s`,
      details: { now, timestamp, diff, tolerance },
    };
  }
  
  const validAlgorithms = ['sha256', 'sha512', 'sha1'];
  if (!validAlgorithms.includes(algorithm)) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.INVALID_ALGORITHM,
      message: `Invalid algorithm: ${algorithm}`,
    };
  }
  
  const expectedSignature = computeHmacSignature(rawBody, provider.secret, algorithm);
  
  let signatureToCompare = providedSignature;
  if (providedSignature.startsWith('sha256=')) {
    signatureToCompare = providedSignature.slice(7);
  } else if (providedSignature.startsWith('sha512=')) {
    signatureToCompare = providedSignature.slice(7);
  } else if (providedSignature.startsWith('hmac-sha256=')) {
    signatureToCompare = providedSignature.slice(12);
  }
  
  const hexRegex = /^[0-9a-fA-F]+$/;
  if (!hexRegex.test(signatureToCompare)) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.INVALID_SIGNATURE,
      message: 'Invalid signature format (not hex)',
      details: {
        provided: signatureToCompare.substring(0, 32),
        algorithm,
      },
    };
  }
  
  const expectedBuffer = Buffer.from(expectedSignature, 'hex');
  const providedBuffer = Buffer.from(signatureToCompare, 'hex');
  
  if (expectedBuffer.length !== providedBuffer.length) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.INVALID_SIGNATURE,
      message: 'Signature length mismatch',
      details: {
        provided_length: providedBuffer.length,
        expected_length: expectedBuffer.length,
        algorithm,
      },
    };
  }
  
  const isValid = crypto.timingSafeEqual(expectedBuffer, providedBuffer);
  
  if (!isValid) {
    return {
      valid: false,
      error: SIGNATURE_ERRORS.INVALID_SIGNATURE,
      message: 'Signature mismatch',
      details: {
        provided: signatureToCompare,
        expected: expectedSignature,
        algorithm,
      },
    };
  }
  
  return {
    valid: true,
    timestamp,
  };
}

function generateTestSignature(rawBody, secret, algorithm = 'sha256') {
  return computeHmacSignature(rawBody, secret, algorithm);
}

module.exports = {
  verifySignature,
  computeHmacSignature,
  generateTestSignature,
  extractEventIdFromBody,
  SIGNATURE_ERRORS,
};
