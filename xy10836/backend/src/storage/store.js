const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../../data');
const FILES = {
  leases: path.join(DATA_DIR, 'leases.json'),
  approvals: path.join(DATA_DIR, 'approvals.json'),
  renewals: path.join(DATA_DIR, 'renewals.json'),
  invalidations: path.join(DATA_DIR, 'invalidations.json'),
  auditLogs: path.join(DATA_DIR, 'audit-logs.json')
};

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  Object.values(FILES).forEach(file => {
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, JSON.stringify([], null, 2));
    }
  });
}

function readData(file) {
  ensureDataDir();
  const content = fs.readFileSync(file, 'utf8');
  return JSON.parse(content);
}

function writeData(file, data) {
  ensureDataDir();
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

module.exports = {
  readLeases: () => readData(FILES.leases),
  writeLeases: (data) => writeData(FILES.leases, data),
  readApprovals: () => readData(FILES.approvals),
  writeApprovals: (data) => writeData(FILES.approvals, data),
  readRenewals: () => readData(FILES.renewals),
  writeRenewals: (data) => writeData(FILES.renewals, data),
  readInvalidations: () => readData(FILES.invalidations),
  writeInvalidations: (data) => writeData(FILES.invalidations, data),
  readAuditLogs: () => readData(FILES.auditLogs),
  writeAuditLogs: (data) => writeData(FILES.auditLogs, data)
};
