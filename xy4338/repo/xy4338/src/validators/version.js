const path = require('path');
const config = require('../config');

class VersionValidator {
  constructor() {
    this.versionPattern = config.validators.versionPattern;
    this.strictMatch = true;
  }
  
  extractVersion(filename) {
    const match = filename.match(this.versionPattern);
    if (match) {
      return match[1];
    }
    return null;
  }
  
  parseVersion(versionStr) {
    if (!versionStr) return null;
    const parts = versionStr.split('.').map(Number);
    return parts.every(p => !isNaN(p)) ? parts : null;
  }
  
  compareVersions(v1, v2) {
    const p1 = this.parseVersion(v1);
    const p2 = this.parseVersion(v2);
    
    if (!p1 || !p2) return null;
    
    const maxLen = Math.max(p1.length, p2.length);
    for (let i = 0; i < maxLen; i++) {
      const n1 = p1[i] || 0;
      const n2 = p2[i] || 0;
      if (n1 > n2) return 1;
      if (n1 < n2) return -1;
    }
    return 0;
  }
  
  versionsMatch(v1, v2) {
    const comparison = this.compareVersions(v1, v2);
    return comparison === 0;
  }
  
  getGroupedFiles(files) {
    const groups = {
      scores: [],
      audio: [],
      csv: [],
      other: []
    };
    
    for (const file of files) {
      const ext = path.extname(file.name).toLowerCase();
      const version = this.extractVersion(file.name);
      const fileWithVersion = { ...file, version };
      
      if (ext === '.pdf') {
        groups.scores.push(fileWithVersion);
      } else if (['.mp3', '.wav', '.aac', '.ogg', '.m4a'].includes(ext)) {
        groups.audio.push(fileWithVersion);
      } else if (ext === '.csv') {
        groups.csv.push(fileWithVersion);
      } else {
        groups.other.push(fileWithVersion);
      }
    }
    
    return groups;
  }
  
  findReferenceVersion(groups) {
    const allFiles = [
      ...groups.scores,
      ...groups.audio,
      ...groups.csv
    ].filter(f => f.version);
    
    if (allFiles.length === 0) {
      return null;
    }
    
    const versionCounts = {};
    for (const file of allFiles) {
      versionCounts[file.version] = (versionCounts[file.version] || 0) + 1;
    }
    
    const sortedVersions = Object.entries(versionCounts)
      .sort((a, b) => b[1] - a[1]);
    
    return sortedVersions[0][0];
  }
  
  validate(files) {
    const risks = [];
    const groups = this.getGroupedFiles(files);
    const referenceVersion = this.findReferenceVersion(groups);
    
    if (!referenceVersion) {
      risks.push({
        type: 'version',
        severity: 'warning',
        category: '版本',
        message: '未在文件名中识别到版本号，无法进行版本匹配校验',
        details: {
          tip: '建议在文件名中包含版本号，如: "女高声部_v1.2.pdf"'
        }
      });
      
      return {
        valid: true,
        risks,
        referenceVersion: null,
        mismatchedFiles: []
      };
    }
    
    const allRelevantFiles = [
      ...groups.scores,
      ...groups.audio
    ];
    
    const mismatchedFiles = [];
    const noVersionFiles = [];
    
    for (const file of allRelevantFiles) {
      if (file.version) {
        if (!this.versionsMatch(file.version, referenceVersion)) {
          mismatchedFiles.push({
            name: file.name,
            path: file.path,
            currentVersion: file.version,
            expectedVersion: referenceVersion
          });
        }
      } else {
        noVersionFiles.push({
          name: file.name,
          path: file.path
        });
      }
    }
    
    if (mismatchedFiles.length > 0) {
      risks.push({
        type: 'version',
        severity: 'critical',
        category: '版本',
        message: `检测到版本不匹配。参考版本: ${referenceVersion}`,
        details: {
          referenceVersion,
          mismatchedCount: mismatchedFiles.length,
          mismatchedFiles: mismatchedFiles.map(f => ({
            file: f.name,
            current: f.currentVersion,
            expected: f.expectedVersion
          }))
        }
      });
    }
    
    if (noVersionFiles.length > 0) {
      risks.push({
        type: 'version',
        severity: 'warning',
        category: '版本',
        message: `部分文件未包含版本号，无法校验匹配`,
        details: {
          referenceVersion,
          noVersionCount: noVersionFiles.length,
          noVersionFiles: noVersionFiles.map(f => f.name)
        }
      });
    }
    
    return {
      valid: mismatchedFiles.length === 0,
      risks,
      referenceVersion,
      mismatchedFiles,
      noVersionFiles
    };
  }
}

module.exports = VersionValidator;
