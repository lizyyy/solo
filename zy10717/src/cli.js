const fs = require('fs');
const path = require('path');
const { UnpackEngine } = require('./unpack-engine.js');
const { ReportGenerator } = require('./report-generator.js');

class CLI {
  constructor() {
    this.commands = {
      unpack: this.unpack.bind(this),
      validate: this.validate.bind(this),
      diff: this.diff.bind(this),
      help: this.help.bind(this)
    };
  }

  run(args) {
    const [command, ...params] = args;
    
    if (!command || command === '--help' || command === '-h') {
      this.help();
      return;
    }

    const cmd = this.commands[command];
    if (cmd) {
      cmd(params);
    } else {
      console.error(`未知命令: ${command}`);
      this.help();
      process.exit(1);
    }
  }

  help() {
    console.log(`
标注任务导出返工拆包清理 CLI v1.0.0

用法:
  annotation-unpack unpack <输入目录> <输出目录> [选项]
  annotation-unpack validate <文件路径>
  annotation-unpack diff <旧目录> <新目录>
  annotation-unpack help

命令说明:
  unpack    - 拆出返工包并生成复核报告
  validate  - 验证标注导出文件格式
  diff      - 对比两次拆包结果的差异

unpack 选项:
  --no-dedup          禁用去重逻辑（默认启用）
  --strict            严格模式，遇到错误立即终止
  --annotator <名单>  指定标注员名单文件（处理离职人员）
  --format <格式>     输出格式: json, csv, both (默认 both)

示例:
  annotation-unpack unpack samples/input samples/output
  annotation-unpack unpack samples/input samples/output --annotator data/active-annotators.json
  annotation-unpack diff runs/2026-05-01 runs/2026-05-18
    `);
  }

  parseOptions(params) {
    const options = {
      dedup: true,
      strict: false,
      annotatorFile: null,
      format: 'both'
    };

    const positional = [];
    let i = 0;
    while (i < params.length) {
      const arg = params[i];
      if (arg === '--no-dedup') {
        options.dedup = false;
      } else if (arg === '--strict') {
        options.strict = true;
      } else if (arg === '--annotator' && i + 1 < params.length) {
        options.annotatorFile = params[++i];
      } else if (arg === '--format' && i + 1 < params.length) {
        options.format = params[++i];
      } else {
        positional.push(arg);
      }
      i++;
    }

    return { positional, options };
  }

  unpack(params) {
    const { positional, options } = this.parseOptions(params);
    const [inputDir, outputDir] = positional;

    if (!inputDir || !outputDir) {
      console.error('错误: 请指定输入目录和输出目录');
      console.error('用法: annotation-unpack unpack <输入目录> <输出目录> [选项]');
      process.exit(1);
    }

    console.log('==================================================');
    console.log('  标注任务导出返工拆包清理 CLI');
    console.log('  Annotation Export Rework Unpack & Cleanup');
    console.log('==================================================');
    console.log(`[配置] 输入目录: ${inputDir}`);
    console.log(`[配置] 输出目录: ${outputDir}`);
    console.log(`[配置] 去重逻辑: ${options.dedup ? '启用' : '禁用'}`);
    console.log(`[配置] 严格模式: ${options.strict ? '启用' : '禁用'}`);
    console.log('');

    try {
      const engine = new UnpackEngine(options);
      const generator = new ReportGenerator();

      const inputFiles = this.scanInputFiles(inputDir);
      console.log(`[发现] 找到 ${inputFiles.length} 个标注导出文件`);

      const results = engine.process(inputFiles, inputDir);
      
      this.ensureDir(outputDir);
      generator.generate(results, outputDir, options.format);

      console.log('');
      console.log('[完成] 拆包处理完成！');
      console.log(`[统计] 总任务数: ${results.stats.totalTasks}`);
      console.log(`[统计] 返工任务数: ${results.stats.reworkTasks}`);
      console.log(`[统计] 去重排除数: ${results.stats.duplicateRemoved}`);
      console.log(`[统计] 离职排除数: ${results.stats.leftAnnotatorRemoved}`);
      console.log(`[统计] 重叠包合并数: ${results.stats.overlapMerged}`);
      console.log(`[输出] 结果已写入: ${outputDir}`);
      
    } catch (error) {
      console.error(`[错误] ${error.message}`);
      if (options.strict) {
        process.exit(1);
      }
    }
  }

  validate(params) {
    const [filePath] = params;
    if (!filePath) {
      console.error('错误: 请指定文件路径');
      process.exit(1);
    }

    try {
      const engine = new UnpackEngine({});
      const issues = engine.validateFile(filePath);
      
      if (issues.length === 0) {
        console.log('[验证通过] 文件格式正确');
      } else {
        console.log(`[发现问题] ${issues.length} 个问题:`);
        issues.forEach((issue, i) => {
          console.log(`  ${i + 1}. [${issue.level}] ${issue.message}`);
        });
        process.exit(1);
      }
    } catch (error) {
      console.error(`[错误] ${error.message}`);
      process.exit(1);
    }
  }

  diff(params) {
    const [oldDir, newDir] = params;
    if (!oldDir || !newDir) {
      console.error('错误: 请指定两个目录进行对比');
      process.exit(1);
    }

    const generator = new ReportGenerator();
    const diffResult = generator.generateDiff(oldDir, newDir);
    
    console.log(diffResult.summary);
    if (diffResult.hasChanges) {
      console.log('');
      console.log('详细变更:');
      diffResult.changes.forEach(change => {
        console.log(`  [${change.type}] ${change.description}`);
      });
    }
  }

  scanInputFiles(dir) {
    if (!fs.existsSync(dir)) {
      throw new Error(`输入目录不存在: ${dir}`);
    }

    const files = fs.readdirSync(dir)
      .filter(f => f.endsWith('.json') || f.endsWith('.csv'))
      .map(f => path.join(dir, f));

    if (files.length === 0) {
      throw new Error(`输入目录中没有找到 .json 或 .csv 文件: ${dir}`);
    }

    return files;
  }

  ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

module.exports = { CLI };
