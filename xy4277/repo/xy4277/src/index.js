#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const chalk = require('chalk');

const Scanner = require('./scanner');
const Parser = require('./parser');
const RulesEngine = require('./rules');
const Reporter = require('./reporter');

const RISK_COLORS = {
  CRITICAL: chalk.red.bold,
  HIGH: chalk.red,
  MEDIUM: chalk.yellow,
  LOW: chalk.green,
  OK: chalk.green.bold
};

const RISK_ICONS = {
  CRITICAL: '🔴',
  HIGH: '🟠',
  MEDIUM: '🟡',
  LOW: '🟢',
  OK: '✅'
};

program
  .name('material-check')
  .description('素材授权交付核对器 - 用于核对素材清单、授权合同、时间线EDL和交付文件夹')
  .version('1.0.0', '-v, --version', '输出版本号');

program
  .command('scan')
  .description('扫描目录并识别相关文件')
  .argument('<directory>', '要扫描的目录路径')
  .option('-v, --verbose', '显示详细信息')
  .action((directory, options) => {
    console.log(chalk.blue.bold('\n📁 素材授权交付核对器 - 扫描模式'));
    console.log(chalk.dim('========================================\n'));

    try {
      const scanner = new Scanner();
      const scanResult = scanner.scan(directory);
      
      console.log(chalk.bold(`扫描目录: ${directory}\n`));
      
      console.log(chalk.blue(`📋 CSV 文件 (${scanResult.csvFiles.length}个):`));
      if (scanResult.csvFiles.length > 0) {
        scanResult.csvFiles.forEach(f => console.log(`   - ${f.relativePath} (${formatFileSize(f.size)})`));
      } else {
        console.log(chalk.gray('   (未找到)'));
      }

      console.log(chalk.blue(`\n📄 JSON 授权文件 (${scanResult.jsonFiles.length}个):`));
      if (scanResult.jsonFiles.length > 0) {
        scanResult.jsonFiles.forEach(f => console.log(`   - ${f.relativePath} (${formatFileSize(f.size)})`));
      } else {
        console.log(chalk.gray('   (未找到)'));
      }

      console.log(chalk.blue(`\n🎬 EDL 时间线文件 (${scanResult.edlFiles.length}个):`));
      if (scanResult.edlFiles.length > 0) {
        scanResult.edlFiles.forEach(f => console.log(`   - ${f.relativePath} (${formatFileSize(f.size)})`));
      } else {
        console.log(chalk.gray('   (未找到)'));
      }

      console.log(chalk.blue(`\n🎥 媒体文件 (${scanResult.mediaFiles.length}个):`));
      if (scanResult.mediaFiles.length > 0) {
        if (options.verbose) {
          scanResult.mediaFiles.forEach(f => console.log(`   - ${f.relativePath} (${formatFileSize(f.size)})`));
        } else {
          const totalSize = scanResult.mediaFiles.reduce((sum, f) => sum + f.size, 0);
          console.log(chalk.gray(`   共 ${scanResult.mediaFiles.length} 个文件，总大小 ${formatFileSize(totalSize)}`));
          console.log(chalk.gray('   使用 -v 选项查看详细列表'));
        }
      } else {
        console.log(chalk.gray('   (未找到)'));
      }

      if (scanResult.otherFiles.length > 0) {
        console.log(chalk.gray(`\n其他文件 (${scanResult.otherFiles.length}个)`));
      }

      console.log(chalk.green('\n✅ 扫描完成\n'));
    } catch (error) {
      console.error(chalk.red(`\n❌ 扫描失败: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('check')
  .description('执行完整的素材授权核对流程')
  .argument('<directory>', '包含素材的目录路径')
  .option('-p, --project <name>', '项目名称', '未命名项目')
  .option('--csv <path>', '指定素材清单CSV文件路径')
  .option('--json <path>', '指定授权合同JSON文件路径')
  .option('--edl <path>', '指定时间线EDL文件路径')
  .option('--media <path>', '指定媒体文件目录（如果不在主目录中）')
  .option('-o, --output <path>', '输出目录路径', './output')
  .option('--no-markdown', '不生成Markdown报告')
  .option('--no-json', '不生成JSON报告')
  .option('--warning-days <days>', '授权到期警告天数', parseInt, 30)
  .option('--allow-missing-auth', '允许缺少授权合同（降低为警告）')
  .option('--no-strict-duration', '禁用严格时长检查')
  .option('-v, --verbose', '显示详细信息')
  .action((directory, options) => {
    console.log(chalk.blue.bold('\n🔍 素材授权交付核对器'));
    console.log(chalk.dim('========================================\n'));

    const projectName = options.project || '未命名项目';
    console.log(chalk.bold(`项目名称: ${projectName}`));
    console.log(chalk.bold(`扫描目录: ${directory}\n`));

    try {
      const scanner = new Scanner();
      const scanResult = scanner.scan(directory);
      
      const selectedFiles = scanner.selectFiles(scanResult, {
        csvFile: options.csv,
        jsonFile: options.json,
        edlFile: options.edl,
        mediaDir: options.media
      });

      const parser = new Parser();
      const parsedData = {
        materialList: selectedFiles.csv ? parser.parseCSV(selectedFiles.csv) : null,
        authData: selectedFiles.json ? parser.parseJSON(selectedFiles.json) : null,
        edlData: selectedFiles.edl ? parser.parseEDL(selectedFiles.edl) : null
      };

      const parseErrors = parser.getErrors();
      if (parseErrors.length > 0) {
        console.log(chalk.yellow(`\n⚠️  解析过程中发现 ${parseErrors.length} 个问题:`));
        parseErrors.forEach(err => {
          console.log(chalk.yellow(`   - ${err.message}`));
        });
      }

      console.log(chalk.blue('\n📊 解析结果摘要:'));
      console.log(`   素材清单: ${parsedData.materialList ? `${parsedData.materialList.materials.length} 条记录` : chalk.gray('未提供')}`);
      console.log(`   授权合同: ${parsedData.authData ? `${parsedData.authData.contracts.length} 份合同` : chalk.gray('未提供')}`);
      console.log(`   时间线EDL: ${parsedData.edlData ? `${parsedData.edlData.events.length} 个事件` : chalk.gray('未提供')}`);
      console.log(`   媒体文件: ${selectedFiles.media.length} 个`);

      console.log(chalk.blue('\n⚙️  执行规则检查...'));
      
      const rulesEngine = new RulesEngine({
        warningDays: options.warningDays,
        allowMissingAuth: options.allowMissingAuth === true,
        strictDurationCheck: options.strictDuration !== false
      });

      const validationResult = rulesEngine.validate(parsedData, selectedFiles.media);

      const violations = rulesEngine.getViolations();
      const warnings = rulesEngine.getWarnings();

      console.log(chalk.blue('\n📋 检查结果:'));
      console.log(`   最高风险等级: ${RISK_ICONS[validationResult.summary.highestRisk] || '❓'} ${RISK_COLORS[validationResult.summary.highestRisk] ? RISK_COLORS[validationResult.summary.highestRisk](validationResult.summary.highestRisk) : validationResult.summary.highestRisk}`);
      console.log(`   违规问题: ${chalk.red(validationResult.summary.violations)} 个`);
      console.log(`   警告: ${chalk.yellow(validationResult.summary.warnings)} 个`);

      if (violations.length > 0) {
        console.log(chalk.red('\n🔴 违规问题:'));
        const sortedViolations = [...violations].sort((a, b) => b.riskValue - a.riskValue);
        for (const v of sortedViolations) {
          const colorFn = RISK_COLORS[v.riskLevel] || chalk.white;
          console.log(`   ${RISK_ICONS[v.riskLevel] || '❓'} [${v.materialId || '全局'}] ${colorFn(v.message)}`);
        }
      }

      if (warnings.length > 0 && options.verbose) {
        console.log(chalk.yellow('\n🟡 警告信息:'));
        const sortedWarnings = [...warnings].sort((a, b) => b.riskValue - a.riskValue);
        for (const w of sortedWarnings) {
          console.log(`   ${RISK_ICONS[w.riskLevel] || '❓'} [${w.materialId || '全局'}] ${w.message}`);
        }
      } else if (warnings.length > 0) {
        console.log(chalk.gray(`\n   还有 ${warnings.length} 个警告，使用 -v 选项查看详情`));
      }

      const reporter = new Reporter({
        projectName,
        generatedBy: 'material-check CLI'
      });

      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `${projectName.replace(/\s+/g, '_')}_${timestamp}`;

      let filesGenerated = [];

      if (options.json !== false) {
        const jsonPath = path.join(outputDir, `${baseName}.json`);
        reporter.exportJSON(jsonPath, validationResult, parsedData, selectedFiles);
        filesGenerated.push(jsonPath);
        console.log(chalk.green(`\n📄 JSON报告已生成: ${jsonPath}`));
      }

      if (options.markdown !== false) {
        const mdPath = path.join(outputDir, `${baseName}.md`);
        reporter.exportMarkdown(mdPath, validationResult, parsedData, selectedFiles);
        filesGenerated.push(mdPath);
        console.log(chalk.green(`📝 Markdown报告已生成: ${mdPath}`));
      }

      console.log(chalk.green.bold('\n✅ 核对完成!'));
      
      if (validationResult.summary.highestRisk === 'CRITICAL' || validationResult.summary.highestRisk === 'HIGH') {
        console.log(chalk.red.bold('⚠️  发现高风险问题，请在交片前解决！'));
        process.exit(2);
      } else if (validationResult.summary.highestRisk === 'MEDIUM') {
        console.log(chalk.yellow('⚠️  发现中等风险问题，建议复查。'));
      } else {
        console.log(chalk.green('所有检查通过，可以交付。'));
      }

      console.log('');
    } catch (error) {
      console.error(chalk.red(`\n❌ 核对失败: ${error.message}`));
      if (options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('examples')
  .description('显示示例数据说明')
  .action(() => {
    console.log(chalk.blue.bold('\n📚 素材授权交付核对器 - 示例数据说明'));
    console.log(chalk.dim('============================================\n'));
    
    console.log(chalk.bold('项目结构示例:'));
    console.log(`
project/
├── 素材清单.csv          # 素材清单CSV
├── 授权合同.json          # 授权合同摘要JSON
├── 时间线.edl             # 时间线EDL文件
└── delivery/              # 交付文件夹
    ├── DOC_2024_01_采访片段.mp4
    ├── DOC_2024_02空镜画面.mp4
    └── DOC_2024_03档案资料.mp4
`);

    console.log(chalk.bold('使用方法:'));
    console.log(`
  1. 扫描目录查看文件:
     $ material-check scan ./project

  2. 执行完整核对:
     $ material-check check ./project -p "我的纪录片项目"

  3. 指定特定文件:
     $ material-check check ./project --csv ./custom.csv --edl ./timeline.edl

  4. 查看更多选项:
     $ material-check check --help
`);

    console.log(chalk.gray('示例数据文件位于 examples/ 目录下\n'));
  });

function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

program.parse(process.argv);
