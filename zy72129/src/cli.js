#!/usr/bin/env node

const yargs = require('yargs');
const path = require('path');
const config = require('./config');
const ReviewService = require('./reviewService');

async function main() {
  yargs
    .command(
      'scan',
      '扫描音频目录并执行响度审查',
      (yargs) => {
        return yargs
          .option('audio-dir', {
            describe: '音频文件目录',
            default: config.paths.audio
          })
          .option('tracklist', {
            describe: '曲目表文件路径'
          })
          .option('notes', {
            describe: '批注文件路径'
          })
          .option('export', {
            describe: '扫描后自动导出报告',
            type: 'boolean',
            default: false
          })
          .option('format', {
            describe: '导出格式',
            choices: ['all', 'csv', 'json', 'excel'],
            default: 'all'
          });
      },
      async (argv) => {
        await handleScan(argv);
      }
    )
    .command(
      'export',
      '导出审查报告',
      (yargs) => {
        return yargs
          .option('format', {
            describe: '导出格式',
            choices: ['all', 'csv', 'json', 'excel'],
            default: 'all'
          })
          .option('prefix', {
            describe: '文件名前缀',
            default: '播客广告口播响度审查'
          });
      },
      async (argv) => {
        await handleExport(argv);
      }
    )
    .command(
      'demo',
      '运行演示样例',
      () => {},
      async (argv) => {
        await handleDemo(argv);
      }
    )
    .demandCommand(1, '请指定一个命令')
    .help()
    .argv;
}

async function handleScan(argv) {
  const service = new ReviewService();
  
  console.log('=== 播客广告口播响度审查系统');
  console.log('================================');
  
  if (argv.tracklist) {
    console.log(`加载曲目表: ${argv.tracklist}`);
    await service.loadTracklist(argv.tracklist);
  }
  
  if (argv.notes) {
    console.log(`加载批注: ${argv.notes}`);
    await service.loadNotes(argv.notes);
  }
  
  console.log(`扫描音频目录: ${argv.audioDir}`);
  const result = await service.scanAudioDirectory(argv.audioDir);
  
  console.log('\n=== 扫描结果 ===');
  console.log(`总文件数: ${result.summary.total}`);
  console.log(`成功处理: ${result.summary.success}`);
  console.log(`失败: ${result.summary.failed}`);
  console.log(`成功率: ${result.summary.successRate}%`);
  
  console.log('\n=== 审查结果摘要 ===');
  result.results.forEach((r, i) => {
    const statusIcon = r.status === '通过' ? '✓' : r.status === '失败' ? '✗' : '⚠';
    console.log(`${statusIcon} [${r.status}] ${r.fileName}`);
    if (r.reviewReasons && r.reviewReasons.length > 0) {
      r.reviewReasons.forEach(reason => console.log(`   - ${reason}`));
    }
  });
  
  if (argv.export) {
    console.log('\n=== 导出报告 ===');
    const exports = await service.exportReports(argv.format);
    console.log('报告已导出至:', config.paths.output);
  }
}

async function handleExport(argv) {
  console.log('导出功能需要先运行扫描命令');
}

async function handleDemo(argv) {
  console.log('=== 播客广告口播响度审查 - 演示模式 ===');
  console.log('========================================');
  
  const service = new ReviewService();
  
  console.log('\n1. 加载样例曲目表...');
  const tracklistPath = path.join(config.paths.tracklists, 'sample_tracklist.csv');
  
  try {
    await service.loadTracklist(tracklistPath);
    console.log('   ✓ 曲目表已加载');
  } catch (e) {
    console.log('   ℹ 样例曲目表不存在，将创建模拟数据');
  }
  
  console.log('\n2. 加载群聊补充批注...');
  const notesPath = path.join(config.paths.notes, 'sample_notes.json');
  try {
    await service.loadNotes(notesPath);
    console.log('   ✓ 批注已加载');
  } catch (e) {
    console.log('   ℹ 样例批注不存在');
  }
  
  console.log('\n3. 添加舞台通道表旧口径记录...');
  service.addManualReviewRecord({
    trackId: 'L001',
    title: '开场音乐 - 旧版',
    artist: '阿蓝',
    fileName: 'legacy_opening_v1.mp3',
    status: '旧口径',
    loudness: { inputLUFS: -18, inputPeak: -2 },
    reviewReasons: ['从舞台通道表导入，2024年10月批次，当时标准为-18LUFS'],
    notes: [{ note: '演出统筹阿蓝确认，该版本用于彩排', source: '舞台通道表' }],
    source: '舞台通道表'
  });
  console.log('   ✓ 旧口径记录已添加');
  
  console.log('\n4. 扫描音频目录...');
  const result = await service.scanAudioDirectory();
  
  console.log('\n=== 演示完成！');
  console.log('\n=== 审查结果:');
  console.log('----------------------------------------');
  
  service.reviewResults.forEach((r, i) => {
    const icons = {
      '通过': '✓',
      '需人工确认': '⚠',
      '旧口径': '📜',
      '失败': '✗'
    };
    console.log(`\n${icons[r.status] || '•'} ${i + 1}. ${r.title || r.fileName}`);
    console.log(`   状态: ${r.status}`);
    console.log(`   来源: ${r.source}`);
    if (r.loudness) {
      console.log(`   响度: ${r.loudness.inputLUFS?.toFixed(1)} LUFS`);
    }
    if (r.reviewReasons?.length > 0) {
      console.log(`   原因: ${r.reviewReasons.join('; ')}`);
    }
  });
  
  console.log('\n5. 导出报告...');
  const exports = await service.exportReports('all', '播客广告口播响度审查_演示');
  console.log('   ✓ 报告已导出至 output/ 目录');
  
  console.log('\n=== 演示结束 ===');
}

main().catch(err => {
  console.error('错误:', err.message);
  process.exit(1);
});
