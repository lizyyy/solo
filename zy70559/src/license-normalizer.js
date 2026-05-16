const spdxParse = require('spdx-expression-parse');

const RISK_LEVELS = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  UNKNOWN: 'unknown'
};

const LICENSE_RISKS = {
  'MIT': RISK_LEVELS.LOW,
  'Apache-2.0': RISK_LEVELS.LOW,
  'BSD-2-Clause': RISK_LEVELS.LOW,
  'BSD-3-Clause': RISK_LEVELS.LOW,
  'ISC': RISK_LEVELS.LOW,
  'GPL-3.0-only': RISK_LEVELS.HIGH,
  'GPL-2.0-only': RISK_LEVELS.HIGH,
  'AGPL-3.0-only': RISK_LEVELS.HIGH,
  'MPL-2.0': RISK_LEVELS.MEDIUM
};

class LicenseNormalizer {
  constructor() {
    this.errors = [];
  }

  normalize(license, packageName, packagePath) {
    if (!license) {
      this.addError(packageName, 'no license found', packagePath);
      return { original: null, normalized: null, risk: RISK_LEVELS.UNKNOWN };
    }
    const original = license;
    let normalized = license.trim();
    try {
      const risk = this.simpleRiskCheck(normalized);
      return { original, normalized, risk };
    } catch (e) {
      const risk = this.simpleRiskCheck(normalized);
      this.addError(packageName, 'SPDX parse failed', packagePath);
      return { original, normalized, risk };
    }
  }

  determineRisk(parsed) {
    if (typeof parsed === 'string') {
      return LICENSE_RISKS[parsed] || RISK_LEVELS.UNKNOWN;
    }
    if (parsed.license) {
      return LICENSE_RISKS[parsed.license] || RISK_LEVELS.UNKNOWN;
    }
    return RISK_LEVELS.UNKNOWN;
  }

  simpleRiskCheck(license) {
    const lower = license.toLowerCase();
    if (lower.includes('gpl') || lower.includes('agpl')) return RISK_LEVELS.HIGH;
    if (lower.includes('mpl') || lower.includes('epl') || lower.includes('cddl')) return RISK_LEVELS.MEDIUM;
    if (lower.includes('mit') || lower.includes('apache') || lower.includes('bsd') || lower.includes('isc')) return RISK_LEVELS.LOW;
    return RISK_LEVELS.UNKNOWN;
  }

  riskToNumber(risk) {
    const order = { low: 1, medium: 2, high: 3, unknown: 4 };
    return order[risk] || 4;
  }

  numberToRisk(num) {
    const order = ['low', 'medium', 'high', 'unknown'];
    return order[num - 1] || RISK_LEVELS.UNKNOWN;
  }

  addError(packageName, reason, location) {
    this.errors.push({
      packageName,
      reason,
      location,
      timestamp: new Date().toISOString()
    });
  }

  getErrors() {
    return this.errors;
  }
}

module.exports = LicenseNormalizer;
module.exports.RISK_LEVELS = RISK_LEVELS;
