const store = require('../store/MemoryStore');
const VendorConfig = require('../models/VendorConfig');
const VerificationReport = require('../models/VerificationReport');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const fs = require('fs');
const path = require('path');

class RotationService {
  createRotation(vendorId, oldSecret, newSecret, options = {}) {
    const existingConfig = store.getVendorConfigByVendorId(vendorId);
    if (existingConfig) {
      if (existingConfig.rotationState !== VendorConfig.STATES.COMPLETED && 
          existingConfig.rotationState !== VendorConfig.STATES.FAILED) {
        throw new Error(`供应商 ${vendorId} 已有进行中的轮换任务`);
      }
    }

    const config = new VendorConfig({
      vendorId,
      oldSecret,
      newSecret,
      dualKeyStartTime: options.dualKeyStartTime,
      dualKeyEndTime: options.dualKeyEndTime,
      metadata: options.metadata
    });

    config.rotationState = VendorConfig.STATES.DUAL_KEY_ACTIVE;
    store.saveVendorConfig(config);

    return config.toJSON();
  }

  getRotation(id) {
    const config = store.getVendorConfig(id);
    if (!config) {
      throw new Error(`轮换任务 ${id} 不存在`);
    }
    return config.toJSON();
  }

  getRotationByVendorId(vendorId) {
    const config = store.getVendorConfigByVendorId(vendorId);
    if (!config) {
      return null;
    }
    return config.toJSON();
  }

  getAllRotations() {
    return store.getAllVendorConfigs().map(c => c.toJSON());
  }

  advanceRotationState(id, targetState) {
    const config = store.getVendorConfig(id);
    if (!config) {
      throw new Error(`轮换任务 ${id} 不存在`);
    }

    const validTransitions = {
      [VendorConfig.STATES.PENDING]: [VendorConfig.STATES.DUAL_KEY_ACTIVE],
      [VendorConfig.STATES.DUAL_KEY_ACTIVE]: [VendorConfig.STATES.OLD_KEY_DEPRECATED],
      [VendorConfig.STATES.OLD_KEY_DEPRECATED]: [VendorConfig.STATES.COMPLETED],
      [VendorConfig.STATES.COMPLETED]: [],
      [VendorConfig.STATES.FAILED]: [VendorConfig.STATES.DUAL_KEY_ACTIVE]
    };

    const currentState = config.rotationState;
    if (!validTransitions[currentState].includes(targetState)) {
      throw new Error(`无效的状态迁移: ${currentState} -> ${targetState}`);
    }

    config.rotationState = targetState;
    config.updatedAt = new Date().toISOString();

    if (targetState === VendorConfig.STATES.OLD_KEY_DEPRECATED) {
      config.oldKeyDeprecateTime = new Date().toISOString();
    }

    store.saveVendorConfig(config);
    return config.toJSON();
  }

  deprecateOldKey(id) {
    return this.advanceRotationState(id, VendorConfig.STATES.OLD_KEY_DEPRECATED);
  }

  completeRotation(id) {
    return this.advanceRotationState(id, VendorConfig.STATES.COMPLETED);
  }

  markAsFailed(id, reason) {
    const config = store.getVendorConfig(id);
    if (!config) {
      throw new Error(`轮换任务 ${id} 不存在`);
    }

    config.rotationState = VendorConfig.STATES.FAILED;
    config.metadata = {
      ...config.metadata,
      failureReason: reason,
      failedAt: new Date().toISOString()
    };
    config.updatedAt = new Date().toISOString();

    store.saveVendorConfig(config);
    return config.toJSON();
  }

  retryRotation(id) {
    return this.advanceRotationState(id, VendorConfig.STATES.DUAL_KEY_ACTIVE);
  }

  generateReport(rotationId) {
    const config = store.getVendorConfig(rotationId);
    if (!config) {
      throw new Error(`轮换任务 ${rotationId} 不存在`);
    }

    const samples = store.getCallbackSamplesByRotationId(rotationId);
    const report = new VerificationReport({
      rotationId,
      vendorId: config.vendorId
    });

    const isInDualWindow = config.isInDualKeyWindow();
    samples.forEach(sample => {
      report.addSample(sample, isInDualWindow);
    });

    return report.toJSON();
  }

  async exportReport(rotationId, format = 'json', outputPath) {
    const report = this.generateReport(rotationId);

    if (format === 'json') {
      const jsonOutput = JSON.stringify(report, null, 2);
      if (outputPath) {
        fs.writeFileSync(outputPath, jsonOutput, 'utf8');
      }
      return { format, content: report };
    }

    if (format === 'csv') {
      const csvData = this.convertReportToCSV(report);
      if (outputPath) {
        const csvWriter = createCsvWriter({
          path: outputPath,
          header: csvData.headers.map(h => ({ id: h.id, title: h.title }))
        });
        await csvWriter.writeRecords(csvData.rows);
      }
      return { format, content: csvData };
    }

    throw new Error(`不支持的导出格式: ${format}`);
  }

  convertReportToCSV(report) {
    const headers = [
      { id: 'sampleId', title: '样本ID' },
      { id: 'idempotencyKey', title: '幂等键' },
      { id: 'result', title: '验签结果' },
      { id: 'keyType', title: '使用密钥' },
      { id: 'isDuplicate', title: '是否重复' },
      { id: 'receivedAt', title: '接收时间' },
      { id: 'conclusion', title: '最终结论' },
      { id: 'anomaly', title: '异常详情' }
    ];

    const rows = report.details.map(d => ({
      sampleId: d.sampleId,
      idempotencyKey: d.callbackIdempotencyKey,
      result: d.verificationResult,
      keyType: d.verifiedWithKey || '',
      isDuplicate: d.isDuplicate ? '是' : '否',
      receivedAt: d.receivedAt,
      conclusion: d.finalConclusion || '',
      anomaly: report.anomalies.find(a => a.sampleId === d.sampleId)?.message || ''
    }));

    return { headers, rows };
  }

  getFailedSamples(rotationId) {
    return store.getFailedSamples(rotationId).map(s => s.toFullJSON());
  }

  manuallyFixSample(sampleId, operator, note) {
    const sample = store.getCallbackSample(sampleId);
    if (!sample) {
      throw new Error(`样本 ${sampleId} 不存在`);
    }

    sample.setManuallyFixed(operator, note);
    store.saveCallbackSample(sample);

    return sample.toFullJSON();
  }

  getSampleDetails(sampleId) {
    const sample = store.getCallbackSample(sampleId);
    if (!sample) {
      throw new Error(`样本 ${sampleId} 不存在`);
    }
    return sample.toFullJSON();
  }
}

module.exports = new RotationService();