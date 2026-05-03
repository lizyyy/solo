import * as path from 'path';
import * as fs from 'fs/promises';

const DEFAULT_CONFIG = {
  guests: 'data/guests.csv',
  tables: 'data/tables.json',
  output: 'output/',
  rules: {
    enabled: [
      'duplicate_name',
      'table_over_capacity',
      'avoid_conflict',
      'table_not_exist',
      'guest_not_seated',
      'companions_separated',
      'accessibility_issue',
      'children_without_adult',
      'vip_bad_seat',
      'quiet_zone_issue',
      'diet_not_summarized',
      'empty_table',
      'prefer_with',
      'group_seating'
    ],
    disabled: []
  },
  thresholds: {
    maxExitDistanceForMobility: 60,
    maxStageDistanceForVIP: 30,
    maxSpeakerDistanceForQuiet: 40
  },
  export: {
    includeUnseated: true,
    includeNotes: true,
    htmlPrintFormat: 'A4'
  }
};

export class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.configLoaded = false;
  }

  async load(configPath) {
    if (!configPath) {
      const defaultPaths = [
        'seating-config.json',
        '.seating-config.json',
        'config/seating-config.json'
      ];

      for (const p of defaultPaths) {
        try {
          const fullPath = path.resolve(p);
          await fs.access(fullPath);
          configPath = fullPath;
          break;
        } catch (e) {
          // 继续尝试下一个
        }
      }
    }

    if (configPath) {
      try {
        const content = await fs.readFile(configPath, 'utf8');
        const userConfig = JSON.parse(content);
        this.config = this._mergeConfig(DEFAULT_CONFIG, userConfig);
        this.configLoaded = true;
        this.configPath = configPath;
      } catch (error) {
        if (error.code === 'ENOENT') {
          // 文件不存在，使用默认配置
        } else if (error instanceof SyntaxError) {
          throw new Error(`配置文件格式错误: ${configPath} - ${error.message}`);
        } else {
          throw new Error(`加载配置文件失败: ${error.message}`);
        }
      }
    }

    return this.config;
  }

  _mergeConfig(defaultConfig, userConfig) {
    const merged = { ...defaultConfig };

    for (const [key, value] of Object.entries(userConfig)) {
      if (value !== null && value !== undefined) {
        if (typeof value === 'object' && !Array.isArray(value) && 
            typeof defaultConfig[key] === 'object' && !Array.isArray(defaultConfig[key])) {
          merged[key] = this._mergeConfig(defaultConfig[key], value);
        } else {
          merged[key] = value;
        }
      }
    }

    return merged;
  }

  get(key, defaultValue) {
    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value === null || value === undefined) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  getGuestsPath(override) {
    return override || this.config.guests;
  }

  getTablesPath(override) {
    return override || this.config.tables;
  }

  getOutputPath(override) {
    return override || this.config.output;
  }

  isRuleEnabled(ruleName) {
    const enabled = this.get('rules.enabled', []);
    const disabled = this.get('rules.disabled', []);

    if (disabled.includes(ruleName)) {
      return false;
    }
    if (enabled.includes(ruleName) || enabled.includes('*')) {
      return true;
    }
    return true;
  }
}

export const configManager = new ConfigManager();

export default configManager;
