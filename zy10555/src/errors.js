class BadRowCollector {
  constructor() {
    this.badRows = [];
  }

  add(row, reason, source = null, lineNumber = null) {
    this.badRows.push({
      row: this.sanitizeRow(row),
      reason,
      source,
      lineNumber,
      timestamp: new Date().toISOString()
    });
  }

  sanitizeRow(row) {
    if (typeof row === 'string') {
      return row.substring(0, 2000);
    }
    if (row && typeof row === 'object') {
      const sanitized = {};
      for (const key of Object.keys(row)) {
        if (typeof row[key] === 'string') {
          sanitized[key] = row[key].substring(0, 500);
        } else {
          sanitized[key] = row[key];
        }
      }
      return sanitized;
    }
    return row;
  }

  getAll() {
    return [...this.badRows];
  }

  hasBadRows() {
    return this.badRows.length > 0;
  }

  getCount() {
    return this.badRows.length;
  }

  toJSON() {
    return {
      count: this.badRows.length,
      rows: this.badRows
    };
  }

  merge(otherCollector) {
    if (otherCollector instanceof BadRowCollector) {
      this.badRows = [...this.badRows, ...otherCollector.badRows];
    }
  }
}

class LicenseError extends Error {
  constructor(message, code, context = {}) {
    super(message);
    this.name = 'LicenseError';
    this.code = code;
    this.context = context;
    Error.captureStackTrace(this, LicenseError);
  }
}

class ParseError extends LicenseError {
  constructor(message, context = {}) {
    super(message, 'PARSE_ERROR', context);
    this.name = 'ParseError';
  }
}

class LicenseNotFoundError extends LicenseError {
  constructor(packageName, version, context = {}) {
    super(`License not found for ${packageName}@${version}`, 'LICENSE_NOT_FOUND', {
      packageName,
      version,
      ...context
    });
    this.name = 'LicenseNotFoundError';
  }
}

class SnapshotMismatchError extends LicenseError {
  constructor(message, context = {}) {
    super(message, 'SNAPSHOT_MISMATCH', context);
    this.name = 'SnapshotMismatchError';
  }
}

module.exports = {
  BadRowCollector,
  LicenseError,
  ParseError,
  LicenseNotFoundError,
  SnapshotMismatchError
};