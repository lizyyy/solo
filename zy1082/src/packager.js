const fs = require('fs');
const path = require('path');
const { ensureDirectory, ValidationError } = require('./utils');
const { ISSUE_SEVERITY } = require('./validator');

const DEFAULT_PACKAGE_CONFIG = {
  outputPattern: '{number}_{type}_{version}.{ext}',
  directoryStructure: {
    refined_watermark: '精修带水印',
    refined_nowatermark: '精修无水印',
    original: '原片',
    grid: '小红书九宫格',
    print: '打印清单'
  },
  flatten: false,
  includeVersion: true,
  copyOnlyLatestVersion: true
};

class PhotoPackager {
  constructor(manifest, options = {}) {
    this.manifest = manifest;
    this.config = { ...DEFAULT_PACKAGE_CONFIG, ...options };
  }

  preview(photos, selections, validationResult, options = {}) {
    const { 
      includeTypes = null,
      excludeTypes = [],
      onlySelected = true,
      dryRun = true
    } = options;

    const photoTypes = this.manifest.requirements.photoTypes;
    const selectionMap = new Map(selections.map(s => [s.photoNumber, s]));

    const plans = [];
    const warnings = [];

    if (validationResult && validationResult.summary.hasCriticalIssues) {
      warnings.push({
        type: 'critical_issues',
        message: '存在严重问题，建议先修复后再打包',
        severity: ISSUE_SEVERITY.CRITICAL
      });
    }

    if (validationResult && validationResult.summary.hasHighIssues) {
      warnings.push({
        type: 'high_issues',
        message: '存在高优先级问题，建议先修复后再打包',
        severity: ISSUE_SEVERITY.HIGH
      });
    }

    const groupedByNumber = this._groupByNumberAndType(photos, photoTypes);

    for (const [number, typeMap] of Object.entries(groupedByNumber)) {
      const selection = selectionMap.get(number);
      
      if (onlySelected && !selection) {
        continue;
      }

      for (const [photoType, photosOfType] of Object.entries(typeMap)) {
        if (excludeTypes.includes(photoType)) {
          continue;
        }
        
        if (includeTypes && !includeTypes.includes(photoType)) {
          continue;
        }

        const typeConfig = photoTypes.find(t => t.type === photoType);
        if (!typeConfig) continue;

        const photosToProcess = this._selectPhotosToProcess(photosOfType);

        for (const photo of photosToProcess) {
          const targetPath = this._generateTargetPath(photo, photoType, typeConfig, number);
          
          plans.push({
            source: {
              filePath: photo.filePath,
              fileName: photo.fileName,
              relativePath: photo.relativePath,
              size: photo.fileSize,
              modifiedTime: photo.modifiedTime
            },
            target: {
              filePath: targetPath,
              fileName: path.basename(targetPath),
              directory: path.dirname(targetPath),
              relativeDir: this.config.flatten ? '' : (this.config.directoryStructure[photoType] || photoType)
            },
            photoNumber: number,
            photoType: photoType,
            photoTypeName: typeConfig.name,
            version: photo.version,
            isLatest: this._isLatestVersion(photo, photosOfType),
            hasWatermark: photo.hasWatermark,
            expectedWatermark: typeConfig.watermark,
            action: 'copy'
          });
        }
      }
    }

    return {
      success: warnings.length === 0,
      totalPlans: plans.length,
      plans,
      warnings,
      summary: this._generatePlanSummary(plans)
    };
  }

  execute(previewResult, outputDir, options = {}) {
    const { confirm = false, overwrite = false } = options;

    if (!previewResult || !previewResult.plans || previewResult.plans.length === 0) {
      throw new ValidationError(
        '没有要执行的打包计划',
        'NO_PLANS_TO_EXECUTE'
      );
    }

    if (previewResult.warnings && previewResult.warnings.length > 0) {
      const criticalWarnings = previewResult.warnings.filter(w => 
        w.severity === ISSUE_SEVERITY.CRITICAL
      );
      
      if (criticalWarnings.length > 0 && !confirm) {
        throw new ValidationError(
          `存在 ${criticalWarnings.length} 个严重问题，需要确认后才能继续执行。请使用 --confirm 选项确认。`,
          'NEEDS_CONFIRMATION',
          { warnings: criticalWarnings }
        );
      }
    }

    ensureDirectory(outputDir);

    const results = {
      success: true,
      totalProcessed: 0,
      totalFailed: 0,
      totalSkipped: 0,
      copiedFiles: [],
      failedFiles: [],
      skippedFiles: []
    };

    for (const plan of previewResult.plans) {
      const targetPath = path.join(outputDir, plan.target.relativeDir, plan.target.fileName);
      
      try {
        if (fs.existsSync(targetPath) && !overwrite) {
          results.skippedFiles.push({
            ...plan,
            targetPath,
            reason: '文件已存在'
          });
          results.totalSkipped++;
          continue;
        }

        const targetDir = path.dirname(targetPath);
        ensureDirectory(targetDir);

        fs.copyFileSync(plan.source.filePath, targetPath);
        
        results.copiedFiles.push({
          ...plan,
          targetPath,
          copiedAt: new Date().toISOString()
        });
        results.totalProcessed++;
        
      } catch (error) {
        results.failedFiles.push({
          ...plan,
          targetPath,
          error: error.message
        });
        results.totalFailed++;
        results.success = false;
      }
    }

    const manifestPath = this._createPackageManifest(results, outputDir);
    results.manifestPath = manifestPath;

    return results;
  }

  _groupByNumberAndType(photos, photoTypes) {
    const grouped = {};

    for (const photo of photos) {
      if (!photo.photoNumber) continue;

      const number = photo.photoNumber;
      if (!grouped[number]) {
        grouped[number] = {};
      }

      for (const photoType of photoTypes) {
        if (this._matchesPhotoType(photo, photoType)) {
          if (!grouped[number][photoType.type]) {
            grouped[number][photoType.type] = [];
          }
          grouped[number][photoType.type].push(photo);
        }
      }
    }

    return grouped;
  }

  _matchesPhotoType(photo, photoType) {
    if (photoType.categories && photoType.categories.length > 0) {
      if (!photo.category || photo.category.length === 0) {
        return false;
      }
      const hasCategory = photoType.categories.some(cat => photo.category.includes(cat));
      if (!hasCategory) return false;
    }

    if (photoType.watermark !== undefined) {
      if (photoType.watermark && !photo.hasWatermark) return false;
      if (!photoType.watermark && photo.hasWatermark) return false;
    }

    return true;
  }

  _selectPhotosToProcess(photosOfType) {
    if (this.config.copyOnlyLatestVersion && photosOfType.length > 1) {
      const sorted = [...photosOfType].sort((a, b) => {
        const versionA = a.version || 0;
        const versionB = b.version || 0;
        if (versionB !== versionA) {
          return versionB - versionA;
        }
        return new Date(b.modifiedTime) - new Date(a.modifiedTime);
      });
      return [sorted[0]];
    }
    return photosOfType;
  }

  _isLatestVersion(photo, photosOfType) {
    if (photosOfType.length <= 1) return true;
    
    const versions = photosOfType.map(p => p.version || 0);
    const maxVersion = Math.max(...versions);
    
    return (photo.version || 0) === maxVersion;
  }

  _generateTargetPath(photo, photoType, typeConfig, number) {
    let pattern = this.config.outputPattern;
    
    const ext = path.extname(photo.fileName);
    const baseName = path.basename(photo.fileName, ext);
    
    pattern = pattern.replace('{number}', number);
    pattern = pattern.replace('{type}', photoType);
    
    if (this.config.includeVersion && photo.version) {
      pattern = pattern.replace('{version}', `v${photo.version}`);
    } else {
      pattern = pattern.replace('_{version}', '').replace('{version}', '');
    }
    
    pattern = pattern.replace('{ext}', ext.substring(1));
    pattern = pattern.replace('{original_name}', baseName);
    
    return pattern;
  }

  _generatePlanSummary(plans) {
    const summary = {
      totalFiles: plans.length,
      byType: {},
      byNumber: new Set(),
      estimatedSize: 0
    };

    for (const plan of plans) {
      if (!summary.byType[plan.photoType]) {
        summary.byType[plan.photoType] = {
          count: 0,
          name: plan.photoTypeName,
          size: 0
        };
      }
      summary.byType[plan.photoType].count++;
      summary.byType[plan.photoType].size += plan.source.size;
      
      summary.byNumber.add(plan.photoNumber);
      summary.estimatedSize += plan.source.size;
    }

    summary.uniqueNumbers = summary.byNumber.size;
    summary.estimatedSizeFormatted = this._formatSize(summary.estimatedSize);

    return summary;
  }

  _formatSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  _createPackageManifest(results, outputDir) {
    const manifest = {
      packageInfo: {
        generatedAt: new Date().toISOString(),
        version: '1.0.0',
        totalFiles: results.totalProcessed,
        totalFailed: results.totalFailed,
        totalSkipped: results.totalSkipped
      },
      files: results.copiedFiles.map(f => ({
        photoNumber: f.photoNumber,
        photoType: f.photoType,
        photoTypeName: f.photoTypeName,
        source: f.source.relativePath,
        target: path.join(f.target.relativeDir, f.target.fileName),
        version: f.version,
        size: f.source.size,
        modifiedTime: f.source.modifiedTime
      }))
    };

    const manifestPath = path.join(outputDir, 'package_manifest.json');
    fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
    
    return manifestPath;
  }
}

module.exports = PhotoPackager;
