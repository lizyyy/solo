const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const chalk = require('chalk');

class DataStore {
  constructor(configPath) {
    this.configPath = configPath || path.join(process.cwd(), 'config.json');
    this.dataDir = path.join(process.cwd(), 'data');
    this.reportsDir = path.join(process.cwd(), 'reports');
    
    this.ensureDirectories();
    this.loadConfig();
  }

  ensureDirectories() {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.reportsDir)) {
      fs.mkdirSync(this.reportsDir, { recursive: true });
    }
  }

  loadConfig() {
    if (fs.existsSync(this.configPath)) {
      try {
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        console.log(chalk.green('✓ 配置文件加载成功'));
      } catch (error) {
        console.log(chalk.yellow(`⚠ 配置文件读取失败: ${error.message}`));
        this.config = this.getDefaultConfig();
      }
    } else {
      console.log(chalk.yellow('⚠ 未找到配置文件，使用默认配置'));
      this.config = this.getDefaultConfig();
    }
  }

  getDefaultConfig() {
    return {
      project: {
        name: 'default-project',
        description: '默认项目'
      },
      paths: {
        requirements: path.join(this.dataDir, 'requirements.json'),
        testCases: path.join(this.dataDir, 'test-cases.json'),
        sourceCode: ['./src/**/*.js'],
        coverage: path.join(this.dataDir, 'coverage.json'),
        output: this.reportsDir
      },
      mappings: {
        autoMatch: true,
        caseSensitive: false
      }
    };
  }

  saveConfig() {
    fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    console.log(chalk.green('✓ 配置文件已保存'));
  }

  loadRequirements() {
    const filePath = this.config.paths.requirements;
    if (!fs.existsSync(filePath)) {
      return { items: [], lastUpdated: null };
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.log(chalk.red(`✗ 读取需求文件失败: ${error.message}`));
      return { items: [], lastUpdated: null, error: error.message };
    }
  }

  saveRequirements(data) {
    const filePath = this.config.paths.requirements;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.green(`✓ 需求数据已保存到 ${filePath}`));
  }

  loadTestCases() {
    const filePath = this.config.paths.testCases;
    if (!fs.existsSync(filePath)) {
      return { items: [], lastUpdated: null };
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.log(chalk.red(`✗ 读取测试用例文件失败: ${error.message}`));
      return { items: [], lastUpdated: null, error: error.message };
    }
  }

  saveTestCases(data) {
    const filePath = this.config.paths.testCases;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.green(`✓ 测试用例数据已保存到 ${filePath}`));
  }

  loadCoverage() {
    const filePath = this.config.paths.coverage;
    if (!fs.existsSync(filePath)) {
      return { items: [], lastUpdated: null };
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow(`⚠ 读取覆盖数据文件失败: ${error.message}`));
      return { items: [], lastUpdated: null, error: error.message };
    }
  }

  saveCoverage(data) {
    const filePath = this.config.paths.coverage;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.green(`✓ 覆盖数据已保存到 ${filePath}`));
  }

  loadFailures() {
    const filePath = path.join(this.dataDir, 'failures.json');
    if (!fs.existsSync(filePath)) {
      return { items: [], lastUpdated: null };
    }
    try {
      return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
      console.log(chalk.yellow(`⚠ 读取失败项文件失败: ${error.message}`));
      return { items: [], lastUpdated: null, error: error.message };
    }
  }

  saveFailures(data) {
    const filePath = path.join(this.dataDir, 'failures.json');
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    console.log(chalk.green(`✓ 失败项数据已保存到 ${filePath}`));
  }

  addFailure(type, relatedId, description, details = {}) {
    const failures = this.loadFailures();
    const failure = {
      id: uuidv4(),
      type,
      relatedId,
      description,
      timestamp: new Date().toISOString(),
      details
    };
    failures.items.push(failure);
    failures.lastUpdated = failure.timestamp;
    this.saveFailures(failures);
    return failure;
  }

  validateRequirements(items) {
    const errors = [];
    const warnings = [];
    const seenIds = new Set();

    items.forEach((item, index) => {
      if (!item.id) {
        errors.push(`第 ${index + 1} 项缺少 id`);
      } else if (seenIds.has(item.id)) {
        errors.push(`第 ${index + 1} 项 id 重复: ${item.id}`);
      } else {
        seenIds.add(item.id);
      }

      if (!item.title) {
        warnings.push(`第 ${index + 1} 项缺少 title: ${item.id || '未知'}`);
      }

      if (!item.description) {
        warnings.push(`第 ${index + 1} 项缺少 description: ${item.id || '未知'}`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  validateTestCases(items) {
    const errors = [];
    const warnings = [];
    const seenIds = new Set();

    items.forEach((item, index) => {
      if (!item.id) {
        errors.push(`第 ${index + 1} 项缺少 id`);
      } else if (seenIds.has(item.id)) {
        errors.push(`第 ${index + 1} 项 id 重复: ${item.id}`);
      } else {
        seenIds.add(item.id);
      }

      if (!item.title) {
        warnings.push(`第 ${index + 1} 项缺少 title: ${item.id || '未知'}`);
      }

      if (!item.requirements || !Array.isArray(item.requirements) || item.requirements.length === 0) {
        warnings.push(`第 ${index + 1} 项没有关联需求: ${item.id || '未知'}`);
      }
    });

    return { valid: errors.length === 0, errors, warnings };
  }

  mergeRequirements(existing, newItems, options = {}) {
    const { overwrite = false, skipDuplicates = true } = options;
    const merged = new Map();
    const stats = { added: 0, updated: 0, skipped: 0, duplicates: 0 };

    existing.items.forEach(item => {
      merged.set(item.id, { ...item });
    });

    newItems.forEach(item => {
      if (merged.has(item.id)) {
        if (overwrite) {
          merged.set(item.id, { ...merged.get(item.id), ...item });
          stats.updated++;
        } else {
          stats.duplicates++;
          if (!skipDuplicates) {
            stats.updated++;
            merged.set(item.id, { ...merged.get(item.id), ...item });
          }
        }
      } else {
        merged.set(item.id, item);
        stats.added++;
      }
    });

    return {
      items: Array.from(merged.values()),
      lastUpdated: new Date().toISOString(),
      stats
    };
  }

  mergeTestCases(existing, newItems, options = {}) {
    const { overwrite = false, skipDuplicates = true } = options;
    const merged = new Map();
    const stats = { added: 0, updated: 0, skipped: 0, duplicates: 0 };

    existing.items.forEach(item => {
      merged.set(item.id, { ...item });
    });

    newItems.forEach(item => {
      if (merged.has(item.id)) {
        if (overwrite) {
          merged.set(item.id, { ...merged.get(item.id), ...item });
          stats.updated++;
        } else {
          stats.duplicates++;
          if (!skipDuplicates) {
            stats.updated++;
            merged.set(item.id, { ...merged.get(item.id), ...item });
          }
        }
      } else {
        merged.set(item.id, item);
        stats.added++;
      }
    });

    return {
      items: Array.from(merged.values()),
      lastUpdated: new Date().toISOString(),
      stats
    };
  }
}

module.exports = DataStore;
