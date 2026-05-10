const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { DB_PATH, loadDatabase, saveDatabase, clearCache, defaultSchema } = require('../config/database');

const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

clearCache();
const db = loadDatabase();

for (const key of Object.keys(defaultSchema)) {
  if (!db[key]) {
    db[key] = [];
  }
}

if (db.gate_rules.length === 0) {
  const now = new Date().toISOString();
  
  db.gate_rules.push({
    id: 'rule-signature-required',
    name: '必须有有效签名',
    description: '制品必须至少有一个已验证的有效数字签名',
    rule_type: 'signature',
    is_enabled: true,
    config: { minValidSignatures: 1 },
    priority: 100,
    created_at: now,
    updated_at: now
  });

  db.gate_rules.push({
    id: 'rule-security-scan-required',
    name: '安全扫描必须通过',
    description: '制品必须通过安全扫描，且致命/高危漏洞数量为0',
    rule_type: 'security_scan',
    is_enabled: true,
    config: { allowCritical: 0, allowHigh: 0 },
    priority: 90,
    created_at: now,
    updated_at: now
  });

  db.gate_rules.push({
    id: 'rule-approval-required',
    name: '审批必须通过',
    description: '制品晋级必须有至少一个已批准的审批记录',
    rule_type: 'approval',
    is_enabled: true,
    config: { requireApproval: true },
    priority: 80,
    created_at: now,
    updated_at: now
  });

  console.log('已初始化默认门禁规则');
}

saveDatabase();
console.log('数据库初始化完成:', DB_PATH);
