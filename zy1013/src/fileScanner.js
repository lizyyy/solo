const fs = require('fs-extra');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

const SUPPORTED_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

class FileScanner {
  static async scanFolder(folderPath) {
    const photos = [];
    const files = await fs.readdir(folderPath);
    
    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (SUPPORTED_EXTENSIONS.includes(ext)) {
        const fullPath = path.join(folderPath, file);
        const photoInfo = await this.getPhotoInfo(fullPath);
        photos.push(photoInfo);
      }
    }
    
    return photos;
  }

  static async getPhotoInfo(filePath) {
    const stats = await fs.stat(filePath);
    const hash = await this.computeFileHash(filePath);
    
    let width, height, format;
    try {
      const metadata = await sharp(filePath).metadata();
      width = metadata.width;
      height = metadata.height;
      format = metadata.format;
    } catch (e) {
      width = 0;
      height = 0;
      format = path.extname(filePath).slice(1).toLowerCase();
    }
    
    return {
      id: this.generateId(),
      filePath: filePath,
      fileName: path.basename(filePath),
      fileSize: stats.size,
      fileSizeFormatted: this.formatFileSize(stats.size),
      createdAt: stats.birthtimeMs,
      modifiedAt: stats.mtimeMs,
      hash: hash,
      width: width,
      height: height,
      format: format,
      thumbnail: null,
      groupId: null,
      isDefect: false,
      isMain: false,
      defectDescription: ''
    };
  }

  static async computeFileHash(filePath) {
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash('md5');
      const stream = fs.createReadStream(filePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  static async generateThumbnail(filePath, width = 200, height = 200) {
    try {
      const buffer = await sharp(filePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        .jpeg({ quality: 80 })
        .toBuffer();
      
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    } catch (e) {
      console.error('Thumbnail generation failed:', e);
      return null;
    }
  }

  static formatFileSize(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  static generateId() {
    return 'photo_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }
}

module.exports = FileScanner;
