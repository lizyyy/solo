const crypto = require('crypto');

class SignatureVerifier {
  constructor() {
    this.algorithms = ['MD5', 'SHA1', 'SHA256', 'HMAC-SHA256'];
  }

  generateSignature(data, algorithm = 'MD5', key = '') {
    if (!this.algorithms.includes(algorithm)) {
      throw new Error(`不支持的签名算法: ${algorithm}`);
    }

    const sortedData = this.sortObjectKeys(data);
    const dataString = JSON.stringify(sortedData);

    if (algorithm === 'HMAC-SHA256') {
      return crypto.createHmac('sha256', key).update(dataString).digest('hex');
    } else if (algorithm === 'SHA256') {
      return crypto.createHash('sha256').update(dataString).digest('hex');
    } else if (algorithm === 'SHA1') {
      return crypto.createHash('sha1').update(dataString).digest('hex');
    } else {
      return crypto.createHash('md5').update(dataString).digest('hex');
    }
  }

  sortObjectKeys(obj) {
    if (Array.isArray(obj)) {
      return obj.map(item => this.sortObjectKeys(item));
    } else if (obj !== null && typeof obj === 'object') {
      return Object.keys(obj).sort().reduce((result, key) => {
        result[key] = this.sortObjectKeys(obj[key]);
        return result;
      }, {});
    }
    return obj;
  }

  verify(message, expectedAlgorithm, key = '') {
    const { sign, signMethod, ...data } = message;

    if (!sign) {
      return {
        valid: false,
        error: '缺少签名字段',
        expectedAlgorithm: signMethod || 'unknown',
        actualAlgorithm: null
      };
    }

    const usedAlgorithm = signMethod || 'MD5';
    const calculatedSign = this.generateSignature(data, usedAlgorithm, key);

    if (usedAlgorithm !== expectedAlgorithm) {
      return {
        valid: false,
        error: `签名算法不一致: 期望 ${expectedAlgorithm}, 实际 ${usedAlgorithm}`,
        expectedAlgorithm,
        actualAlgorithm: usedAlgorithm,
        expectedSign: this.generateSignature(data, expectedAlgorithm, key),
        actualSign: sign
      };
    }

    if (calculatedSign !== sign) {
      return {
        valid: false,
        error: '签名验证失败',
        expectedAlgorithm,
        actualAlgorithm: usedAlgorithm,
        expectedSign: calculatedSign,
        actualSign: sign
      };
    }

    return {
      valid: true,
      algorithm: usedAlgorithm,
      sign: sign
    };
  }
}

module.exports = SignatureVerifier;