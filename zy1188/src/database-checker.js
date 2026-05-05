'use strict';

const fs = require('fs-extra');
const path = require('path');
const { glob } = require('glob');
const { RISK_LEVELS, PERMISSION_RISKS } = require('./patterns');

class DatabaseChecker {
  constructor() {}

  _getFilePermissions(filePath) {
    try {
      const stats = fs.statSync(filePath);
      const mode = stats.mode;
      
      return {
        mode: mode,
        octal: (mode & parseInt('777', 8)).toString(8).padStart(3, '0'),
        isReadableByOthers: (mode & parseInt('004', 8)) !== 0,
        isWritableByOthers: (mode & parseInt('002', 8)) !== 0,
        isExecutableByOthers: (mode & parseInt('001', 8)) !== 0,
        isReadableByGroup: (mode & parseInt('040', 8)) !== 0,
        isWritableByGroup: (mode & parseInt('020', 8)) !== 0
      };
    } catch (error) {
      return null;
    }
  }

  _getDirectoryPermissions(dirPath) {
    return this._getFilePermissions(dirPath);
  }

  async checkDatabaseFile(filePath) {
    const issues = [];
    
    if (!fs.existsSync(filePath)) {
      return issues;
    }

    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return issues;
    }

    const permissions = this._getFilePermissions(filePath);
    if (!permissions) {
      return issues;
    }

    const fileName = path.basename(filePath);
    const ext = path.extname(filePath).toLowerCase();
    const isBackup = fileName.toLowerCase().includes('backup') || 
                     fileName.toLowerCase().includes('bak') ||
                     fileName.match(/\.(bak|backup|old)$/i);
    const isWal = ext === '-wal' || fileName.endsWith('.db-wal') || fileName.endsWith('.sqlite-wal');
    const isShm = ext === '-shm' || fileName.endsWith('.db-shm') || fileName.endsWith('.sqlite-shm');

    const fileType = this._getFileType(filePath);

    if (permissions.isWritableByOthers) {
      issues.push({
        id: 'PERMISSION_WORLD_WRITABLE',
        name: '数据库文件全局可写',
        severity: RISK_LEVELS.CRITICAL,
        description: PERMISSION_RISKS.WORLD_WRITABLE.description,
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: fileType,
        permissions: permissions.octal,
        fixSuggestion: PERMISSION_RISKS.WORLD_WRITABLE.fixSuggestion.replace('<filename>', filePath),
        matchedText: `权限: ${permissions.octal}`
      });
    }

    if (permissions.isReadableByOthers) {
      const severity = isBackup ? RISK_LEVELS.CRITICAL : RISK_LEVELS.HIGH;
      issues.push({
        id: 'PERMISSION_WORLD_READABLE',
        name: '数据库文件全局可读',
        severity: severity,
        description: PERMISSION_RISKS.WORLD_READABLE.description + 
          (isBackup ? ' (备份文件尤为敏感)' : ''),
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: fileType,
        permissions: permissions.octal,
        isBackup: isBackup,
        fixSuggestion: PERMISSION_RISKS.WORLD_READABLE.fixSuggestion.replace('<filename>', filePath),
        matchedText: `权限: ${permissions.octal}`
      });
    }

    if (permissions.isExecutableByOthers) {
      issues.push({
        id: 'PERMISSION_WORLD_EXECUTABLE',
        name: '数据库文件有可执行权限',
        severity: RISK_LEVELS.MEDIUM,
        description: PERMISSION_RISKS.WORLD_EXECUTABLE.description,
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: fileType,
        permissions: permissions.octal,
        fixSuggestion: PERMISSION_RISKS.WORLD_EXECUTABLE.fixSuggestion.replace('<filename>', filePath),
        matchedText: `权限: ${permissions.octal}`
      });
    }

    if (isWal) {
      issues.push({
        id: 'WAL_FILE_DETECTED',
        name: 'SQLite WAL文件存在',
        severity: RISK_LEVELS.LOW,
        description: '检测到SQLite预写日志(WAL)文件。该文件包含未写入主数据库的事务数据，应确保其权限设置与主数据库一致。',
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: 'wal',
        permissions: permissions.octal,
        fixSuggestion: '确保WAL文件权限与主数据库一致: chmod 600 <filename>。定期执行CHECKPOINT或关闭数据库连接以合并WAL到主数据库。',
        matchedText: `WAL文件: ${path.basename(filePath)}`
      });
    }

    if (isShm) {
      issues.push({
        id: 'SHM_FILE_DETECTED',
        name: 'SQLite SHM文件存在',
        severity: RISK_LEVELS.LOW,
        description: '检测到SQLite共享内存(SHM)文件。该文件用于WAL模式下的进程间通信。',
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: 'shm',
        permissions: permissions.octal,
        fixSuggestion: '确保SHM文件权限设置合理。当所有数据库连接关闭后，该文件可安全删除。',
        matchedText: `SHM文件: ${path.basename(filePath)}`
      });
    }

    if (isBackup) {
      issues.push({
        id: 'BACKUP_FILE_DETECTED',
        name: '数据库备份文件检测',
        severity: RISK_LEVELS.MEDIUM,
        description: '检测到疑似数据库备份文件。备份文件通常包含完整数据副本，其安全性经常被忽视。',
        filePath: filePath,
        lineNumber: 1,
        column: 1,
        fileType: 'backup',
        permissions: permissions.octal,
        fixSuggestion: '1. 确保备份文件权限严格设置为 600\n2. 考虑加密备份文件\n3. 将备份文件存储在安全位置，而非Web可访问目录\n4. 定期清理过期备份',
        matchedText: `备份文件: ${path.basename(filePath)}`
      });
    }

    const parentDir = path.dirname(filePath);
    const dirPermissions = this._getDirectoryPermissions(parentDir);
    
    if (dirPermissions && dirPermissions.isWritableByOthers) {
      issues.push({
        id: 'DIRECTORY_WORLD_WRITABLE',
        name: '数据库目录全局可写',
        severity: RISK_LEVELS.HIGH,
        description: PERMISSION_RISKS.IN_DIRECTORY_WITH_WORLD_WRITE.description,
        filePath: filePath,
        directory: parentDir,
        lineNumber: 1,
        column: 1,
        fileType: 'directory',
        dirPermissions: dirPermissions.octal,
        fixSuggestion: PERMISSION_RISKS.IN_DIRECTORY_WITH_WORLD_WRITE.fixSuggestion.replace('<directory>', parentDir),
        matchedText: `目录权限: ${dirPermissions.octal}`
      });
    }

    return issues;
  }

  _getFileType(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const fileName = path.basename(filePath).toLowerCase();

    if (fileName.includes('backup') || fileName.includes('bak') || ext === '.bak') {
      return 'backup';
    }
    if (ext === '-wal' || fileName.endsWith('.db-wal') || fileName.endsWith('.sqlite-wal')) {
      return 'wal';
    }
    if (ext === '-shm' || fileName.endsWith('.db-shm') || fileName.endsWith('.sqlite-shm')) {
      return 'shm';
    }
    if (['.db', '.sqlite', '.sqlite3', '.db3', '.s3db', '.sl3'].includes(ext)) {
      return 'database';
    }
    return 'other';
  }

  findRelatedFiles(databasePath) {
    const relatedFiles = [];
    const dir = path.dirname(databasePath);
    const baseName = path.basename(databasePath, path.extname(databasePath));
    const fullBaseName = path.basename(databasePath);

    const possibleRelated = [
      path.join(dir, `${fullBaseName}-wal`),
      path.join(dir, `${fullBaseName}-shm`),
      path.join(dir, `${baseName}.db-wal`),
      path.join(dir, `${baseName}.db-shm`),
      path.join(dir, `${baseName}.sqlite-wal`),
      path.join(dir, `${baseName}.sqlite-shm`),
      path.join(dir, `${baseName}.backup`),
      path.join(dir, `${baseName}.bak`),
      path.join(dir, `${fullBaseName}.backup`),
      path.join(dir, `${fullBaseName}.bak`),
      path.join(dir, `backup_${fullBaseName}`),
      path.join(dir, `${fullBaseName}_backup`)
    ];

    for (const file of possibleRelated) {
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        relatedFiles.push(file);
      }
    }

    return relatedFiles;
  }

  async checkAllInDirectory(dirPath) {
    const allIssues = [];
    const patterns = [
      '*.db',
      '*.sqlite',
      '*.sqlite3',
      '*.db3',
      '*.s3db',
      '*.sl3',
      '*.db-wal',
      '*.db-shm',
      '*.sqlite-wal',
      '*.sqlite-shm',
      '*backup*.db',
      '*backup*.sqlite',
      '*.bak',
      '*.backup'
    ];

    for (const pattern of patterns) {
      const files = await glob(pattern, {
        cwd: dirPath,
        absolute: true,
        nodir: true
      });

      for (const file of files) {
        const issues = await this.checkDatabaseFile(file);
        allIssues.push(...issues);
      }
    }

    return allIssues;
  }
}

module.exports = DatabaseChecker;
