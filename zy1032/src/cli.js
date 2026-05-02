#!/usr/bin/env node

const { program } = require('commander');
const path = require('path');
const fs = require('fs');
const { scanDirectory, hasLastScanResult, getLastScanResult } = require('./index');
const { generateConsoleReport, generateJson, generateMarkdown, generateHtml } = require('./reporter');

const packageJson = require('../package.json');

program
  .name('a11y-smoke')
  .description('本地前端无障碍冒烟巡检器 - 快速扫描可访问性问题')
  .version(packageJson.version);

program
  .command('scan')
  .description('扫描目录中的可访问性问题')
  .argument('<directory>', '要扫描的目标目录')
  .option('-c, --config <path>', '配置文件路径')
  .option('-o, --output <path>', '输出 JSON 报告文件路径')
  .option('-f, --format <format>', '输出格式: console, json, md, html (默认: console)', 'console')
  .action(async (directory, options) => {
    try {
      const targetDir = path.resolve(directory);
      
      if (!fs.existsSync(targetDir)) {
        console.error(`❌ 错误: 目录不存在: ${targetDir}`);
        process.exit(1);
      }
      
      const stats = fs.statSync(targetDir);
      if (!stats.isDirectory()) {
        console.error(`❌ 错误: 不是一个目录: ${targetDir}`);
        process.exit(1);
      }
      
      console.log(`🔍 开始扫描目录: ${targetDir}`);
      console.log();
      
      const result = scanDirectory(targetDir, {
        configPath: options.config ? path.resolve(options.config) : undefined
      });
      
      const { issues, filesScanned } = result;
      
      console.log(`✅ 扫描完成，共扫描 ${filesScanned} 个文件`);
      
      if (options.format === 'json') {
        const outputPath = options.output || path.join(process.cwd(), 'a11y-report.json');
        const jsonPath = generateJson(issues, targetDir, outputPath);
        console.log(`\n📄 JSON 报告已生成: ${jsonPath}`);
      } else if (options.format === 'md' || options.format === 'markdown') {
        const outputPath = options.output || path.join(process.cwd(), 'a11y-report.md');
        const mdPath = generateMarkdown(issues, targetDir, outputPath);
        console.log(`\n📄 Markdown 报告已生成: ${mdPath}`);
      } else if (options.format === 'html') {
        const outputPath = options.output || path.join(process.cwd(), 'a11y-report.html');
        const htmlPath = generateHtml(issues, targetDir, outputPath);
        console.log(`\n🌐 HTML 报告已生成: ${htmlPath}`);
        console.log(`   可以在浏览器中打开此文件查看详细报告`);
      } else {
        console.log(generateConsoleReport(issues, targetDir));
      }
      
      const errorCount = issues.filter(i => i.severity === 'error').length;
      if (errorCount > 0) {
        process.exit(1);
      }
      
    } catch (error) {
      console.error(`❌ 扫描失败: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('report')
  .description('根据最近的扫描结果生成报告')
  .option('-f, --format <format>', '输出格式: json, md, html (默认: html)', 'html')
  .option('-o, --output <path>', '输出文件路径')
  .option('-s, --source <directory>', '重新扫描指定目录并生成报告')
  .option('-c, --config <path>', '配置文件路径 (仅与 --source 配合使用)')
  .action(async (options) => {
    try {
      let issues;
      let targetDir;
      
      if (options.source) {
        const sourceDir = path.resolve(options.source);
        
        if (!fs.existsSync(sourceDir)) {
          console.error(`❌ 错误: 目录不存在: ${sourceDir}`);
          process.exit(1);
        }
        
        console.log(`🔍 重新扫描目录: ${sourceDir}`);
        
        const result = scanDirectory(sourceDir, {
          configPath: options.config ? path.resolve(options.config) : undefined
        });
        
        issues = result.issues;
        targetDir = result.targetDir;
        
        console.log(`✅ 扫描完成，找到 ${issues.length} 个问题`);
      } else {
        if (!hasLastScanResult()) {
          console.error(`❌ 错误: 没有找到最近的扫描结果`);
          console.error(`   请先运行 "a11y-smoke scan <directory>" 或使用 --source 选项`);
          process.exit(1);
        }
        
        const lastResult = getLastScanResult();
        issues = lastResult.issues;
        targetDir = lastResult.targetDir;
      }
      
      let outputPath = options.output;
      
      if (options.format === 'json') {
        if (!outputPath) {
          outputPath = path.join(process.cwd(), 'a11y-report.json');
        }
        const savedPath = generateJson(issues, targetDir, outputPath);
        console.log(`\n📄 JSON 报告已生成: ${savedPath}`);
      } else if (options.format === 'md' || options.format === 'markdown') {
        if (!outputPath) {
          outputPath = path.join(process.cwd(), 'a11y-report.md');
        }
        const savedPath = generateMarkdown(issues, targetDir, outputPath);
        console.log(`\n📄 Markdown 报告已生成: ${savedPath}`);
      } else {
        if (!outputPath) {
          outputPath = path.join(process.cwd(), 'a11y-report.html');
        }
        const savedPath = generateHtml(issues, targetDir, outputPath);
        console.log(`\n🌐 HTML 报告已生成: ${savedPath}`);
        console.log(`   可以在浏览器中打开此文件查看详细报告`);
      }
      
    } catch (error) {
      console.error(`❌ 生成报告失败: ${error.message}`);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program
  .command('rules')
  .description('列出所有可用的可访问性规则')
  .action(() => {
    const rules = [
      { id: 'img-alt', name: '图片缺少 alt 属性', severity: 'error', description: '所有图片都应该有 alt 属性，装饰性图片使用空 alt=""' },
      { id: 'form-label', name: '表单控件缺少标签关联', severity: 'error', description: '所有表单控件都应该有相关联的标签' },
      { id: 'button-text', name: '按钮缺少可读文本', severity: 'error', description: '按钮应该有可见文本或 aria-label' },
      { id: 'link-text', name: '链接缺少可读文本', severity: 'error', description: '链接应该有描述性文本，避免"点击这里"等模糊描述' },
      { id: 'duplicate-id', name: '重复的 id 属性', severity: 'error', description: 'id 属性在页面中应该是唯一的' },
      { id: 'tabindex', name: 'tabindex 风险', severity: 'warning', description: '避免使用正数 tabindex，它会破坏自然的 Tab 顺序' },
      { id: 'aria-misuse', name: 'ARIA 属性误用', severity: 'error', description: '检查常见的 ARIA 错误使用' },
      { id: 'color-contrast', name: '颜色对比度不足', severity: 'warning', description: '检查前景色和背景色的对比度是否符合 WCAG 标准' }
    ];
    
    console.log('\n╔════════════════════════════════════════════════════════════╗');
    console.log('║                    可用的可访问性规则                        ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    for (const rule of rules) {
      const severityIcon = rule.severity === 'error' ? '🔴' : '🟡';
      const severityLabel = rule.severity === 'error' ? '错误' : '警告';
      
      console.log(`${severityIcon} [${rule.id}] (${severityLabel})`);
      console.log(`   ${rule.name}`);
      console.log(`   ${rule.description}`);
      console.log();
    }
    
    console.log('💡 可以在配置文件中禁用或调整规则的严重级别');
    console.log('   示例配置文件: a11y-smoke.config.json');
    console.log();
  });

program
  .command('init')
  .description('在当前目录初始化配置文件')
  .action(() => {
    const configPath = path.join(process.cwd(), 'a11y-smoke.config.json');
    
    if (fs.existsSync(configPath)) {
      console.error(`❌ 配置文件已存在: ${configPath}`);
      process.exit(1);
    }
    
    const defaultConfig = {
      rules: {
        'img-alt': { enabled: true, severity: 'error' },
        'form-label': { enabled: true, severity: 'error' },
        'button-text': { enabled: true, severity: 'error' },
        'link-text': { enabled: true, severity: 'error' },
        'duplicate-id': { enabled: true, severity: 'error' },
        'tabindex': { enabled: true, severity: 'warning' },
        'aria-misuse': { enabled: true, severity: 'error' },
        'color-contrast': { enabled: true, severity: 'warning' }
      },
      contrastThreshold: 4.5,
      ignorePatterns: [
        'node_modules/**',
        'dist/**',
        'build/**',
        '.git/**',
        '*.min.css',
        'vendor/**'
      ],
      fileExtensions: ['.html', '.jsx', '.tsx', '.css']
    };
    
    fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf-8');
    
    console.log(`✅ 配置文件已创建: ${configPath}`);
    console.log();
    console.log('📋 配置说明:');
    console.log('   - rules: 控制每个规则的启用状态和严重级别');
    console.log('   - contrastThreshold: 颜色对比度阈值 (默认 4.5, 符合 WCAG AA)');
    console.log('   - ignorePatterns: 忽略的文件/目录模式');
    console.log('   - fileExtensions: 要扫描的文件扩展名');
    console.log();
  });

program.parse(process.argv);

if (!process.argv.slice(2).length) {
  program.outputHelp();
}
