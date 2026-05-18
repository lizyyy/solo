const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const _ = require('lodash');
const PDFAnalyzer = require('./analyzers/pdf-analyzer');
const ImageAnalyzer = require('./analyzers/image-analyzer');
const { generateFixSuggestions, generateSummary } = require('./utils/report-generator');
const SampleData = require('./sample/data');

class GiftCompare {
  constructor(config, logger, options) {
    this.config = config;
    this.logger = logger;
    this.options = options;
    this.pdfAnalyzer = new PDFAnalyzer(config, logger);
    this.imageAnalyzer = new ImageAnalyzer(config, logger);
    this.results = {
      pdfIssues: [],
      imageIssues: [],
      summary: {},
      fixSuggestions: []
    };
  }

  async initialize() {
    this.logger.debug('初始化比对器...');
    
    if (this.config.sampleMode) {
      this.logger.debug('使用样例数据模式');
      this.sampleData = new SampleData(this.logger);
      await this.sampleData.generate();
    }
    
    this.logger.debug('比对器初始化完成');
  }

  async run() {
    this.logger.info('开始稿件比对...');
    
    const tasks = [];
    
    if (!this.options.imageOnly) {
      tasks.push(this.analyzePDF());
    }
    
    if (!this.options.pdfOnly) {
      tasks.push(this.analyzeImages());
    }
    
    await Promise.all(tasks);
    
    this.results.fixSuggestions = generateFixSuggestions(this.results);
    this.results.summary = generateSummary(this.results);
    
    return this.results;
  }

  async analyzePDF() {
    this.logger.section('PDF字体替换检测');
    
    let pdfFiles;
    
    if (this.config.sampleMode) {
      pdfFiles = this.sampleData.getPDFFiles();
    } else {
      const pdfDir = this.config.paths.pdfInput;
      pdfFiles = await this.getFilesByExt(pdfDir, ['.pdf']);
    }
    
    this.logger.info(`发现 ${pdfFiles.length} 个PDF文件`);
    
    for (const pdfFile of pdfFiles) {
      this.logger.debug(`分析: ${path.basename(pdfFile)}`);
      const issues = await this.pdfAnalyzer.analyze(pdfFile);
      this.results.pdfIssues.push(...issues);
      
      issues.forEach(issue => {
        const status = issue.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');
        this.logger[issue.severity === 'error' ? 'error' : 'warn'](
          `${status} ${path.basename(pdfFile)}: ${issue.message}`
        );
      });
    }
    
    this.logger.info(`PDF检测完成，发现 ${this.results.pdfIssues.length} 个问题`);
  }

  async analyzeImages() {
    this.logger.section('图片压缩检测');
    
    let imageFiles;
    
    if (this.config.sampleMode) {
      imageFiles = this.sampleData.getImageFiles();
    } else {
      const imageDir = this.config.paths.imageInput;
      imageFiles = await this.getFilesByExt(imageDir, ['.jpg', '.jpeg', '.png', '.gif', '.webp']);
    }
    
    this.logger.info(`发现 ${imageFiles.length} 个图片文件`);
    
    for (const imageFile of imageFiles) {
      this.logger.debug(`分析: ${path.basename(imageFile)}`);
      const issues = await this.imageAnalyzer.analyze(imageFile);
      this.results.imageIssues.push(...issues);
      
      issues.forEach(issue => {
        const status = issue.severity === 'error' ? chalk.red('✗') : chalk.yellow('⚠');
        this.logger[issue.severity === 'error' ? 'error' : 'warn'](
          `${status} ${path.basename(imageFile)}: ${issue.message}`
        );
      });
    }
    
    this.logger.info(`图片检测完成，发现 ${this.results.imageIssues.length} 个问题`);
  }

  async getFilesByExt(dir, extensions) {
    if (!await fs.pathExists(dir)) {
      return [];
    }
    
    const files = await fs.readdir(dir);
    return files
      .filter(f => extensions.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(dir, f));
  }

  printSummary(results) {
    console.log('\n' + chalk.cyan('='.repeat(60)));
    console.log(chalk.cyan.bold('           企业礼品仓礼品稿件比对 - 异常摘要'));
    console.log(chalk.cyan('='.repeat(60)) + '\n');
    
    const { summary } = results;
    
    console.log(chalk.white.bold('【检测概览】'));
    console.log(chalk.gray(`  检测时间: ${new Date().toLocaleString('zh-CN')}`));
    console.log(chalk.gray(`  运行模式: ${this.options.preview ? '预览模式' : '正式模式'}`));
    console.log();
    
    console.log(chalk.white.bold('【PDF字体替换检测】'));
    console.log(`  检测文件数: ${summary.pdf.totalFiles}`);
    console.log(`  发现问题: ${chalk.red(summary.pdf.errors + summary.pdf.warnings + summary.pdf.infos)} 个`);
    console.log(`    - 错误: ${chalk.red(summary.pdf.errors)}`);
    console.log(`    - 警告: ${chalk.yellow(summary.pdf.warnings)}`);
    console.log(`    - 信息: ${chalk.blue(summary.pdf.infos)}`);
    console.log();
    
    console.log(chalk.white.bold('【图片压缩检测】'));
    console.log(`  检测文件数: ${summary.image.totalFiles}`);
    console.log(`  发现问题: ${chalk.red(summary.image.errors + summary.image.warnings + summary.image.infos)} 个`);
    console.log(`    - 错误: ${chalk.red(summary.image.errors)}`);
    console.log(`    - 警告: ${chalk.yellow(summary.image.warnings)}`);
    console.log(`    - 信息: ${chalk.blue(summary.image.infos)}`);
    console.log();
    
    console.log(chalk.white.bold('【修复建议摘要】'));
    const suggestionGroups = _.groupBy(results.fixSuggestions, 'category');
    Object.entries(suggestionGroups).forEach(([category, suggestions]) => {
      console.log(`  ${chalk.yellow(category)}: ${suggestions.length} 条建议`);
    });
    console.log();
    
    console.log(chalk.white.bold('【可复跑输出】'));
    console.log(chalk.gray('  本次检测结果已标记时间戳，支持重复运行进行增量比对'));
    console.log(chalk.gray(`  运行标识: ${this.getRunId()}`));
    console.log();
    
    if (results.fixSuggestions.length > 0) {
      console.log(chalk.white.bold('【详细修复建议】'));
      results.fixSuggestions.forEach((suggestion, idx) => {
        console.log(`\n  ${idx + 1}. ${chalk.yellow(suggestion.title)}`);
        console.log(`     分类: ${suggestion.category}`);
        console.log(`     建议: ${suggestion.suggestion}`);
        console.log(`     影响文件: ${suggestion.files.join(', ')}`);
        if (suggestion.action) {
          console.log(`     执行动作: ${chalk.green(suggestion.action)}`);
        }
      });
    }
    
    console.log('\n' + chalk.cyan('='.repeat(60)));
  }

  async writeResults(results, outputDir) {
    await fs.ensureDir(outputDir);
    
    const runId = this.getRunId();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    
    const summaryFile = path.join(outputDir, `comparison-summary-${timestamp}.json`);
    await fs.writeJson(summaryFile, {
      runId,
      timestamp: new Date().toISOString(),
      mode: this.options.preview ? 'preview' : 'formal',
      config: _.pick(this.config, ['rules', 'thresholds']),
      results: this.sanitizeResults(results),
      statistics: results.summary
    }, { spaces: 2 });
    
    const reportFile = path.join(outputDir, `fix-report-${timestamp}.md`);
    await fs.writeFile(reportFile, this.generateMarkdownReport(results));
    
    if (this.config.sampleMode) {
      await this.sampleData.cleanup();
    }
  }

  getRunId() {
    return `gift-compare-${Date.now()}`;
  }

  sanitizeResults(results) {
    return {
      pdfIssues: results.pdfIssues.map(issue => ({
        ...issue,
        filePath: path.basename(issue.filePath)
      })),
      imageIssues: results.imageIssues.map(issue => ({
        ...issue,
        filePath: path.basename(issue.filePath)
      })),
      fixSuggestions: results.fixSuggestions
    };
  }

  generateMarkdownReport(results) {
    let md = '# 企业礼品仓礼品稿件比对报告\n\n';
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    md += '## 1. 检测概览\n\n';
    md += `- PDF文件检测: ${results.summary.pdf.totalFiles} 个文件，${results.summary.pdf.errors + results.summary.pdf.warnings} 个问题\n`;
    md += `- 图片检测: ${results.summary.image.totalFiles} 个文件，${results.summary.image.errors + results.summary.image.warnings} 个问题\n\n`;
    
    md += '## 2. PDF字体替换问题\n\n';
    if (results.pdfIssues.length === 0) {
      md += '无异常\n\n';
    } else {
      results.pdfIssues.forEach(issue => {
        md += `### ${path.basename(issue.filePath)}\n`;
        md += `- 严重程度: ${issue.severity}\n`;
        md += `- 问题描述: ${issue.message}\n`;
        md += `- 字体名称: ${issue.fontName || 'N/A'}\n`;
        md += `- 建议替换: ${issue.suggestedFont || 'N/A'}\n\n`;
      });
    }
    
    md += '## 3. 图片压缩问题\n\n';
    if (results.imageIssues.length === 0) {
      md += '无异常\n\n';
    } else {
      results.imageIssues.forEach(issue => {
        md += `### ${path.basename(issue.filePath)}\n`;
        md += `- 严重程度: ${issue.severity}\n`;
        md += `- 问题描述: ${issue.message}\n`;
        md += `- 当前大小: ${issue.currentSize || 'N/A'}\n`;
        md += `- 建议大小: ${issue.suggestedSize || 'N/A'}\n\n`;
      });
    }
    
    md += '## 4. 修复建议\n\n';
    results.fixSuggestions.forEach((suggestion, idx) => {
      md += `### ${idx + 1}. ${suggestion.title}\n`;
      md += `- 分类: ${suggestion.category}\n`;
      md += `- 建议: ${suggestion.suggestion}\n`;
      md += `- 影响文件: ${suggestion.files.join(', ')}\n`;
      if (suggestion.action) {
        md += `- 执行动作: ${suggestion.action}\n`;
      }
      md += '\n';
    });
    
    return md;
  }
}

module.exports = GiftCompare;
