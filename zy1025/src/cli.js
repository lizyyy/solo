import { Command } from 'commander';
import { scanProject } from './scanner/scanner.js';
import { loadConfig, initConfig } from './config/config.js';
import { checkIssues, redactSecrets } from './checker/rules.js';
import { printConsoleReport } from './reporter/consoleReporter.js';
import { generateJsonReport } from './reporter/jsonReporter.js';
import { generateMarkdownReport } from './reporter/markdownReporter.js';
import { EXIT_CODES } from './utils/constants.js';
import fs from 'fs';
import path from 'path';

const program = new Command();

program
  .name('env-checker')
  .description('检查前端/Node项目中的环境变量漂移问题')
  .version('1.0.0');

program
  .command('scan')
  .description('扫描项目中的环境变量并检查问题')
  .argument('[directory]', '项目目录路径 (默认: 当前目录)')
  .option('-c, --config <path>', '配置文件路径')
  .option('-o, --output <path>', '输出报告目录')
  .option('--json <file>', '导出 JSON 报告到指定文件')
  .option('--markdown <file>', '导出 Markdown 报告到指定文件')
  .option('--no-console', '不输出终端报告')
  .action(async (directory, options) => {
    try {
      const projectDir = directory ? path.resolve(directory) : process.cwd();
      
      if (!fs.existsSync(projectDir)) {
        console.error(`错误: 目录不存在: ${projectDir}`);
        process.exit(EXIT_CODES.SCAN_ERROR);
      }

      if (!fs.statSync(projectDir).isDirectory()) {
        console.error(`错误: 路径不是目录: ${projectDir}`);
        process.exit(EXIT_CODES.SCAN_ERROR);
      }

      const config = loadConfig(projectDir, options.config);

      console.log(`📁 扫描目录: ${projectDir}`);
      console.log('⏳ 正在扫描环境变量...\n');

      const scanResult = scanProject(projectDir, config);
      const issues = checkIssues(scanResult, config);

      let finalScanResult = scanResult;
      let finalIssues = issues;
      
      if (config.redactSecrets) {
        const redacted = redactSecrets(scanResult, issues);
        finalScanResult = redacted.scanResult;
        finalIssues = redacted.issues;
      }

      if (options.console !== false) {
        printConsoleReport(finalScanResult, finalIssues, config);
      }

      if (options.json) {
        generateJsonReport(finalScanResult, finalIssues, config, {
          outputFile: options.json,
        });
      }

      if (options.markdown) {
        generateMarkdownReport(finalScanResult, finalIssues, config, {
          outputFile: options.markdown,
        });
      }

      if (options.output) {
        const outputDir = path.resolve(options.output);
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }

        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const baseName = `env-check-report-${timestamp}`;

        generateJsonReport(finalScanResult, finalIssues, config, {
          outputFile: path.join(outputDir, `${baseName}.json`),
        });

        generateMarkdownReport(finalScanResult, finalIssues, config, {
          outputFile: path.join(outputDir, `${baseName}.md`),
        });
      }

      const hasErrors = finalIssues.some(i => i.severity === 'high' || i.severity === 'medium');
      
      if (hasErrors) {
        process.exit(EXIT_CODES.ERRORS_FOUND);
      } else {
        process.exit(EXIT_CODES.SUCCESS);
      }

    } catch (error) {
      console.error('❌ 扫描失败:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(EXIT_CODES.SCAN_ERROR);
    }
  });

program
  .command('init-config')
  .description('生成带注释的配置模板文件')
  .argument('[path]', '配置文件路径 (默认: .env-checker.config.json)')
  .action(async (targetPath) => {
    try {
      const configPath = initConfig(targetPath);
      console.log(`✅ 配置文件已生成: ${configPath}`);
      console.log('\n编辑此文件可以：');
      console.log('  - 标记可选变量 (optionalVars)');
      console.log('  - 标记仅本地使用的变量 (localOnlyVars)');
      console.log('  - 配置要排除的文件/目录');
      console.log('  - 调整扫描范围');
      process.exit(EXIT_CODES.SUCCESS);
    } catch (error) {
      console.error('❌ 生成配置文件失败:', error.message);
      process.exit(EXIT_CODES.CONFIG_ERROR);
    }
  });

program.parse(process.argv);
