#!/usr/bin/env node

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const PermissionAuditScanner = require('../src/scanner');

const argv = yargs(hideBin(process.argv))
  .scriptName('perm-scan')
  .usage('$0 <command> [options]')
  .command(
    'scan <directory>',
    '扫描权限审计日志，检测过期仍访问用户',
    (yargs) => {
      yargs
        .positional('directory', {
          describe: '包含CSV审计日志文件的目录路径',
          type: 'string'
        })
        .option('date', {
          alias: 'd',
          describe: '审计基准日期 (格式: YYYY-MM-DD)',
          type: 'string',
          default: new Date().toISOString().split('T')[0]
        })
        .option('format', {
          alias: 'f',
          describe: '输出格式',
          choices: ['text', 'json'],
          default: 'text'
        })
        .option('output', {
          alias: 'o',
          describe: '输出文件路径 (默认: 标准输出)',
          type: 'string'
        });
    },
    async (argv) => {
      try {
        const scanner = new PermissionAuditScanner({
          auditDate: argv.date
        });
        
        const report = await scanner.scanDirectory(argv.directory);
        const output = scanner.formatReport(report, argv.format);
        
        if (argv.output) {
          const fs = require('fs');
          fs.writeFileSync(argv.output, output, 'utf-8');
          console.log(`权限审计日志临权到期巡检报告已写入: ${argv.output}`);
        } else {
          console.log(output);
        }
        
        process.exit(report.summary.过期仍访问用户数 > 0 ? 2 : 0);
      } catch (error) {
        console.error('权限审计日志临权到期巡检执行失败:');
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'validate <file>',
    '验证单个CSV文件格式是否符合要求',
    (yargs) => {
      yargs
        .positional('file', {
          describe: 'CSV文件路径',
          type: 'string'
        });
    },
    async (argv) => {
      try {
        const scanner = new PermissionAuditScanner();
        const path = require('path');
        const fs = require('fs');
        
        const dir = path.dirname(argv.file);
        const tempDir = path.join(dir, '.temp-validate');
        
        if (!fs.existsSync(tempDir)) {
          fs.mkdirSync(tempDir);
        }
        
        const tempFile = path.join(tempDir, path.basename(argv.file));
        fs.copyFileSync(argv.file, tempFile);
        
        const report = await scanner.scanDirectory(tempDir);
        
        fs.rmSync(tempDir, { recursive: true, force: true });
        
        console.log('='.repeat(70));
        console.log('权限审计日志临权到期巡检 - 文件验证结果');
        console.log('='.repeat(70));
        console.log(`验证文件: ${path.basename(argv.file)}`);
        console.log(`发现问题数: ${report.summary.发现问题数}`);
        console.log(`警告数: ${report.summary.警告数}`);
        
        if (report['数据问题详情'].length > 0) {
          console.log('\n数据问题:');
          report['数据问题详情'].forEach(issue => {
            console.log(`  - 行 ${issue.行号}: ${issue.问题类型} - ${JSON.stringify(issue.详细信息)}`);
          });
        }
        
        if (report['处理警告'].length > 0) {
          console.log('\n警告:');
          report['处理警告'].forEach(warn => {
            console.log(`  - ${warn.警告信息}`);
          });
        }
        
        console.log('='.repeat(70));
        
        process.exit(report.summary.发现问题数 > 0 ? 1 : 0);
      } catch (error) {
        console.error('权限审计日志临权到期巡检验证失败:');
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .command(
    'diff <oldReport> <newReport>',
    '对比两次巡检报告的差异 (令牌刷新、部门调整、权限继承变化)',
    (yargs) => {
      yargs
        .positional('oldReport', {
          describe: '旧报告JSON文件路径',
          type: 'string'
        })
        .positional('newReport', {
          describe: '新报告JSON文件路径',
          type: 'string'
        });
    },
    async (argv) => {
      try {
        const fs = require('fs');
        const oldReport = JSON.parse(fs.readFileSync(argv.oldReport, 'utf-8'));
        const newReport = JSON.parse(fs.readFileSync(argv.newReport, 'utf-8'));
        
        console.log('='.repeat(70));
        console.log('权限审计日志临权到期巡检 - 报告差异对比');
        console.log('='.repeat(70));
        console.log(`旧报告日期: ${oldReport.summary.扫描日期}`);
        console.log(`新报告日期: ${newReport.summary.扫描日期}`);
        console.log('');
        
        const oldUsers = new Map(oldReport['过期仍访问用户列表'].map(u => [u.用户ID, u]));
        const newUsers = new Map(newReport['过期仍访问用户列表'].map(u => [u.用户ID, u]));
        
        const added = [...newUsers.keys()].filter(id => !oldUsers.has(id));
        const removed = [...oldUsers.keys()].filter(id => !newUsers.has(id));
        const changed = [...newUsers.keys()].filter(id => oldUsers.has(id));
        
        console.log(`【用户数量变化】`);
        console.log(`  旧报告用户数: ${oldUsers.size}`);
        console.log(`  新报告用户数: ${newUsers.size}`);
        console.log(`  新增用户数: ${added.length}`);
        console.log(`  移除用户数: ${removed.length}`);
        console.log(`  可能变更用户数: ${changed.length}`);
        console.log('');
        
        if (added.length > 0) {
          console.log('【新增过期仍访问用户】');
          added.forEach(id => {
            const u = newUsers.get(id);
            console.log(`  + ${u.用户名} (${u.用户ID})`);
            console.log(`    部门: ${u.部门} | 权限来源: ${u.权限来源}`);
            console.log(`    权限令牌: ${u.权限令牌}`);
          });
          console.log('');
        }
        
        if (removed.length > 0) {
          console.log('【不再过期仍访问的用户】');
          removed.forEach(id => {
            const u = oldUsers.get(id);
            console.log(`  - ${u.用户名} (${u.用户ID})`);
            console.log(`    部门: ${u.部门} | 权限来源: ${u.权限来源}`);
          });
          console.log('');
        }
        
        if (changed.length > 0) {
          console.log('【用户信息变更检测】');
          changed.forEach(id => {
            const oldU = oldUsers.get(id);
            const newU = newUsers.get(id);
            const changes = [];
            
            if (oldU.部门 !== newU.部门) {
              changes.push(`部门: "${oldU.部门}" → "${newU.部门}"`);
            }
            if (oldU.权限令牌 !== newU.权限令牌) {
              changes.push(`权限令牌刷新: "${oldU.权限令牌}" → "${newU.权限令牌}"`);
            }
            if (oldU.权限来源 !== newU.权限来源) {
              changes.push(`权限继承变更: "${oldU.权限来源}" → "${newU.权限来源}"`);
            }
            if (oldU.过期天数 !== newU.过期天数) {
              changes.push(`过期天数: ${oldU.过期天数} → ${newU.过期天数}`);
            }
            
            if (changes.length > 0) {
              console.log(`  ~ ${newU.用户名} (${newU.用户ID})`);
              changes.forEach(c => console.log(`    ${c}`));
            }
          });
          console.log('');
        }
        
        console.log(`【统计数据变化】`);
        console.log(`  处理文件数: ${oldReport.summary.处理文件数} → ${newReport.summary.处理文件数}`);
        console.log(`  发现问题数: ${oldReport.summary.发现问题数} → ${newReport.summary.发现问题数}`);
        console.log(`  警告数: ${oldReport.summary.警告数} → ${newReport.summary.警告数}`);
        console.log('');
        console.log('='.repeat(70));
        console.log('差异对比结束 - 权限审计日志临权到期巡检');
        console.log('='.repeat(70));
        
        process.exit(added.length > 0 || removed.length > 0 ? 1 : 0);
      } catch (error) {
        console.error('权限审计日志临权到期巡检差异对比失败:');
        console.error(error.message);
        process.exit(1);
      }
    }
  )
  .example('$0 scan ./audit-logs', '扫描审计日志目录')
  .example('$0 scan ./audit-logs -f json -o report.json', '输出JSON格式报告到文件')
  .example('$0 diff old-report.json new-report.json', '对比两次巡检报告差异')
  .demandCommand(1, '请指定一个命令')
  .help()
  .version('1.0.0')
  .epilog('权限审计日志临权到期巡检 CLI v1.0.0')
  .argv;
