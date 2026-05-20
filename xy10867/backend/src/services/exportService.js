const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const VulnerabilityService = require('./vulnerabilityService');
const AuditService = require('./auditService');
const Database = require('../db');

class ExportService {
  static async exportVulnerabilities(format = 'csv', filters = {}, operator = null, includeDetails = false) {
    const vulnerabilities = await VulnerabilityService.getVulnerabilities(filters);
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const timestamp = Date.now();
    let result;

    if (format === 'csv') {
      if (includeDetails) {
        result = await this.exportFullReportCsv(vulnerabilities, exportDir, timestamp);
      } else {
        result = await this.exportToCsv(vulnerabilities, exportDir, timestamp);
      }
    } else if (format === 'json') {
      if (includeDetails) {
        result = await this.exportFullReportJson(vulnerabilities, exportDir, timestamp);
      } else {
        result = await this.exportToJson(vulnerabilities, exportDir, timestamp);
      }
    }

    if (operator) {
      await AuditService.log({
        vulnerabilityId: null,
        action: 'EXPORT',
        previousStatus: null,
        newStatus: null,
        operator,
        requestData: { format, filters, includeDetails },
        responseData: { filename: result.filename, count: vulnerabilities.length }
      });
    }

    return result;
  }

  static async exportToCsv(vulnerabilities, exportDir, timestamp) {
    const filename = `vulnerabilities-${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'id', title: 'ID' },
        { id: 'package_name', title: '包名' },
        { id: 'package_version', title: '版本' },
        { id: 'ecosystem', title: '生态' },
        { id: 'cve_id', title: 'CVE ID' },
        { id: 'severity', title: '严重程度' },
        { id: 'cvss_score', title: 'CVSS分数' },
        { id: 'status', title: '状态' },
        { id: 'affected_services', title: '受影响服务' },
        { id: 'exempt_reason', title: '豁免理由' },
        { id: 'fix_batch', title: '修复批次' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' }
      ]
    });

    const records = vulnerabilities.map(v => ({
      ...v,
      affected_services: v.affected_services.join(', ')
    }));

    await csvWriter.writeRecords(records);
    return { filepath, filename, count: vulnerabilities.length };
  }

  static async exportFullReportCsv(vulnerabilities, exportDir, timestamp) {
    const filename = `vulnerabilities-full-report-${timestamp}.csv`;
    const filepath = path.join(exportDir, filename);

    const allRecords = [];
    
    for (const vuln of vulnerabilities) {
      const auditLogs = await AuditService.getLogsByVulnerability(vuln.id);
      const verifications = await Database.all(
        `SELECT * FROM verification_records WHERE vulnerability_id = ? ORDER BY verified_at DESC`,
        [vuln.id]
      );

      allRecords.push({
        record_type: 'VULNERABILITY',
        id: vuln.id,
        package_name: vuln.package_name,
        package_version: vuln.package_version,
        ecosystem: vuln.ecosystem,
        cve_id: vuln.cve_id,
        severity: vuln.severity,
        cvss_score: vuln.cvss_score,
        status: vuln.status,
        affected_services: vuln.affected_services.join(', '),
        exempt_reason: vuln.exempt_reason,
        fix_batch: vuln.fix_batch,
        created_at: vuln.created_at,
        updated_at: vuln.updated_at,
        audit_action: '',
        audit_operator: '',
        audit_timestamp: '',
        verification_result: '',
        verification_verifier: '',
        verification_comment: '',
        verification_timestamp: ''
      });

      for (const log of auditLogs) {
        allRecords.push({
          record_type: 'AUDIT_LOG',
          id: vuln.id,
          package_name: vuln.package_name,
          package_version: vuln.package_version,
          ecosystem: vuln.ecosystem,
          cve_id: vuln.cve_id,
          severity: '',
          cvss_score: '',
          status: '',
          affected_services: '',
          exempt_reason: '',
          fix_batch: '',
          created_at: '',
          updated_at: '',
          audit_action: log.action,
          audit_operator: log.operator,
          audit_timestamp: log.created_at,
          verification_result: '',
          verification_verifier: '',
          verification_comment: '',
          verification_timestamp: ''
        });
      }

      for (const verif of verifications) {
        allRecords.push({
          record_type: 'VERIFICATION',
          id: vuln.id,
          package_name: vuln.package_name,
          package_version: vuln.package_version,
          ecosystem: vuln.ecosystem,
          cve_id: vuln.cve_id,
          severity: '',
          cvss_score: '',
          status: '',
          affected_services: '',
          exempt_reason: '',
          fix_batch: '',
          created_at: '',
          updated_at: '',
          audit_action: '',
          audit_operator: '',
          audit_timestamp: '',
          verification_result: verif.result,
          verification_verifier: verif.verifier,
          verification_comment: verif.comment,
          verification_timestamp: verif.verified_at
        });
      }
    }

    const csvWriter = createCsvWriter({
      path: filepath,
      header: [
        { id: 'record_type', title: '记录类型' },
        { id: 'id', title: '漏洞ID' },
        { id: 'package_name', title: '包名' },
        { id: 'package_version', title: '版本' },
        { id: 'ecosystem', title: '生态' },
        { id: 'cve_id', title: 'CVE ID' },
        { id: 'severity', title: '严重程度' },
        { id: 'cvss_score', title: 'CVSS分数' },
        { id: 'status', title: '状态' },
        { id: 'affected_services', title: '受影响服务' },
        { id: 'exempt_reason', title: '豁免理由' },
        { id: 'fix_batch', title: '修复批次' },
        { id: 'created_at', title: '创建时间' },
        { id: 'updated_at', title: '更新时间' },
        { id: 'audit_action', title: '审计操作' },
        { id: 'audit_operator', title: '审计操作人' },
        { id: 'audit_timestamp', title: '审计时间' },
        { id: 'verification_result', title: '验证结果' },
        { id: 'verification_verifier', title: '验证人' },
        { id: 'verification_comment', title: '验证备注' },
        { id: 'verification_timestamp', title: '验证时间' }
      ]
    });

    await csvWriter.writeRecords(allRecords);
    return { filepath, filename, count: vulnerabilities.length, detailsCount: allRecords.length };
  }

  static async exportToJson(vulnerabilities, exportDir, timestamp) {
    const filename = `vulnerabilities-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);
    fs.writeFileSync(filepath, JSON.stringify(vulnerabilities, null, 2));
    return { filepath, filename, count: vulnerabilities.length };
  }

  static async exportFullReportJson(vulnerabilities, exportDir, timestamp) {
    const filename = `vulnerabilities-full-report-${timestamp}.json`;
    const filepath = path.join(exportDir, filename);

    const fullReport = [];
    
    for (const vuln of vulnerabilities) {
      const auditLogs = await AuditService.getLogsByVulnerability(vuln.id);
      const verifications = await Database.all(
        `SELECT * FROM verification_records WHERE vulnerability_id = ? ORDER BY verified_at DESC`,
        [vuln.id]
      );

      fullReport.push({
        vulnerability: vuln,
        auditLogs,
        verifications
      });
    }

    fs.writeFileSync(filepath, JSON.stringify(fullReport, null, 2));
    return { filepath, filename, count: vulnerabilities.length };
  }

  static getExportFile(filename) {
    const filepath = path.join(__dirname, '../../exports', filename);
    if (fs.existsSync(filepath)) {
      return filepath;
    }
    return null;
  }
}

module.exports = ExportService;
