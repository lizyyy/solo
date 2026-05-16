class MemoryStore {
  constructor() {
    this.vendorConfigs = new Map();
    this.callbackSamples = new Map();
    this.idempotencyMap = new Map();
  }

  saveVendorConfig(config) {
    config.updatedAt = new Date().toISOString();
    this.vendorConfigs.set(config.id, config);
    return config;
  }

  getVendorConfig(id) {
    return this.vendorConfigs.get(id);
  }

  getVendorConfigByVendorId(vendorId) {
    for (const config of this.vendorConfigs.values()) {
      if (config.vendorId === vendorId) {
        return config;
      }
    }
    return null;
  }

  getAllVendorConfigs() {
    return Array.from(this.vendorConfigs.values());
  }

  deleteVendorConfig(id) {
    return this.vendorConfigs.delete(id);
  }

  saveCallbackSample(sample) {
    sample.updatedAt = new Date().toISOString();
    this.callbackSamples.set(sample.id, sample);
    
    if (sample.callbackIdempotencyKey) {
      const key = `${sample.vendorId}:${sample.callbackIdempotencyKey}`;
      if (!this.idempotencyMap.has(key)) {
        this.idempotencyMap.set(key, sample.id);
      }
    }
    
    return sample;
  }

  getCallbackSample(id) {
    return this.callbackSamples.get(id);
  }

  getCallbackSamplesByRotationId(rotationId) {
    const samples = [];
    for (const sample of this.callbackSamples.values()) {
      if (sample.rotationId === rotationId) {
        samples.push(sample);
      }
    }
    return samples;
  }

  getCallbackSamplesByVendorId(vendorId) {
    const samples = [];
    for (const sample of this.callbackSamples.values()) {
      if (sample.vendorId === vendorId) {
        samples.push(sample);
      }
    }
    return samples;
  }

  findDuplicateSample(vendorId, idempotencyKey) {
    const key = `${vendorId}:${idempotencyKey}`;
    const sampleId = this.idempotencyMap.get(key);
    if (sampleId) {
      return this.getCallbackSample(sampleId);
    }
    return null;
  }

  getFailedSamples(rotationId) {
    const samples = this.getCallbackSamplesByRotationId(rotationId);
    return samples.filter(s => s.verificationResult === 'FAILED');
  }

  getAllCallbackSamples() {
    return Array.from(this.callbackSamples.values());
  }
}

const store = new MemoryStore();

module.exports = store;