const fs = require('fs/promises');
const path = require('path');

class Scanner {
  constructor(options = {}) {
    this.options = {
      followSymlinks: options.followSymlinks || false,
      maxDepth: options.maxDepth || Infinity,
      excludePatterns: options.excludePatterns || [],
      includePatterns: options.includePatterns || [],
      minSize: options.minSize || 0,
    };
  }

  async scan(directory) {
    const results = {
      files: [],
      errors: [],
      stats: {
        totalFiles: 0,
        totalSize: 0,
        scannedDirs: 0,
      },
    };

    await this._scanRecursive(directory, 0, results);
    return results;
  }

  async _scanRecursive(dirPath, depth, results) {
    if (depth > this.options.maxDepth) return;

    try {
      results.stats.scannedDirs++;
      const entries = await fs.readdir(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (this._shouldExclude(fullPath, entry.name)) {
          continue;
        }

        if (entry.isDirectory() && !entry.isSymbolicLink()) {
          await this._scanRecursive(fullPath, depth + 1, results);
        } else if (entry.isFile() || (entry.isSymbolicLink() && this.options.followSymlinks)) {
          await this._processFile(fullPath, entry.name, results);
        }
      }
    } catch (error) {
      results.errors.push({
        type: 'directory_read_error',
        path: dirPath,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  async _processFile(fullPath, fileName, results) {
    try {
      const stats = await fs.stat(fullPath);

      if (stats.size < this.options.minSize) {
        return;
      }

      if (this.options.includePatterns.length > 0 && 
          !this.options.includePatterns.some(p => 
            typeof p === 'string' ? fileName.includes(p) : p.test(fileName)
          )) {
        return;
      }

      results.stats.totalFiles++;
      results.stats.totalSize += stats.size;

      results.files.push({
        id: this._generateFileId(fullPath, stats),
        path: fullPath,
        directory: path.dirname(fullPath),
        name: fileName,
        nameWithoutExt: path.basename(fileName, path.extname(fileName)),
        extension: path.extname(fileName).slice(1),
        size: stats.size,
        created: stats.birthtime.toISOString(),
        modified: stats.mtime.toISOString(),
        accessed: stats.atime.toISOString(),
        scannedAt: new Date().toISOString(),
      });
    } catch (error) {
      results.errors.push({
        type: 'file_stat_error',
        path: fullPath,
        name: fileName,
        message: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }

  _shouldExclude(fullPath, fileName) {
    return this.options.excludePatterns.some(p => {
      if (typeof p === 'string') {
        return fileName.includes(p) || fullPath.includes(p);
      }
      return p.test(fileName) || p.test(fullPath);
    });
  }

  _generateFileId(fullPath, stats) {
    return `${fullPath}:${stats.size}:${stats.mtime.getTime()}`;
  }
}

module.exports = { Scanner };
