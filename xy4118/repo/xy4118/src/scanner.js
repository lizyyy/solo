const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const exifr = require('exifr');
const config = require('./config');

class FileScanner {
  constructor(options = {}) {
    this.config = options.config || config.DEFAULT_CONFIG;
    this.workspaceRoot = options.workspaceRoot || config.getWorkspaceRoot();
  }

  getPath(relativePath) {
    return path.join(this.workspaceRoot, relativePath);
  }

  async scanDirectory(directory, options = {}) {
    const {
      extensions = this.config.validation.allowedExtensions,
      recursive = true
    } = options;

    const files = [];
    const absoluteDir = this.getPath(directory);

    if (!(await fs.pathExists(absoluteDir))) {
      return files;
    }

    const entries = await fs.readdir(absoluteDir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(absoluteDir, entry.name);
      const relativePath = path.relative(this.workspaceRoot, fullPath);

      if (entry.isDirectory() && recursive) {
        const subFiles = await this.scanDirectory(relativePath, options);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (extensions.includes(ext)) {
          files.push(relativePath);
        }
      }
    }

    return files;
  }

  async getFileInfo(filePath) {
    const absolutePath = this.getPath(filePath);
    const stats = await fs.stat(absolutePath);
    
    return {
      path: filePath,
      name: path.basename(filePath),
      extension: path.extname(filePath).toLowerCase(),
      size: stats.size,
      modifiedTime: stats.mtime.toISOString(),
      createdTime: stats.birthtime.toISOString()
    };
  }

  async calculateFileHash(filePath, algorithm = 'sha256') {
    const absolutePath = this.getPath(filePath);
    
    return new Promise((resolve, reject) => {
      const hash = crypto.createHash(algorithm);
      const stream = fs.createReadStream(absolutePath);
      
      stream.on('data', (data) => hash.update(data));
      stream.on('end', () => resolve(hash.digest('hex')));
      stream.on('error', reject);
    });
  }

  async extractEXIF(filePath) {
    const absolutePath = this.getPath(filePath);
    
    try {
      const exif = await exifr.parse(absolutePath, {
        tiff: true,
        xmp: true,
        icc: true,
        iptc: true,
        jfif: true,
        ihdr: true
      });
      
      if (!exif) {
        return null;
      }

      return {
        make: exif.Make || exif.make,
        model: exif.Model || exif.model,
        dateTimeOriginal: exif.DateTimeOriginal || exif.dateTimeOriginal,
        dateTimeDigitized: exif.DateTimeDigitized || exif.dateTimeDigitized,
        exposureTime: exif.ExposureTime || exif.exposureTime,
        fNumber: exif.FNumber || exif.fNumber,
        iso: exif.ISO || exif.iso,
        focalLength: exif.FocalLength || exif.focalLength,
        width: exif.ImageWidth || exif.imageWidth,
        height: exif.ImageHeight || exif.imageHeight,
        orientation: exif.Orientation || exif.orientation
      };
    } catch (error) {
      return null;
    }
  }

  async scanPhotos(photoDirectory) {
    const photoFiles = await this.scanDirectory(photoDirectory);
    const photoInfos = [];

    for (const photoPath of photoFiles) {
      const fileInfo = await this.getFileInfo(photoPath);
      const hash = await this.calculateFileHash(photoPath);
      const exif = await this.extractEXIF(photoPath);

      photoInfos.push({
        ...fileInfo,
        hash,
        exif
      });
    }

    return photoInfos;
  }

  async parseShootingList(csvPath) {
    const csv = require('csv-parser');
    const absolutePath = this.getPath(csvPath);
    
    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(`拍摄清单文件不存在: ${csvPath}`);
    }

    const results = [];
    
    return new Promise((resolve, reject) => {
      fs.createReadStream(absolutePath)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseCollectionCatalog(jsonPath) {
    const absolutePath = this.getPath(jsonPath);
    
    if (!(await fs.pathExists(absolutePath))) {
      throw new Error(`藏品目录文件不存在: ${jsonPath}`);
    }

    const content = await fs.readJson(absolutePath);
    return content;
  }

  async scanStagingArea() {
    const stagingDir = this.config.directories.staging;
    const photos = await this.scanPhotos(stagingDir);
    
    const shootingListPath = path.join(stagingDir, this.config.filenames.shootingList);
    let shootingList = null;
    if (await fs.pathExists(this.getPath(shootingListPath))) {
      shootingList = await this.parseShootingList(shootingListPath);
    }
    
    const catalogPath = path.join(stagingDir, this.config.filenames.collectionCatalog);
    let collectionCatalog = null;
    if (await fs.pathExists(this.getPath(catalogPath))) {
      collectionCatalog = await this.parseCollectionCatalog(catalogPath);
    }

    return {
      photos,
      shootingList,
      collectionCatalog,
      scannedAt: new Date().toISOString()
    };
  }
}

module.exports = {
  FileScanner
};
