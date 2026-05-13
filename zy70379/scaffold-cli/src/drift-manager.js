const fs = require('fs');
const path = require('path');

const DRIFT_CONFIG_FILE = '.scaffold-drift.json';

class DriftManager {
  constructor(projectPath) {
    this.projectPath = path.resolve(projectPath);
    this.configFile = path.join(this.projectPath, DRIFT_CONFIG_FILE);
    this.config = this.loadConfig();
  }

  loadConfig() {
    if (!fs.existsSync(this.configFile)) {
      return { version: '1.0.0', allowedDrifts: [] };
    }

    try {
      const content = fs.readFileSync(this.configFile, 'utf-8');
      return JSON.parse(content);
    } catch (e) {
      return { version: '1.0.0', allowedDrifts: [] };
    }
  }

  saveConfig() {
    fs.writeFileSync(
      this.configFile,
      JSON.stringify(this.config, null, 2) + '\n',
      'utf-8'
    );
  }

  isDriftAllowed(issue) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const allowed = this.config.allowedDrifts.find(drift => {
      if (drift.ruleId !== issue.ruleId) return false;

      if (drift.mismatchedScript && issue.details?.mismatchedScript) {
        if (drift.mismatchedScript !== issue.details.mismatchedScript) return false;
      }

      if (drift.missingFile && issue.details?.missingFile) {
        if (drift.missingFile !== issue.details.missingFile) return false;
      }

      if (drift.dependency && issue.details?.dependency) {
        if (drift.dependency !== issue.details.dependency) return false;
      }

      if (drift.allowedUntil) {
        const untilDate = new Date(drift.allowedUntil);
        untilDate.setHours(0, 0, 0, 0);
        if (today > untilDate) return false;
      }

      return true;
    });

    if (allowed) {
      const untilDate = allowed.allowedUntil ? new Date(allowed.allowedUntil) : null;
      if (untilDate) {
        untilDate.setHours(0, 0, 0, 0);
        const daysUntilExpiry = Math.ceil((untilDate - today) / (1000 * 60 * 60 * 24));
        return {
          allowed: true,
          allowedUntil: allowed.allowedUntil,
          reason: allowed.reason,
          approvedBy: allowed.approvedBy,
          approvedAt: allowed.approvedAt,
          daysUntilExpiry,
          reviewRequired: allowed.reviewRequired
        };
      }
      return {
        allowed: true,
        reason: allowed.reason,
        approvedBy: allowed.approvedBy,
        approvedAt: allowed.approvedAt,
        reviewRequired: allowed.reviewRequired
      };
    }

    return { allowed: false };
  }

  getExpiredDrifts() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return this.config.allowedDrifts.filter(drift => {
      if (!drift.allowedUntil) return false;
      const untilDate = new Date(drift.allowedUntil);
      untilDate.setHours(0, 0, 0, 0);
      return today > untilDate;
    });
  }

  addAllowedDrift(drift) {
    const id = `${drift.ruleId}-${Date.now()}`;
    this.config.allowedDrifts.push({
      id,
      ...drift,
      approvedAt: drift.approvedAt || new Date().toISOString().split('T')[0]
    });
    this.saveConfig();
    return id;
  }

  removeAllowedDrift(id) {
    const index = this.config.allowedDrifts.findIndex(d => d.id === id);
    if (index !== -1) {
      this.config.allowedDrifts.splice(index, 1);
      this.saveConfig();
      return true;
    }
    return false;
  }

  getAllDrifts() {
    return this.config.allowedDrifts;
  }
}

module.exports = DriftManager;
