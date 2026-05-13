const crypto = require('crypto');

const EXPIRY_DAYS = 90;

class ErrorFingerprint {
  constructor(data) {
    this.taskName = data.taskName || '';
    this.errorCode = this.extractErrorCode(data.errorMessage || '', data.stackTrace || '');
    this.stackSignature = this.extractStackSignature(data.stackTrace || '');
    this.contextHash = this.hashContext(data.context || {});
  }

  extractErrorCode(message, stack) {
    const combined = `${message}\n${stack}`;
    const patterns = [
      /Error:\s*(\w+)/i,
      /Exception:\s*(\w+)/i,
      /\[(\w+Error)\]/i,
      /code[:\s]+["']?(\w+[-_]?\w*)["']?/i,
      /status[:\s]+(\d+)/i,
      /(\d{3})\s+\w+/
    ];
    
    for (const pattern of patterns) {
      const match = combined.match(pattern);
      if (match) return match[1].toUpperCase();
    }
    return 'UNKNOWN';
  }

  extractStackSignature(stack) {
    if (!stack) return 'NO_STACK';
    
    const lines = stack.split('\n')
      .filter(line => line.includes('at ') || line.includes('->'))
      .slice(0, 5)
      .map(line => {
        return line
          .replace(/at\s+/, '')
          .replace(/\([^)]+\)/g, '')
          .replace(/:\d+:\d+/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      })
      .filter(line => line.length > 0);
    
    return lines.length > 0 ? lines.join('|') : 'NO_STACK';
  }

  hashContext(context) {
    if (!context || Object.keys(context).length === 0) return 'NO_CONTEXT';
    const keys = Object.keys(context).sort();
    const str = keys.map(k => `${k}:${context[k]}`).join('|');
    return crypto.createHash('md5').update(str).digest('hex').substring(0, 8);
  }

  toHash() {
    return crypto.createHash('sha256')
      .update(`${this.taskName}|${this.errorCode}|${this.stackSignature}|${this.contextHash}`)
      .digest('hex');
  }

  toObject() {
    return {
      taskName: this.taskName,
      errorCode: this.errorCode,
      stackSignature: this.stackSignature,
      contextHash: this.contextHash
    };
  }
}

class KnowledgeEntry {
  constructor(data) {
    this.id = data.id || crypto.randomUUID();
    this.fingerprint = data.fingerprint;
    this.fingerprintHash = data.fingerprintHash;
    this.taskName = data.taskName || '';
    this.errorMessage = data.errorMessage || '';
    this.stackTrace = data.stackTrace || '';
    this.context = data.context || {};
    this.resolution = data.resolution || '';
    this.notes = data.notes || '';
    this.createdAt = data.createdAt || new Date().toISOString();
    this.updatedAt = data.updatedAt || new Date().toISOString();
    this.resolvedAt = data.resolvedAt || null;
    this.usefulCount = data.usefulCount || 0;
    this.notUsefulCount = data.notUsefulCount || 0;
    this.feedbackScore = data.feedbackScore || 0;
    this.status = data.status || 'pending';
    this.expiryDate = data.expiryDate || this.calculateExpiry();
    this.resolvedBy = data.resolvedBy || null;
    this.tags = data.tags || [];
  }

  calculateExpiry() {
    const date = new Date();
    date.setDate(date.getDate() + EXPIRY_DAYS);
    return date.toISOString();
  }

  isExpired() {
    return new Date() > new Date(this.expiryDate);
  }

  needsReview() {
    return this.isExpired() && this.status === 'resolved';
  }

  updateFeedback(useful) {
    if (useful) {
      this.usefulCount++;
      this.feedbackScore += 1;
    } else {
      this.notUsefulCount++;
      this.feedbackScore -= 1;
    }
    this.updatedAt = new Date().toISOString();
  }

  resolve(resolution, notes, resolvedBy) {
    this.resolution = resolution;
    this.notes = notes || this.notes;
    this.resolvedBy = resolvedBy || null;
    this.resolvedAt = new Date().toISOString();
    this.updatedAt = this.resolvedAt;
    this.status = 'resolved';
    this.expiryDate = this.calculateExpiry();
  }

  extendExpiry() {
    this.expiryDate = this.calculateExpiry();
    this.updatedAt = new Date().toISOString();
  }

  toObject() {
    return {
      id: this.id,
      fingerprint: this.fingerprint,
      fingerprintHash: this.fingerprintHash,
      taskName: this.taskName,
      errorMessage: this.errorMessage,
      stackTrace: this.stackTrace,
      context: this.context,
      resolution: this.resolution,
      notes: this.notes,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt,
      resolvedAt: this.resolvedAt,
      usefulCount: this.usefulCount,
      notUsefulCount: this.notUsefulCount,
      feedbackScore: this.feedbackScore,
      status: this.status,
      expiryDate: this.expiryDate,
      resolvedBy: this.resolvedBy,
      tags: this.tags
    };
  }
}

class SimilarityResult {
  constructor(entry, similarity, reasons) {
    this.entry = entry;
    this.similarity = similarity;
    this.reasons = reasons;
    this.score = this.calculateScore();
  }

  calculateScore() {
    let score = this.similarity * 100;
    score += this.entry.feedbackScore * 5;
    score += this.entry.usefulCount * 2;
    score -= this.entry.notUsefulCount * 3;
    
    if (this.entry.isExpired()) {
      score *= 0.5;
    }
    
    return Math.max(0, score);
  }

  toObject() {
    return {
      entry: this.entry.toObject(),
      similarity: this.similarity,
      reasons: this.reasons,
      score: this.score,
      isExpired: this.entry.isExpired(),
      needsReview: this.entry.needsReview()
    };
  }
}

module.exports = {
  ErrorFingerprint,
  KnowledgeEntry,
  SimilarityResult,
  EXPIRY_DAYS
};
