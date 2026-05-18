const path = require('path');
const fs = require('fs-extra');
const ExifReader = require('exifreader');
const AdmZip = require('adm-zip');

class PhotoInspector {
  constructor(options) {
    this.logger = options.logger;
    this.inputPath = options.inputPath;
    this.outputDir = options.outputDir || path.join(process.cwd(), 'output');
    this.isPreviewMode = options.preview || false;
    this.resume = options.resume || false;
    
    this.normalDir = path.join(this.outputDir, 'normal');
    this.abnormalDir = path.join(this.outputDir, 'abnormal');
    this.processedRecord = path.join(this.outputDir, '.processed.json');
    
    this.results = {
      timestamp: new Date().toISOString(),
      totalFiles: 0,
      normalCount: 0,
      abnormalCount: 0,
      normalFiles: [],
      abnormalFiles: []
    };
    
    this.processedFiles = this.loadProcessedFiles();
    this.tempDir = path.join(this.outputDir, '.temp');
  }

  loadProcessedFiles() {
    if (fs.existsSync(this.processedRecord)) {
      return fs.readJsonSync(this.processedRecord);
    }
    return {};
  }

  saveProcessedFiles() {
    fs.writeJsonSync(this.processedRecord, this.processedFiles, { spaces: 2 });
  }

  async preview() {
    const files = await this.collectFiles();
    this.logger.info(`发现 ${files.length} 个待处理文件:`);
    files.forEach((file, index) => {
      const filename = typeof file === 'string' ? path.basename(file) : file.filename;
      this.logger.verbose(`${index + 1}. ${filename}`);
    });
    this.logger.success('预览完成，可执行 run 命令进行正式抽检');
  }

  async collectFiles() {
    const files = [];
    
    if (!fs.existsSync(this.inputPath)) {
      throw new Error(`路径不存在: ${this.inputPath}`);
    }

    const stat = fs.statSync(this.inputPath);
    
    if (stat.isDirectory()) {
      await this.collectFromDirectory(this.inputPath, files);
    } else if (this.inputPath.endsWith('.zip')) {
      await this.collectFromZip(this.inputPath, files);
    }

    return files;
  }

  async collectFromDirectory(dir, files) {
    const items = fs.readdirSync(dir);
    for (const item of items) {
      const fullPath = path.join(dir, item);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        await this.collectFromDirectory(fullPath, files);
      } else if (this.isImageFile(item)) {
        files.push(fullPath);
      } else if (item.endsWith('.zip')) {
        const nestedFiles = await this.handleNestedZip(fullPath);
        files.push(...nestedFiles);
      }
    }
  }

  async collectFromZip(zipPath, files) {
    const zip = new AdmZip(zipPath);
    const zipEntries = zip.getEntries();
    
    for (const entry of zipEntries) {
      if (!entry.isDirectory) {
        if (this.isImageFile(entry.name)) {
          files.push({
            type: 'zip',
            zipPath,
            entryName: entry.entryName,
            filename: path.basename(entry.name)
          });
        } else if (entry.name.endsWith('.zip')) {
          const nestedFiles = await this.handleNestedZipInZip(zip, entry);
          files.push(...nestedFiles);
        }
      }
    }
  }

  async handleNestedZip(zipPath) {
    this.logger.warn(`发现嵌套压缩包: ${path.basename(zipPath)}，继续处理内部文件`);
    const files = [];
    
    try {
      const zip = new AdmZip(zipPath);
      const zipEntries = zip.getEntries();
      
      for (const entry of zipEntries) {
        if (!entry.isDirectory && this.isImageFile(entry.name)) {
          files.push({
            type: 'nested-zip',
            zipPath,
            entryName: entry.entryName,
            filename: path.basename(entry.name),
            nestedZip: path.basename(zipPath)
          });
        }
      }
      
      this.processedFiles[path.basename(zipPath)] = {
        status: 'processed',
        reason: '压缩包嵌套，已提取内部图片'
      };
    } catch (error) {
      this.logger.error(`处理嵌套压缩包失败: ${error.message}`);
    }
    
    return files;
  }

  async handleNestedZipInZip(parentZip, entry) {
    this.logger.warn(`发现ZIP内嵌套压缩包: ${entry.name}，继续处理内部文件`);
    const files = [];
    
    try {
      const tempZipPath = path.join(this.tempDir, entry.name);
      fs.ensureDirSync(this.tempDir);
      parentZip.extractEntryTo(entry, this.tempDir, false, true);
      
      const nestedZip = new AdmZip(tempZipPath);
      const nestedEntries = nestedZip.getEntries();
      
      for (const nestedEntry of nestedEntries) {
        if (!nestedEntry.isDirectory && this.isImageFile(nestedEntry.name)) {
          files.push({
            type: 'deep-nested-zip',
            zipPath: tempZipPath,
            entryName: nestedEntry.entryName,
            filename: path.basename(nestedEntry.name),
            nestedZip: entry.name
          });
        }
      }
      
      fs.removeSync(tempZipPath);
    } catch (error) {
      this.logger.error(`处理ZIP内嵌套压缩包失败: ${error.message}`);
    }
    
    return files;
  }

  isImageFile(filename) {
    const ext = path.extname(filename).toLowerCase();
    return ['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext);
  }

  async run() {
    if (!this.isPreviewMode) {
      fs.ensureDirSync(this.normalDir);
      fs.ensureDirSync(this.abnormalDir);
    }

    const files = await this.collectFiles();
    this.results.totalFiles = files.length;
    
    this.logger.info(`开始处理 ${files.length} 个文件...`);
    
    for (const file of files) {
      await this.processFile(file);
    }

    this.saveReport();
    this.saveProcessedFiles();
    
    this.logger.success('');
    this.logger.success('=== 抽检完成 ===');
    this.logger.success(`正常文件: ${this.results.normalCount}`);
    this.logger.success(`异常文件: ${this.results.abnormalCount}`);
    this.logger.success(`报告已保存至: ${path.join(this.outputDir, 'report.json')}`);
  }

  async processFile(file) {
    const filename = typeof file === 'string' ? path.basename(file) : file.filename;
    
    if (this.resume && this.processedFiles[filename]) {
      this.logger.verbose(`跳过已处理文件: ${filename}`);
      return;
    }

    this.logger.verbose(`处理文件: ${filename}`);
    
    try {
      let imageBuffer;
      let sourcePath;
      
      if (typeof file === 'string') {
        imageBuffer = fs.readFileSync(file);
        sourcePath = file;
      } else {
        const zip = new AdmZip(file.zipPath);
        const entry = zip.getEntry(file.entryName);
        imageBuffer = zip.readFile(entry);
        sourcePath = file.zipPath + '!' + file.entryName;
      }

      const timeCheck = await this.checkPhotoTime(filename, imageBuffer);
      
      if (timeCheck.isAbnormal) {
        await this.handleAbnormalFile(file, imageBuffer, timeCheck.reason);
      } else {
        await this.handleNormalFile(file, imageBuffer);
      }
      
      this.processedFiles[filename] = {
        status: 'processed',
        checkedAt: new Date().toISOString()
      };
      
    } catch (error) {
      this.logger.error(`处理文件失败 ${filename}: ${error.message}`);
      this.results.abnormalCount++;
      this.results.abnormalFiles.push({
        filename,
        reason: `处理失败: ${error.message}`
      });
    }
  }

  async checkPhotoTime(filename, imageBuffer) {
    try {
      const tags = ExifReader.load(imageBuffer);
      
      if (!tags.DateTimeOriginal && !tags.CreateDate && !tags.ModifyDate) {
        return {
          isAbnormal: true,
          reason: '图片缺失拍摄时间信息，可能为非现场拍摄照片'
        };
      }

      let photoTime;
      if (tags.DateTimeOriginal) {
        photoTime = new Date(tags.DateTimeOriginal.description);
      } else if (tags.CreateDate) {
        photoTime = new Date(tags.CreateDate.description);
      } else {
        photoTime = new Date(tags.ModifyDate.description);
      }

      const now = new Date();
      const diffDays = (now - photoTime) / (1000 * 60 * 60 * 24);

      if (diffDays > 7) {
        return {
          isAbnormal: true,
          reason: `照片拍摄于 ${photoTime.toLocaleDateString()}，距今天数(${Math.round(diffDays)}天)超过保洁抽检7天有效期，时间错位`
        };
      }

      if (diffDays < 0) {
        return {
          isAbnormal: true,
          reason: `照片拍摄时间(${photoTime.toLocaleDateString()})晚于当前时间，时间异常`
        };
      }

      return { isAbnormal: false, photoTime };
      
    } catch (error) {
      return {
        isAbnormal: true,
        reason: `无法读取照片EXIF信息，可能为篡改或非现场拍摄: ${error.message}`
      };
    }
  }

  async handleNormalFile(file, imageBuffer) {
    const filename = typeof file === 'string' ? path.basename(file) : file.filename;
    
    this.results.normalCount++;
    this.results.normalFiles.push({
      filename,
      status: 'normal'
    });
    
    if (!this.isPreviewMode) {
      const destPath = path.join(this.normalDir, filename);
      fs.writeFileSync(destPath, imageBuffer);
    }
    
    this.logger.verbose(`✓ 正常: ${filename}`);
  }

  async handleAbnormalFile(file, imageBuffer, reason) {
    const filename = typeof file === 'string' ? path.basename(file) : file.filename;
    
    this.results.abnormalCount++;
    this.results.abnormalFiles.push({
      filename,
      reason
    });
    
    if (!this.isPreviewMode) {
      const destPath = path.join(this.abnormalDir, filename);
      fs.writeFileSync(destPath, imageBuffer);
      
      const reasonFile = path.join(this.abnormalDir, `${path.parse(filename).name}.txt`);
      fs.writeFileSync(reasonFile, reason);
    }
    
    this.logger.warn(`⚠ 异常: ${filename} - ${reason}`);
  }

  saveReport() {
    if (!this.isPreviewMode) {
      const reportPath = path.join(this.outputDir, 'report.json');
      fs.writeJsonSync(reportPath, this.results, { spaces: 2 });
    }
  }
}

module.exports = PhotoInspector;
