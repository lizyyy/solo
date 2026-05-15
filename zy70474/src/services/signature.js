const CryptoJS = require('crypto-js');

class SignatureService {
  constructor() {
    this.supportedAlgorithms = ['MD5', 'SHA1', 'SHA256', 'SHA512'];
    this.correctAlgorithm = 'SHA256';
  }

  generateSignature(content, algorithm = 'SHA256') {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    switch (algorithm.toUpperCase()) {
      case 'MD5':
        return CryptoJS.MD5(contentStr).toString();
      case 'SHA1':
        return CryptoJS.SHA1(contentStr).toString();
      case 'SHA256':
        return CryptoJS.SHA256(contentStr).toString();
      case 'SHA512':
        return CryptoJS.SHA512(contentStr).toString();
      default:
        throw new Error(`不支持的签名算法: ${algorithm}`);
    }
  }

  verifySignature(content, signature, algorithm) {
    const result = {
      valid: false,
      algorithmMatch: false,
      expectedAlgorithm: this.correctAlgorithm,
      providedAlgorithm: algorithm,
      error: null
    };

    if (!algorithm) {
      result.error = '签名算法不能为空';
      return result;
    }

    const algoUpper = algorithm.toUpperCase();
    
    if (!this.supportedAlgorithms.includes(algoUpper)) {
      result.error = `不支持的签名算法: ${algorithm}`;
      return result;
    }

    result.algorithmMatch = (algoUpper === this.correctAlgorithm);

    if (!result.algorithmMatch) {
      result.error = `签名算法不一致: 预期${this.correctAlgorithm}, 实际${algorithm}`;
      return result;
    }

    try {
      const expectedSignature = this.generateSignature(content, algorithm);
      result.valid = (expectedSignature === signature);
      
      if (!result.valid) {
        result.error = '签名值不匹配';
      }
    } catch (e) {
      result.error = `签名验证失败: ${e.message}`;
    }

    return result;
  }

  getSignContent(item) {
    return {
      itemNo: item.itemNo,
      projectName: item.projectName,
      outsourcingVendor: item.outsourcingVendor,
      workContent: item.workContent,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal
    };
  }

  verifyTaskDetail(item) {
    const signContent = this.getSignContent(item);
    return this.verifySignature(signContent, item.signature, item.signAlgorithm);
  }
}

module.exports = new SignatureService();