const low = require('lowdb');
const FileSync = require('lowdb/adapters/FileSync');
const path = require('path');
const fs = require('fs');

const dbDir = path.join(__dirname, '../data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const adapter = new FileSync(path.join(dbDir, 'db.json'));
const db = low(adapter);

db.defaults({
  evidencePackages: [],
  downloaders: [],
  watermarks: [],
  authorizations: [],
  revocationRecords: [],
  trackingSummaries: [],
  failureRecords: [],
  auditLogs: []
}).write();

module.exports = db;
