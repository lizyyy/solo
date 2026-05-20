const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const dataDir = path.join(__dirname, '../data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('创建数据目录:', dataDir);
}

const dbPath = path.join(dataDir, 'vulnerability.db');
const db = new sqlite3.Database(dbPath);

const samplePackages = [
  { name: 'lodash', version: '4.17.20', ecosystem: 'npm' },
  { name: 'axios', version: '0.21.1', ecosystem: 'npm' },
  { name: 'django', version: '3.2.0', ecosystem: 'pypi' },
  { name: 'spring-core', version: '5.3.0', ecosystem: 'maven' },
  { name: 'jquery', version: '3.4.1', ecosystem: 'npm' },
  { name: 'express', version: '4.17.1', ecosystem: 'npm' },
  { name: 'numpy', version: '1.21.0', ecosystem: 'pypi' },
  { name: 'netty', version: '4.1.0', ecosystem: 'maven' }
];

const sampleVulnerabilities = [
  { cveId: 'CVE-2021-23337', severity: 'HIGH', cvssScore: 7.2, description: '原型污染漏洞', affectedServices: ['user-service', 'order-service'], status: 'PENDING' },
  { cveId: 'CVE-2020-28469', severity: 'CRITICAL', cvssScore: 9.8, description: '远程代码执行', affectedServices: ['api-gateway'], status: 'ANALYZING' },
  { cveId: 'CVE-2021-23358', severity: 'MEDIUM', cvssScore: 5.3, description: '正则表达式拒绝服务', affectedServices: ['payment-service'], status: 'FIXING' },
  { cveId: 'CVE-2020-7656', severity: 'HIGH', cvssScore: 7.5, description: '目录遍历漏洞', affectedServices: ['file-service', 'upload-service'], status: 'EXEMPTED' },
  { cveId: 'CVE-2019-11358', severity: 'CRITICAL', cvssScore: 9.1, description: 'jQuery原型污染', affectedServices: ['admin-portal', 'customer-portal'], status: 'VERIFIED' },
  { cveId: 'CVE-2022-24999', severity: 'HIGH', cvssScore: 8.2, description: 'qs模块原型污染', affectedServices: ['auth-service'], status: 'PENDING' },
  { cveId: 'CVE-2021-33430', severity: 'MEDIUM', cvssScore: 5.9, description: 'NumPy数组越界', affectedServices: ['data-processing'], status: 'PENDING' },
  { cveId: 'CVE-2021-21290', severity: 'LOW', cvssScore: 3.7, description: 'Netty信息泄露', affectedServices: ['realtime-service'], status: 'CLOSED' }
];

async function seedData() {
  console.log('开始插入演示数据...');

  for (let i = 0; i < samplePackages.length; i++) {
    const pkg = samplePackages[i];
    const vuln = sampleVulnerabilities[i];
    
    const packageId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT OR IGNORE INTO packages (id, name, version, ecosystem) VALUES (?, ?, ?, ?)`,
        [packageId, pkg.name, pkg.version, pkg.ecosystem],
        (err) => err ? reject(err) : resolve()
      );
    });

    const vulnId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO vulnerabilities (id, package_id, cve_id, severity, cvss_score, description, affected_services, status, exempt_reason, fix_batch)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          vulnId, packageId, vuln.cveId, vuln.severity, vuln.cvssScore,
          vuln.description, JSON.stringify(vuln.affectedServices), vuln.status,
          vuln.status === 'EXEMPTED' ? '该功能未在生产环境使用，风险可控' : null,
          vuln.status === 'FIXING' ? 'BATCH-2024-01' : null
        ],
        (err) => err ? reject(err) : resolve()
      );
    });

    const auditId = uuidv4();
    await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO audit_logs (id, vulnerability_id, action, previous_status, new_status, operator, request_data, response_data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [auditId, vulnId, 'CREATE', null, 'PENDING', 'system', JSON.stringify({}), JSON.stringify({ id: vulnId })],
        (err) => err ? reject(err) : resolve()
      );
    });

    console.log(`已创建: ${pkg.name} - ${vuln.cveId}`);
  }

  console.log('演示数据插入完成！');
  db.close();
}

seedData().catch(err => {
  console.error('插入数据失败:', err);
  db.close();
  process.exit(1);
});
