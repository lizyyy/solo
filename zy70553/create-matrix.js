const fs = require('fs');

const code = `class MatrixBuilder {
  constructor() {
    this.retryCategories = {
      TRANSIENT: { name: 'Transient Errors', description: 'Retryable errors', retryable: true },
      PERMANENT: { name: 'Permanent Errors', description: 'Non-retryable errors', retryable: false },
      CLIENT_ERROR: { name: 'Client Errors', description: 'Client errors', retryable: false },
      SERVER_ERROR: { name: 'Server Errors', description: 'Server errors', retryable: true }
    };
  }

  buildMatrix(p, s) {
    const m = {
      timestamp: new Date().toISOString(),
      summary: { totalCodes: 0, withRetryStrategy: 0, withoutRetryStrategy: 0, categories: {} },
      errorCodes: [],
      categories: this.initializeCategories(),
      conflicts: []
    };
    const a = this.mergeCodes(p, s || {});
    for (let i = 0; i < a.length; i++) {
      const c = a[i];
      const t = this.categorizeError(c);
      m.errorCodes.push(this.createMatrixEntry(c, t));
      m.categories[t.key].codes.push(m.errorCodes[m.errorCodes.length - 1]);
    }
    this.calculateSummary(m);
    return m;
  }

  initializeCategories() {
    const c = {};
    c.TRANSIENT = { name: 'Transient Errors', description: 'Retryable errors', retryable: true, key: 'TRANSIENT', codes: [], count: 0 };
    c.PERMANENT = { name: 'Permanent Errors', description: 'Non-retryable errors', retryable: false, key: 'PERMANENT', codes: [], count: 0 };
    c.CLIENT_ERROR = { name: 'Client Errors', description: 'Client errors', retryable: false, key: 'CLIENT_ERROR', codes: [], count: 0 };
    c.SERVER_ERROR = { name: 'Server Errors', description: 'Server errors', retryable: true, key: 'SERVER_ERROR', codes: [], count: 0 };
    return c;
  }

  mergeCodes(p, s) {
    const m = new Map();
    for (let i = 0; i < p.length; i++) {
      const x = p[i];
      const k = x.code.toString();
      if (!m.has(k)) {
        m.set(k, {
          code: x.code,
          name: x.name,
          proto: { enumName: x.enumName, fullName: x.fullName, package: x.package },
          sdks: {}
        });
      }
    }
    return Array.from(m.values());
  }

  categorizeError(c) {
    const n = c.name.toLowerCase();
    if (n.indexOf('not_found') >= 0) {
      return { key: 'PERMANENT', name: 'Permanent Errors', retryable: false };
    }
    if (n.indexOf('invalid') >= 0) {
      return { key: 'CLIENT_ERROR', name: 'Client Errors', retryable: false };
    }
    if (n.indexOf('unavailable') >= 0 || n.indexOf('timeout') >= 0) {
      return { key: 'TRANSIENT', name: 'Transient Errors', retryable: true };
    }
    return { key: 'PERMANENT', name: 'Permanent Errors', retryable: false };
  }

  createMatrixEntry(c, t) {
    return {
      code: c.code,
      name: c.name,
      category: t.key,
      retryable: t.retryable,
      retryStrategy: this.getRetryStrategy(t.key),
      proto: c.proto,
      sdks: c.sdks,
      sdkConsistency: this.checkSdkConsistency(c)
    };
  }

  getRetryStrategy(k) {
    const s = {
      TRANSIENT: { maxRetries: 3, backoff: 'exponential' },
      SERVER_ERROR: { maxRetries: 2, backoff: 'linear' },
      CLIENT_ERROR: { maxRetries: 0 },
      PERMANENT: { maxRetries: 0 }
    };
    return s[k] || s.PERMANENT;
  }

  checkSdkConsistency(c) {
    return { consistent: true, issues: [] };
  }

  calculateSummary(m) {
    m.summary.totalCodes = m.errorCodes.length;
    let wr = 0, wor = 0;
    for (let i = 0; i < m.errorCodes.length; i++) {
      if (m.errorCodes[i].retryStrategy.maxRetries > 0) {
        wr++;
      } else {
        wor++;
      }
    }
    m.summary.withRetryStrategy = wr;
    m.summary.withoutRetryStrategy = wor;
    for (const k in m.categories) {
      m.summary.categories[k] = m.categories[k].codes.length;
    }
  }
}

module.exports = MatrixBuilder;
`;

fs.writeFileSync('src/matrix-builder.js', code, 'utf8');
console.log('matrix-builder.js created');
