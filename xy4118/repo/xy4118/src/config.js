const path = require('path');
const os = require('os');

const DEFAULT_CONFIG = {
  version: '1.0.0',
  directories: {
    staging: 'staging',
    archive: 'archive',
    reports: 'reports',
    logs: 'logs',
    temp: path.join(os.tmpdir(), 'museum-photo-checker')
  },
  validation: {
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.raw'],
    collectionIdPattern: '^[A-Z]+-\\d{4,}$',
    maxPhotosPerItem: 10,
    exifTimeToleranceMinutes: 5
  },
  filenames: {
    shootingList: 'shooting-list.csv',
    collectionCatalog: 'collection-catalog.json',
    auditLog: 'audit-log.json',
    stagingManifest: 'staging-manifest.json',
    lastCheckReport: 'last-check-report.json'
  }
};

function getWorkspaceRoot() {
  return process.cwd();
}

function getPath(relativePath) {
  return path.join(getWorkspaceRoot(), relativePath);
}

function getConfigPath() {
  return getPath('.photo-checker.json');
}

function isInitialized() {
  const fs = require('fs-extra');
  return fs.existsSync(getConfigPath());
}

module.exports = {
  DEFAULT_CONFIG,
  getWorkspaceRoot,
  getPath,
  getConfigPath,
  isInitialized
};
