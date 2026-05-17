const crypto = require('crypto');

class SamplingEngine {
  constructor(options = {}) {
    this.sampleSize = options.sampleSize || 1000;
    this.strataFields = options.strataFields || ['status', 'region', 'resourceType'];
    this.dedupeFields = options.dedupeFields || ['url', 'status', 'ip'];
    this.strataRatios = options.strataRatios || {};
    this.minPerStratum = options.minPerStratum || 5;
    this.maxPerStratum = options.maxPerStratum || 100;
    this.weightField = options.weightField || null;
    this.seed = options.seed || Date.now().toString();
    
    this.strata = new Map();
    this.dedupeCache = new Set();
    this.reservoirPerStratum = new Map();
    this.countPerStratum = new Map();
    this.totalProcessed = 0;
    this.totalValid = 0;
  }

  getStratumKey(record) {
    const parts = this.strataFields.map(field => {
      const value = record.data[field];
      return value !== undefined && value !== null ? String(value) : 'unknown';
    });
    return parts.join('|');
  }

  getDedupeKey(record) {
    const parts = this.dedupeFields.map(field => {
      const value = record.data[field];
      return value !== undefined && value !== null ? String(value) : 'unknown';
    });
    const raw = parts.join('|');
    return crypto.createHash('md5').update(raw).digest('hex');
  }

  isDuplicate(record) {
    const key = this.getDedupeKey(record);
    return this.dedupeCache.has(key);
  }

  markAsSeen(record) {
    const key = this.getDedupeKey(record);
    this.dedupeCache.add(key);
  }

  processRecord(record) {
    this.totalProcessed++;

    if (!record.valid) {
      return { action: 'invalid', record };
    }

    this.totalValid++;
    const stratumKey = this.getStratumKey(record);

    if (this.isDuplicate(record)) {
      return { action: 'duplicate', stratum: stratumKey, record };
    }

    this.markAsSeen(record);

    if (!this.reservoirPerStratum.has(stratumKey)) {
      this.reservoirPerStratum.set(stratumKey, []);
      this.countPerStratum.set(stratumKey, 0);
    }

    const reservoir = this.reservoirPerStratum.get(stratumKey);
    const count = this.countPerStratum.get(stratumKey) + 1;
    this.countPerStratum.set(stratumKey, count);

    if (reservoir.length < this.maxPerStratum) {
      if (reservoir.length < this.minPerStratum) {
        reservoir.push({ ...record, sampleWeight: 1, selectionMethod: 'min_guarantee' });
        return { action: 'selected', stratum: stratumKey, selectionMethod: 'min_guarantee', record };
      }

      const probability = this.getSelectionProbability(stratumKey, count);
      if (this.random() < probability) {
        const index = Math.floor(this.random() * reservoir.length);
        if (reservoir.length < this.maxPerStratum) {
          reservoir.push({ ...record, sampleWeight: 1 / probability, selectionMethod: 'reservoir' });
        } else {
          reservoir[index] = { ...record, sampleWeight: 1 / probability, selectionMethod: 'reservoir' };
        }
        return { action: 'selected', stratum: stratumKey, selectionMethod: 'reservoir', record };
      }
    }

    return { action: 'skipped', stratum: stratumKey, record };
  }

  getSelectionProbability(stratumKey, count) {
    const ratio = this.strataRatios[stratumKey] || 1;
    const targetSize = Math.min(this.maxPerStratum, Math.max(this.minPerStratum, Math.floor(this.sampleSize * ratio / this.strataFields.length)));
    return targetSize / Math.max(count, targetSize);
  }

  random() {
    const hash = crypto.createHash('sha256').update(this.seed + this.totalProcessed).digest('hex');
    return parseInt(hash.substr(0, 8), 16) / 0xffffffff;
  }

  getSamples() {
    const allSamples = [];
    for (const [stratum, samples] of this.reservoirPerStratum) {
      allSamples.push(...samples.map(s => ({ ...s, stratum })));
    }
    return allSamples;
  }

  getStratumStats() {
    const stats = {};
    for (const [stratum, samples] of this.reservoirPerStratum) {
      stats[stratum] = {
        totalInStratum: this.countPerStratum.get(stratum) || 0,
        sampledCount: samples.length,
        samplingRatio: samples.length / Math.max(this.countPerStratum.get(stratum) || 1, 1)
      };
    }
    return stats;
  }

  getSummary() {
    const samples = this.getSamples();
    return {
      totalProcessed: this.totalProcessed,
      totalValid: this.totalValid,
      totalSampled: samples.length,
      totalStrata: this.reservoirPerStratum.size,
      samplingRatio: samples.length / Math.max(this.totalValid, 1),
      strataStats: this.getStratumStats()
    };
  }

  filterByStatusCodes(codes) {
    if (!codes || codes.length === 0) return;
    this.statusFilter = new Set(codes.map(c => parseInt(c, 10)));
  }

  filterByRegions(regions) {
    if (!regions || regions.length === 0) return;
    this.regionFilter = new Set(regions.map(r => r.toUpperCase()));
  }

  filterByResourceTypes(types) {
    if (!types || types.length === 0) return;
    this.resourceTypeFilter = new Set(types.map(t => t.toLowerCase()));
  }

  shouldFilter(record) {
    if (!record.valid) return false;
    
    if (this.statusFilter && !this.statusFilter.has(record.data.status)) {
      return true;
    }
    if (this.regionFilter && !this.regionFilter.has(record.data.region || 'UNKNOWN')) {
      return true;
    }
    if (this.resourceTypeFilter && !this.resourceTypeFilter.has(record.data.resourceType || 'other')) {
      return true;
    }
    return false;
  }
}

module.exports = { SamplingEngine };
