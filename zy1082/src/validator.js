const { ValidationError } = require('./utils');
const { DEFAULT_MANIFEST } = require('./reader');

const ISSUE_TYPES = {
  MISSING_PHOTO: 'missing_photo',
  EXTRA_PHOTO: 'extra_photo',
  DUPLICATE_NUMBER: 'duplicate_number',
  WRONG_VERSION: 'wrong_version',
  WRONG_WATERMARK: 'wrong_watermark',
  INVALID_ASPECT_RATIO: 'invalid_aspect_ratio',
  NO_NUMBER: 'no_number',
  MULTIPLE_VERSIONS: 'multiple_versions',
  CATEGORY_MISMATCH: 'category_mismatch'
};

const ISSUE_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low'
};

class PhotoValidator {
  constructor(manifest = DEFAULT_MANIFEST) {
    this.manifest = manifest;
  }

  validate(photos, selections, options = {}) {
    const { 
      checkMissing = true,
      checkExtra = true,
      checkDuplicates = true,
      checkVersions = true,
      checkWatermark = true,
      checkAspectRatio = true,
      checkCategories = true
    } = options;

    const issues = [];
    const photosByNumber = this._groupByNumber(photos);
    const selectionNumbers = new Set(selections.map(s => s.photoNumber));
    const photoNumbers = new Set(Object.keys(photosByNumber));

    if (checkMissing) {
      issues.push(...this._checkMissing(photosByNumber, selections));
    }

    if (checkExtra) {
      issues.push(...this._checkExtra(photosByNumber, selectionNumbers));
    }

    if (checkDuplicates) {
      issues.push(...this._checkDuplicates(photosByNumber));
    }

    if (checkVersions) {
      issues.push(...this._checkVersions(photosByNumber, selectionNumbers));
    }

    if (checkWatermark) {
      issues.push(...this._checkWatermark(photosByNumber, selectionNumbers));
    }

    if (checkAspectRatio) {
      issues.push(...this._checkAspectRatio(photosByNumber));
    }

    if (checkCategories) {
      issues.push(...this._checkCategories(photosByNumber, selections));
    }

    issues.push(...this._checkNoNumber(photos));

    return this._buildResult(issues, photos, selections);
  }

  _groupByNumber(photos) {
    const grouped = {};
    
    for (const photo of photos) {
      const number = photo.photoNumber;
      if (number) {
        if (!grouped[number]) {
          grouped[number] = [];
        }
        grouped[number].push(photo);
      }
    }
    
    return grouped;
  }

  _checkMissing(photosByNumber, selections) {
    const issues = [];
    const requiredTypes = this.manifest.requirements.photoTypes.filter(t => t.required);

    for (const selection of selections) {
      const number = selection.photoNumber;
      const photos = photosByNumber[number] || [];

      for (const requiredType of requiredTypes) {
        const matchingPhotos = photos.filter(p => 
          this._matchesPhotoType(p, requiredType)
        );

        if (matchingPhotos.length === 0) {
          issues.push({
            type: ISSUE_TYPES.MISSING_PHOTO,
            severity: ISSUE_SEVERITY.CRITICAL,
            photoNumber: number,
            photoType: requiredType.type,
            photoTypeName: requiredType.name,
            message: `缺少必需的照片类型: ${requiredType.name}`,
            rule: `交付规则要求每个选中的照片必须包含 ${requiredType.name}`,
            suggestion: `请确认编号为 ${number} 的 ${requiredType.name} 是否已存在于交付目录中`,
            files: [],
            selection: selection
          });
        }
      }
    }

    return issues;
  }

  _checkExtra(photosByNumber, selectionNumbers) {
    const issues = [];

    for (const [number, photos] of Object.entries(photosByNumber)) {
      if (!selectionNumbers.has(number)) {
        issues.push({
          type: ISSUE_TYPES.EXTRA_PHOTO,
          severity: ISSUE_SEVERITY.LOW,
          photoNumber: number,
          message: `照片编号不在选片表中: ${number}`,
          rule: '交付目录中只应包含选片表中列出的照片',
          suggestion: `请确认这些照片是否应该被交付，或是误放的文件。如果是误放，请移除以避免混淆。`,
          files: photos.map(p => ({
            filePath: p.filePath,
            fileName: p.fileName,
            relativePath: p.relativePath
          })),
          photoCount: photos.length
        });
      }
    }

    return issues;
  }

  _checkDuplicates(photosByNumber) {
    const issues = [];

    for (const [number, photos] of Object.entries(photosByNumber)) {
      const types = this.manifest.requirements.photoTypes;
      
      for (const photoType of types) {
        const matchingPhotos = photos.filter(p => 
          this._matchesPhotoType(p, photoType)
        );

        if (matchingPhotos.length > 1) {
          const versions = matchingPhotos.map(p => p.version).filter(v => v !== null);
          const hasDistinctVersions = new Set(versions).size > 1;

          if (!hasDistinctVersions || versions.length === 0) {
            issues.push({
              type: ISSUE_TYPES.DUPLICATE_NUMBER,
              severity: ISSUE_SEVERITY.HIGH,
              photoNumber: number,
              photoType: photoType.type,
              photoTypeName: photoType.name,
              message: `同一编号存在多个 ${photoType.name} 文件`,
              rule: `每个照片编号的每种类型应该只有一个最新版本`,
              suggestion: `请检查这些文件，删除重复的旧版本或确认哪个是正确的版本。涉及 ${matchingPhotos.length} 个文件。`,
              files: matchingPhotos.map(p => ({
                filePath: p.filePath,
                fileName: p.fileName,
                relativePath: p.relativePath,
                version: p.version,
                modifiedTime: p.modifiedTime,
                fileSize: p.fileSize
              }))
            });
          }
        }
      }
    }

    return issues;
  }

  _checkVersions(photosByNumber, selectionNumbers) {
    const issues = [];
    const versionRules = this.manifest.requirements.versionRules;

    if (!versionRules.enabled) {
      return issues;
    }

    for (const [number, photos] of Object.entries(photosByNumber)) {
      if (!selectionNumbers.has(number)) continue;

      const types = this.manifest.requirements.photoTypes;
      
      for (const photoType of types) {
        const matchingPhotos = photos.filter(p => 
          this._matchesPhotoType(p, photoType)
        );

        if (matchingPhotos.length <= 1) continue;

        const versions = matchingPhotos
          .map(p => ({ photo: p, version: p.version || 0 }))
          .sort((a, b) => b.version - a.version);

        const latestVersion = versions[0];
        const olderVersions = versions.slice(1);

        if (olderVersions.length > 0) {
          issues.push({
            type: ISSUE_TYPES.MULTIPLE_VERSIONS,
            severity: ISSUE_SEVERITY.MEDIUM,
            photoNumber: number,
            photoType: photoType.type,
            photoTypeName: photoType.name,
            message: `存在多个版本，最新为 v${latestVersion.version}`,
            rule: versionRules.latestVersionOnly 
              ? '只应保留最新版本的照片' 
              : '建议清理旧版本',
            suggestion: versionRules.rejectOlderVersions
              ? `建议删除旧版本文件，只保留最新的 v${latestVersion.version}。旧版本文件: ${olderVersions.map(v => v.photo.fileName).join(', ')}`
              : `确认是否需要保留所有版本，或只保留最新的 v${latestVersion.version}`,
            files: matchingPhotos.map(p => ({
              filePath: p.filePath,
              fileName: p.fileName,
              relativePath: p.relativePath,
              version: p.version,
              isLatest: p.version === latestVersion.version
            })),
            latestVersion: latestVersion.version,
            olderVersions: olderVersions.map(v => v.version)
          });
        }
      }
    }

    return issues;
  }

  _checkWatermark(photosByNumber, selectionNumbers) {
    const issues = [];

    for (const [number, photos] of Object.entries(photosByNumber)) {
      if (!selectionNumbers.has(number)) continue;

      const types = this.manifest.requirements.photoTypes;
      
      for (const photoType of types) {
        if (photoType.watermark === undefined) continue;

        const matchingPhotos = photos.filter(p => 
          this._matchesCategory(p, photoType.categories)
        );

        for (const photo of matchingPhotos) {
          const hasWatermark = photo.hasWatermark;
          const shouldHaveWatermark = photoType.watermark;

          if (hasWatermark !== shouldHaveWatermark) {
            issues.push({
              type: ISSUE_TYPES.WRONG_WATERMARK,
              severity: ISSUE_SEVERITY.HIGH,
              photoNumber: number,
              photoType: photoType.type,
              photoTypeName: photoType.name,
              message: `水印状态不正确: ${hasWatermark ? '带水印' : '无水印'}`,
              rule: `${photoType.name} 应该是 ${shouldHaveWatermark ? '带水印' : '无水印'} 的`,
              suggestion: shouldHaveWatermark
                ? `请为这张照片添加水印: ${photo.fileName}`
                : `请确认这张照片是否应该有水印。如果不需要，请使用无水印版本: ${photo.fileName}`,
              files: [{
                filePath: photo.filePath,
                fileName: photo.fileName,
                relativePath: p.relativePath
              }],
              actualWatermark: hasWatermark,
              expectedWatermark: shouldHaveWatermark
            });
          }
        }
      }
    }

    return issues;
  }

  _checkAspectRatio(photosByNumber) {
    const issues = [];
    const ratioRules = this.manifest.requirements.aspectRatioRules;

    if (!ratioRules.enabled) {
      return issues;
    }

    const allowedOrientations = ratioRules.allowedOrientations || 
      ['landscape', 'portrait', 'square'];

    for (const [number, photos] of Object.entries(photosByNumber)) {
      for (const photo of photos) {
        if (!allowedOrientations.includes(photo.orientation)) {
          issues.push({
            type: ISSUE_TYPES.INVALID_ASPECT_RATIO,
            severity: ISSUE_SEVERITY.MEDIUM,
            photoNumber: number,
            message: `照片比例异常: ${photo.width}x${photo.height} (比例: ${photo.aspectRatio.toFixed(2)})`,
            rule: `允许的照片方向: ${allowedOrientations.join(', ')}。当前为: ${photo.orientation}`,
            suggestion: `请确认这张照片的比例是否正确。如果是特殊尺寸，请检查是否符合交付要求。`,
            files: [{
              filePath: photo.filePath,
              fileName: photo.fileName,
              relativePath: p.relativePath
            }],
            dimensions: {
              width: photo.width,
              height: photo.height,
              aspectRatio: photo.aspectRatio,
              orientation: photo.orientation
            },
            allowedOrientations
          });
        }
      }
    }

    return issues;
  }

  _checkCategories(photosByNumber, selections) {
    const issues = [];
    const selectionMap = new Map(selections.map(s => [s.photoNumber, s]));

    for (const [number, photos] of Object.entries(photosByNumber)) {
      const selection = selectionMap.get(number);
      if (!selection) continue;

      const expectedTypes = selection.types || ['refined'];
      
      for (const photo of photos) {
        const photoCategories = photo.category || ['uncategorized'];
        const hasMatchingCategory = expectedTypes.some(type => 
          photoCategories.includes(type)
        );

        if (!hasMatchingCategory && photoCategories[0] !== 'uncategorized') {
          issues.push({
            type: ISSUE_TYPES.CATEGORY_MISMATCH,
            severity: ISSUE_SEVERITY.MEDIUM,
            photoNumber: number,
            message: `照片分类与选片表要求不符`,
            rule: `选片表要求类型: ${expectedTypes.join(', ')}，照片实际分类: ${photoCategories.join(', ')}`,
            suggestion: `请确认这张照片是否属于正确的分类，或更新选片表中的类型标注。`,
            files: [{
              filePath: photo.filePath,
              fileName: photo.fileName,
              relativePath: p.relativePath
            }],
            expectedTypes,
            actualCategories: photoCategories
          });
        }
      }
    }

    return issues;
  }

  _checkNoNumber(photos) {
    const issues = [];
    const noNumberPhotos = photos.filter(p => !p.photoNumber);

    if (noNumberPhotos.length > 0) {
      issues.push({
        type: ISSUE_TYPES.NO_NUMBER,
        severity: ISSUE_SEVERITY.MEDIUM,
        message: `无法识别编号的照片 (${noNumberPhotos.length} 张)`,
        rule: '所有交付的照片文件名中应包含可识别的照片编号',
        suggestion: `请为这些文件重命名，使其包含照片编号（如 IMG_1234.jpg），以便工具能够正确识别。`,
        files: noNumberPhotos.map(p => ({
          filePath: p.filePath,
          fileName: p.fileName,
          relativePath: p.relativePath
        })),
        count: noNumberPhotos.length
      });
    }

    return issues;
  }

  _matchesPhotoType(photo, photoType) {
    if (!this._matchesCategory(photo, photoType.categories)) {
      return false;
    }

    if (photoType.watermark !== undefined) {
      if (photoType.watermark && !photo.hasWatermark) return false;
      if (!photoType.watermark && photo.hasWatermark) return false;
    }

    return true;
  }

  _matchesCategory(photo, categories) {
    if (!categories || categories.length === 0) return true;
    if (!photo.category || photo.category.length === 0) return false;
    
    return categories.some(cat => photo.category.includes(cat));
  }

  _buildResult(issues, photos, selections) {
    const severityCounts = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0
    };

    for (const issue of issues) {
      severityCounts[issue.severity]++;
    }

    const hasIssues = issues.length > 0;
    const hasCriticalIssues = severityCounts.critical > 0;
    const hasHighIssues = severityCounts.high > 0;

    return {
      success: !hasCriticalIssues && !hasHighIssues,
      summary: {
        totalPhotos: photos.length,
        totalSelections: selections.length,
        totalIssues: issues.length,
        severityCounts,
        hasIssues,
        hasCriticalIssues,
        hasHighIssues
      },
      issues: this._groupIssuesByType(issues),
      allIssues: issues,
      photos,
      selections
    };
  }

  _groupIssuesByType(issues) {
    const grouped = {};
    
    for (const issue of issues) {
      if (!grouped[issue.type]) {
        grouped[issue.type] = [];
      }
      grouped[issue.type].push(issue);
    }
    
    return grouped;
  }
}

module.exports = {
  PhotoValidator,
  ISSUE_TYPES,
  ISSUE_SEVERITY
};
