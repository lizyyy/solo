const crypto = require('crypto');
const config = require('../config');

class Signature {
  constructor(options = {}) {
    this.algorithm = options.algorithm || config.signature.algorithm;
    this.header = options.header || config.signature.header;
    this.prefix = options.prefix || config.signature.prefix;
  }

  generate(secret, payload) {
    const payloadString = typeof payload === 'string' 
      ? payload 
      : JSON.stringify(payload);
    
    const hmac = crypto.createHmac(this.algorithm, secret);
    const signature = hmac.update(payloadString, 'utf8').digest('hex');
    
    return this.prefix + signature;
  }

  verify(secret, payload, signature) {
    if (!signature) {
      return {
        valid: false,
        error: 'Missing signature'
      };
    }

    const expectedSignature = this.generate(secret, payload);
    
    if (!crypto.timingSafeEqual(
      Buffer.from(signature, 'utf8'),
      Buffer.from(expectedSignature, 'utf8')
    )) {
      return {
        valid: false,
        error: 'Signature mismatch',
        expected: expectedSignature,
        received: signature
      };
    }

    return {
      valid: true,
      error: null
    };
  }

  verifyFromRequest(secret, payload, headers) {
    const signature = headers[this.header.toLowerCase()] || 
                      headers[this.header] ||
                      null;
    
    if (!signature) {
      return {
        valid: false,
        error: `Missing ${this.header} header`
      };
    }

    let cleanSignature = signature;
    if (signature.startsWith(this.prefix)) {
      cleanSignature = signature;
    } else {
      cleanSignature = this.prefix + signature;
    }

    return this.verify(secret, payload, cleanSignature);
  }

  generateRequestHeaders(secret, payload) {
    const signature = this.generate(secret, payload);
    return {
      [this.header]: signature
    };
  }
}

module.exports = Signature;