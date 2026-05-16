#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Command } = require('commander');
const chalk = require('chalk');

const ProtoParser = require('./proto-parser');
const SnapshotManager = require('./snapshot-manager');
const CompatibilityChecker = require('./compatibility-checker');
const ReportGenerator = require('./report-generator');

const program = new Command();

program
  .name('proto-compat')
  .description('gRPC Proto 文件兼容性检查工具')
  .version('1.0.0');

program
  .command('check')
  .description('检查 proto 文件的兼容性')
  .argument('<proto-files...>', '要检查的 proto 文件路径')
  .option('-o, --output <dir>', '输出目录', './proto-compat-output')
  .option('-s, --snapshot <version>', '使用指定版本的快照进行对比')
  .option('--no-save', '不保存新快照')
  .option('--strict', '严格模式：警告也视为失败')
  .option('--json-only', '仅输出 JSON 报告')
  .action(async (protoFiles, options) => {
    try {
      validateInputs(protoFiles, options);
      
      const outputDir = path.resolve(options.output);
      const snapshotManager = new SnapshotManager(outputDir);
      const reportGenerator = new ReportGenerator(outputDir);
      const checker = new CompatibilityChecker();

      const allProtoData = parseProtoFiles(protoFiles);
      const mergedData = mergeProtoData(allProtoData);

      const oldSnapshot = options.snapshot 
        ? snapshotManager.loadSnapshot(options.snapshot)
        : snapshotManager.loadSnapshot();

      const result = checker.check(oldSnapshot, mergedData);

      if (!options.save && result.isCompatible && oldSnapshot) {
        console.log(chalk.yellow('警告: 兼容变更，快照未自动保存。使用 --save 强制保存。'));
      } else if (options.save !== false) {
        const newSnapshot = snapshotManager.createSnapshot(mergedData);
        console.log(chalk.green(`新快照已保存: ${newSnapshot.path}`));
      }

      if (!options.jsonOnly) {
        reportGenerator.printConsoleSummary(result);
      }

      const jsonReport = reportGenerator.generateJsonReport(
        result, 
        mergedData, 
        oldSnapshot
      );
      const markdownReport = reportGenerator.generateMarkdownReport(
        result, 
        mergedData, 
        oldSnapshot
      );

      console.log(chalk.blue(`JSON 报告: ${jsonReport.path}`));
      console.log(chalk.blue(`Markdown 报告: ${markdownReport.path}`));

      const isFailed = !result.isCompatible || (options.strict && result.summary.warnings > 0);
      process.exit(isFailed ? 1 : 0);

    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

program
  .command('snapshot')
  .description('快照管理命令')
  .addCommand(new Command('list')
    .description('列出所有快照')
    .option('-o, --output <dir>', '输出目录', './proto-compat-output')
    .action((options) => {
      const outputDir = path.resolve(options.output);
      const snapshotManager = new SnapshotManager(outputDir);
      const snapshots = snapshotManager.listSnapshots();

      if (snapshots.length === 0) {
        console.log('没有找到快照');
        return;
      }

      console.log('快照列表:');
      snapshots.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s.version} (创建于: ${s.createdAt})`);
      });
    }))
  .addCommand(new Command('create')
    .description('创建新快照')
    .argument('<proto-files...>', 'proto 文件路径')
    .option('-o, --output <dir>', '输出目录', './proto-compat-output')
    .option('-v, --version <version>', '快照版本号')
    .action((protoFiles, options) => {
      try {
        validateInputs(protoFiles, options);
        
        const outputDir = path.resolve(options.output);
        const snapshotManager = new SnapshotManager(outputDir);

        const allProtoData = parseProtoFiles(protoFiles);
        const mergedData = mergeProtoData(allProtoData);

        const result = snapshotManager.createSnapshot(mergedData, options.version);
        console.log(chalk.green(`快照创建成功: ${result.path}`));
      } catch (error) {
        console.error(chalk.red(`错误: ${error.message}`));
        process.exit(1);
      }
    }))
  .addCommand(new Command('delete')
    .description('删除快照')
    .argument('<version>', '快照版本')
    .option('-o, --output <dir>', '输出目录', './proto-compat-output')
    .action((version, options) => {
      const outputDir = path.resolve(options.output);
      const snapshotManager = new SnapshotManager(outputDir);
      
      if (snapshotManager.deleteSnapshot(version)) {
        console.log(chalk.green(`快照 ${version} 已删除`));
      } else {
        console.error(chalk.red(`快照 ${version} 不存在`));
        process.exit(1);
      }
    }));

program
  .command('parse')
  .description('解析 proto 文件并输出结构')
  .argument('<proto-file>', 'proto 文件路径')
  .option('--json', '以 JSON 格式输出')
  .action((protoFile, options) => {
    try {
      if (!fs.existsSync(protoFile)) {
        throw new Error(`文件不存在: ${protoFile}`);
      }

      const parser = new ProtoParser();
      const data = parser.parse(protoFile);

      if (options.json) {
        const output = {
          messages: data.messages.map(m => ({
            name: m.name,
            fullName: m.fullName,
            fileName: m.fileName,
            fields: Array.from(m.fields.values()).map(f => ({
              name: f.name,
              number: f.number,
              type: f.type,
              repeated: f.repeated
            }))
          })),
          enums: data.enums.map(e => ({
            name: e.name,
            fullName: e.fullName,
            values: Array.from(e.values.values())
          })),
          services: data.services.map(s => ({
            name: s.name,
            fullName: s.fullName,
            methods: Array.from(s.methods.values())
          }))
        };
        console.log(JSON.stringify(output, null, 2));
      } else {
        console.log('消息 (Messages):');
        data.messages.forEach(m => {
          console.log(`  ${m.fullName}`);
          m.fields.forEach((f, num) => {
            const repeated = f.repeated ? 'repeated ' : '';
            console.log(`    ${num}: ${repeated}${f.type} ${f.name}`);
          });
        });

        if (data.enums.length > 0) {
          console.log('\n枚举 (Enums):');
          data.enums.forEach(e => {
            console.log(`  ${e.fullName}`);
            e.values.forEach((v, num) => {
              console.log(`    ${num}: ${v.name}`);
            });
          });
        }

        if (data.services.length > 0) {
          console.log('\n服务 (Services):');
          data.services.forEach(s => {
            console.log(`  ${s.fullName}`);
            s.methods.forEach(m => {
              console.log(`    rpc ${m.name}(${m.input}) returns (${m.output})`);
            });
          });
        }
      }
    } catch (error) {
      console.error(chalk.red(`错误: ${error.message}`));
      process.exit(1);
    }
  });

function validateInputs(protoFiles, options) {
  for (const file of protoFiles) {
    if (!fs.existsSync(file)) {
      throw new Error(`Proto 文件不存在: ${file}`);
    }
    if (!file.endsWith('.proto')) {
      throw new Error(`不是有效的 proto 文件: ${file}`);
    }
  }

  if (options.output && typeof options.output !== 'string') {
    throw new Error('输出目录必须是字符串');
  }
}

function parseProtoFiles(protoFiles) {
  return protoFiles.map(file => {
    const parser = new ProtoParser();
    return parser.parse(file);
  });
}

function mergeProtoData(protoDataList) {
  const messages = [];
  const enums = [];
  const services = [];
  const sourceLocations = {};

  for (const data of protoDataList) {
    messages.push(...data.messages);
    enums.push(...data.enums);
    services.push(...data.services);
    Object.assign(sourceLocations, data.sourceLocations);
  }

  return {
    messages: messages,
    enums: enums,
    services: services,
    sourceLocations: sourceLocations
  };
}

program.parse();
