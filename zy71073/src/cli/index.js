const { Command } = require('commander');
const chalk = require('chalk');
const path = require('path');
const fs = require('fs');

const { WorkbookParser } = require('../core/workbook-parser');
const { DependencyGraph } = require('../core/dependency-graph');
const { TerminalReporter } = require('../reporters/terminal-reporter');
const { JsonReporter } = require('../reporters/json-reporter');
const { MarkdownReporter } = require('../reporters/markdown-reporter');
const { SelfTester } = require('../core/self-tester');
const exitCodes = require('../core/exit-codes');

class CLI {
  constructor() {
    this.program = new Command();
    this.setupCommands();
  }

  setupCommands() {
    this.program
      .name('excel-dep')
      .description('Excel 公式依赖图分析工具')
      .version('1.0.0');

    this.program
      .command('analyze <file>')
      .description('分析Excel文件的公式依赖关系')
      .option('-o, --output <dir>', '输出目录', './reports')
      .option('-s, --sheet <sheet>', '指定要分析的工作表')
      .option('-c, --cell <cell>', '指定要分析影响的单元格 (如: Sheet1!A1)')
      .option('-d, --dependency <cell>', '分析指定单元格的依赖链')
      .option('--include-hidden', '包含隐藏的工作表')
      .option('--no-markdown', '不生成Markdown报告')
      .option('--no-json', '不生成JSON报告')
      .option('--fail-on-circular', '检测到循环引用时退出码非0')
      .option('--fail-on-external', '检测到外部链接时退出码非0')
      .action(this.handleAnalyze.bind(this));

    this.program
      .command('impact <file> <cell>')
      .description('分析修改指定单元格的影响范围')
      .option('-o, --output <dir>', '输出目录', './reports')
      .option('--include-hidden', '包含隐藏的工作表')
      .action(this.handleImpact.bind(this));

    this.program
      .command('inputs <file>')
      .description('找出所有作为输入项的单元格（无公式但被引用）')
      .option('-o, --output <dir>', '输出目录', './reports')
      .option('--include-hidden', '包含隐藏的工作表')
      .option('-n, --top <n>', '显示前N个影响最大的输入项', '20')
      .action(this.handleInputs.bind(this));

    this.program
      .command('sheets <file>')
      .description('列出所有工作表及其统计信息')
      .option('--include-hidden', '包含隐藏的工作表')
      .action(this.handleSheets.bind(this));

    this.program
      .command('self-test')
      .description('运行自检，验证工具功能完整性')
      .option('-v, --verbose', '显示详细测试信息')
      .action(this.handleSelfTest.bind(this));
  }

  async run(argv) {
    await this.program.parseAsync(argv);
  }

  async handleAnalyze(file, options) {
    const startTime = Date.now();
    const result = await this._analyzeFile(file, options);

    const outputDir = this._ensureOutputDir(options.output);
    const baseName = path.basename(file, path.extname(file));

    const terminalReporter = new TerminalReporter();
    terminalReporter.report(result, options);

    if (options.json !== false) {
      const jsonReporter = new JsonReporter();
      const jsonPath = path.join(outputDir, `${baseName}-dependency-report.json`);
      jsonReporter.generate(result, jsonPath, options);
      console.log(chalk.gray(`   JSON报告: ${jsonPath}`));
    }

    if (options.markdown !== false) {
      const mdReporter = new MarkdownReporter();
      const mdPath = path.join(outputDir, `${baseName}-dependency-report.md`);
      mdReporter.generate(result, mdPath, options);
      console.log(chalk.gray(`   Markdown报告: ${mdPath}`));
    }

    const duration = Date.now() - startTime;
    console.log(chalk.gray(`\n完成，耗时 ${duration}ms`));

    let exitCode = exitCodes.SUCCESS;
    if (options.failOnCircular && result.graph.hasCircularReferences) {
      exitCode = exitCodes.CIRCULAR_REFERENCE;
    }
    if (options.failOnExternal && result.workbook.externalLinks.length > 0) {
      exitCode = exitCodes.EXTERNAL_LINKS;
    }
    process.exit(exitCode);
  }

  async handleImpact(file, cell, options) {
    const startTime = Date.now();
    const result = await this._analyzeFile(file, options);

    const impact = result.graphInstance.getImpactPath(cell);

    const terminalReporter = new TerminalReporter();
    terminalReporter.reportImpact(impact, result);

    const outputDir = this._ensureOutputDir(options.output);
    const baseName = path.basename(file, path.extname(file));
    const cellClean = cell.replace('!', '-');

    const jsonReporter = new JsonReporter();
    const jsonPath = path.join(outputDir, `${baseName}-impact-${cellClean}.json`);
    jsonReporter.generateImpact(impact, result, jsonPath);
    console.log(chalk.gray(`   JSON报告: ${jsonPath}`));

    const duration = Date.now() - startTime;
    console.log(chalk.gray(`\n完成，耗时 ${duration}ms`));
    process.exit(exitCodes.SUCCESS);
  }

  async handleInputs(file, options) {
    const startTime = Date.now();
    const result = await this._analyzeFile(file, options);

    const inputs = result.graphInstance.getInputCells();
    const topN = parseInt(options.top, 10);
    const topInputs = inputs.slice(0, topN);

    const terminalReporter = new TerminalReporter();
    terminalReporter.reportInputs(topInputs, inputs.length, options);

    const duration = Date.now() - startTime;
    console.log(chalk.gray(`\n完成，耗时 ${duration}ms`));
    process.exit(exitCodes.SUCCESS);
  }

  async handleSheets(file, options) {
    const result = await this._analyzeFile(file, options);
    const terminalReporter = new TerminalReporter();
    terminalReporter.reportSheets(result.workbook.sheets);
    process.exit(exitCodes.SUCCESS);
  }

  async handleSelfTest(options) {
    const tester = new SelfTester();
    const results = await tester.runAll(options.verbose);

    const terminalReporter = new TerminalReporter();
    terminalReporter.reportSelfTest(results);

    process.exit(results.passed ? exitCodes.SUCCESS : exitCodes.SELF_TEST_FAILED);
  }

  async _analyzeFile(file, options) {
    const parserOptions = {
      includeHiddenSheets: options.includeHidden || false,
    };

    const parser = new WorkbookParser(file, parserOptions);
    const workbookData = parser.parse();

    const graph = new DependencyGraph();
    const graphData = graph.build(workbookData);

    return {
      workbook: workbookData,
      graph: graphData,
      graphInstance: graph,
      parser,
      analyzedAt: new Date().toISOString(),
    };
  }

  _ensureOutputDir(outputDir) {
    const dir = path.resolve(outputDir);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    return dir;
  }
}

module.exports = { CLI };
