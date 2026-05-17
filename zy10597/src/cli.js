#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs');
const path = require('path');

const CookieParser = require('./parser');
const CookieAuditor = require('./auditor');
const Reporter = require('./reporter');

const program = new Command();

program
  .name('cookie-audit')
  .description('浏览器Cookie域审计CLI - 审计多个子域共享登录后的Cookie设置')
  .version('1.0.0');

program
  .command('audit')
  .description('审计Cookie文件或目录')
  .argument('<source>', 'Cookie文件路径或目录路径')
  .option('-d, --domain <domains...>', '指定目标域名用于冲突检测 (可多个)')
  .option('-o, --output <directory>', '报告输出目录', './audit-reports')
  .option('--no-color', '禁用彩色输出')
  .action(async (source, options) => {
    try {
      if (options.color === false) {
        process.env.FORCE_COLOR = '0';
      }

      const parser = new CookieParser();
      const auditor = new CookieAuditor();
      const reporter = new Reporter(options.output);

      let allCookies = [];
      let inputInfo = {
        source,
        type: null,
        files: []
      };

      const stats = fs.statSync(source);
      
      if (stats.isDirectory()) {
        inputInfo.type = 'directory';
        const results = parser.parseDirectory(source);
        inputInfo.files = results.map(r => r.filePath);
        results.forEach(r => {
          if (r.cookies) {
            allCookies = allCookies.concat(r.cookies);
          }
        });
      } else if (stats.isFile()) {
        inputInfo.type = 'file';
        inputInfo.files = [source];
        const result = parser.parseFile(source);
        if (result.cookies) {
          allCookies = result.cookies;
        }
      } else {
        console.error('错误: 源必须是文件或目录');
        process.exit(1);
      }

      const targetDomains = options.domain || [];
      const auditResult = auditor.auditAllCookies(allCookies, targetDomains);

      const reportPaths = reporter.generateReport(auditResult, inputInfo);
      
      reporter.printConsoleSummary(auditResult, reportPaths);

    } catch (error) {
      console.error('审计失败:', error.message);
      console.error('\n错误详情:', error.stack);
      process.exit(1);
    }
  });

program
  .command('parse')
  .description('仅解析Cookie文件，不进行审计')
  .argument('<file>', 'Cookie文件路径')
  .option('-f, --format <format>', '输出格式: json, table', 'json')
  .action((file, options) => {
    try {
      const parser = new CookieParser();
      const result = parser.parseFile(file);
      
      if (options.format === 'table') {
        console.table(result.cookies.map(c => ({
          name: c.name,
          domain: c.domain,
          path: c.path,
          sameSite: c.sameSite,
          secure: c.secure,
          httpOnly: c.httpOnly,
          expires: c.expires ? new Date(c.expires).toLocaleDateString() : 'session'
        })));
      } else {
        console.log(JSON.stringify(result, null, 2));
      }
    } catch (error) {
      console.error('解析失败:', error.message);
      process.exit(1);
    }
  });

program
  .command('list-reports')
  .description('列出已生成的审计报告')
  .option('-o, --output <directory>', '报告目录', './audit-reports')
  .action((options) => {
    try {
      const outputDir = options.output;
      
      if (!fs.existsSync(outputDir)) {
        console.log('报告目录不存在');
        return;
      }

      const files = fs.readdirSync(outputDir)
        .filter(f => f.endsWith('.json') || f.endsWith('.md'))
        .sort()
        .reverse();

      if (files.length === 0) {
        console.log('未找到报告文件');
        return;
      }

      console.log('已生成的报告:\n');
      files.forEach(f => {
        const filePath = path.join(outputDir, f);
        const stats = fs.statSync(filePath);
        console.log(`  ${f} (${Math.round(stats.size / 1024)}KB)`);
      });
    } catch (error) {
      console.error('列出报告失败:', error.message);
      process.exit(1);
    }
  });

program.parseAsync();
