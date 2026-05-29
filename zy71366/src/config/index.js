const path = require('path');

module.exports = {
  port: process.env.PORT || 3000,
  storage: {
    lutDir: path.join(__dirname, '../../storage/luts'),
    archiveDir: path.join(__dirname, '../../storage/archives'),
    exportDir: path.join(__dirname, '../../storage/exports'),
    tempDir: path.join(__dirname, '../../storage/temp')
  },
  database: {
    path: path.join(__dirname, '../../storage/lut-ledger.db')
  },
  validation: {
    allowedExtensions: ['.cube', '.3dl', '.look'],
    maxFileSize: 50 * 1024 * 1024,
    versionPattern: /^v\d+\.\d+(\.\d+)?$/
  },
  status: {
    DRAFT: 'draft',
    ACTIVE: 'active',
    ARCHIVED: 'archived',
    SUPERSEDED: 'superseded',
    WITHDRAWN: 'withdrawn',
    CONFLICT: 'conflict'
  }
};
