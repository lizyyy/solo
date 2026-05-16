const crypto = require('crypto');
const store = require('../store/MemoryStore');
const CallbackSample = require('../models/CallbackSample');

class SignatureService {
  generateSignature(payload, secret, algorithm = 'sha256') {
    const hmac = crypto.createHmac(algorithm, secret);
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex');
  }

  verifySignature(payload, signature, secret, algorithm = 'sha256') {
    try {
      const expectedSignature = this.generateSignature(payload, secret, algorithm);
      return crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      );
    } catch (error) {
      return false;
    }
  }

  async verifyWebhook(vendorId, payload, signature, idempotencyKey, signatureVersion = 'v1') {
    const vendorConfig = store.getVendorConfigByVendorId(vendorId);
    if (!vendorConfig) {
      throw new Error(`供应商 ${vendorId} 未配置`);
    }

    const sample = new CallbackSample({
      vendorId,
      rotationId: vendorConfig.id,
      callbackIdempotencyKey: idempotencyKey,
      rawInput: JSON.stringify(payload),
      signature,
      signatureVersion
    });

    const existingSample = store.findDuplicateSample(vendorId, idempotencyKey);
    if (existingSample) {
      sample.setDuplicate(existingSample.id);
      sample.addProcessingBasis({
        step: 'DUPLICATE_CHECK',
        action: 'DETECTED',
        detail: `发现重复回调，原始样本ID: ${existingSample.id}`
      });
      store.saveCallbackSample(sample);
      return {
        success: true,
        isDuplicate: true,
        sample: sample.toJSON(),
        originalSampleId: existingSample.id
      };
    }

    sample.addProcessingBasis({
      step: 'DUPLICATE_CHECK',
      action: 'PASSED',
      detail: '未发现重复回调'
    });

    const isInDualWindow = vendorConfig.isInDualKeyWindow();
    sample.addProcessingBasis({
      step: 'WINDOW_CHECK',
      action: 'EVALUATED',
      detail: `双钥匙窗口: ${isInDualWindow ? '是' : '否'}`,
      windowStart: vendorConfig.dualKeyStartTime,
      windowEnd: vendorConfig.dualKeyEndTime
    });

    let verified = false;
    let keyType = null;

    if (vendorConfig.canUseNewKey()) {
      const newKeyValid = this.verifySignature(payload, signature, vendorConfig.newSecret);
      sample.addProcessingBasis({
        step: 'NEW_KEY_VERIFICATION',
        action: newKeyValid ? 'PASSED' : 'FAILED',
        detail: newKeyValid ? '新密钥验签通过' : '新密钥验签失败'
      });

      if (newKeyValid) {
        verified = true;
        keyType = 'NEW';
      }
    } else {
      sample.addProcessingBasis({
        step: 'NEW_KEY_VERIFICATION',
        action: 'SKIPPED',
        detail: '新密钥尚未生效'
      });
    }

    if (!verified && vendorConfig.canUseOldKey()) {
      const oldKeyValid = this.verifySignature(payload, signature, vendorConfig.oldSecret);
      sample.addProcessingBasis({
        step: 'OLD_KEY_VERIFICATION',
        action: oldKeyValid ? 'PASSED' : 'FAILED',
        detail: oldKeyValid ? '旧密钥验签通过' : '旧密钥验签失败'
      });

      if (oldKeyValid) {
        verified = true;
        keyType = 'OLD';
      }
    } else if (!verified) {
      sample.addProcessingBasis({
        step: 'OLD_KEY_VERIFICATION',
        action: 'SKIPPED',
        detail: '旧密钥已禁用或不在有效期'
      });
    }

    if (verified) {
      sample.setSuccess(keyType);
    } else {
      sample.setFailed('双密钥验签均失败，请检查签名或密钥配置');
    }

    store.saveCallbackSample(sample);

    return {
      success: verified,
      isDuplicate: false,
      sample: sample.toJSON(),
      keyType,
      isInDualWindow
    };
  }
}

module.exports = new SignatureService();