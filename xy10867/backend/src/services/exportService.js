const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');
const VulnerabilityService = require('./vulnerabilityService');

class ExportService {
  static async exportVulnerabilities(format = 'csv', filters = {}) {
    const vulnerabilities = await VulnerabilityService.getVulnerabilities(filters);
    
    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filename = `vulnerabilities-${Date.now()}.${format}`;
    const filepath = path.join(exportDir, filename);

    if (format === 'csv') {
      await this.exportToCsv(vulnerabilities, filepath);
    } else if (format === 'json') {
      await this.exportToJson(vulnerabilities, filepath);
    }

    return { filepath, filename, count: vulnerabilities.length };
  }

  static async exportToCsv(vulnerabilities, filepath) {
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
        { id: 'created_at', title: '创建时间' }
      ]
    });

    const records = vulnerabilities.map(v => ({
      ...v,
      affected_services: v.affected_services.join(', ')
    }));

    await csvWriter.writeRecords(records);
  }

  static async exportToJson(vulnerabilities, filepath) {
    fs.writeFileSync(filepath, JSON.stringify(vulnerabilities, null, 2));
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
