#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');
const chalk = require('chalk');

const probe = require('../modules/probe');
const planner = require('../modules/planner');
const reporter = require('../modules/reporter');
const { EXIT_CODES } = require('../modules/reporter');

const program = new Command();

async function validateInput(input) {
  if (!input) {
    console.error(chalk.red('错误: 必须指定输入文件或目录'));
    process.exit(EXIT_CODES.NO_INPUT);
  }

  if (!fs.existsSync(input)) {
    console.error(chalk.red(`错误: 输入路径不存在: ${input}`));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  const stat = fs.statSync(input);
  if (!stat.isDirectory() && !stat.isFile()) {
    console.error(chalk.red('错误: 输入必须是文件或目录'));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  return true;
}

function validateOutputDir(outputDir) {
  if (!outputDir) return;
  
  if (!fs.existsSync(outputDir)) {
    try {
      fs.mkdirSync(outputDir, { recursive: true });
    } catch (err) {
      console.error(chalk.red(`错误: 无法创建输出目录: ${err.message}`));
      process.exit(EXIT_CODES.IO_ERROR);
    }
  }
}

function validateBitrate(bitrate) {
  if (!bitrate) return null;
  
  const match = bitrate.match(/^(\d+(?:\.\d+)?)([kKmM]?)$/);
  if (!match) {
    console.error(chalk.red(`错误: 无效的码率格式: ${bitrate}`));
    console.error(chalk.gray('支持格式: 5000k, 5M, 8000000'));
    process.exit(EXIT_CODES.INVALID_INPUT);
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();
  
  if (unit === 'm') return Math.round(value * 1000000);
  if (unit === 'k') return Math.round(value * 1000);
  return Math.round(value);
}

function validateTargetProfile(profile) {
  if (!profile) return null;
  return profile.toLowerCase();
}

async function checkFFprobe() {
  const hasFFprobe = await probe.checkFFprobe();
  if (!hasFFprobe) {
    console.error(chalk.red('错误: 未找到 ffprobe，请安装 FFmpeg'));
    console.error(chalk.gray('下载地址: https://ffmpeg.org/download.html'));
    process.exit(EXIT_CODES.NO_FFPROBE);
  }
}

program
  .name('transcode-plan')
  .description('FFmpeg 批量转码计划 CLI - 估算转码体积、检测失败风险、生成转码计划')
  .version('1.0.0');

program
  .argument('<input>', '输入媒体文件、目录或 ffprobe JSON 文件')
  .option('-t, --target <profile>', '目标规格: 480p, 720p, 1080p, 4k (自动检测)')
  .option('-b, --bitrate <bitrate>', '自定义视频码率 (如: 5M, 5000k)')
  .option('-m, --multiplier <factor>', '码率乘数 (默认: 1.0)', '1.0')
  .option('-c, --config <path>', '配置文件路径 (YAML/JSON)')
  .option('-o, --output-dir <path>', '输出目录', './transcode-plan')
  .option('--no-markdown', '不生成 Markdown 报告')
  .option('--no-json', '不生成 JSON 报告')
  .option('--batch-script', '生成批处理脚本')
  .option('--show-commands', '显示生成的转码命令')
  .option('--show-all', '显示所有文件（默认只显示有风险的）')
  .option('--min-risk <level>', '最低显示风险等级: SAFE, LOW, MEDIUM, HIGH, CRITICAL', 'LOW')
  .option('--concurrency <num>', '并行探测数', '2')
  .option('--ffprobe-path <path>', 'ffprobe 路径', 'ffprobe')
  .option('--quiet', '静默模式，只输出错误')
  .option('--extra-options <options>', '额外 FFmpeg 参数')
  .action(async (input, options) => {
    try {
      await validateInput(input);
      
      const targetProfile = validateTargetProfile(options.target);
      const customBitrate = validateBitrate(options.bitrate);
      const bitrateMultiplier = parseFloat(options.multiplier) || 1.0;
      
      validateOutputDir(options.outputDir);
      
      if (!options.quiet) {
        console.log(chalk.cyan('🔍 开始分析媒体文件...'));
      }

      await checkFFprobe();

      const plan = await planner.generatePlan(input, {
        targetProfile,
        customBitrate,
        bitrateMultiplier,
        configPath: options.config,
        outputDir: options.outputDir,
        concurrency: parseInt(options.concurrency) || 2,
        ffprobePath: options.ffprobePath,
        extraFFmpegOptions: options.extraOptions || ''
      });

      if (!options.quiet) {
        reporter.printTerminalReport(plan, {
          showDetails: true,
          showRisks: true,
          showCommands: options.showCommands,
          showAll: options.showAll,
          minRiskLevel: options.minRisk
        });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const baseName = `transcode-plan-${timestamp}`;
      const outputDir = options.outputDir;

      if (options.json !== false) {
        const jsonPath = path.join(outputDir, `${baseName}.json`);
        reporter.exportJSON(plan, jsonPath);
        if (!options.quiet) {
          console.log(chalk.green(`📄 JSON 报告已保存: ${jsonPath}`));
        }
      }

      if (options.markdown !== false) {
        const mdPath = path.join(outputDir, `${baseName}.md`);
        reporter.exportMarkdown(plan, mdPath);
        if (!options.quiet) {
          console.log(chalk.green(`📑 Markdown 报告已保存: ${mdPath}`));
        }
      }

      if (options.batchScript) {
        const scriptPath = path.join(outputDir, `${baseName}.sh`);
        planner.exportBatchScript(plan, scriptPath);
        if (!options.quiet) {
          console.log(chalk.green(`📜 批处理脚本已保存: ${scriptPath}`));
        }
      }

      const exitCode = reporter.getExitCode(plan);
      if (!options.quiet) {
        console.log('');
        if (exitCode === EXIT_CODES.SUCCESS) {
          console.log(chalk.green('✅ 分析完成，未发现严重问题'));
        } else if (exitCode === EXIT_CODES.CRITICAL_RISKS) {
          console.log(chalk.yellow('⚠️  分析完成，但检测到严重风险，请审查报告'));
        } else {
          console.log(chalk.yellow('⚠️  分析完成，存在部分问题'));
        }
      }

      process.exit(exitCode);

    } catch (err) {
      console.error(chalk.red(`\n❌ 执行失败: ${err.message}`));
      if (program.opts().verbose) {
        console.error(err.stack);
      }
      process.exit(EXIT_CODES.IO_ERROR);
    }
  });

program
  .command('probe <input>')
  .description('仅探测媒体文件，输出 ffprobe 结果')
  .option('-o, --output <path>', '输出 JSON 文件')
  .option('--concurrency <num>', '并行探测数', '2')
  .action(async (input, options) => {
    try {
      await validateInput(input);
      await checkFFprobe();

      console.log(chalk.cyan('🔍 探测媒体文件...'));

      let results;
      const stat = fs.statSync(input);
      
      if (stat.isDirectory()) {
        results = await probe.probeDirectory(input, {
          concurrency: parseInt(options.concurrency) || 2,
          onProgress: (done, total) => {
            process.stdout.write(`\r  进度: ${done}/${total}`);
          }
        });
        console.log('');
      } else {
        results = [await probe.probeFile(input)];
      }

      if (options.output) {
        fs.writeFileSync(options.output, JSON.stringify(results, null, 2));
        console.log(chalk.green(`📄 探测结果已保存: ${options.output}`));
      } else {
        console.log(JSON.stringify(results, null, 2));
      }

      process.exit(EXIT_CODES.SUCCESS);
    } catch (err) {
      console.error(chalk.red(`❌ 探测失败: ${err.message}`));
      process.exit(EXIT_CODES.IO_ERROR);
    }
  });

program
  .command('list-profiles')
  .description('列出内置的目标规格')
  .action(() => {
    const { DEFAULT_TARGET_PROFILES } = require('../modules/rules');
    
    console.log(chalk.cyan('\n📋 可用的目标规格:\n'));
    
    for (const [name, profile] of Object.entries(DEFAULT_TARGET_PROFILES)) {
      console.log(chalk.white.bold(`  ${name}`));
      console.log(`    分辨率: ${profile.width}x${profile.height}`);
      console.log(`    视频编码: ${profile.videoCodec}`);
      console.log(`    音频编码: ${profile.audioCodec}`);
      console.log(`    默认码率: ${(profile.defaultBitrate / 1000000).toFixed(1)} Mbps`);
      console.log(`    码率范围: ${(profile.minBitrate / 1000000).toFixed(1)} - ${(profile.maxBitrate / 1000000).toFixed(1)} Mbps`);
      console.log('');
    }
  });

program
  .command('list-rules')
  .description('列出内置的码率规则')
  .action(() => {
    const { DEFAULT_BITRATE_RULES } = require('../modules/rules');
    
    console.log(chalk.cyan('\n📋 内置码率规则:\n'));
    
    for (const rule of DEFAULT_BITRATE_RULES) {
      console.log(chalk.white.bold(`  ${rule.id} (${rule.name})`));
      console.log(`    优先级: ${rule.priority}`);
      console.log(`    乘数: ${rule.multiplier}x`);
      console.log(`    条件:`);
      for (const [key, value] of Object.entries(rule.conditions)) {
        console.log(`      - ${key}: ${value}`);
      }
      console.log('');
    }
  });

program
  .addHelpText('after', `
退出码说明:
  0 - 成功，无严重问题
  1 - 未指定输入
  2 - 无效输入
  3 - 未找到 ffprobe
  4 - 检测到严重风险
  5 - 部分文件分析失败
  6 - IO 错误

示例:
  # 分析单个视频文件
  transcode-plan video.mp4

  # 分析目录下所有视频，目标 1080p
  transcode-plan ./videos -t 1080p

  # 自定义码率 4Mbps，生成批处理脚本
  transcode-plan ./videos -b 4M --batch-script

  # 使用配置文件，输出到指定目录
  transcode-plan ./videos -c ./config.yaml -o ./reports

  # 仅探测媒体信息
  transcode-plan probe ./videos -o probe-results.json

  # 显示所有文件和转码命令
  transcode-plan ./videos --show-all --show-commands
`);

program.parseAsync(process.argv);
