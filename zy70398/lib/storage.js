const fs = require('fs');
const path = require('path');
const { KnowledgeEntry, ErrorFingerprint } = require('./models');

class KnowledgeStore {
  constructor(dataPath = null) {
    this.dataPath = dataPath || path.join(process.cwd(), '.failure-kb', 'knowledge.json');
    this.entries = [];
    this._loaded = false;
  }

  _ensureDirectory() {
    const dir = path.dirname(this.dataPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  load() {
    if (this._loaded) return;

    this._ensureDirectory();

    if (fs.existsSync(this.dataPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.dataPath, 'utf8'));
        this.entries = data.map(e => new KnowledgeEntry(e));
      } catch (err) {
        console.warn('警告：知识库文件损坏，使用空数据库');
        this.entries = [];
      }
    }

    this._loaded = true;
  }

  save() {
    this._ensureDirectory();
    const data = this.entries.map(e => e.toObject());
    fs.writeFileSync(this.dataPath, JSON.stringify(data, null, 2), 'utf8');
  }

  addOrUpdate(entryData) {
    this.load();

    const fingerprint = new ErrorFingerprint(entryData);
    const fingerprintHash = fingerprint.toHash();

    const existing = this.entries.find(e => e.fingerprintHash === fingerprintHash);

    if (existing) {
      existing.updatedAt = new Date().toISOString();
      if (entryData.notes && !existing.notes.includes(entryData.notes)) {
        existing.notes = existing.notes 
          ? `${existing.notes}\n\n[补充 ${new Date().toISOString()}]\n${entryData.notes}`
          : entryData.notes;
      }
      if (entryData.resolution) {
        existing.resolution = entryData.resolution;
        existing.status = 'resolved';
        existing.resolvedAt = new Date().toISOString();
      }
      this.save();
      return { entry: existing, isNew: false };
    }

    const entry = new KnowledgeEntry({
      ...entryData,
      fingerprint: fingerprint.toObject(),
      fingerprintHash
    });

    this.entries.push(entry);
    this.save();

    return { entry, isNew: true };
  }

  findById(id) {
    this.load();
    return this.entries.find(e => e.id === id);
  }

  findByFingerprintHash(hash) {
    this.load();
    return this.entries.find(e => e.fingerprintHash === hash);
  }

  getAll(filter = {}) {
    this.load();
    let results = [...this.entries];

    if (filter.status) {
      results = results.filter(e => e.status === filter.status);
    }

    if (filter.taskName) {
      results = results.filter(e => 
        e.taskName.toLowerCase().includes(filter.taskName.toLowerCase())
      );
    }

    if (filter.expired === true) {
      results = results.filter(e => e.isExpired());
    }

    if (filter.expired === false) {
      results = results.filter(e => !e.isExpired());
    }

    if (filter.needsReview) {
      results = results.filter(e => e.needsReview());
    }

    return results;
  }

  updateFeedback(entryId, useful) {
    const entry = this.findById(entryId);
    if (!entry) return null;

    entry.updateFeedback(useful);
    this.save();
    return entry;
  }

  resolve(entryId, resolution, notes, resolvedBy) {
    const entry = this.findById(entryId);
    if (!entry) return null;

    entry.resolve(resolution, notes, resolvedBy);
    this.save();
    return entry;
  }

  extendExpiry(entryId) {
    const entry = this.findById(entryId);
    if (!entry) return null;

    entry.extendExpiry();
    this.save();
    return entry;
  }

  getStats() {
    this.load();
    const total = this.entries.length;
    const resolved = this.entries.filter(e => e.status === 'resolved').length;
    const pending = total - resolved;
    const expired = this.entries.filter(e => e.isExpired()).length;
    const needsReview = this.entries.filter(e => e.needsReview()).length;

    const taskNames = [...new Set(this.entries.map(e => e.taskName).filter(Boolean))];
    const errorCodes = [...new Set(this.entries.map(e => e.fingerprint?.errorCode).filter(Boolean))];

    let totalUseful = 0;
    let totalNotUseful = 0;
    this.entries.forEach(e => {
      totalUseful += e.usefulCount;
      totalNotUseful += e.notUsefulCount;
    });

    return {
      total,
      resolved,
      pending,
      expired,
      needsReview,
      taskNames,
      errorCodes,
      feedback: {
        useful: totalUseful,
        notUseful: totalNotUseful
      }
    };
  }
}

module.exports = { KnowledgeStore };
