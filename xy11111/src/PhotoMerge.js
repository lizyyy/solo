const fs = require('fs');
const path = require('path');
const chalk = require('chalk');
const readline = require('readline');

class PhotoMerge {
  constructor(config, options = {}) {
    this.config = config;
    this.options = options;
    this.isPreviewMode = options.preview || false;
    this.configPath = options.configPath;
    
    this.sourceDirs = config.sourceDirs || {};
    this.outputDir = path.resolve(config.outputDir || 'output');
    this.logDir = path.resolve(config.logDir || 'logs');
    this.rules = config.rules || {};
    this.clientInfo = config['客户信息'] || {};
    
    this.plan = [];
    this.logs = [];
    this.processedFiles = new Set();
    this.processedLogPath = path.join(this.logDir, 'processed_files.json');
    
    this.ensureDirs();
    this.loadProcessedFiles();
  }

  ensureDirs() {
    [this.outputDir, this.logDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadProcessedFiles() {
    if (fs.existsSync(this.processedLogPath)) {
      try {
        const data = JSON.parse(fs.readFileSync(this.processedLogPath, 'utf-8'));
        this.processedFiles = new Set(data);
      } catch (e) {
        this.processedFiles = new Set();
      }
    }
  }

  saveProcessedFiles() {
    fs.writeFileSync(
      this.processedLogPath,
      JSON.stringify([...this.processedFiles], null, 2),
      'utf-8'
    );
  }

  normalizeExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    const basename = path.basename(filename, path.extname(filename));
    return basename + ext;
  }

  isAllowedExtension(filename) {
    const ext = path.extname(filename).toLowerCase();
    const allowed = (this.rules.allowedExtensions || []).map(e => e.toLowerCase());
    return allowed.includes(ext);
  }

  generateTargetFilename(sourcePath, photoType, index) {
    let basename = path.basename(sourcePath);
    
    if (this.rules.normalizeExtension) {
      basename = this.normalizeExtension(basename);
    }
    
    const ext = path.extname(basename);
    const pattern = this.config.filenamePattern || '{拍摄日期}_{客户姓名}_{照片类型}_{序号}{扩展名}';
    
    let filename = pattern
      .replace('{拍摄日期}', this.clientInfo['拍摄日期'] || 'UNKNOWN')
      .replace('{客户姓名}', this.clientInfo['客户姓名'] || 'CLIENT')
      .replace('{照片类型}', photoType)
      .replace('{序号}', String(index).padStart(4, '0'))
      .replace('{扩展名}', ext);
    
    filename = filename.replace(/[^a-zA-Z0-9_\u4e00-\u9fa5.-]/g, '_');
    
    const maxLen = this.rules.maxFilenameLength || 100;
    if (filename.length > maxLen) {
      const nameWithoutExt = path.basename(filename, ext);
      filename = nameWithoutExt.substring(0, maxLen - ext.length) + ext;
    }
    
    return filename;
  }

  findUniqueFilename(targetPath) {
    const dir = path.dirname(targetPath);
    const ext = path.extname(targetPath);
    const basename = path.basename(targetPath, ext);
    let counter = 1;
    let newPath = targetPath;
    
    while (fs.existsSync(newPath)) {
      newPath = path.join(dir, `${basename}_${counter}${ext}`);
      counter++;
    }
    
    return { path: newPath, renamed: counter > 1 };
  }

  scanSourceDirs() {
    const files = [];
    
    Object.entries(this.sourceDirs).forEach(([photoType, dirPath]) => {
      const absoluteDir = path.resolve(dirPath);
      
      if (!fs.existsSync(absoluteDir)) {
        this.logs.push({
          type: 'warning',
          message: `目录不存在: ${dirPath}`,
          photoType,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      const dirFiles = fs.readdirSync(absoluteDir)
        .filter(f => !fs.statSync(path.join(absoluteDir, f)).isDirectory());
      
      if (dirFiles.length === 0) {
        this.logs.push({
          type: 'info',
          message: `空目录: ${dirPath}`,
          photoType,
          timestamp: new Date().toISOString()
        });
        return;
      }
      
      dirFiles.forEach((filename, idx) => {
        const sourcePath = path.join(absoluteDir, filename);
        const fileKey = `${photoType}:${filename}`;
        
        let reason = null;
        let skip = false;
        
        if (!this.isAllowedExtension(filename)) {
          reason = `非允许扩展名: ${path.extname(filename)}`;
          skip = true;
        } else if (this.rules.skipProcessed && this.processedFiles.has(fileKey)) {
          reason = '已处理过的文件';
          skip = true;
        }
        
        files.push({
          sourcePath,
          filename,
          photoType,
          index: idx + 1,
          skip,
          reason,
          fileKey
        });
      });
    });
    
    return files;
  }

  buildPlan() {
    this.plan = [];
    const files = this.scanSourceDirs();
    
    let successCount = 0;
    let skipCount = 0;
    
    files.forEach(file => {
      if (file.skip) {
        skipCount++;
        this.plan.push({
          action: 'skip',
          source: file.sourcePath,
          reason: file.reason,
          photoType: file.photoType
        });
      } else {
        successCount++;
        const targetFilename = this.generateTargetFilename(
          file.sourcePath,
          file.photoType,
          file.index
        );
        const targetPath = path.join(this.outputDir, targetFilename);
        const uniqueResult = this.findUniqueFilename(targetPath);
        
        this.plan.push({
          action: 'copy',
          source: file.sourcePath,
          target: uniqueResult.path,
          renamed: uniqueResult.renamed,
          photoType: file.photoType,
          fileKey: file.fileKey
        });
      }
    });
    
    return { successCount, skipCount, total: files.length };
  }

  displayPlan() {
    console.log(chalk.cyan('📁 源目录配置:'));
    Object.entries(this.sourceDirs).forEach(([type, dir]) => {
      console.log(chalk.gray(`   ${type}: ${dir}`));
    });
    console.log(chalk.cyan(`📂 输出目录: ${this.outputDir}`));
    console.log(chalk.cyan(`📝 日志目录: ${this.logDir}`));
    console.log();
    
    console.log(chalk.yellow('👤 客户信息:'));
    Object.entries(this.clientInfo).forEach(([key, value]) => {
      console.log(chalk.gray(`   ${key}: ${value}`));
    });
    console.log();
    
    const { successCount, skipCount, total } = this.buildPlan();
    
    console.log(chalk.blue(`📊 计划汇总: 总计 ${total} 个文件`));
    console.log(chalk.green(`   ✅  将复制: ${successCount} 个文件`));
    console.log(chalk.yellow(`   ⏭️  将跳过: ${skipCount} 个文件`));
    console.log();
    
    if (this.plan.length > 0) {
      console.log(chalk.magenta('📋 详细计划:'));
      console.log();
    }
    
    this.plan.forEach((item, idx) => {
      const num = String(idx + 1).padStart(3, ' ');
      
      if (item.action === 'skip') {
        console.log(
          chalk.yellow(`  ${num}. ⏭️  跳过`) +
          chalk.gray(` ${path.basename(item.source)}`) +
          chalk.yellow(` [${item.reason}]`)
        );
      } else {
        const status = item.renamed ? chalk.magenta('[重命名避免重复]') : '';
        console.log(
          chalk.green(`  ${num}. 📋 复制`) +
          chalk.gray(` ${path.basename(item.source)} `) +
          chalk.cyan(`→ ${path.basename(item.target)} `) +
          status
        );
      }
    });
    
    console.log();
    console.log(chalk.gray(`配置文件: ${this.configPath}`));
  }

  async confirmAction() {
    this.buildPlan();
    this.displayPlan();
    
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
    
    return new Promise(resolve => {
      rl.question(chalk.red.bold('\n⚠️  确认执行以上操作？(yes/N): '), answer => {
        rl.close();
        resolve(answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y');
      });
    });
  }

  async preview() {
    this.displayPlan();
    console.log(chalk.green.bold('\n✅ 预览完成。确认无误后可使用 --run 参数执行正式操作。'));
  }

  executePlan() {
    let copied = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log(chalk.magenta('\n⚡ 开始执行...\n'));
    
    this.plan.forEach((item, idx) => {
      const num = String(idx + 1).padStart(3, ' ');
      
      try {
        if (item.action === 'skip') {
          skipped++;
          console.log(
            chalk.yellow(`  ${num}. ⏭️  跳过`) +
            chalk.gray(` ${path.basename(item.source)}`)
          );
          
          this.logs.push({
            type: 'skip',
            source: item.source,
            reason: item.reason,
            photoType: item.photoType,
            timestamp: new Date().toISOString()
          });
        } else {
          const content = fs.readFileSync(item.source);
          fs.writeFileSync(item.target, content);
          
          this.processedFiles.add(item.fileKey);
          
          copied++;
          const status = item.renamed ? chalk.magenta(' [重命名]') : '';
          console.log(
            chalk.green(`  ${num}. ✅ 已复制`) +
            chalk.gray(` ${path.basename(item.target)}`) +
            status
          );
          
          this.logs.push({
            type: 'copy',
            source: item.source,
            target: item.target,
            renamed: item.renamed,
            photoType: item.photoType,
            timestamp: new Date().toISOString()
          });
        }
      } catch (error) {
        errors++;
        console.log(
          chalk.red(`  ${num}. ❌ 失败`) +
          chalk.gray(` ${path.basename(item.source)}: ${error.message}`)
        );
        
        this.logs.push({
          type: 'error',
          source: item.source,
          error: error.message,
          photoType: item.photoType,
          timestamp: new Date().toISOString()
        });
      }
    });
    
    this.saveProcessedFiles();
    
    return { copied, skipped, errors, total: this.plan.length };
  }

  saveExecutionLog() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const logPath = path.join(this.logDir, `merge_${timestamp}.json`);
    
    const logData = {
      config: this.config,
      plan: this.plan,
      logs: this.logs,
      summary: {
        total: this.plan.length,
        copied: this.logs.filter(l => l.type === 'copy').length,
        skipped: this.logs.filter(l => l.type === 'skip').length,
        errors: this.logs.filter(l => l.type === 'error').length
      },
      executedAt: new Date().toISOString(),
      mode: this.isPreviewMode ? 'preview' : 'run'
    };
    
    fs.writeFileSync(logPath, JSON.stringify(logData, null, 2), 'utf-8');
    return logPath;
  }

  async run() {
    const result = this.executePlan();
    const logPath = this.saveExecutionLog();
    
    console.log();
    console.log(chalk.green.bold('✅ 执行完成！'));
    console.log();
    console.log(chalk.cyan('📊 执行统计:'));
    console.log(chalk.gray(`   总计文件: ${result.total}`));
    console.log(chalk.green(`   成功复制: ${result.copied}`));
    console.log(chalk.yellow(`   跳过文件: ${result.skipped}`));
    if (result.errors > 0) {
      console.log(chalk.red(`   失败文件: ${result.errors}`));
    }
    console.log();
    console.log(chalk.magenta(`📝 详细日志: ${logPath}`));
    console.log(chalk.magenta(`📝 已处理记录: ${this.processedLogPath}`));
  }
}

module.exports = PhotoMerge;
