const fs = require('fs');
const path = require('path');

class Scanner {
  constructor(options = {}) {
    this.options = {
      csvPattern: options.csvPattern || /\.csv$/i,
      jsonPattern: options.jsonPattern || /\.json$/i,
      edlPattern: options.edlPattern || /\.edl$/i,
      videoExtensions: options.videoExtensions || ['.mp4', '.mov', '.avi', '.mkv', '.mxf', '.prores'],
      audioExtensions: options.audioExtensions || ['.wav', '.aiff', '.mp3', '.aac', '.m4a'],
      imageExtensions: options.imageExtensions || ['.jpg', '.jpeg', '.png', '.tiff', '.tif', '.exr', '.dpx']
    };
  }

  scan(directory) {
    if (!fs.existsSync(directory)) {
      throw new Error(`目录不存在: ${directory}`);
    }

    const result = {
      directory,
      csvFiles: [],
      jsonFiles: [],
      edlFiles: [],
      mediaFiles: [],
      otherFiles: []
    };

    this._scanDirectoryRecursive(directory, result, '');
    return result;
  }

  _scanDirectoryRecursive(directory, result, relativePath) {
    const entries = fs.readdirSync(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      const entryRelativePath = relativePath ? path.join(relativePath, entry.name) : entry.name;

      if (entry.isDirectory()) {
        this._scanDirectoryRecursive(fullPath, result, entryRelativePath);
      } else if (entry.isFile()) {
        this._classifyFile(fullPath, entry.name, entryRelativePath, result);
      }
    }
  }

  _classifyFile(fullPath, name, relativePath, result) {
    const ext = path.extname(name).toLowerCase();

    const fileInfo = {
      name,
      fullPath,
      relativePath,
      size: fs.statSync(fullPath).size,
      extension: ext
    };

    if (this.options.csvPattern.test(name)) {
      result.csvFiles.push(fileInfo);
    } else if (this.options.jsonPattern.test(name)) {
      result.jsonFiles.push(fileInfo);
    } else if (this.options.edlPattern.test(name)) {
      result.edlFiles.push(fileInfo);
    } else if (this._isMediaFile(ext)) {
      result.mediaFiles.push(fileInfo);
    } else {
      result.otherFiles.push(fileInfo);
    }
  }

  _isMediaFile(ext) {
    return this.options.videoExtensions.includes(ext) ||
           this.options.audioExtensions.includes(ext) ||
           this.options.imageExtensions.includes(ext);
  }

  selectFiles(scanResult, options = {}) {
    const {
      csvFile = null,
      jsonFile = null,
      edlFile = null,
      mediaDir = null
    } = options;

    const selected = {
      csv: this._selectFile(scanResult.csvFiles, csvFile, 'CSV'),
      json: this._selectFile(scanResult.jsonFiles, jsonFile, 'JSON'),
      edl: this._selectFile(scanResult.edlFiles, edlFile, 'EDL'),
      media: scanResult.mediaFiles
    };

    if (mediaDir) {
      const mediaDirScan = this.scan(mediaDir);
      selected.media = mediaDirScan.mediaFiles;
    }

    return selected;
  }

  _selectFile(files, explicitPath, fileType) {
    if (explicitPath) {
      if (!fs.existsSync(explicitPath)) {
        throw new Error(`指定的${fileType}文件不存在: ${explicitPath}`);
      }
      return {
        name: path.basename(explicitPath),
        fullPath: explicitPath,
        relativePath: path.basename(explicitPath),
        size: fs.statSync(explicitPath).size,
        extension: path.extname(explicitPath).toLowerCase()
      };
    }

    if (files.length === 0) {
      return null;
    }

    if (files.length === 1) {
      return files[0];
    }

    const keywords = {
      CSV: ['素材', '清单', 'list', 'material', 'inventory'],
      JSON: ['授权', '合同', 'contract', 'authorization', 'license'],
      EDL: ['时间线', 'timeline', 'sequence', 'edit']
    };

    const lowerKeywords = keywords[fileType].map(k => k.toLowerCase());
    const matched = files.find(f => 
      lowerKeywords.some(kw => f.name.toLowerCase().includes(kw))
    );

    return matched || files[0];
  }
}

module.exports = Scanner;
