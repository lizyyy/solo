#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const VariableEngine = require('./core/variable-engine');
const TerminalFormatter = require('./output/terminal-formatter');
const HtmlFormatter = require('./output/html-formatter');

const program = new Command();

class CLIManager {
  constructor() {
    this.engine = new VariableEngine();
    this.terminalFormatter = new TerminalFormatter();
    this.htmlFormatter = new HtmlFormatter();
  }

  validateInput(inputPath) {
    const errors = [];

    if (!inputPath) {
      errors.push('必须指定输入目录路径');
      return errors;
    }

    const resolvedPath = path.resolve(inputPath);

    if (!fs.existsSync(resolvedPath)) {
      errors.push('输入路径不存在: ' + resolvedPath);
      return errors;
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      errors.push('输入路径不是目录: ' + resolvedPath);
      return errors;
    }

    return errors;
  }

  ensureOutputDirectory(outputPath) {
    const resolvedPath = path.resolve(outputPath);

    if (!fs.existsSync(resolvedPath)) {
      fs.mkdirSync(resolvedPath, { recursive: true });
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      throw new Error('输出路径不是目录: ' + resolvedPath);
    }

    return resolvedPath;
  }

  writeJsonReport(report, outputDir) {
    const fileName = 'env-shadow-report-' + Date.now() + '.json';
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, JSON.stringify(report, null, 2));
    return filePath;
  }

  writeHtmlReport(report, outputDir) {
    const fileName = 'env-shadow-report-' + Date.now() + '.html';
    const filePath = path.join(outputDir, fileName);
    fs.writeFileSync(filePath, this.htmlFormatter.format(report));
    return filePath;
  }

  run(options) {
    console.log('');

    const inputErrors = this.validateInput(options.input);
    if (inputErrors.length > 0) {
      console.error(chalk.red('ERROR: 输入错误:'));
      inputErrors.forEach(err => console.error(chalk.red('   - ' + err)));
      console.error('');
      process.exit(1);
    }

    let outputDir;
    try {
      outputDir = this.ensureOutputDirectory(options.output);
    } catch (error) {
      console.error(chalk.red('ERROR: 输出目录错误: ' + error.message));
      console.error('');
      process.exit(1);
    }

    console.log(chalk.cyan('INFO: 正在分析目录:'), path.resolve(options.input));
    console.log(chalk.cyan('INFO: 输出目录:'), outputDir);
    console.log('');

    let report;
    try {
      report = this.engine.processDirectory(options.input);
    } catch (error) {
      console.error(chalk.red('ERROR: 处理失败: ' + error.message));
      console.error(chalk.gray(error.stack));
      console.error('');
      process.exit(1);
    }

    console.log(this.terminalFormatter.format(report));
    console.log('');

    const jsonPath = this.writeJsonReport(report, outputDir);
    console.log(chalk.green('SUCCESS: JSON报告已写入: ' + jsonPath));

    const htmlPath = this.writeHtmlReport(report, outputDir);
    console.log(chalk.green('SUCCESS: HTML报告已写入: ' + htmlPath));
    console.log('');

    if (report.statistics.errorCount > 0) {
      console.log(chalk.yellow('WARNING: 检测到 ' + report.statistics.errorCount + ' 个解析错误，请查看详细报告'));
      process.exit(2);
    }

    if (report.statistics.overriddenCount > 0) {
      console.log(chalk.yellow('WARNING: 检测到 ' + report.statistics.overriddenCount + ' 个变量被覆盖'));
    }

    console.log(chalk.green('SUCCESS: 分析完成！'));
    console.log('');
  }
}

program
  .name('env-shadow')
  .description('环境变量影子CLI - 多源环境变量优先级分析与覆盖追踪工具')
  .version('1.0.0');

program
  .option('-i, --input <directory>', '输入目录路径（包含配置文件）')
  .option('-o, --output <directory>', '输出目录路径（默认为 ./output）', './output')
  .action((options) => {
    const manager = new CLIManager();
    manager.run(options);
  });

program.addHelpText('after', `

示例:
  $ env-shadow --input ./my-project/config
  $ env-shadow -i ./config -o ./reports

支持的文件类型:
  - .env, .env.* (dotenv 文件)
  - *.sh, *.bash (Shell脚本)
  - docker-compose.yml, compose.yml (Docker Compose文件)
`);

program.parse();
