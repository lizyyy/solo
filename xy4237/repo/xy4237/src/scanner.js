const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');

class Scanner {
  constructor(options = {}) {
    this.options = {
      validExtensions: ['.xlsx', '.xls', '.csv', '.json', '.md', '.txt'],
      fileTypePatterns: {
        props: [/道具|prop|物品|inventory/i],
        lighting: [/灯光|light|cue/i],
        actors: [/演员|actor|出场|入场/i],
        notes: [/备注|note|改动|临时/i]
      },
      ...options
    };
  }

  async scan(directory) {
    if (!await fs.pathExists(directory)) {
      throw new Error(`目录不存在: ${directory}`);
    }

    const files = await this._scanDirectory(directory);
    const categorized = this._categorizeFiles(files);
    
    console.log(chalk.blue(`扫描完成: 找到 ${files.length} 个文件`));
    console.log(chalk.gray(`  道具清单: ${categorized.props.length}`));
    console.log(chalk.gray(`  灯光Cue: ${categorized.lighting.length}`));
    console.log(chalk.gray(`  演员出入场: ${categorized.actors.length}`));
    console.log(chalk.gray(`  临时备注: ${categorized.notes.length}`));

    return files;
  }

  async _scanDirectory(directory) {
    const files = [];
    const entries = await fs.readdir(directory, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(directory, entry.name);
      
      if (entry.isDirectory()) {
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }
        const subFiles = await this._scanDirectory(fullPath);
        files.push(...subFiles);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (this.options.validExtensions.includes(ext)) {
          const stat = await fs.stat(fullPath);
          files.push({
            name: entry.name,
            path: fullPath,
            extension: ext,
            size: stat.size,
            modified: stat.mtime.toISOString(),
            category: this._determineCategory(entry.name)
          });
        }
      }
    }

    return files;
  }

  _determineCategory(filename) {
    const { fileTypePatterns } = this.options;
    
    for (const [category, patterns] of Object.entries(fileTypePatterns)) {
      for (const pattern of patterns) {
        if (pattern.test(filename)) {
          return category;
        }
      }
    }
    
    return 'unknown';
  }

  _categorizeFiles(files) {
    const categorized = {
      props: [],
      lighting: [],
      actors: [],
      notes: [],
      unknown: []
    };

    files.forEach(file => {
      if (categorized[file.category]) {
        categorized[file.category].push(file);
      } else {
        categorized.unknown.push(file);
      }
    });

    return categorized;
  }

  validateFiles(files) {
    const issues = [];
    const warnings = [];

    // 检查必须的文件类型
    const categories = this._categorizeFiles(files);
    
    // 道具清单是必须的
    if (categories.props.length === 0) {
      issues.push({
        type: 'error',
        message: '未找到道具清单文件（文件名应包含"道具"、"prop"或"inventory"）',
        category: 'scanning'
      });
    }

    // 检查文件大小
    files.forEach(file => {
      if (file.size === 0) {
        issues.push({
          type: 'error',
          message: `文件为空: ${file.name}`,
          category: 'scanning',
          file: file.path
        });
      }
    });

    // 检查是否有太多未分类文件
    if (categories.unknown.length > 2) {
      warnings.push({
        type: 'warning',
        message: `有 ${categories.unknown.length} 个文件无法识别类型，请确认是否需要处理`,
        category: 'scanning',
        files: categories.unknown.map(f => f.name)
      });
    }

    return { issues, warnings };
  }
}

module.exports = Scanner;
