const _ = require('lodash');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');

const STATUS = {
  PENDING: 'pending',
  ACTIVE: 'active',
  UNPUBLISHED: 'unpublished',
  ARCHIVED: 'archived',
  BLOCKED: 'blocked',
  FAILED: 'failed',
  PARTIAL: 'partial'
};

const CHANNEL_TYPE = {
  OFFICIAL_WEBSITE: 'official_website',
  WECHAT: 'wechat',
  COOPERATION: 'cooperation',
  INTRANET: 'intranet',
  APP: 'app'
};

class ContentRecord {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.title = data.title || '';
    this.type = data.type || 'news';
    this.contentUrl = data.contentUrl || '';
    this.version = data.version || 1;
    this.status = data.status || STATUS.ACTIVE;
    this.author = data.author || '';
    this.owner = data.owner || '';
    this.publishedAt = data.publishedAt ? moment(data.publishedAt) : moment();
    this.unpublishedAt = data.unpublishedAt ? moment(data.unpublishedAt) : null;
    this.channels = data.channels || [];
    this.referencePages = data.referencePages || [];
    this.metadata = data.metadata || {};
    this.createdAt = data.createdAt ? moment(data.createdAt) : moment();
    this.updatedAt = data.updatedAt ? moment(data.updatedAt) : moment();
  }

  toJSON() {
    return {
      id: this.id,
      title: this.title,
      type: this.type,
      contentUrl: this.contentUrl,
      version: this.version,
      status: this.status,
      author: this.author,
      owner: this.owner,
      publishedAt: this.publishedAt ? this.publishedAt.format() : null,
      unpublishedAt: this.unpublishedAt ? this.unpublishedAt.format() : null,
      channels: this.channels.map(c => c.toJSON ? c.toJSON() : c),
      referencePages: this.referencePages,
      metadata: this.metadata,
      createdAt: this.createdAt.format(),
      updatedAt: this.updatedAt.format()
    };
  }

  static fromJSON(json) {
    const content = new ContentRecord(json);
    content.channels = (json.channels || []).map(c => ChannelStatus.fromJSON(c));
    return content;
  }
}

class ChannelStatus {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.channelName = data.channelName || '';
    this.channelType = data.channelType || CHANNEL_TYPE.OFFICIAL_WEBSITE;
    this.url = data.url || '';
    this.status = data.status || STATUS.ACTIVE;
    this.cacheStatus = data.cacheStatus || 'unknown';
    this.unpublishAttempts = data.unpublishAttempts || 0;
    this.lastAttemptAt = data.lastAttemptAt ? moment(data.lastAttemptAt) : null;
    this.verifiedAt = data.verifiedAt ? moment(data.verifiedAt) : null;
    this.owner = data.owner || '';
    this.errors = data.errors || [];
    this.notes = data.notes || '';
  }

  toJSON() {
    return {
      id: this.id,
      channelName: this.channelName,
      channelType: this.channelType,
      url: this.url,
      status: this.status,
      cacheStatus: this.cacheStatus,
      unpublishAttempts: this.unpublishAttempts,
      lastAttemptAt: this.lastAttemptAt ? this.lastAttemptAt.format() : null,
      verifiedAt: this.verifiedAt ? this.verifiedAt.format() : null,
      owner: this.owner,
      errors: this.errors,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new ChannelStatus(json);
  }
}

class ReferencePage {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.url = data.url || '';
    this.title = data.title || '';
    this.status = data.status || STATUS.PENDING;
    this.hasLink = data.hasLink !== undefined ? data.hasLink : null;
    this.verifiedAt = data.verifiedAt ? moment(data.verifiedAt) : null;
    this.owner = data.owner || '';
    this.notes = data.notes || '';
  }

  toJSON() {
    return {
      id: this.id,
      url: this.url,
      title: this.title,
      status: this.status,
      hasLink: this.hasLink,
      verifiedAt: this.verifiedAt ? this.verifiedAt.format() : null,
      owner: this.owner,
      notes: this.notes
    };
  }

  static fromJSON(json) {
    return new ReferencePage(json);
  }
}

class CacheConfig {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.channelId = data.channelId || '';
    this.cacheType = data.cacheType || 'cdn';
    this.ttlSeconds = data.ttlSeconds || 3600;
    this.purgeUrl = data.purgeUrl || '';
    this.purgeStatus = data.purgeStatus || 'pending';
    this.purgedAt = data.purgedAt ? moment(data.purgedAt) : null;
    this.purgeAttempts = data.purgeAttempts || 0;
  }

  toJSON() {
    return {
      id: this.id,
      channelId: this.channelId,
      cacheType: this.cacheType,
      ttlSeconds: this.ttlSeconds,
      purgeUrl: this.purgeUrl,
      purgeStatus: this.purgeStatus,
      purgedAt: this.purgedAt ? this.purgedAt.format() : null,
      purgeAttempts: this.purgeAttempts
    };
  }

  static fromJSON(json) {
    return new CacheConfig(json);
  }
}

class AuditLog {
  constructor(data = {}) {
    this.id = data.id || uuidv4();
    this.contentId = data.contentId || '';
    this.action = data.action || '';
    this.operator = data.operator || 'system';
    this.timestamp = data.timestamp ? moment(data.timestamp) : moment();
    this.before = data.before || null;
    this.after = data.after || null;
    this.reason = data.reason || '';
    this.diff = data.diff || [];
  }

  toJSON() {
    return {
      id: this.id,
      contentId: this.contentId,
      action: this.action,
      operator: this.operator,
      timestamp: this.timestamp.format(),
      before: this.before,
      after: this.after,
      reason: this.reason,
      diff: this.diff
    };
  }

  static fromJSON(json) {
    return new AuditLog(json);
  }
}

module.exports = {
  STATUS,
  CHANNEL_TYPE,
  ContentRecord,
  ChannelStatus,
  ReferencePage,
  CacheConfig,
  AuditLog
};
