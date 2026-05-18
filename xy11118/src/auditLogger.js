const fs = require('fs');
const path = require('path');
const { AUDIT_ACTIONS } = require('./constants');

class AuditLogger {
  constructor(auditDir) {
    this.auditDir = auditDir;
    this.ensureAuditDir();
    this.auditFile = this.createAuditFile();
    this.entries = [];
  }

  ensureAuditDir() {
    if (!fs.existsSync(this.auditDir)) {
      fs.mkdirSync(this.auditDir, { recursive: true });
    }
  }

  createAuditFile() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return path.join(this.auditDir, `audit-${timestamp}.json`);
  }

  log(action, details = {}) {
    const entry = {
      timestamp: new Date().toISOString(),
      action,
      details
    };
    this.entries.push(entry);
    this.writeToFile();
    return entry;
  }

  logProcessStart(configPath, inputPath, outputDir) {
    return this.log(AUDIT_ACTIONS.PROCESS_START, {
      configPath,
      inputPath,
      outputDir,
      nodeVersion: process.version
    });
  }

  logProcessEnd(totalRecords, classifiedCounts) {
    return this.log(AUDIT_ACTIONS.PROCESS_END, {
      totalRecords,
      classifiedCounts,
      completedAt: new Date().toISOString()
    });
  }

  logRecordClassified(recordId, originalType, newType, reason) {
    return this.log(AUDIT_ACTIONS.RECORD_CLASSIFIED, {
      recordId,
      originalType,
      newType,
      reason
    });
  }

  logRuleApplied(ruleName, ruleParams, affectedRecords) {
    return this.log(AUDIT_ACTIONS.RULE_APPLIED, {
      ruleName,
      ruleParams,
      affectedRecords
    });
  }

  logSpecialCaseDetected(recordId, caseType, description) {
    return this.log(AUDIT_ACTIONS.SPECIAL_CASE_DETECTED, {
      recordId,
      caseType,
      description
    });
  }

  logOutputGenerated(filePath, recordCount) {
    return this.log(AUDIT_ACTIONS.OUTPUT_GENERATED, {
      filePath,
      recordCount
    });
  }

  writeToFile() {
    const auditData = {
      auditId: path.basename(this.auditFile, '.json'),
      generatedAt: new Date().toISOString(),
      entries: this.entries
    };
    fs.writeFileSync(this.auditFile, JSON.stringify(auditData, null, 2), 'utf8');
  }

  getAuditFilePath() {
    return this.auditFile;
  }
}

module.exports = AuditLogger;
