const { v4: uuidv4 } = require('uuid');

const VERIFICATION_RESULTS = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
  PENDING: 'PENDING',
  MANUALLY_FIXED: 'MANUALLY_FIXED'
};

class CallbackSample {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.vendorId = data.vendorId;
    this.rotationId = data.rotationId;
    this.callbackIdempotencyKey = data.callbackIdempotencyKey;
    this.rawInput = data.rawInput;
    this.signature = data.signature;
    this.signatureVersion = data.signatureVersion || 'v1';
    this.receivedAt = data.receivedAt || new Date().toISOString();
    this.verificationResult = data.verificationResult || VERIFICATION_RESULTS.PENDING;
    this.verifiedWithKey = data.verifiedWithKey;
    this.processingBasis = data.processingBasis || [];
    this.finalConclusion = data.finalConclusion;
    this.errorDetails = data.errorDetails;
    this.isDuplicate = data.isDuplicate || false;
    this.originalSampleId = data.originalSampleId;
    this.manuallyFixedBy = data.manuallyFixedBy;
    this.manuallyFixedAt = data.manuallyFixedAt;
    this.manualFixNote = data.manualFixNote;
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
  }

  static get RESULTS() {
    return VERIFICATION_RESULTS;
  }

  addProcessingBasis(basis) {
    this.processingBasis.push({
      timestamp: new Date().toISOString(),
      ...basis
    });
    this.updatedAt = new Date().toISOString();
  }

  setSuccess(keyType) {
    this.verificationResult = VERIFICATION_RESULTS.SUCCESS;
    this.verifiedWithKey = keyType;
    this.finalConclusion = `验签成功，使用${keyType === 'OLD' ? '旧密钥' : '新密钥'}`;
    this.updatedAt = new Date().toISOString();
  }

  setFailed(errorDetails) {
    this.verificationResult = VERIFICATION_RESULTS.FAILED;
    this.errorDetails = errorDetails;
    this.finalConclusion = '验签失败，双密钥均无法验证签名';
    this.updatedAt = new Date().toISOString();
  }

  setDuplicate(originalSampleId) {
    this.isDuplicate = true;
    this.originalSampleId = originalSampleId;
    this.verificationResult = VERIFICATION_RESULTS.SUCCESS;
    this.finalConclusion = '重复回调，已去重';
    this.updatedAt = new Date().toISOString();
  }

  setManuallyFixed(operator, note) {
    this.verificationResult = VERIFICATION_RESULTS.MANUALLY_FIXED;
    this.manuallyFixedBy = operator;
    this.manuallyFixedAt = new Date().toISOString();
    this.manualFixNote = note;
    this.finalConclusion = `人工修正: ${note}`;
    this.updatedAt = new Date().toISOString();
  }

  toJSON() {
    return {
      id: this.id,
      vendorId: this.vendorId,
      rotationId: this.rotationId,
      callbackIdempotencyKey: this.callbackIdempotencyKey,
      signature: this.signature.substring(0, 20) + '...',
      signatureVersion: this.signatureVersion,
      receivedAt: this.receivedAt,
      verificationResult: this.verificationResult,
      verifiedWithKey: this.verifiedWithKey,
      processingBasis: this.processingBasis,
      finalConclusion: this.finalConclusion,
      errorDetails: this.errorDetails,
      isDuplicate: this.isDuplicate,
      originalSampleId: this.originalSampleId,
      manuallyFixedBy: this.manuallyFixedBy,
      manuallyFixedAt: this.manuallyFixedAt,
      manualFixNote: this.manualFixNote,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  toFullJSON() {
    return {
      ...this.toJSON(),
      rawInput: this.rawInput
    };
  }
}

module.exports = CallbackSample;