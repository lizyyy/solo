const fs = require('fs');
const path = require('path');

const DEFAULT_CONFIG = {
  requiredColumns: [
    "设备编号",
    "设备名称",
    "设备类型",
    "检修日期",
    "检修人员",
    "检修状态"
  ],
  optionalColumns: {
    "套装编号": "套装设备关联编号",
    "灯泡使用时长": "灯泡累计使用小时数",
    "备注": "其他说明"
  },
  output: {
    normalResult: "normal_inspection_result.csv",
    setMissingItems: "set_missing_items.csv",
    bulbLifeReport: "bulb_life_report.csv",
    rerunOutput: "rerun_needed.csv",
    errors: "processing_errors.csv"
  },
  validation: {
    maxBulbHours: 2000,
    warningBulbHours: 1500,
    duplicateCheckColumns: ["设备编号"]
  },
  encoding: {
    default: "utf-8",
    fallback: ["gbk", "gb2312", "iso-8859-1"]
  }
};

function loadConfig(customConfigPath) {
  let config = { ...DEFAULT_CONFIG };
  
  if (customConfigPath && fs.existsSync(customConfigPath)) {
    try {
      const customConfig = JSON.parse(fs.readFileSync(customConfigPath, 'utf-8'));
      config = deepMerge(config, customConfig);
    } catch (e) {
      console.warn(`警告: 配置文件加载失败，使用默认配置: ${e.message}`);
    }
  } else {
    const defaultConfigPath = path.join(__dirname, '..', 'config', 'default.json');
    if (fs.existsSync(defaultConfigPath)) {
      try {
        const defaultConfig = JSON.parse(fs.readFileSync(defaultConfigPath, 'utf-8'));
        config = deepMerge(config, defaultConfig);
      } catch (e) {
        console.warn(`警告: 默认配置文件加载失败，使用内置默认配置: ${e.message}`);
      }
    }
  }
  
  return config;
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

module.exports = { loadConfig, DEFAULT_CONFIG };
