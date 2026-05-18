const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { CONFIG } = require('./config');
const BillingParser = require('./parser');
const OverageCalculator = require('./calculator');

class BillingProcessor {
  constructor(inputDir, outputDir) {
    this.inputDir = inputDir || CONFIG.DEFAULT_INPUT_DIR;
    this.outputDir = outputDir || CONFIG.DEFAULT_OUTPUT_DIR;
    this.hashFilePath = path.join(this.outputDir, CONFIG.REPORT_FILES.HASH);
    this.parser = new BillingParser();
    this.calculator = new OverageCalculator();
  }

  ensureOutputDir() {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  getFileHash(filePath) {
    const content = fs.readFileSync(filePath);
    return crypto.createHash('md5').update(content).digest('hex');
  }

  loadProcessedFilesHash() {
    if (fs.existsSync(this.hashFilePath)) {
      const content = fs.readFileSync(this.hashFilePath, CONFIG.ENCODING);
      return JSON.parse(content);
    }
    return {};
  }

  saveProcessedFilesHash(hashes) {
    fs.writeFileSync(this.hashFilePath, JSON.stringify(hashes, null, 2), CONFIG.ENCODING);
  }

  getInputFiles() {
    if (!fs.existsSync(this.inputDir)) {
      return [];
    }
    
    const files = fs.readdirSync(this.inputDir);
    return files
      .filter(f => CONFIG.SUPPORTED_EXTENSIONS.includes(path.extname(f).toLowerCase()))
      .map(f => path.join(this.inputDir, f));
  }

  filterUnprocessedFiles(files) {
    const processedHashes = this.loadProcessedFilesHash();
    const unprocessed = [];
    const newHashes = { ...processedHashes };

    files.forEach(filePath => {
      const fileName = path.basename(filePath);
      const fileHash = this.getFileHash(filePath);
      
      if (processedHashes[fileName] !== fileHash) {
        unprocessed.push(filePath);
        newHashes[fileName] = fileHash;
      }
    });

    return { unprocessed, newHashes };
  }

  process() {
    this.ensureOutputDir();
    
    const inputFiles = this.getInputFiles();
    if (inputFiles.length === 0) {
      return {
        success: false,
        message: '未找到输入文件',
        filesProcessed: 0,
        issues: [],
        results: [],
        totals: null,
      };
    }

    const { unprocessed, newHashes } = this.filterUnprocessedFiles(inputFiles);
    
    if (unprocessed.length === 0) {
      return {
        success: true,
        message: '所有文件已处理，无新文件需要计算',
        filesProcessed: 0,
        issues: [],
        results: [],
        totals: null,
        skippedFiles: inputFiles.length,
      };
    }

    unprocessed.forEach(filePath => {
      this.parser.parseFile(filePath);
    });

    const records = this.parser.getRecords();
    const issues = this.parser.getIssues();
    
    const results = this.calculator.calculateUserOverage(records);
    const totals = this.calculator.calculateTotals(results);

    this.saveResults(results, issues, totals);
    this.saveProcessedFilesHash(newHashes);

    return {
      success: true,
      message: '处理完成',
      filesProcessed: unprocessed.length,
      filesSkipped: inputFiles.length - unprocessed.length,
      issueCount: issues.length,
      resultCount: results.length,
      issues,
      results,
      totals,
    };
  }

  saveResults(results, issues, totals) {
    const issuesPath = path.join(this.outputDir, CONFIG.REPORT_FILES.ISSUES);
    const resultsPath = path.join(this.outputDir, CONFIG.REPORT_FILES.RESULTS);
    const summaryPath = path.join(this.outputDir, CONFIG.REPORT_FILES.SUMMARY);

    fs.writeFileSync(issuesPath, JSON.stringify(issues, null, 2), CONFIG.ENCODING);
    fs.writeFileSync(resultsPath, JSON.stringify({ results, totals }, null, 2), CONFIG.ENCODING);
    fs.writeFileSync(summaryPath, this.generateMarkdownSummary(results, issues, totals), CONFIG.ENCODING);
  }

  generateMarkdownSummary(results, issues, totals) {
    const issueGroups = {};
    issues.forEach(issue => {
      if (!issueGroups[issue.type]) {
        issueGroups[issue.type] = [];
      }
      issueGroups[issue.type].push(issue);
    });

    let md = `# 账单流水文件套餐超额核算报告\n\n`;
    md += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
    
    md += `## 一、核算汇总\n\n`;
    md += `| 指标 | 数值 |\n`;
    md += `|------|------|\n`;
    md += `| 用户总数 | ${totals.userCount} |\n`;
    md += `| 超额用户数 | ${totals.overageUserCount} |\n`;
    md += `| 总数据超额 (GB) | ${totals.totalDataOverageGB} |\n`;
    md += `| 总语音超额 (分钟) | ${totals.totalVoiceOverageMinutes} |\n`;
    md += `| 总短信超额 (条) | ${totals.totalSmsOverageCount} |\n`;
    md += `| 总超额费用 (元) | ${totals.totalOverageFee} |\n`;
    md += `| 减免差异总额 (元) | ${totals.totalDiscountDifference} |\n\n`;

    md += `## 二、问题检测汇总\n\n`;
    md += `共检测到 **${issues.length}** 个问题:\n\n`;
    Object.entries(issueGroups).forEach(([type, typeIssues]) => {
      md += `### ${type} (${typeIssues.length}个)\n\n`;
      md += `| 文件名 | 行号 | 问题描述 |\n`;
      md += `|--------|------|----------|\n`;
      typeIssues.forEach(issue => {
        md += `| ${issue.fileName} | ${issue.lineNumber} | ${issue.message} |\n`;
      });
      md += `\n`;
    });

    md += `## 三、用户超额明细\n\n`;
    const overageUsers = results.filter(r => r.overageDetails.totalOverageFee > 0);
    overageUsers.forEach(user => {
      md += `### 用户 ${user.userId}\n\n`;
      md += `#### 使用情况\n\n`;
      md += `- 数据: ${user.usageSummary.dataGB} GB / 限额 ${user.usageSummary.dataLimitGB} GB (超额 ${user.overageDetails.dataOverageGB} GB)\n`;
      md += `- 语音: ${user.usageSummary.voiceMinutes} 分钟 / 限额 ${user.usageSummary.voiceLimitMinutes} 分钟 (超额 ${user.overageDetails.voiceOverageMinutes} 分钟)\n`;
      md += `- 短信: ${user.usageSummary.smsCount} 条 / 限额 ${user.usageSummary.smsLimitCount} 条 (超额 ${user.overageDetails.smsOverageCount} 条)\n\n`;
      
      md += `#### 费用明细\n\n`;
      md += `- 套餐费用: ${user.financialSummary.totalPackageFee} 元\n`;
      md += `- 超额费用: ${user.overageDetails.totalOverageFee} 元\n`;
      md += `- 减免金额: ${user.financialSummary.totalDiscountAmount} 元\n`;
      md += `- 实际支付: ${user.financialSummary.totalActualPayment} 元\n`;
      md += `- 预期应付: ${user.financialSummary.expectedPayment} 元\n`;
      md += `- 减免差异: ${user.financialSummary.discountDifference} 元\n\n`;
      
      md += `#### 来源记录\n\n`;
      md += `| 文件名 | 行号 | 计费月份 | 账单编号 |\n`;
      md += `|--------|------|----------|----------|\n`;
      user.sourceRecords.forEach(src => {
        md += `| ${src.fileName} | ${src.lineNumber} | ${src.billingMonth} | ${src.billNumber} |\n`;
      });
      md += `\n`;
    });

    if (overageUsers.length === 0) {
      md += `暂无超额用户。\n\n`;
    }

    return md;
  }
}

module.exports = BillingProcessor;
