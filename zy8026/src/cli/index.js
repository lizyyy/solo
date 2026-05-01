import { Command } from 'commander';
import { parseShotList, parseMetadata, parseSRT, parseRules } from '../parsers/index.js';
import { checkFileNaming, checkDuration, checkSubtitles, checkFormat } from '../rules/index.js';
import { generateMarkdown, generateCSV } from '../reports/index.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function runCLI() {
  const program = new Command();

  program
    .name('vqc')
    .description('短视频素材质检 CLI 工具')
    .version('1.0.0');

  program
    .command('check')
    .description('执行素材质量检查')
    .option('-d, --media-dir <path>', '素材目录路径', './media')
    .option('-c, --csv <path>', '镜头清单 CSV 文件路径', './shot_list.csv')
    .option('-m, --metadata <path>', 'ffprobe 导出的媒体元数据 JSON 文件路径', './metadata.json')
    .option('-s, --srt <path>', '字幕 SRT 文件路径', './subtitle.srt')
    .option('-r, --rules <path>', '平台规则 YAML 文件路径', './rules.yaml')
    .option('-o, --output <path>', '报告输出目录', './reports')
    .action(async (options) => {
      try {
        await executeCheck(options);
      } catch (error) {
        console.error('检查失败:', error.message);
        process.exit(1);
      }
    });

  program
    .command('demo')
    .description('运行内置样例数据的演示')
    .action(async () => {
      try {
        const sampleDir = path.join(__dirname, '../../sample');
        await executeCheck({
          mediaDir: path.join(sampleDir, 'media'),
          csv: path.join(sampleDir, 'shot_list.csv'),
          metadata: path.join(sampleDir, 'metadata.json'),
          srt: path.join(sampleDir, 'subtitle.srt'),
          rules: path.join(sampleDir, 'rules.yaml'),
          output: './demo_report'
        });
        console.log('演示完成！报告已生成在 demo_report 目录');
      } catch (error) {
        console.error('演示失败:', error.message);
        process.exit(1);
      }
    });

  program.parse();
}

async function executeCheck(options) {
  console.log('开始质量检查...');
  console.log('参数:', options);

  const { mediaDir, csv, metadata, srt, rules, output } = options;

  const shotList = parseShotList(csv);
  const mediaMetadata = parseMetadata(metadata);
  const subtitles = parseSRT(srt);
  const platformRules = parseRules(rules);

  const issues = [];

  issues.push(...checkFileNaming(shotList, mediaDir));
  issues.push(...checkDuration(shotList, mediaMetadata, platformRules));
  issues.push(...checkSubtitles(subtitles, mediaMetadata, shotList, platformRules));
  issues.push(...checkFormat(shotList, mediaMetadata, platformRules));

  console.log(`检查完成，发现 ${issues.length} 个问题`);
  
  const errors = issues.filter(i => i.severity === 'error');
  const warnings = issues.filter(i => i.severity === 'warning');
  
  console.log(`  - 错误: ${errors.length}`);
  console.log(`  - 警告: ${warnings.length}`);

  await generateReports(issues, output);
  
  console.log(`报告已导出到 ${output}`);
}

async function generateReports(issues, outputDir) {
  try {
    await fs.access(outputDir);
  } catch {
    await fs.mkdir(outputDir, { recursive: true });
  }

  const mdPath = path.join(outputDir, 'report.md');
  const csvPath = path.join(outputDir, 'report.csv');

  generateMarkdown(issues, mdPath);
  generateCSV(issues, csvPath);
}

import fs from 'fs/promises';