const crypto = require('crypto');

const DiffCalculator = {
  calculateAmountDiff: (expected, actual, tolerance = 0.01) => {
    const diff = Math.abs(expected - actual);
    return {
      expected,
      actual,
      difference: diff,
      percentage: expected > 0 ? (diff / expected) * 100 : 100,
      hasMismatch: diff > tolerance,
      evidence: {
        type: 'AMOUNT_COMPARISON',
        source: { expected, actual },
        timestamp: new Date().toISOString()
      }
    };
  },

  calculateTimeDiff: (expectedTime, actualTime, toleranceMs = 300000) => {
    const expected = new Date(expectedTime).getTime();
    const actual = new Date(actualTime).getTime();
    const diff = Math.abs(expected - actual);
    return {
      expected: expectedTime,
      actual: actualTime,
      differenceMs: diff,
      differenceMinutes: diff / 60000,
      hasMismatch: diff > toleranceMs,
      evidence: {
        type: 'TIME_COMPARISON',
        source: { expected: expectedTime, actual: actualTime },
        timestamp: new Date().toISOString()
      }
    };
  },

  buildEvidenceChain: (source, comparison, result) => {
    const chainId = crypto.createHash('sha256').update(JSON.stringify({ source, comparison, timestamp: Date.now() })).digest('hex').substring(0, 16);
    return {
      chainId,
      source: {
        type: source.type,
        id: source.id,
        snapshot: JSON.parse(JSON.stringify(source.data))
      },
      comparison: {
        field: comparison.field,
        expected: comparison.expected,
        actual: comparison.actual
      },
      result: {
        hasDiscrepancy: result.hasDiscrepancy,
        discrepancyType: result.discrepancyType,
        severity: result.severity
      },
      timestamp: new Date().toISOString()
    };
  },

  compareObjects: (obj1, obj2, fields) => {
    const differences = [];
    fields.forEach(field => {
      const val1 = obj1[field];
      const val2 = obj2[field];
      if (val1 !== val2) {
        differences.push({
          field,
          expected: val1,
          actual: val2,
          evidence: {
            type: 'FIELD_COMPARISON',
            field,
            source: { obj1: val1, obj2: val2 },
            timestamp: new Date().toISOString()
          }
        });
      }
    });
    return {
      hasDifferences: differences.length > 0,
      differences,
      evidence: {
        type: 'OBJECT_COMPARISON',
        fieldsCompared: fields,
        timestamp: new Date().toISOString()
      }
    };
  },

  isWithinTolerance: (value1, value2, tolerance) => {
    return Math.abs(value1 - value2) <= tolerance;
  },

  generateTraceId: () => {
    return 'TRACE_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
};

module.exports = DiffCalculator;
