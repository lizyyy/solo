const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { ValidationError, validateFile, safeJSONParse } = require('./utils');

const DEFAULT_MANIFEST = {
  version: '1.0.0',
  requirements: {
    photoTypes: [
      {
        type: 'refined_watermark',
        name: '精修带水印',
        description: '用于客户预览的带水印精修图',
        required: true,
        watermark: true,
        categories: ['refined'],
        namingPattern: '{number}_精修_带水印'
      },
      {
        type: 'refined_nowatermark',
        name: '精修无水印',
        description: '用于最终交付的无水印精修图',
        required: true,
        watermark: false,
        categories: ['refined'],
        namingPattern: '{number}_精修_无水印'
      },
      {
        type: 'original',
        name: '原片',
        description: '原始照片文件',
        required: false,
        categories: ['original'],
        namingPattern: '{number}_原片'
      },
      {
        type: 'grid',
        name: '小红书九宫格',
        description: '用于社交媒体的九宫格图片',
        required: false,
        categories: ['grid'],
        namingPattern: '{number}_九宫格'
      },
      {
        type: 'print',
        name: '打印清单',
        description: '用于打印的高清图片',
        required: false,
        categories: ['print'],
        namingPattern: '{number}_打印'
      }
    ],
    aspectRatioRules: {
      enabled: true,
      allowedOrientations: ['landscape', 'portrait', 'square'],
      customRules: []
    },
    versionRules: {
      enabled: true,
      latestVersionOnly: true,
      rejectOlderVersions: true
    }
  },
  naming: {
    outputPattern: '{number}_{type}_{version}.{ext}',
    versionFormat: 'v{number}',
    numberPadding: 4
  }
};

class ManifestReader {
  constructor() {
    this.manifest = null;
  }

  read(manifestPath) {
    validateFile(manifestPath, { required: true, extensions: ['.json'] });
    
    const content = fs.readFileSync(manifestPath, 'utf-8');
    const parsed = safeJSONParse(content, manifestPath);
    
    this.manifest = this._validateAndMerge(parsed);
    
    return this.manifest;
  }

  _validateAndMerge(parsed) {
    const manifest = { ...DEFAULT_MANIFEST, ...parsed };
    
    if (!manifest.requirements || !manifest.requirements.photoTypes) {
      manifest.requirements = manifest.requirements || {};
      manifest.requirements.photoTypes = DEFAULT_MANIFEST.requirements.photoTypes;
    }
    
    this._validatePhotoTypes(manifest.requirements.photoTypes);
    
    return manifest;
  }

  _validatePhotoTypes(photoTypes) {
    for (const [index, type] of photoTypes.entries()) {
      if (!type.type) {
        throw new ValidationError(
          `照片类型配置错误: 第 ${index + 1} 个类型缺少 'type' 字段`,
          'INVALID_MANIFEST',
          { field: 'type', index }
        );
      }
      
      if (!type.name) {
        throw new ValidationError(
          `照片类型配置错误: 类型 '${type.type}' 缺少 'name' 字段`,
          'INVALID_MANIFEST',
          { field: 'name', type: type.type }
        );
      }
    }
  }

  getPhotoType(type) {
    if (!this.manifest) {
      return null;
    }
    
    return this.manifest.requirements.photoTypes.find(t => t.type === type);
  }

  getRequiredPhotoTypes() {
    if (!this.manifest) {
      return [];
    }
    
    return this.manifest.requirements.photoTypes.filter(t => t.required);
  }

  getAllPhotoTypes() {
    if (!this.manifest) {
      return DEFAULT_MANIFEST.requirements.photoTypes;
    }
    
    return this.manifest.requirements.photoTypes;
  }
}

class SelectionsReader {
  constructor() {
    this.selections = [];
    this.headers = [];
  }

  async read(csvPath) {
    validateFile(csvPath, { required: true, extensions: ['.csv'] });
    
    this.selections = [];
    this.headers = [];
    
    return new Promise((resolve, reject) => {
      const results = [];
      
      fs.createReadStream(csvPath, 'utf-8')
        .pipe(csv())
        .on('headers', (headers) => {
          this.headers = headers;
          this._validateHeaders(headers);
        })
        .on('data', (data) => {
          const selection = this._parseSelection(data);
          if (selection) {
            results.push(selection);
          }
        })
        .on('end', () => {
          this.selections = results;
          this._validateSelections();
          resolve(this.selections);
        })
        .on('error', (error) => {
          reject(new ValidationError(
            `CSV 文件读取失败: ${error.message}`,
            'CSV_READ_ERROR',
            { filePath: csvPath }
          ));
        });
    });
  }

  readSync(csvPath) {
    validateFile(csvPath, { required: true, extensions: ['.csv'] });
    
    this.selections = [];
    this.headers = [];
    
    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());
    
    if (lines.length < 2) {
      throw new ValidationError(
        'CSV 文件格式错误: 至少需要包含表头和一行数据',
        'INVALID_CSV',
        { filePath: csvPath }
      );
    }
    
    this.headers = this._parseCsvLine(lines[0]);
    this._validateHeaders(this.headers);
    
    for (let i = 1; i < lines.length; i++) {
      const values = this._parseCsvLine(lines[i]);
      const data = {};
      
      for (let j = 0; j < this.headers.length; j++) {
        data[this.headers[j]] = values[j] || '';
      }
      
      const selection = this._parseSelection(data);
      if (selection) {
        this.selections.push(selection);
      }
    }
    
    this._validateSelections();
    
    return this.selections;
  }

  _parseCsvLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    
    result.push(current.trim());
    return result;
  }

  _validateHeaders(headers) {
    const requiredHeaders = ['编号', '照片编号'];
    const lowerHeaders = headers.map(h => h.toLowerCase().trim());
    
    const hasNumber = lowerHeaders.some(h => 
      ['编号', '照片编号', 'photo number', 'number', 'id'].includes(h)
    );
    
    if (!hasNumber) {
      throw new ValidationError(
        `CSV 表头缺少必需字段: 照片编号。当前表头: ${headers.join(', ')}`,
        'MISSING_CSV_COLUMN',
        { 
          required: ['编号', '照片编号'],
          actual: headers 
        }
      );
    }
  }

  _parseSelection(data) {
    const numberField = this._findNumberField(data);
    if (!numberField || !data[numberField]) {
      return null;
    }
    
    const photoNumber = this._extractNumber(data[numberField]);
    
    if (!photoNumber) {
      return null;
    }
    
    const selection = {
      photoNumber,
      originalValue: data[numberField],
      notes: data['备注'] || data['注释'] || data['notes'] || data['comment'] || '',
      types: this._parseTypes(data),
      rawData: data
    };
    
    return selection;
  }

  _findNumberField(data) {
    const keys = Object.keys(data);
    const numberKeywords = ['编号', '照片编号', 'photo number', 'number', 'id'];
    
    for (const key of keys) {
      const lowerKey = key.toLowerCase().trim();
      if (numberKeywords.some(kw => lowerKey.includes(kw.toLowerCase()))) {
        return key;
      }
    }
    
    return null;
  }

  _extractNumber(value) {
    if (!value) return null;
    
    const strValue = String(value).trim();
    const match = strValue.match(/(\d{4,8})/);
    
    return match ? match[1] : strValue;
  }

  _parseTypes(data) {
    const types = [];
    const typeFields = ['类型', '交付类型', 'type', 'delivery type'];
    
    for (const [key, value] of Object.entries(data)) {
      const lowerKey = key.toLowerCase().trim();
      const isTypeField = typeFields.some(tf => lowerKey.includes(tf.toLowerCase()));
      
      if (isTypeField && value) {
        const typeValue = String(value).toLowerCase().trim();
        
        if (typeValue.includes('精修') || typeValue.includes('refined')) {
          types.push('refined');
        }
        if (typeValue.includes('原片') || typeValue.includes('original')) {
          types.push('original');
        }
        if (typeValue.includes('九宫格') || typeValue.includes('grid')) {
          types.push('grid');
        }
        if (typeValue.includes('打印') || typeValue.includes('print')) {
          types.push('print');
        }
      }
    }
    
    return types.length > 0 ? types : ['refined'];
  }

  _validateSelections() {
    const seenNumbers = new Set();
    const duplicates = [];
    
    for (const selection of this.selections) {
      if (seenNumbers.has(selection.photoNumber)) {
        duplicates.push(selection.photoNumber);
      }
      seenNumbers.add(selection.photoNumber);
    }
    
    if (duplicates.length > 0) {
      throw new ValidationError(
        `选片表中存在重复的照片编号: ${duplicates.join(', ')}`,
        'DUPLICATE_SELECTION',
        { duplicates }
      );
    }
  }

  getPhotoNumbers() {
    return this.selections.map(s => s.photoNumber);
  }

  getSelectionByNumber(number) {
    return this.selections.find(s => s.photoNumber === number);
  }
}

module.exports = {
  ManifestReader,
  SelectionsReader,
  DEFAULT_MANIFEST
};
