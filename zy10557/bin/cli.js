#!/usr/bin/env node

const { Command } = require('commander');
const JsonConfigDiff = require('../src/index');

const program = new Command();

program
  .name('json-config-diff')
  .description('JSON 配置差异 CLI 工具 - 结构化比较多环境配置')
  .version('1.0.0');

program
  .command('diff', { isDefault: true })
  .description('比较 JSON 配置文件差异')
  .option('-i, --input-dir <dir>', '输入目录，默认为当前目录', '.')
  .option('-o, --output-dir <dir>', '输出目录', './output')
  .option('-f, --files <files...>', '指定要比较的文件，空格分隔')
  .option('-e, --envs <names...>', '环境名称，与文件顺序对应')
  .option('-b, --base-env <name>', '基准环境名，默认为第一个环境')
  .option('-s, --sensitive <patterns...>', '敏感字段匹配模式，支持通配符')
  .option('-a, --array-keys <pairs>', '数组键字段映射，格式: path=key,path2=key2')
  .option('--no-array-normalize', '禁用数组归一化处理')
  .option('--no-ignore-array-order', '不忽略数组顺序')
  .option('-d, --defaults <json>', '默认值映射 JSON 字符串')
  .option('--defaults-file <path>', '默认值配置文件路径')
  .action(async (options) => {
    try {
      if (options.defaultsFile) {
        const fs = require('fs');
        const path = require('path');
        const defaultsContent = fs.readFileSync(path.resolve(options.defaultsFile), 'utf-8');
        options.defaults = JSON.parse(defaultsContent);
      }

      const diffTool = new JsonConfigDiff();
      const result = diffTool.run(options);

      console.log(result.summary);
      console.log('📁 输出目录:', result.runDir);
      console.log('📄 生成文件:');
      for (const file of result.files) {
        console.log(`   - ${file}`);
      }
      console.log('');

      if (result.errors && result.errors.length > 0) {
        process.exitCode = 1;
      }
    } catch (error) {
      console.error('❌ 错误:', error.message);
      process.exit(1);
    }
  });

program
  .command('list')
  .description('列出输入目录中的 JSON 文件')
  .option('-i, --input-dir <dir>', '输入目录', '.')
  .action((options) => {
    const ConfigLoader = require('../src/config-loader');
    const loader = new ConfigLoader({ inputDir: options.inputDir });
    const files = loader.findJsonFiles();

    console.log(`在 ${options.inputDir} 中发现 ${files.length} 个配置文件:\n`);
    for (const file of files) {
      console.log(`  - ${file.filename} (环境: ${file.env})`);
    }
    console.log('');
  });

program
  .command('mask')
  .description('遮蔽配置文件中的敏感字段')
  .option('-i, --input-dir <dir>', '输入目录', '.')
  .option('-f, --file <file>', '要遮蔽的文件')
  .option('-s, --sensitive <patterns...>', '敏感字段匹配模式')
  .option('-o, --output <file>', '输出文件')
  .action((options) => {
    const fs = require('fs');
    const path = require('path');
    const DiffProcessor = require('../src/diff-processor');
    const ConfigLoader = require('../src/config-loader');

    const loader = new ConfigLoader({ inputDir: options.inputDir });
    const result = loader.loadConfig(options.file);

    if (!result.success) {
      console.error('❌ 加载文件失败:', result.error.message);
      process.exit(1);
    }

    const processor = new DiffProcessor({
      sensitivePatterns: options.sensitive || []
    });

    const masked = processor.maskConfigValues(result.config);

    if (options.output) {
      fs.writeFileSync(path.resolve(options.output), JSON.stringify(masked, null, 2));
      console.log('✅ 已生成遮蔽后的配置:', options.output);
    } else {
      console.log(JSON.stringify(masked, null, 2));
    }
  });

program.parse(process.argv);