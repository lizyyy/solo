const path = require('path');
const config = require('./config');
const ReviewService = require('./reviewService');

async function runDemo() {
  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║          播客广告口播响度审查系统 - 完整演示              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');

  const service = new ReviewService();
  service.audioAnalyzer.useSimulation = true;

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 1: 加载曲目表和批注');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const tracklistPath = path.join(config.paths.tracklists, 'sample_tracklist.csv');
  const notesPath = path.join(config.paths.notes, 'sample_notes.json');
  const legacyPath = path.join(config.paths.tracklists, 'stage_channel_legacy.csv');

  console.log(`✓ 加载曲目表: ${path.basename(tracklistPath)}`);
  await service.loadTracklist(tracklistPath);
  
  console.log(`✓ 加载群聊批注: ${path.basename(notesPath)}`);
  await service.loadNotes(notesPath);
  
  console.log(`✓ 合并批注到曲目`);
  service.mergeNotes('sample_tracklist.csv', 'sample_notes.json');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 2: 扫描音频目录（含坏文件）');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const scanResult = await service.scanAudioDirectory();
  console.log(`扫描完成: ${scanResult.summary.total} 个文件`);
  console.log(`  - 成功: ${scanResult.summary.success}`);
  console.log(`  - 失败: ${scanResult.summary.failed}`);
  console.log(`  - 成功率: ${scanResult.summary.successRate}%`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 3: 添加舞台通道表旧口径记录');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  await service.loadTracklist(legacyPath);
  
  service.addManualReviewRecord({
    trackId: 'L001',
    title: '品牌主题曲-2024版',
    artist: '音乐组',
    fileName: 'theme_2024_legacy.mp3',
    status: config.review.statuses.LEGACY,
    loudness: { inputLUFS: -18, inputLRA: 6, inputPeak: -2, inputThresh: -28 },
    reviewReasons: [
      '从舞台通道表导入',
      '2024年10月批次，当时执行旧标准-18LUFS',
      '演出统筹阿蓝确认通过现场验收'
    ],
    notes: [{ note: '已通过现场验收，旧口径无需返工', source: '舞台通道表_阿蓝_2024-10-15' }],
    source: '舞台通道表',
    metadata: { duration: 180, format: 'mp3' }
  });
  
  service.addManualReviewRecord({
    trackId: 'L002',
    title: '活动开场-彩排版',
    artist: '李老师',
    fileName: 'opening_rehearsal_v2.mp3',
    status: config.review.statuses.LEGACY,
    loudness: { inputLUFS: -19, inputLRA: 4, inputPeak: -2.5, inputThresh: -30 },
    reviewReasons: [
      '从舞台通道表导入',
      '彩排专用版本，音量特意调低',
      '已存档，不用于正式播出'
    ],
    notes: [{ note: '彩排使用，音量较低是故意的', source: '舞台通道表_阿蓝_2024-11-02' }],
    source: '舞台通道表',
    metadata: { duration: 45, format: 'mp3' }
  });
  
  console.log('✓ 已添加 2 条旧口径记录');

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 4: 审查结果总览');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  const summary = service.getSummary();
  console.log(`总记录数: ${summary.total}`);
  console.log(`需人工确认: ${summary.needsAttention}`);
  console.log(`失败: ${summary.failed}`);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('详细结果');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  service.reviewResults.forEach((r, i) => {
    const icons = {
      '通过': '✅',
      '需人工确认': '⚠️ ',
      '旧口径': '📜',
      '失败': '❌',
      '待处理': '⏳'
    };
    
    console.log('');
    console.log(`${icons[r.status] || '•'} 记录 ${i + 1}: ${r.title || r.fileName}`);
    console.log(`   ├─ 状态: ${r.status}`);
    console.log(`   ├─ 来源: ${r.source}`);
    console.log(`   ├─ 文件名: ${r.fileName}`);
    if (r.loudness) {
      console.log(`   ├─ 响度: ${r.loudness.inputLUFS?.toFixed(1)} LUFS`);
      console.log(`   └─ 峰值: ${r.loudness.inputPeak?.toFixed(2)} dB`);
    } else {
      console.log(`   └─ 响度: 无数据`);
    }
    
    if (r.reviewReasons?.length > 0) {
      console.log('');
      console.log('   🔍 审查原因:');
      r.reviewReasons.forEach(reason => console.log(`      • ${reason}`));
    }
    
    if (r.notes?.length > 0) {
      console.log('');
      console.log('   📝 批注:');
      r.notes.forEach(note => {
        const src = note.source ? `[${note.source}]` : '';
        console.log(`      • ${src} ${note.note || note}`);
      });
    }
    
    if (r.processedAt) {
      console.log('');
      console.log(`   ⏰ 处理时间: ${r.processedAt}`);
    }
  });

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('步骤 5: 导出报告');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  
  const exports = await service.reportExporter.exportToCsv(
    service.reviewResults, 
    '播客广告口播响度审查'
  );
  const jsonExport = service.reportExporter.exportToJson(
    service.reviewResults,
    '播客广告口播响度审查'
  );
  const excelExport = service.reportExporter.exportToExcel(
    service.reviewResults,
    '播客广告口播响度审查'
  );
  
  console.log('✓ 报告已导出至: output/');
  console.log('');
  console.log('  格式清单:');
  console.log(`  • CSV:   ${exports.fileName}`);
  console.log(`  • JSON:  ${jsonExport.fileName}`);
  console.log(`  • Excel: ${excelExport.fileName}`);

  console.log('');
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  演示完成！交接给演出统筹阿蓝时，请查看 output/ 目录       ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log('');
}

runDemo().catch(err => {
  console.error('演示出错:', err);
  process.exit(1);
});
