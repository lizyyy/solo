const fs = require('fs');
const path = require('path');
const { glob } = require('glob');
const gzipSize = require('gzip-size');
const { DEPENDENCY_PATTERNS } = require('./config');
const { getRelativePath, logWarning } = require('./utils');

class BundleScanner {
  constructor(config) {
    this.config = config;
    this.anomalies = [];
  }

  async scan() {
    const files = await this.findBuildFiles();
    const chunks = [];
    const modules = [];

    for (const file of files) {
      try {
        const stats = fs.statSync(file);
        const content = fs.readFileSync(file, 'utf-8');
        const gzippedSize = this.config.gzip ? await gzipSize(content) : null;

        const chunk = {
          path: file,
          name: path.basename(file),
          relativePath: getRelativePath(file, this.config.inputDir),
          size: stats.size,
          gzippedSize,
          extension: path.extname(file),
          isSourceMap: file.endsWith('.map')
        };

        chunks.push(chunk);

        if (file.endsWith('.js.map')) {
          const parsedModules = await this.parseSourceMap(file, content);
          modules.push(...parsedModules);
        } else if (file.endsWith('.js')) {
          const jsModules = this.parseJsFile(file, content);
          modules.push(...jsModules);
        }
      } catch (error) {
        this.anomalies.push({
          file,
          type: 'parse_error',
          reason: error.message,
          size: fs.existsSync(file) ? fs.statSync(file).size : 0
        });
      }
    }

    return { chunks, modules, anomalies: this.anomalies };
  }

  async findBuildFiles() {
    const allFiles = [];
    
    for (const pattern of this.config.buildPatterns) {
      try {
        const files = await glob(pattern, {
          cwd: this.config.inputDir,
          absolute: true,
          ignore: this.config.excludePatterns,
          nodir: true
        });
        allFiles.push(...files);
      } catch (e) {
        logWarning(`Pattern ${pattern} 匹配失败: ${e.message}`);
      }
    }

    return [...new Set(allFiles)];
  }

  parseJsFile(filePath, content) {
    const modules = [];
    const size = Buffer.byteLength(content, 'utf-8');
    
    const nodeModulesMatches = content.match(/node_modules[\\/][^\s"']+/g) || [];
    
    const uniquePaths = [...new Set(nodeModulesMatches)];
    
    uniquePaths.forEach(modulePath => {
      const pkgName = this.extractPackageName(modulePath);
      if (pkgName) {
        modules.push({
          path: modulePath,
          name: path.basename(modulePath),
          package: pkgName,
          chunk: path.basename(filePath),
          chunkPath: filePath,
          size: Math.floor(size / uniquePaths.length),
          method: 'heuristic',
          type: 'javascript'
        });
      }
    });

    if (uniquePaths.length === 0) {
      modules.push({
        path: filePath,
        name: path.basename(filePath),
        package: '(application)',
        chunk: path.basename(filePath),
        chunkPath: filePath,
        size,
        method: 'direct',
        type: 'javascript'
      });
    }

    return modules;
  }

  async parseSourceMap(filePath, content) {
    const modules = [];
    
    try {
      const sourceMap = JSON.parse(content);
      
      if (sourceMap.sources && sourceMap.sources.length > 0) {
        sourceMap.sources.forEach((source, index) => {
          const sourcePath = this.normalizeSourcePath(source);
          const pkgName = this.extractPackageName(sourcePath);
          const size = this.estimateModuleSize(sourceMap, index);
          
          modules.push({
            path: sourcePath,
            name: path.basename(sourcePath),
            package: pkgName || '(application)',
            chunk: path.basename(filePath.replace('.map', '')),
            chunkPath: filePath.replace('.map', ''),
            sourceMapPath: filePath,
            size,
            method: 'sourcemap',
            type: 'sourcemap',
            isNodeModule: sourcePath.includes('node_modules')
          });
        });
      }
    } catch (error) {
      this.anomalies.push({
        file: filePath,
        type: 'sourcemap_parse_error',
        reason: `SourceMap解析失败: ${error.message}`,
        size: fs.statSync(filePath).size
      });
    }

    return modules;
  }

  normalizeSourcePath(source) {
    let normalized = source
      .replace(/^webpack:\/\//, '')
      .replace(/^\.\//, '')
      .replace(/\?\w+$/, '');
    
    if (normalized.includes('node_modules')) {
      const idx = normalized.indexOf('node_modules');
      normalized = normalized.slice(idx);
    }
    
    return normalized;
  }

  extractPackageName(modulePath) {
    const match = modulePath.match(DEPENDENCY_PATTERNS.PACKAGE_NAME);
    if (match) {
      return match[1].replace(/[\\/]/g, '/');
    }
    return null;
  }

  estimateModuleSize(sourceMap, index) {
    if (sourceMap.mappings) {
      const mappingChunks = sourceMap.mappings.split(',');
      const avgSize = Math.floor(sourceMap.fileSize / mappingChunks.length);
      return Math.max(avgSize, 100);
    }
    return 1024;
  }
}

module.exports = BundleScanner;
