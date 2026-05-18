#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const fs = require('fs');
const ResumeDeduplicator = require('../src/deduplicator');

const argv = yargs
  .scriptName('resume-dedup')
  .usage('$0 [选项]')
  .example('$0 -r resumes.csv -c channels.csv -b blacklist.csv -o suggestions.csv', '运行简历查重并生成建议表')
  .option('resumes', {
    alias: 'r',
    describe: '简历CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('channels', {
    alias: 'c',
    describe: '渠道表CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('blacklist', {
    alias: 'b',
    describe: '黑名单CSV文件路径',
    type: 'string',
    demandOption: true
  })
  .option('output', {
    alias: 'o',
    describe: '输出建议表CSV文件路径',
    type: 'string',
    default: 'suggestions.csv'
  })
  .option('phone-field', {
    describe: '手机号字段名',
    type: 'string',
    default: '手机号'
  })
  .option('email-field', {
    describe: '邮箱字段名',
    type: 'string',
    default: '邮箱'
  })
  .option('name-field', {
    describe: '姓名字段名',
    type: 'string',
    default: '姓名'
  })
  .option('source-field', {
    describe: '来源渠道字段名',
    type: 'string',
    default: '来源渠道'
  })
  .option('id-field', {
    describe: '简历编号字段名',
    type: 'string',
    default: '简历编号'
  })
  .help('h')
  .alias('h', 'help')
  .epilogue('简历来源文件候选人查重整理 CLI - 按手机邮箱生成合并建议')
  .argv;

async function main() {
  console.log('========================================');
  console.log('    简历来源文件候选人查重整理 CLI');
  console.log('========================================');
  console.log('');
  
  const files = {
    '简历文件': argv.resumes,
    '渠道表': argv.channels,
    '黑名单': argv.blacklist
  };
  
  Object.entries(files).forEach(([name, filePath]) => {
    const absPath = path.resolve(filePath);
    if (!fs.existsSync(absPath)) {
      console.error(`❌ 错误: ${name}不存在: ${absPath}`);
      process.exit(1);
    }
    console.log(`📁 ${name}: ${absPath}`);
  });
  
  console.log('');
  console.log('⏳ 正在加载数据文件...');
  
  const deduplicator = new ResumeDeduplicator({
    phoneField: argv['phone-field'],
    emailField: argv['email-field'],
    nameField: argv['name-field'],
    sourceField: argv['source-field'],
    idField: argv['id-field']
  });
  
  try {
    await deduplicator.loadResumes(path.resolve(argv.resumes));
    console.log(`   ✓ 简历文件加载完成: ${deduplicator.resumes.length} 条记录`);
    
    await deduplicator.loadChannels(path.resolve(argv.channels));
    console.log(`   ✓ 渠道表加载完成: ${deduplicator.channels.size} 个渠道`);
    
    await deduplicator.loadBlacklist(path.resolve(argv.blacklist));
    console.log(`   ✓ 黑名单加载完成: ${deduplicator.blacklist.size} 条记录`);
  } catch (err) {
    console.error('');
    console.error(`❌ 加载失败: ${err.message}`);
    process.exit(1);
  }
  
  if (deduplicator.errors.length > 0) {
    console.log('');
    console.log(`⚠️  解析过程中发现 ${deduplicator.errors.length} 条错误记录:`);
    deduplicator.errors.slice(0, 5).forEach((err, idx) => {
      console.log(`   ${idx + 1}. [${err.file}] 第${err.line}行: ${err.message}`);
    });
    if (deduplicator.errors.length > 5) {
      console.log(`   ...还有 ${deduplicator.errors.length - 5} 条错误请查看输出文件`);
    }
  }
  
  console.log('');
  console.log('🔍 正在分析重复记录...');
  
  const outputPath = path.resolve(argv.output);
  const report = await deduplicator.generateReport(outputPath);
  
  console.log('');
  console.log('========================================');
  console.log('            📊 查重结果报告');
  console.log('========================================');
  console.log('');
  console.log('📈 统计信息:');
  Object.entries(report.details).forEach(([key, value]) => {
    console.log(`   ${key}: ${value}`);
  });
  console.log('');
  
  const duplicates = deduplicator.findDuplicates();
  if (duplicates.length > 0) {
    console.log('🔄 发现的重复组:');
    duplicates.forEach((group, idx) => {
      console.log(``);
      console.log(`   【组 ${idx + 1}】${group.matchType}: ${group.matchValue}`);
      console.log(`   ├─ 共 ${group.totalCount} 条记录, ${group.phoneMissingCount} 条缺手机号, ${group.emailMissingCount} 条缺邮箱`);
      console.log(`   ├─ ★ 主记录: #${group.primary.id} [${group.primary.name}] ${group.primary.phone || '(无电话)'} ${group.primary.email || '(无邮箱)'} - ${group.primary.source}`);
      console.log(`   │     选择理由: ${group.primary.reason}`);
      group.duplicates.forEach((dup, dIdx) => {
        console.log(`   ${dIdx === group.duplicates.length - 1 ? '└' : '├'}─ ◇ 重复: #${dup.id} [${dup.name}] ${dup.phone || '(无电话)'} ${dup.email || '(无邮箱)'} - ${dup.source}`);
        console.log(`         建议: ${dup.suggestion}`);
      });
    });
  } else {
    console.log('✅ 未发现重复记录');
  }
  
  console.log('');
  console.log('========================================');
  console.log(`✅ 查重建议表已生成: ${outputPath}`);
  console.log('========================================');
}

main().catch(err => {
  console.error('');
  console.error('❌ 程序运行出错:');
  console.error(err.stack);
  process.exit(1);
});
