const crypto = require('crypto');
const config = require('../../config');

function generateSignature(payload, secret = config.signature.secret) {
  if (typeof payload === 'object') {
    payload = JSON.stringify(payload);
  }
  
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  return hmac.digest('hex');
}

function verifySignature(payload, signature, secret = config.signature.secret) {
  if (typeof payload === 'object') {
    payload = JSON.stringify(payload);
  }
  
  const expectedSignature = generateSignature(payload, secret);
  return crypto.timingSafeEqual(
    Buffer.from(signature, 'hex'),
    Buffer.from(expectedSignature, 'hex')
  );
}

function createCredential(participant, options = {}) {
  const now = Date.now();
  const expiresIn = options.expiresIn || 7 * 24 * 60 * 60 * 1000;
  
  const payload = {
    id: options.id || `cred_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    participant_id: participant.id,
    name: participant.name,
    email: participant.email || '',
    phone: participant.phone || '',
    issued_at: now,
    valid_from: options.validFrom || now,
    valid_until: options.validUntil || now + expiresIn,
    metadata: options.metadata || {}
  };
  
  const signature = generateSignature(payload);
  
  return {
    payload,
    signature,
    token: `${Buffer.from(JSON.stringify(payload)).toString('base64')}.${signature}`
  };
}

function parseCredential(token) {
  try {
    const [payloadBase64, signature] = token.split('.');
    
    if (!payloadBase64 || !signature) {
      return { valid: false, error: '无效的凭证格式' };
    }
    
    const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
    
    return {
      valid: true,
      payload,
      signature
    };
  } catch (error) {
    return { valid: false, error: `凭证解析失败: ${error.message}` };
  }
}

function verifyCredential(token, options = {}) {
  const parseResult = parseCredential(token);
  
  if (!parseResult.valid) {
    return {
      valid: false,
      error: parseResult.error,
      errorCode: 'PARSE_ERROR'
    };
  }
  
  const { payload, signature } = parseResult;
  
  if (!verifySignature(payload, signature)) {
    return {
      valid: false,
      error: '签名验证失败，凭证可能被篡改',
      errorCode: 'SIGNATURE_INVALID',
      payload
    };
  }
  
  const now = Date.now();
  
  if (payload.valid_from && now < payload.valid_from) {
    return {
      valid: false,
      error: `凭证尚未生效，生效时间: ${new Date(payload.valid_from).toLocaleString()}`,
      errorCode: 'NOT_YET_VALID',
      payload
    };
  }
  
  if (payload.valid_until && now > payload.valid_until) {
    return {
      valid: false,
      error: `凭证已过期，过期时间: ${new Date(payload.valid_until).toLocaleString()}`,
      errorCode: 'EXPIRED',
      payload
    };
  }
  
  return {
    valid: true,
    payload,
    signature
  };
}

module.exports = {
  generateSignature,
  verifySignature,
  createCredential,
  parseCredential,
  verifyCredential
};
