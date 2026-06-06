const ImportService = require('./importService');
const dataStore = require('./dataStore');
const ReviewService = require('./reviewService');

const SAMPLE_AUDIO_IMPORTS = [
  {
    songName: '小星星变奏曲',
    remarks: '学生作业完成度良好，节奏稳定。注意第16小节的附点节奏需要加强练习',
    importedBy: 'system'
  },
  {
    songName: '月光奏鸣曲',
    liveName: '月光奏鸣曲（现场演奏版）',
    copyrightName: '第十四钢琴奏鸣曲「月光」',
    remarks: '现场录音，现场气氛很好，但是第三乐章速度偏快',
    importedBy: 'system'
  },
  {
    songName: '致爱丽丝',
    remarks: '旧口径：2023年春季学期作业，节奏批改完成',
    importedBy: 'system'
  }
];

const SAMPLE_LICENSE_DATA = [
  {
    recordId: null,
    remarks: '学生作业完成度良好，节奏稳定。注意第16小节的附点节奏需要加强练习'
  },
  {
    recordId: null,
    remarks: '现场演出授权：北京音乐厅2024年12月25日，版权名：第十四钢琴奏鸣曲「月光」'
  },
  {
    recordId: null,
    remarks: '【补录】旧口径修正：原备注为2024年春季学期作业，原批改记录有误，以授权期限页为准'
  }
];

class SampleDataService {
  static loadSampleData() {
    dataStore.reset();

    const importResults = ImportService.importAudioRecords(SAMPLE_AUDIO_IMPORTS, 'sample_loader');

    const importedRecords = importResults.success;

    SAMPLE_LICENSE_DATA[0].recordId = importedRecords[0].id;
    SAMPLE_LICENSE_DATA[1].recordId = importedRecords[1].id;
    SAMPLE_LICENSE_DATA[2].recordId = importedRecords[2].id;

    const licenseResults = ImportService.batchImportLicenseData(SAMPLE_LICENSE_DATA, 'audio_engineer_xiaoduan');

    return {
      importedRecords,
      licenseResults,
      summary: {
        totalImported: importedRecords.length,
        withConflicts: licenseResults.conflicts.length,
        needReview: importedRecords.filter(r => r.status === 'needs_review').length
      }
    };
  }

  static getSampleScenarios() {
    return [
      {
        id: 'normal',
        name: '顺利记录',
        description: '正常导入的音乐课作业，无冲突，已补充授权期限页数据',
        songName: '小星星变奏曲',
        expectedResult: '状态为 supplemented，备注完整保留，无冲突'
      },
      {
        id: 'dual_name',
        name: '现场名+版权名',
        description: '同一首歌同时存在现场名和版权名，待音乐老师复核',
        songName: '月光奏鸣曲',
        expectedResult: '状态为 needs_review，分配给音乐老师，不急着归为正常'
      },
      {
        id: 'old_caliber',
        name: '旧口径补录（冲突）',
        description: '音频备注与授权期限页备注不一致，产生冲突待录音师小段确认',
        songName: '致爱丽丝',
        expectedResult: '状态为 conflict，列出冲突证据，需人工确认或驳回'
      }
    ];
  }

  static runDemoFlow() {
    console.log('=== 音乐课作业节奏批改 - 演示流程');
    console.log('');

    const records = dataStore.readRecords();
    
    console.log('【第一步：音频文件备注第一次导入】');
    console.log('----------------------------------------');
    records.forEach((r, i) => {
      console.log(`${i + 1}. ${r.songName}`);
      console.log(`   状态: ${r.status}`);
      console.log(`   备注: ${r.remarks}`);
      console.log('');
    });

    console.log('【第二步：录音师小段补看授权期限页】');
    console.log('----------------------------------------');
    const conflictRecords = records.filter(r => r.status === 'conflict');
    conflictRecords.forEach(r => {
      console.log(`冲突记录: ${r.songName}`);
      console.log('冲突证据:');
      r.conflicts.forEach((c, i) => {
        console.log(`  ${i + 1}. ${c.description}`);
        console.log(`     音频备注: ${c.audioValue}`);
        console.log(`     授权页: ${c.licenseValue}`);
      });
      console.log('');
    });

    const needReviewRecords = records.filter(r => r.status === 'needs_review');
    needReviewRecords.forEach(r => {
      console.log(`待复核记录: ${r.songName}`);
      console.log(`  现场名: ${r.liveName}`);
      console.log(`  版权名: ${r.copyrightName}`);
      console.log(`  分配给: 音乐老师`);
      console.log('');
    });

    console.log('【第三步：给店长看的周报】');
    console.log('----------------------------------------');
    const ReportService = require('./reportService');
    const report = ReportService.generateCurrentWeekReport('demo_user');
    console.log(`周报表头: ${report.weekStart} 至 ${report.weekEnd}`);
    console.log('统计汇总:');
    console.log(`  总记录数: ${report.summary.totalRecords}`);
    console.log(`  正常: ${report.summary.normalRecords}`);
    console.log(`  待复核: ${report.summary.needReviewRecords}`);
    console.log(`  冲突: ${report.summary.conflictRecords}`);
    console.log(`  已补充: ${report.summary.supplementedRecords}`);
    console.log('');
    console.log('重点提醒:');
    report.highlights.forEach(h => {
      console.log(`  [${h.type}] ${h.message}`);
    });
    console.log('');

    console.log('【三种处理结果对比】');
    console.log('----------------------------------------');
    records.forEach(r => {
      console.log(`${r.songName}:`);
      console.log(`  最终状态: ${r.status}`);
      console.log(`  数据来源: ${r.dataSource}`);
      console.log(`  复核次数: ${r.reviewHistory.length}`);
      console.log('');
    });

    return { records, report };
  }
}

module.exports = SampleDataService;
