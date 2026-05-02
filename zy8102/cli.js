#!/usr/bin/env node

import { Command } from 'commander';
import { ConfigParser } from './src/config-parser.js';
import { RuleEngine } from './src/rule-engine.js';
import { ReportRenderer } from './src/report-renderer.js';
import fs from 'fs';

const program = new Command();

program
  .name('screenshot-checker')
  .description('移动端截图本地化遮挡预检工具')
  .version('1.0.0');

program
  .command('analyze')
  .description('分析截图并生成报告')
  .option('--demo', '使用内置示例数据运行演示')
  .option('--input <dir>', '截图目录路径', 'screenshots')
  .option('--output <dir>', '输出目录路径', 'output')
  .option('--manifest <file>', 'screen_manifest.csv路径', 'screenshots/screen_manifest.csv')
  .option('--rules <file>', 'layout_rules.yaml路径', 'screenshots/layout_rules.yaml')
  .action(async (options) => {
    try {
      if (options.demo) {
        await runDemo();
        return;
      }

      const manifest = ConfigParser.parseManifest(options.manifest);
      const layoutRules = ConfigParser.parseLayoutRules(options.rules);
      const groups = ConfigParser.groupByDevicePageLanguage(manifest);

      const ruleEngine = new RuleEngine(layoutRules);
      const allIssues = [];

      for (const group of groups) {
        const issues = await ruleEngine.analyzeGroup(group, options.input);
        allIssues.push(...issues);
      }

      if (!fs.existsSync(options.output)) {
        fs.mkdirSync(options.output, { recursive: true });
      }

      ReportRenderer.generateCSV(allIssues, `${options.output}/issues.csv`);
      ReportRenderer.generateMarkdown(allIssues, `${options.output}/review.md`);
      ReportRenderer.generateHTML(allIssues, manifest, layoutRules, options.input, `${options.output}/preview.html`);

      console.log(`\n✅ 分析完成！`);
      console.log(`📊 问题总数: ${allIssues.length}`);
      console.log(`   - 严重: ${allIssues.filter(i => i.severity === 'critical').length}`);
      console.log(`   - 错误: ${allIssues.filter(i => i.severity === 'error').length}`);
      console.log(`   - 警告: ${allIssues.filter(i => i.severity === 'warning').length}`);
      console.log(`\n📁 输出文件:`);
      console.log(`   - ${options.output}/issues.csv`);
      console.log(`   - ${options.output}/review.md`);
      console.log(`   - ${options.output}/preview.html (可在浏览器中打开)`);

    } catch (error) {
      console.error(`❌ 分析失败: ${error.message}`);
      process.exit(1);
    }
  });

async function runDemo() {
  const demoDir = 'demo_screenshots';
  
  if (!fs.existsSync(demoDir)) {
    fs.mkdirSync(demoDir, { recursive: true });
  }

  const manifestContent = `device,page,language,filename,base_language,dpr
iPhone15,home,en,home_en.png,en,3
iPhone15,home,zh,home_zh.png,en,3
iPhone15,home,ja,home_ja.png,en,3
iPhone15,settings,en,settings_en.png,en,3
iPhone15,settings,zh,settings_zh.png,en,3
iPhone14,home,en,home_en_iphone14.png,en,2
iPhone14,home,zh,home_zh_iphone14.png,en,2`;
  fs.writeFileSync(`${demoDir}/screen_manifest.csv`, manifestContent);

  const rulesContent = `safe_areas:
  iPhone15:
    top: 47
    bottom: 34
    left: 0
    right: 0
  iPhone14:
    top: 47
    bottom: 30
    left: 0
    right: 0

text_regions:
  - device: iPhone15
    page: home
    x: 50
    y: 200
    width: 280
    height: 40
  - device: iPhone15
    page: home
    x: 50
    y: 260
    width: 280
    height: 60
  - device: iPhone15
    page: settings
    x: 50
    y: 150
    width: 280
    height: 40
  - device: iPhone14
    page: home
    x: 40
    y: 160
    width: 220
    height: 32

button_regions:
  - device: iPhone15
    page: home
    x: 50
    y: 750
    width: 280
    height: 50
  - device: iPhone14
    page: home
    x: 40
    y: 600
    width: 220
    height: 40

truncation_checks:
  - device: iPhone15
    page: home
    region:
      x: 250
      y: 200
      width: 80
      height: 40
  - device: iPhone15
    page: settings
    region:
      x: 260
      y: 150
      width: 70
      height: 40`;
  fs.writeFileSync(`${demoDir}/layout_rules.yaml`, rulesContent);

  await generateDemoImages(demoDir);

  console.log('📦 正在准备示例数据...\n');

  const manifest = ConfigParser.parseManifest(`${demoDir}/screen_manifest.csv`);
  const layoutRules = ConfigParser.parseLayoutRules(`${demoDir}/layout_rules.yaml`);
  const groups = ConfigParser.groupByDevicePageLanguage(manifest);

  const ruleEngine = new RuleEngine(layoutRules);
  const allIssues = [];

  for (const group of groups) {
    const issues = await ruleEngine.analyzeGroup(group, demoDir);
    allIssues.push(...issues);
  }

  const outputDir = 'demo_output';
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  ReportRenderer.generateCSV(allIssues, `${outputDir}/issues.csv`);
  ReportRenderer.generateMarkdown(allIssues, `${outputDir}/review.md`);
  ReportRenderer.generateHTML(allIssues, manifest, layoutRules, demoDir, `${outputDir}/preview.html`);

  console.log(`✅ 演示完成！`);
  console.log(`📊 问题总数: ${allIssues.length}`);
  console.log(`   - 严重: ${allIssues.filter(i => i.severity === 'critical').length}`);
  console.log(`   - 错误: ${allIssues.filter(i => i.severity === 'error').length}`);
  console.log(`   - 警告: ${allIssues.filter(i => i.severity === 'warning').length}`);
  console.log(`\n📁 输出文件:`);
  console.log(`   - ${outputDir}/issues.csv`);
  console.log(`   - ${outputDir}/review.md`);
  console.log(`   - ${outputDir}/preview.html (可在浏览器中打开)`);
}

async function generateDemoImages(demoDir) {
  import('jimp').then(({ default: Jimp }) => {
    const images = [
      { name: 'home_en.png', width: 393, height: 852 },
      { name: 'home_zh.png', width: 393, height: 852 },
      { name: 'home_ja.png', width: 393, height: 850 },
      { name: 'settings_en.png', width: 393, height: 852 },
      { name: 'settings_zh.png', width: 393, height: 852 },
      { name: 'home_en_iphone14.png', width: 320, height: 690 },
      { name: 'home_zh_iphone14.png', width: 320, height: 690 }
    ];

    images.forEach(async (img) => {
      const image = new Jimp(img.width, img.height, 0xffffff);
      await image.writeAsync(`${demoDir}/${img.name}`);
    });
  });
}

program.parse();
