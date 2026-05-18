class Logger {
  constructor(verbose = false) {
    this.verbose = verbose;
    this.errors = [];
    this.warnings = [];
    this.stats = {
      totalFiles: 0,
      processedFiles: 0,
      failedFiles: 0,
      totalRecords: 0,
      validRecords: 0,
      invalidRecords: 0
    };
  }

  setVerbose(verbose) {
    this.verbose = verbose;
  }

  info(message, data = null) {
    if (this.verbose) {
      console.log(`[INFO] ${message}`);
      if (data) console.log(JSON.stringify(data, null, 2));
    }
  }

  success(message, data = null) {
    console.log(`✓ ${message}`);
    if (this.verbose && data) console.log(JSON.stringify(data, null, 2));
  }

  warn(message, data = null) {
    this.warnings.push({ message, data });
    console.log(`⚠ ${message}`);
    if (this.verbose && data) console.log(JSON.stringify(data, null, 2));
  }

  error(message, data = null) {
    this.errors.push({ message, data });
    console.error(`✗ ${message}`);
    if (this.verbose && data) console.error(JSON.stringify(data, null, 2));
  }

  recordError(file, lineNumber, reason, record = null) {
    this.errors.push({
      file,
      lineNumber,
      reason,
      record
    });
    this.stats.invalidRecords++;
  }

  recordWarning(file, lineNumber, reason, record = null) {
    this.warnings.push({
      file,
      lineNumber,
      reason,
      record
    });
  }

  incrementFiles(total = 1) {
    this.stats.totalFiles += total;
  }

  incrementProcessedFiles() {
    this.stats.processedFiles++;
  }

  incrementFailedFiles() {
    this.stats.failedFiles++;
  }

  incrementRecords(total = 1) {
    this.stats.totalRecords += total;
  }

  incrementValidRecords() {
    this.stats.validRecords++;
  }

  printSummary() {
    console.log('\n' + '='.repeat(50));
    console.log('处理摘要');
    console.log('='.repeat(50));
    console.log(`文件总数: ${this.stats.totalFiles}`);
    console.log(`成功处理: ${this.stats.processedFiles}`);
    console.log(`处理失败: ${this.stats.failedFiles}`);
    console.log(`记录总数: ${this.stats.totalRecords}`);
    console.log(`有效记录: ${this.stats.validRecords}`);
    console.log(`无效记录: ${this.stats.invalidRecords}`);
    
    if (this.warnings.length > 0) {
      console.log('\n' + '-'.repeat(50));
      console.log(`警告 (${this.warnings.length} 条):`);
      console.log('-'.repeat(50));
      this.warnings.forEach((w, i) => {
        console.log(`${i + 1}. 文件: ${w.file || '未知'}, 行号: ${w.lineNumber || '未知'}`);
        console.log(`   原因: ${w.reason}`);
      });
    }

    if (this.errors.length > 0) {
      console.log('\n' + '-'.repeat(50));
      console.log(`错误 (${this.errors.length} 条):`);
      console.log('-'.repeat(50));
      this.errors.forEach((e, i) => {
        console.log(`${i + 1}. 文件: ${e.file || '未知'}, 行号: ${e.lineNumber || '未知'}`);
        console.log(`   原因: ${e.reason}`);
      });
    }
    console.log('='.repeat(50) + '\n');
  }

  getErrorSummary() {
    return {
      errors: this.errors,
      warnings: this.warnings,
      stats: { ...this.stats }
    };
  }
}

export default new Logger();
