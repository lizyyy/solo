const fs = require('fs');
const path = require('path');

const DEFAULT_RULES = {
  phone: {
    name: '手机号',
    pattern: '(?<!\\d)1[3-9]\\d{9}(?!\\d)',
    severity: 'high',
    blockCode: 'BLOCK_PHONE',
    description: '中国大陆手机号，11位数字',
    enabled: true
  },
  idCard: {
    name: '身份证号',
    pattern: '(?<!\\d)(?:\\d{17}[\\dXx]|\\d{15})(?!\\d)',
    severity: 'critical',
    blockCode: 'BLOCK_IDCARD',
    description: '18位或15位身份证号',
    enabled: true
  },
  token: {
    name: '调试Token',
    pattern: '(?:[Tt][Oo][Kk][Ee][Nn]|[Ss][Ee][Cc][Rr][Ee][Tt]|[Kk][Ee][Yy]|[Pp][Aa][Ss][Ss][Ww][Oo][Rr][Dd])\\s*[:=]\\s*["\']?[a-zA-Z0-9_\\-]{8,}["\']?',
    severity: 'critical',
    blockCode: 'BLOCK_TOKEN',
    description: '常见调试 token 模式：token=xxx, secret=xxx 等',
    enabled: true
  },
  email: {
    name: '邮箱',
    pattern: '[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}',
    severity: 'medium',
    blockCode: 'BLOCK_EMAIL',
    description: '电子邮箱地址',
    enabled: true
  }
};

class RuleLoader {
  constructor() {
    this.rules = new Map();
    this.loadedFiles = new Set();
    this.lastModified = new Map();
  }

  loadDefaultRules() {
    for (const [key, rule] of Object.entries(DEFAULT_RULES)) {
      this.rules.set(key, { ...rule, id: key, source: 'default' });
    }
    return {
      success: true,
      loaded: this.rules.size,
      source: 'default'
    };
  }

  loadFromFile(filePath) {
    const fullPath = path.resolve(filePath);
    const isRepeat = this.loadedFiles.has(fullPath);

    if (!fs.existsSync(fullPath)) {
      return {
        success: false,
        error: '文件不存在',
        filePath: fullPath
      };
    }

    const stat = fs.statSync(fullPath);
    const mtime = stat.mtimeMs;
    const hasChanged = isRepeat && this.lastModified.get(fullPath) !== mtime;

    let content;
    try {
      content = fs.readFileSync(fullPath, 'utf-8');
    } catch (e) {
      return {
        success: false,
        error: '文件读取失败',
        filePath: fullPath,
        details: e.message
      };
    }

    let rulesData;
    try {
      rulesData = JSON.parse(content);
    } catch (e) {
      return {
        success: false,
        error: 'JSON 解析失败',
        filePath: fullPath,
        details: e.message
      };
    }

    if (!rulesData || typeof rulesData !== 'object') {
      return {
        success: false,
        error: '规则文件格式错误，应为对象',
        filePath: fullPath
      };
    }

    const added = [];
    const updated = [];
    const invalid = [];
    const disabled = [];

    for (const [key, rule] of Object.entries(rulesData)) {
      if (!rule || typeof rule !== 'object') {
        invalid.push({ key, reason: '规则不是对象' });
        continue;
      }

      if (rule.enabled === false) {
        disabled.push(key);
        this.rules.delete(key);
        continue;
      }

      if (!rule.pattern) {
        invalid.push({ key, reason: '缺少 pattern 字段' });
        continue;
      }

      try {
        new RegExp(rule.pattern);
      } catch (e) {
        invalid.push({ key, reason: `正则表达式无效: ${e.message}` });
        continue;
      }

      const fullRule = {
        id: key,
        name: rule.name || key,
        pattern: rule.pattern,
        severity: rule.severity || 'medium',
        blockCode: rule.blockCode || `BLOCK_${key.toUpperCase()}`,
        description: rule.description || '',
        enabled: rule.enabled !== false,
        source: fullPath
      };

      if (this.rules.has(key)) {
        updated.push(key);
      } else {
        added.push(key);
      }

      this.rules.set(key, fullRule);
    }

    this.loadedFiles.add(fullPath);
    this.lastModified.set(fullPath, mtime);

    return {
      success: true,
      filePath: fullPath,
      isRepeat,
      hasChanged,
      added,
      updated,
      invalid,
      disabled,
      total: this.rules.size
    };
  }

  loadFromDirectory(dirPath) {
    const fullDir = path.resolve(dirPath);

    if (!fs.existsSync(fullDir)) {
      return {
        success: false,
        error: '目录不存在',
        dirPath: fullDir
      };
    }

    const files = fs.readdirSync(fullDir).filter(f => f.endsWith('.json'));
    const results = [];

    for (const file of files) {
      const filePath = path.join(fullDir, file);
      results.push(this.loadFromFile(filePath));
    }

    return {
      success: true,
      dirPath: fullDir,
      files: results,
      total: this.rules.size
    };
  }

  getRules() {
    return Array.from(this.rules.values()).filter(r => r.enabled);
  }

  getRule(id) {
    return this.rules.get(id);
  }

  hasChanged(filePath) {
    const fullPath = path.resolve(filePath);
    if (!this.loadedFiles.has(fullPath)) return true;
    const stat = fs.statSync(fullPath);
    return stat.mtimeMs !== this.lastModified.get(fullPath);
  }
}

module.exports = { RuleLoader, DEFAULT_RULES };
