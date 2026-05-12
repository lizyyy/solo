const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const { 
  ContentRecord, 
  ChannelStatus, 
  ReferencePage, 
  CacheConfig,
  AuditLog 
} = require('../models/content');

const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const DEFAULT_STORE_FILE = path.join(DEFAULT_DATA_DIR, 'store.json');

class Store {
  constructor(dataDir = DEFAULT_DATA_DIR) {
    this.dataDir = dataDir;
    this.storeFile = path.join(dataDir, 'store.json');
    this.ensureDataDir();
    this.load();
  }

  ensureDataDir() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  load() {
    if (!fs.existsSync(this.storeFile)) {
      this.data = {
        contents: [],
        auditLogs: [],
        cacheConfigs: []
      };
      this.save();
      return;
    }

    try {
      const raw = fs.readFileSync(this.storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      
      this.data = {
        contents: (parsed.contents || []).map(c => ContentRecord.fromJSON(c)),
        auditLogs: (parsed.auditLogs || []).map(l => AuditLog.fromJSON(l)),
        cacheConfigs: (parsed.cacheConfigs || []).map(c => CacheConfig.fromJSON(c))
      };
    } catch (e) {
      console.error('Failed to load store:', e.message);
      this.data = {
        contents: [],
        auditLogs: [],
        cacheConfigs: []
      };
    }
  }

  save() {
    const toSave = {
      contents: this.data.contents.map(c => c.toJSON()),
      auditLogs: this.data.auditLogs.map(l => l.toJSON()),
      cacheConfigs: this.data.cacheConfigs.map(c => c.toJSON())
    };
    fs.writeFileSync(this.storeFile, JSON.stringify(toSave, null, 2), 'utf8');
  }

  addContent(content) {
    const record = content instanceof ContentRecord ? content : new ContentRecord(content);
    this.data.contents.push(record);
    this.save();
    return record;
  }

  updateContent(id, updates, operator = 'system', reason = '') {
    const index = this.data.contents.findIndex(c => c.id === id);
    if (index === -1) return null;

    const before = _.cloneDeep(this.data.contents[index].toJSON());
    const content = this.data.contents[index];
    
    Object.keys(updates).forEach(key => {
      if (key !== 'id' && key !== 'createdAt') {
        content[key] = updates[key];
      }
    });
    
    content.updatedAt = require('moment')();
    const after = _.cloneDeep(content.toJSON());
    
    this.addAuditLog({
      contentId: id,
      action: 'update',
      operator,
      before,
      after,
      reason,
      diff: this.calculateDiff(before, after)
    });
    
    this.save();
    return content;
  }

  getContent(id) {
    return this.data.contents.find(c => c.id === id);
  }

  findContentByUrl(url) {
    return this.data.contents.find(c => c.contentUrl === url);
  }

  findContents(query = {}) {
    return this.data.contents.filter(content => {
      return Object.keys(query).every(key => {
        if (query[key] === undefined) return true;
        return content[key] === query[key];
      });
    });
  }

  getAllContents() {
    return this.data.contents;
  }

  addAuditLog(log) {
    const auditLog = log instanceof AuditLog ? log : new AuditLog(log);
    this.data.auditLogs.push(auditLog);
    this.save();
    return auditLog;
  }

  getAuditLogs(contentId) {
    return this.data.auditLogs.filter(l => l.contentId === contentId);
  }

  getAllAuditLogs() {
    return this.data.auditLogs;
  }

  addCacheConfig(config) {
    const cacheConfig = config instanceof CacheConfig ? config : new CacheConfig(config);
    this.data.cacheConfigs.push(cacheConfig);
    this.save();
    return cacheConfig;
  }

  getCacheConfigs(channelId) {
    return this.data.cacheConfigs.filter(c => c.channelId === channelId);
  }

  updateCacheConfig(id, updates) {
    const index = this.data.cacheConfigs.findIndex(c => c.id === id);
    if (index === -1) return null;
    
    const config = this.data.cacheConfigs[index];
    Object.keys(updates).forEach(key => {
      if (key !== 'id') {
        config[key] = updates[key];
      }
    });
    
    this.save();
    return config;
  }

  calculateDiff(before, after) {
    const diffs = [];
    const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
    
    allKeys.forEach(key => {
      if (['createdAt', 'updatedAt', 'id'].includes(key)) return;
      
      const beforeVal = JSON.stringify(before[key]);
      const afterVal = JSON.stringify(after[key]);
      
      if (beforeVal !== afterVal) {
        diffs.push({
          field: key,
          before: before[key],
          after: after[key]
        });
      }
    });
    
    return diffs;
  }

  manualEdit(contentId, updates, operator, reason) {
    const content = this.getContent(contentId);
    if (!content) throw new Error(`Content not found: ${contentId}`);
    
    const before = _.cloneDeep(content.toJSON());
    const result = this.updateContent(contentId, updates, operator, reason);
    const after = _.cloneDeep(result.toJSON());
    
    return {
      success: true,
      contentId,
      operator,
      reason,
      diff: this.calculateDiff(before, after)
    };
  }

  clear() {
    this.data = {
      contents: [],
      auditLogs: [],
      cacheConfigs: []
    };
    this.save();
  }
}

module.exports = Store;
