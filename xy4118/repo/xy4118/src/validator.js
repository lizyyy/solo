const path = require('path');
const _ = require('lodash');
const moment = require('moment');
const config = require('./config');

const VALIDATION_RULES = {
  FILENAME_FORMAT: 'filename_format',
  FILENAME_UNIQUENESS: 'filename_uniqueness',
  COLLECTION_ID_EXISTS: 'collection_id_exists',
  COLLECTION_ID_FORMAT: 'collection_id_format',
  EXIF_TIME_VALID: 'exif_time_valid',
  EXIF_TIME_CONSISTENCY: 'exif_time_consistency',
  DUPLICATE_HASH: 'duplicate_hash',
  SHOOTING_LIST_MATCH: 'shooting_list_match',
  PHOTO_COUNT_LIMIT: 'photo_count_limit',
  EXTENSION_VALID: 'extension_valid'
};

const RULE_SEVERITY = {
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

class Validator {
  constructor(options = {}) {
    this.config = options.config || config.DEFAULT_CONFIG;
    this.workspaceRoot = options.workspaceRoot || config.getWorkspaceRoot();
  }

  getPath(relativePath) {
    return path.join(this.workspaceRoot, relativePath);
  }

  createValidationResult(rule, passed, severity, message, context = {}) {
    return {
      rule,
      passed,
      severity,
      message,
      context,
      timestamp: new Date().toISOString()
    };
  }

  validateExtension(photo) {
    const allowedExtensions = this.config.validation.allowedExtensions;
    const ext = photo.extension.toLowerCase();
    const isValid = allowedExtensions.includes(ext);

    return this.createValidationResult(
      VALIDATION_RULES.EXTENSION_VALID,
      isValid,
      RULE_SEVERITY.ERROR,
      isValid 
        ? `文件扩展名 ${ext} 有效` 
        : `文件扩展名 ${ext} 不在允许列表中: ${allowedExtensions.join(', ')}`,
      { photo: photo.path, extension: ext }
    );
  }

  validateFilenameFormat(photo) {
    const nameWithoutExt = path.basename(photo.name, photo.extension);
    const idPattern = this.config.validation.collectionIdPattern;
    const regex = new RegExp(idPattern);
    
    const hasCollectionId = regex.test(nameWithoutExt);
    
    return this.createValidationResult(
      VALIDATION_RULES.FILENAME_FORMAT,
      hasCollectionId,
      RULE_SEVERITY.ERROR,
      hasCollectionId 
        ? `文件名 ${photo.name} 包含有效的馆藏号` 
        : `文件名 ${photo.name} 不符合馆藏号格式要求 (${idPattern})`,
      { photo: photo.path, filename: photo.name }
    );
  }

  validateCollectionIdFormat(photo, collectionId) {
    const idPattern = this.config.validation.collectionIdPattern;
    const regex = new RegExp(idPattern);
    const isValid = regex.test(collectionId);

    return this.createValidationResult(
      VALIDATION_RULES.COLLECTION_ID_FORMAT,
      isValid,
      RULE_SEVERITY.ERROR,
      isValid 
        ? `馆藏号 ${collectionId} 格式有效` 
        : `馆藏号 ${collectionId} 格式无效 (期望: ${idPattern})`,
      { photo: photo.path, collectionId }
    );
  }

  validateCollectionIdExists(photo, collectionId, collectionCatalog) {
    if (!collectionCatalog || !collectionCatalog.items) {
      return this.createValidationResult(
        VALIDATION_RULES.COLLECTION_ID_EXISTS,
        true,
        RULE_SEVERITY.WARNING,
        '无藏品目录，跳过馆藏号存在性校验',
        { photo: photo.path, collectionId }
      );
    }

    const exists = collectionCatalog.items.some(item => item.id === collectionId);
    
    return this.createValidationResult(
      VALIDATION_RULES.COLLECTION_ID_EXISTS,
      exists,
      RULE_SEVERITY.ERROR,
      exists 
        ? `馆藏号 ${collectionId} 在藏品目录中存在` 
        : `馆藏号 ${collectionId} 在藏品目录中不存在`,
      { photo: photo.path, collectionId }
    );
  }

  validateExifTimeValid(photo) {
    if (!photo.exif || !photo.exif.dateTimeOriginal) {
      return this.createValidationResult(
        VALIDATION_RULES.EXIF_TIME_VALID,
        false,
        RULE_SEVERITY.WARNING,
        `照片 ${photo.name} 缺少 EXIF 拍摄时间`,
        { photo: photo.path }
      );
    }

    const exifTime = moment(photo.exif.dateTimeOriginal);
    const isValid = exifTime.isValid();

    return this.createValidationResult(
      VALIDATION_RULES.EXIF_TIME_VALID,
      isValid,
      RULE_SEVERITY.WARNING,
      isValid 
        ? `EXIF 拍摄时间有效: ${exifTime.format()}` 
        : `EXIF 拍摄时间格式无效`,
      { photo: photo.path, exifTime: photo.exif.dateTimeOriginal }
    );
  }

  validateExifTimeConsistency(photos) {
    const results = [];
    
    const photosWithExif = photos.filter(p => p.exif && p.exif.dateTimeOriginal);
    
    if (photosWithExif.length < 2) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.EXIF_TIME_CONSISTENCY,
        true,
        RULE_SEVERITY.INFO,
        '照片数量不足，跳过 EXIF 时间一致性校验',
        {}
      ));
      return results;
    }

    const toleranceMinutes = this.config.validation.exifTimeToleranceMinutes;
    const times = photosWithExif.map(p => ({
      photo: p,
      time: moment(p.exif.dateTimeOriginal)
    }));

    times.sort((a, b) => a.time - b.time);
    const firstTime = times[0].time;
    const lastTime = times[times.length - 1].time;
    const diffMinutes = lastTime.diff(firstTime, 'minutes');

    if (diffMinutes > toleranceMinutes * 60) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.EXIF_TIME_CONSISTENCY,
        false,
        RULE_SEVERITY.WARNING,
        `照片拍摄时间跨度较大 (${diffMinutes} 分钟)，首次: ${firstTime.format()}，最后: ${lastTime.format()}`,
        { 
          firstPhoto: times[0].photo.path,
          lastPhoto: times[times.length - 1].photo.path,
          diffMinutes
        }
      ));
    } else {
      results.push(this.createValidationResult(
        VALIDATION_RULES.EXIF_TIME_CONSISTENCY,
        true,
        RULE_SEVERITY.INFO,
        `照片拍摄时间跨度合理 (${diffMinutes} 分钟)`,
        { diffMinutes }
      ));
    }

    return results;
  }

  validateDuplicateHash(photos) {
    const results = [];
    const hashMap = new Map();

    for (const photo of photos) {
      if (!hashMap.has(photo.hash)) {
        hashMap.set(photo.hash, []);
      }
      hashMap.get(photo.hash).push(photo);
    }

    for (const [hash, photoList] of hashMap) {
      if (photoList.length > 1) {
        const paths = photoList.map(p => p.path);
        results.push(this.createValidationResult(
          VALIDATION_RULES.DUPLICATE_HASH,
          false,
          RULE_SEVERITY.ERROR,
          `发现 ${photoList.length} 个重复文件 (哈希: ${hash.substring(0, 12)}...): ${paths.join(', ')}`,
          { hash, photos: paths, count: photoList.length }
        ));
      }
    }

    if (results.length === 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.DUPLICATE_HASH,
        true,
        RULE_SEVERITY.INFO,
        '未发现重复文件',
        { totalPhotos: photos.length }
      ));
    }

    return results;
  }

  validateFilenameUniqueness(photos) {
    const results = [];
    const nameMap = new Map();

    for (const photo of photos) {
      if (!nameMap.has(photo.name)) {
        nameMap.set(photo.name, []);
      }
      nameMap.get(photo.name).push(photo);
    }

    for (const [name, photoList] of nameMap) {
      if (photoList.length > 1) {
        const paths = photoList.map(p => p.path);
        results.push(this.createValidationResult(
          VALIDATION_RULES.FILENAME_UNIQUENESS,
          false,
          RULE_SEVERITY.ERROR,
          `发现文件名冲突: ${name} 出现在 ${paths.join(', ')}`,
          { filename: name, photos: paths }
        ));
      }
    }

    if (results.length === 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.FILENAME_UNIQUENESS,
        true,
        RULE_SEVERITY.INFO,
        '所有文件名唯一',
        { totalPhotos: photos.length }
      ));
    }

    return results;
  }

  validateShootingListMatch(photos, shootingList) {
    const results = [];
    
    if (!shootingList || shootingList.length === 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.SHOOTING_LIST_MATCH,
        true,
        RULE_SEVERITY.WARNING,
        '无拍摄清单，跳过清单匹配校验',
        {}
      ));
      return results;
    }

    const idPattern = this.config.validation.collectionIdPattern;
    const regex = new RegExp(idPattern);
    
    const photoCollectionIds = new Set();
    for (const photo of photos) {
      const nameWithoutExt = path.basename(photo.name, photo.extension);
      const match = nameWithoutExt.match(idPattern);
      if (match) {
        photoCollectionIds.add(match[0]);
      }
    }

    const listCollectionIds = new Set();
    for (const item of shootingList) {
      const id = item.id || item.collectionId || item.馆藏号 || item['藏品编号'];
      if (id) {
        listCollectionIds.add(id);
      }
    }

    const inListNotInPhotos = [...listCollectionIds].filter(id => !photoCollectionIds.has(id));
    const inPhotosNotInList = [...photoCollectionIds].filter(id => !listCollectionIds.has(id));

    if (inListNotInPhotos.length > 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.SHOOTING_LIST_MATCH,
        false,
        RULE_SEVERITY.WARNING,
        `拍摄清单中有但照片中缺少的馆藏号: ${inListNotInPhotos.join(', ')}`,
        { missingIds: inListNotInPhotos }
      ));
    }

    if (inPhotosNotInList.length > 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.SHOOTING_LIST_MATCH,
        false,
        RULE_SEVERITY.WARNING,
        `照片中有但拍摄清单中没有的馆藏号: ${inPhotosNotInList.join(', ')}`,
        { unexpectedIds: inPhotosNotInList }
      ));
    }

    if (results.length === 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.SHOOTING_LIST_MATCH,
        true,
        RULE_SEVERITY.INFO,
        `照片馆藏号与拍摄清单完全匹配`,
        { matchedIds: [...photoCollectionIds] }
      ));
    }

    return results;
  }

  validatePhotoCountLimit(photos) {
    const results = [];
    const idPattern = this.config.validation.collectionIdPattern;
    const maxPhotos = this.config.validation.maxPhotosPerItem;
    const countMap = new Map();

    for (const photo of photos) {
      const nameWithoutExt = path.basename(photo.name, photo.extension);
      const match = nameWithoutExt.match(idPattern);
      if (match) {
        const collectionId = match[0];
        if (!countMap.has(collectionId)) {
          countMap.set(collectionId, []);
        }
        countMap.get(collectionId).push(photo);
      }
    }

    for (const [collectionId, photoList] of countMap) {
      if (photoList.length > maxPhotos) {
        results.push(this.createValidationResult(
          VALIDATION_RULES.PHOTO_COUNT_LIMIT,
          false,
          RULE_SEVERITY.WARNING,
          `馆藏号 ${collectionId} 的照片数量 (${photoList.length}) 超过限制 (${maxPhotos})`,
          { collectionId, count: photoList.length, limit: maxPhotos }
        ));
      }
    }

    if (results.length === 0) {
      results.push(this.createValidationResult(
        VALIDATION_RULES.PHOTO_COUNT_LIMIT,
        true,
        RULE_SEVERITY.INFO,
        '所有藏品的照片数量均在限制范围内',
        { totalCollections: countMap.size, limit: maxPhotos }
      ));
    }

    return results;
  }

  extractCollectionIdFromFilename(filename) {
    const idPattern = this.config.validation.collectionIdPattern;
    const regex = new RegExp(idPattern);
    const nameWithoutExt = path.basename(filename, path.extname(filename));
    const match = nameWithoutExt.match(regex);
    return match ? match[0] : null;
  }

  async validateAll(scanResult) {
    const { photos, shootingList, collectionCatalog } = scanResult;
    const allResults = [];
    const photoResults = new Map();

    for (const photo of photos) {
      const photoId = photo.path;
      if (!photoResults.has(photoId)) {
        photoResults.set(photoId, []);
      }

      photoResults.get(photoId).push(this.validateExtension(photo));
      photoResults.get(photoId).push(this.validateFilenameFormat(photo));

      const collectionId = this.extractCollectionIdFromFilename(photo.name);
      if (collectionId) {
        photoResults.get(photoId).push(this.validateCollectionIdFormat(photo, collectionId));
        photoResults.get(photoId).push(this.validateCollectionIdExists(photo, collectionId, collectionCatalog));
      }

      photoResults.get(photoId).push(this.validateExifTimeValid(photo));
    }

    for (const [photoPath, results] of photoResults) {
      allResults.push(...results);
    }

    allResults.push(...this.validateFilenameUniqueness(photos));
    allResults.push(...this.validateDuplicateHash(photos));
    allResults.push(...this.validateExifTimeConsistency(photos));
    allResults.push(...this.validateShootingListMatch(photos, shootingList));
    allResults.push(...this.validatePhotoCountLimit(photos));

    const errors = allResults.filter(r => !r.passed && r.severity === RULE_SEVERITY.ERROR);
    const warnings = allResults.filter(r => !r.passed && r.severity === RULE_SEVERITY.WARNING);
    const passed = allResults.filter(r => r.passed);

    return {
      isValid: errors.length === 0,
      total: allResults.length,
      errors: errors.length,
      warnings: warnings.length,
      passed: passed.length,
      results: allResults,
      validatedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  Validator,
  VALIDATION_RULES,
  RULE_SEVERITY
};
