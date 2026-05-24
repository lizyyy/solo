const fs = require('fs');
const path = require('path');
const config = require('./config');

class InputValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
  }

  validate(options) {
    this.errors = [];
    this.warnings = [];

    this.validateChangelog(options.changelog);
    this.validateOwners(options.owners);
    this.validateRiskWords(options.riskWords);
    this.validateOutputDir(options.outputDir);

    return {
      isValid: this.errors.length === 0,
      errors: this.errors,
      warnings: this.warnings
    };
  }

  validateChangelog(changelogPath) {
    if (!changelogPath) {
      this.errors.push('必须提供变更日志文件路径 (--changelog)');
      return;
    }

    const fullPath = path.resolve(changelogPath);
    if (!fs.existsSync(fullPath)) {
      this.errors.push(`变更日志文件不存在: ${changelogPath}`);
      return;
    }

    const stats = fs.statSync(fullPath);
    const maxSize = config.get('validation.maxChangelogSize');
    if (stats.size > maxSize) {
      this.errors.push(`变更日志文件过大 (${(stats.size / 1024 / 1024).toFixed(2)}MB)，最大允许 ${maxSize / 1024 / 1024}MB`);
    }

    const ext = path.extname(changelogPath).toLowerCase();
    if (ext !== '.md' && ext !== '.markdown') {
      this.warnings.push(`建议使用 Markdown 格式 (.md)，当前格式: ${ext || '无扩展名'}`);
    }
  }

  validateOwners(ownersPath) {
    if (!ownersPath) {
      this.warnings.push('未提供负责人表 (--owners)，将无法关联负责人');
      return;
    }

    const fullPath = path.resolve(ownersPath);
    if (!fs.existsSync(fullPath)) {
      this.errors.push(`负责人表文件不存在: ${ownersPath}`);
      return;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const owners = JSON.parse(content);
      if (typeof owners !== 'object' || Array.isArray(owners)) {
        this.errors.push('负责人表必须是 JSON 对象格式');
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.errors.push(`负责人表 JSON 格式错误: ${e.message}`);
      } else {
        this.errors.push(`读取负责人表失败: ${e.message}`);
      }
    }
  }

  validateRiskWords(riskWordsPath) {
    if (!riskWordsPath) {
      return;
    }

    const fullPath = path.resolve(riskWordsPath);
    if (!fs.existsSync(fullPath)) {
      this.errors.push(`风险词文件不存在: ${riskWordsPath}`);
      return;
    }

    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const riskWords = JSON.parse(content);
      if (!riskWords.high && !riskWords.medium && !riskWords.low) {
        this.warnings.push('风险词文件未定义 high/medium/low 分级，将使用默认配置');
      }
    } catch (e) {
      if (e instanceof SyntaxError) {
        this.errors.push(`风险词文件 JSON 格式错误: ${e.message}`);
      } else {
        this.errors.push(`读取风险词文件失败: ${e.message}`);
      }
    }
  }

  validateOutputDir(outputDir) {
    if (!outputDir) {
      return;
    }

    const fullPath = path.resolve(outputDir);
    if (!fs.existsSync(fullPath)) {
      try {
        fs.mkdirSync(fullPath, { recursive: true });
        this.warnings.push(`输出目录不存在，已自动创建: ${outputDir}`);
      } catch (e) {
        this.errors.push(`无法创建输出目录: ${e.message}`);
      }
    }
  }
}

module.exports = new InputValidator();
