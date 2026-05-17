import fs from 'fs/promises';
import path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export class FileScanner {
  constructor(options = {}) {
    this.options = {
      followSymlinks: options.followSymlinks || false,
      maxDepth: options.maxDepth || 20,
      excludePatterns: options.excludePatterns || [
        /node_modules/,
        /\.git/,
        /\.DS_Store/
      ]
    };
  }

  async scanDirectory(dirPath, depth = 0) {
    const results = {
      binaries: [],
      errors: [],
      stats: {
        totalFiles: 0,
        scannedFiles: 0,
        binariesFound: 0
      }
    };

    try {
      const entries = await fs.readdir(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (this.shouldExclude(fullPath)) {
          continue;
        }

        if (entry.isDirectory() && depth < this.options.maxDepth) {
          if (entry.isSymbolicLink() && !this.options.followSymlinks) {
            continue;
          }
          const subResults = await this.scanDirectory(fullPath, depth + 1);
          this.mergeResults(results, subResults);
        } else if (entry.isFile() || (entry.isSymbolicLink() && this.options.followSymlinks)) {
          results.stats.totalFiles++;
          const fileInfo = await this.analyzeFile(fullPath);
          if (fileInfo) {
            results.stats.scannedFiles++;
            if (fileInfo.isBinary) {
              results.stats.binariesFound++;
              results.binaries.push(fileInfo);
            }
          }
        }
      }
    } catch (error) {
      results.errors.push({
        path: dirPath,
        error: error.message,
        type: 'directory_read_error'
      });
    }

    return results;
  }

  shouldExclude(filePath) {
    return this.options.excludePatterns.some(pattern => pattern.test(filePath));
  }

  async analyzeFile(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const fileInfo = {
        path: filePath,
        name: path.basename(filePath),
        size: stats.size,
        modified: stats.mtime,
        isBinary: false,
        fileType: 'unknown',
        architectures: [],
        error: null
      };

      if (stats.size === 0) {
        fileInfo.fileType = 'empty';
        return fileInfo;
      }

      const magicBytes = await this.readMagicBytes(filePath);
      fileInfo.isBinary = this.isBinaryFile(magicBytes);
      
      if (fileInfo.isBinary) {
        const machOInfo = await this.analyzeMachO(filePath);
        Object.assign(fileInfo, machOInfo);
      }

      return fileInfo;
    } catch (error) {
      return {
        path: filePath,
        name: path.basename(filePath),
        isBinary: false,
        fileType: 'error',
        error: error.message
      };
    }
  }

  async readMagicBytes(filePath, length = 8) {
    try {
      const buffer = Buffer.alloc(length);
      const fd = await fs.open(filePath, 'r');
      await fd.read(buffer, 0, length, 0);
      await fd.close();
      return buffer;
    } catch {
      return Buffer.alloc(0);
    }
  }

  isBinaryFile(magicBytes) {
    if (magicBytes.length < 4) return false;
    
    const magic = magicBytes.toString('hex', 0, 4);
    
    const binaryMagics = [
      'cffaedfe',
      'cafebabe',
      'cefaedfe',
      'cafebabf',
      '7f454c46',
      'feedface',
      'feedfacf'
    ];
    
    return binaryMagics.includes(magic);
  }

  async analyzeMachO(filePath) {
    try {
      const { stdout } = await execFileAsync('file', ['-b', filePath]);
      const result = {
        fileType: 'unknown',
        architectures: []
      };

      if (stdout.includes('Mach-O')) {
        if (stdout.includes('executable')) {
          result.fileType = 'executable';
        } else if (stdout.includes('dynamically linked shared library')) {
          result.fileType = 'dylib';
        } else if (stdout.includes('bundle')) {
          result.fileType = 'bundle';
        } else {
          result.fileType = 'macho';
        }

        const archMatch = stdout.match(/(x86_64|arm64|i386|ppc64)/g);
        if (archMatch) {
          result.architectures = [...new Set(archMatch)];
        }
      } else if (stdout.includes('universal binary')) {
        result.fileType = 'universal';
        const archMatch = stdout.match(/(x86_64|arm64|i386|ppc64)/g);
        if (archMatch) {
          result.architectures = [...new Set(archMatch)];
        }
      }

      return result;
    } catch {
      return {
        fileType: 'macho_unknown',
        architectures: []
      };
    }
  }

  mergeResults(target, source) {
    target.binaries.push(...source.binaries);
    target.errors.push(...source.errors);
    target.stats.totalFiles += source.stats.totalFiles;
    target.stats.scannedFiles += source.stats.scannedFiles;
    target.stats.binariesFound += source.stats.binariesFound;
  }
}
