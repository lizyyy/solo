const fs = require('fs');
const path = require('path');
const imageSize = require('image-size');
const { ValidationError, validateDirectory } = require('./utils');

const IMAGE_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.tif', '.tiff', '.raw', '.cr2', '.nef', '.arw'];

const DEFAULT_CONFIG = {
  photoNumberPattern: /(?:IMG|DSC|IMG_)?(\d{4,8})/i,
  versionPattern: /_v(\d+)/i,
  watermarkPattern: /(wm|watermark|带水印)/i,
  nowatermarkPattern: /(no.?wm|no.?watermark|无水印|高清)/i,
  refinedPattern: /(refined|精修|修图)/i,
  originalPattern: /(original|原片|原图)/i,
  gridPattern: /(grid|九宫格|小红书)/i,
  printPattern: /(print|打印)/i,
  aspectRatio: {
    landscape: { min: 1.2, max: 3.0 },
    portrait: { min: 0.3, max: 0.85 },
    square: { min: 0.95, max: 1.05 }
  }
};

class PhotoScanner {
  constructor(config = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.photos = [];
  }

  scan(directory) {
    validateDirectory(directory, { required: true });
    
    this.photos = [];
    this._scanDirectoryRecursive(directory, directory);
    
    return this.photos;
  }

  _scanDirectoryRecursive(currentDir, rootDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name);
      
      if (entry.isDirectory()) {
        this._scanDirectoryRecursive(fullPath, rootDir);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (IMAGE_EXTENSIONS.includes(ext)) {
          const photoInfo = this._extractPhotoInfo(fullPath, rootDir);
          if (photoInfo) {
            this.photos.push(photoInfo);
          }
        }
      }
    }
  }

  _extractPhotoInfo(filePath, rootDir) {
    const fileName = path.basename(filePath);
    const fileNameWithoutExt = path.basename(filePath, path.extname(filePath));
    const relativePath = path.relative(rootDir, filePath);
    const directoryName = path.dirname(relativePath);
    
    let dimensions;
    try {
      dimensions = imageSize(filePath);
    } catch (error) {
      return null;
    }
    
    const { width, height } = dimensions;
    const aspectRatio = width / height;
    const orientation = this._determineOrientation(aspectRatio);
    
    const stats = fs.statSync(filePath);
    const fileSize = stats.size;
    
    return {
      filePath,
      fileName,
      fileNameWithoutExt,
      relativePath,
      directoryName,
      width,
      height,
      aspectRatio,
      orientation,
      fileSize,
      modifiedTime: stats.mtime.toISOString(),
      photoNumber: this._extractPhotoNumber(fileNameWithoutExt),
      version: this._extractVersion(fileNameWithoutExt),
      hasWatermark: this._checkWatermark(fileNameWithoutExt, directoryName),
      noWatermark: this._checkNoWatermark(fileNameWithoutExt, directoryName),
      isRefined: this._checkRefined(fileNameWithoutExt, directoryName),
      isOriginal: this._checkOriginal(fileNameWithoutExt, directoryName),
      isGrid: this._checkGrid(fileNameWithoutExt, directoryName),
      isPrint: this._checkPrint(fileNameWithoutExt, directoryName),
      category: this._categorizePhoto(fileNameWithoutExt, directoryName)
    };
  }

  _extractPhotoNumber(fileName) {
    const match = fileName.match(this.config.photoNumberPattern);
    return match ? match[1] : null;
  }

  _extractVersion(fileName) {
    const match = fileName.match(this.config.versionPattern);
    return match ? parseInt(match[1], 10) : null;
  }

  _checkWatermark(fileName, directory) {
    return this.config.watermarkPattern.test(fileName) || 
           this.config.watermarkPattern.test(directory);
  }

  _checkNoWatermark(fileName, directory) {
    return this.config.nowatermarkPattern.test(fileName) || 
           this.config.nowatermarkPattern.test(directory);
  }

  _checkRefined(fileName, directory) {
    return this.config.refinedPattern.test(fileName) || 
           this.config.refinedPattern.test(directory);
  }

  _checkOriginal(fileName, directory) {
    return this.config.originalPattern.test(fileName) || 
           this.config.originalPattern.test(directory);
  }

  _checkGrid(fileName, directory) {
    return this.config.gridPattern.test(fileName) || 
           this.config.gridPattern.test(directory);
  }

  _checkPrint(fileName, directory) {
    return this.config.printPattern.test(fileName) || 
           this.config.printPattern.test(directory);
  }

  _determineOrientation(aspectRatio) {
    const { landscape, portrait, square } = this.config.aspectRatio;
    
    if (aspectRatio >= square.min && aspectRatio <= square.max) {
      return 'square';
    } else if (aspectRatio >= landscape.min && aspectRatio <= landscape.max) {
      return 'landscape';
    } else if (aspectRatio >= portrait.min && aspectRatio <= portrait.max) {
      return 'portrait';
    } else {
      return 'other';
    }
  }

  _categorizePhoto(fileName, directory) {
    const categories = [];
    
    if (this._checkGrid(fileName, directory)) {
      categories.push('grid');
    }
    if (this._checkPrint(fileName, directory)) {
      categories.push('print');
    }
    if (this._checkRefined(fileName, directory)) {
      categories.push('refined');
    }
    if (this._checkOriginal(fileName, directory)) {
      categories.push('original');
    }
    
    return categories.length > 0 ? categories : ['uncategorized'];
  }

  getPhotosByNumber() {
    const grouped = {};
    
    for (const photo of this.photos) {
      if (photo.photoNumber) {
        if (!grouped[photo.photoNumber]) {
          grouped[photo.photoNumber] = [];
        }
        grouped[photo.photoNumber].push(photo);
      }
    }
    
    return grouped;
  }

  getPhotosWithoutNumber() {
    return this.photos.filter(photo => !photo.photoNumber);
  }
}

module.exports = PhotoScanner;
