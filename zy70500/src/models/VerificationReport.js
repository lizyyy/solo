const { v4: uuidv4 } = require('uuid');

class VerificationReport {
  constructor(data) {
    this.id = data.id || uuidv4();
    this.rotationId = data.rotationId;
    this.vendorId = data.vendorId;
    this.generatedAt = data.generatedAt || new Date().toISOString();
    this.summary = {
      totalCallbacks: 0,
      successCount: 0,
      failedCount: 0,
      duplicateCount: 0,
      manuallyFixedCount: 0,
      oldKeySuccessCount: 0,
      newKeySuccessCount: 0,
      inDualWindowCount: 0
    };
    this.details = data.details || [];
    this.anomalies = data.anomalies || [];
  }

  addSample(sample, isInDualWindow) {
    this.summary.totalCallbacks++;

    if (sample.isDuplicate) {
      this.summary.duplicateCount++;
    } else if (sample.verificationResult === 'SUCCESS') {
      this.summary.successCount++;
      if (sample.verifiedWithKey === 'OLD') {
        this.summary.oldKeySuccessCount++;
      } else if (sample.verifiedWithKey === 'NEW') {
        this.summary.newKeySuccessCount++;
      }
    } else if (sample.verificationResult === 'FAILED') {
      this.summary.failedCount++;
      this.anomalies.push({
        sampleId: sample.id,
        type: 'VERIFICATION_FAILED',
        message: sample.errorDetails,
        timestamp: sample.receivedAt
      });
    } else if (sample.verificationResult === 'MANUALLY_FIXED') {
      this.summary.manuallyFixedCount++;
      this.anomalies.push({
        sampleId: sample.id,
        type: 'MANUALLY_FIXED',
        message: sample.manualFixNote,
        operator: sample.manuallyFixedBy,
        timestamp: sample.manuallyFixedAt
      });
    }

    if (isInDualWindow) {
      this.summary.inDualWindowCount++;
    }

    this.details.push({
      sampleId: sample.id,
      callbackIdempotencyKey: sample.callbackIdempotencyKey,
      verificationResult: sample.verificationResult,
      verifiedWithKey: sample.verifiedWithKey,
      isDuplicate: sample.isDuplicate,
      receivedAt: sample.receivedAt,
      finalConclusion: sample.finalConclusion
    });
  }

  toJSON() {
    return {
      id: this.id,
      rotationId: this.rotationId,
      vendorId: this.vendorId,
      generatedAt: this.generatedAt,
      summary: this.summary,
      anomalies: this.anomalies,
      details: this.details
    };
  }

  toCSV() {
    const headers = [
      '样本ID',
      '幂等键',
      '验签结果',
      '使用密钥',
      '是否重复',
      '接收时间',
      '最终结论',
      '异常详情'
    ];
    
    const rows = this.details.map(d => [
      d.sampleId,
      d.callbackIdempotencyKey,
      d.verificationResult,
      d.verifiedWithKey || '',
      d.isDuplicate ? '是' : '否',
      d.receivedAt,
      d.finalConclusion || '',
      this.anomalies.find(a => a.sampleId === d.sampleId)?.message || ''
    ]);

    return { headers, rows };
  }
}

module.exports = VerificationReport;