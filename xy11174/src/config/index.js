const fs = require('fs-extra');
const path = require('path');

const defaultConfig = {
  paths: {
    pdfInput: './input/pdf',
    imageInput: './input/images',
    output: './output'
  },
  rules: {
    pdf: {
      allowedFonts: [
        'Microsoft YaHei',
        'SimSun',
        'PingFang SC',
        'Source Han Sans CN',
        'Arial',
        'Helvetica'
      ],
      fontReplacements: {
        'KaiTi': 'Microsoft YaHei',
        'FangSong': 'SimSun',
        'LiSu': 'Microsoft YaHei',
        'STSong': 'SimSun'
      }
    },
    image: {
      allowedFormats: ['jpeg', 'png', 'webp']
    }
  },
  thresholds: {
    pdf: {
      maxPages: 20,
      maxSizeMB: 5
    },
    image: {
      maxSizeKB: 500,
      minDPI: 300,
      targetWidth: 1200
    }
  }
};

function loadConfig(configPath) {
  const fullPath = path.resolve(configPath);
  
  if (fs.existsSync(fullPath)) {
    try {
      const userConfig = fs.readJsonSync(fullPath);
      return deepMerge(defaultConfig, userConfig);
    } catch (error) {
      console.warn('配置文件读取失败，使用默认配置:', error.message);
      return defaultConfig;
    }
  }
  
  return defaultConfig;
}

function validateConfig(config) {
  const errors = [];
  
  if (!config.rules.pdf.allowedFonts || config.rules.pdf.allowedFonts.length === 0) {
    errors.push('PDF许可字体列表不能为空');
  }
  
  if (!config.rules.image.allowedFormats || config.rules.image.allowedFormats.length === 0) {
    errors.push('图片许可格式列表不能为空');
  }
  
  if (config.thresholds.pdf.maxSizeMB <= 0) {
    errors.push('PDF最大文件大小阈值必须大于0');
  }
  
  if (config.thresholds.image.maxSizeKB <= 0) {
    errors.push('图片最大文件大小阈值必须大于0');
  }
  
  return errors;
}

function deepMerge(target, source) {
  const result = { ...target };
  
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(result[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  
  return result;
}

module.exports = {
  defaultConfig,
  loadConfig,
  validateConfig
};
