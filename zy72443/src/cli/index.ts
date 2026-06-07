import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import { importSampleTickets, RawTicketRow, importTicketRows } from '../core/ticketImporter';
import { createSampleAudioRemarks, runFullDemoWorkflow, getReviewContext, managerReview, engineerUpdateAudioRemark, resolveAnomalyByManager } from '../core/workflow';
import { generateHumanReadableReport, generateReport } from '../core/reportGenerator';
import { dataStore } from '../core/dataStore';
import { processTicketWithAudio } from '../core/anomalyDetector';

const program = new Command();

let dataInitialized = false;

function ensureDataInitialized(): void {
  if (!dataInitialized && dataStore.getAllTickets().length === 0) {
    console.log(chalk.gray('📦 自动加载演示数据...\n'));
    runFullDemoWorkflow();
    dataInitialized = true;
  }
}

program
  .name('musician-split')
  .description('音乐人直播打赏分账系统')
  .version('1.0.0');

program
  .command('demo')
  .description('运行完整演示流程（推荐新人首次使用）')
  .action(() => {
    console.log(chalk.blue('\n🎵 音乐人直播打赏分账系统 - 完整演示\n'));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.yellow('\n📌 第一步：导入票务导出表'));
    console.log(chalk.gray('正在导入5条样例票务数据...'));
    
    const result = runFullDemoWorkflow();
    
    console.log(chalk.green(`✅ 成功导入 ${result.tickets.length} 条票务数据`));
    
    console.log(chalk.yellow('\n📌 第二步：系统自动校验授权地区'));
    console.log(chalk.gray('正在对比票务导出表与音频文件备注...'));
    
    const anomalyCount = result.anomalies.filter(a => !a.resolved).length;
    if (anomalyCount > 0) {
      console.log(chalk.red(`⚠️  检测到 ${anomalyCount} 条授权地区异常！`));
      console.log(chalk.gray('   这些票单已被标记为"预留"，等待店长复核'));
    } else {
      console.log(chalk.green('✅ 所有票单授权地区校验通过'));
    }
    
    console.log(chalk.yellow('\n📌 第三步：生成课时核销单'));
    console.log(chalk.green(`✅ 已生成 ${result.verifications.length} 条课时核销单`));
    
    console.log(chalk.yellow('\n📊 生成的分账报告：\n'));
    console.log(generateHumanReadableReport());
    
    console.log(chalk.blue('\n💡 下一步操作建议：'));
    console.log(chalk.gray('  1. 运行 ') + chalk.cyan('npm run start:cli -- list-tickets') + chalk.gray(' 查看所有票单'));
    console.log(chalk.gray('  2. 运行 ') + chalk.cyan('npm run start:cli -- detail <票单号>') + chalk.gray(' 查看票单详情（可追溯原始数据）'));
    console.log(chalk.gray('  3. 运行 ') + chalk.cyan('npm run start:cli -- manager-review <票单号>') + chalk.gray(' 模拟店长复核'));
    console.log(chalk.gray('  4. 运行 ') + chalk.cyan('npm run start:cli -- engineer-fix <票单号>') + chalk.gray(' 模拟录音师小段补录'));
    console.log(chalk.gray('  5. 运行 ') + chalk.cyan('npm run start:web') + chalk.gray(' 启动小看板Web界面\n'));
  });

program
  .command('import-sample')
  .description('导入样例票务数据')
  .action(() => {
    const tickets = importSampleTickets();
    console.log(chalk.green(`✅ 已导入 ${tickets.length} 条样例票务数据`));
    printTicketsTable(tickets);
  });

program
  .command('import-audio')
  .description('导入样例音频文件备注')
  .action(() => {
    const remarks = createSampleAudioRemarks();
    console.log(chalk.green(`✅ 已导入 ${remarks.length} 条音频文件备注`));
  });

program
  .command('process')
  .description('处理所有票单，校验并生成核销单')
  .action(() => {
    const tickets = dataStore.getAllTickets();
    let anomalyCount = 0;
    
    for (const ticket of tickets) {
      const audioRemark = dataStore.getAudioRemark(ticket.audioFileId);
      if (audioRemark) {
        const result = processTicketWithAudio(ticket, audioRemark);
        if (result.anomalies.length > 0) {
          anomalyCount += result.anomalies.length;
        }
      }
    }
    
    console.log(chalk.green(`✅ 已处理 ${tickets.length} 条票单，检测到 ${anomalyCount} 条异常`));
  });

program
  .command('list-tickets')
  .description('列出所有票单')
  .action(() => {
    ensureDataInitialized();
    const tickets = dataStore.getAllTickets();
    printTicketsTable(tickets);
  });

program
  .command('detail <ticketId>')
  .description('查看票单详情（可追溯原始数据）')
  .action((ticketId) => {
    ensureDataInitialized();
    const context = getReviewContext(ticketId);
    if (!context) {
      console.log(chalk.red(`❌ 未找到票单 ${ticketId}`));
      return;
    }
    
    const { ticket, audioRemark, verification, anomalies } = context;
    
    console.log(chalk.blue(`\n📋 票单详情: ${ticketId}`));
    console.log(chalk.gray('=' .repeat(60)));
    
    console.log(chalk.yellow('\n📄 【票务导出表原始数据】'));
    const ticketTable = new Table({
      head: ['字段', '值'],
      colWidths: [20, 40]
    });
    ticketTable.push(
      ['票单号', ticket.ticketId],
      ['音乐人', ticket.musicianName],
      ['直播日期', ticket.liveDate],
      ['打赏总额', `¥${ticket.totalTips.toFixed(2)}`],
      ['平台服务费', `¥${ticket.platformFee.toFixed(2)}`],
      ['分成比例', `${(ticket.splitRatio * 100).toFixed(0)}%`],
      ['预计收入', `¥${ticket.expectedRevenue.toFixed(2)}`],
      ['授权地区', ticket.authorizedCities.join('、')],
      ['音频文件ID', ticket.audioFileId],
      ['导入时间', new Date(ticket.importedAt).toLocaleString('zh-CN')]
    );
    console.log(ticketTable.toString());
    
    if (audioRemark) {
      console.log(chalk.yellow('\n🎵 【音频文件备注】'));
      const audioTable = new Table({
        head: ['字段', '值'],
        colWidths: [20, 40]
      });
      audioTable.push(
        ['音频文件ID', audioRemark.audioFileId],
        ['音乐人', audioRemark.musicianName],
        ['实际授权地区', audioRemark.actualAuthorizedCities.join('、')],
        ['音频时长', `${Math.floor(audioRemark.audioDuration / 60)}分${audioRemark.audioDuration % 60}秒`],
        ['质量检测', audioRemark.qualityCheck === 'pass' ? '通过' : audioRemark.qualityCheck],
        ['备注', audioRemark.remark],
        ['更新人', audioRemark.updatedBy],
        ['更新时间', new Date(audioRemark.updatedAt).toLocaleString('zh-CN')]
      );
      console.log(audioTable.toString());
    } else {
      console.log(chalk.gray('  暂无音频文件备注'));
    }
    
    if (verification) {
      console.log(chalk.yellow('\n📝 【课时核销单】'));
      const statusColor = verification.status === 'reserved' ? chalk.red : 
                          verification.status === 'verified' ? chalk.green : chalk.yellow;
      const verTable = new Table({
        head: ['字段', '值'],
        colWidths: [20, 40]
      });
      verTable.push(
        ['核销单号', verification.verificationNo],
        ['状态', statusColor(verification.status === 'reserved' ? '已预留(异常)' : verification.status)],
        ['授权地区', verification.authorizedCities.join('、')],
        ['最终金额', `¥${verification.finalRevenue.toFixed(2)}`],
        ['预留原因', verification.reservedReason || '-'],
        ['缺材料', verification.missingMaterials.join('；') || '-'],
        ['下一步找', chalk.cyan(verification.nextAction)],
        ['操作说明', verification.actionNotes],
        ['复核人', verification.reviewedBy || '-']
      );
      console.log(verTable.toString());
    }
    
    if (anomalies.length > 0) {
      console.log(chalk.yellow('\n⚠️  【异常记录】'));
      for (const anomaly of anomalies) {
        const anomalyTable = new Table({
          head: ['字段', '值'],
          colWidths: [20, 40]
        });
        anomalyTable.push(
          ['异常ID', anomaly.id],
          ['类型', '授权地区缺失'],
          ['严重程度', anomaly.severity === 'high' ? chalk.red('高') : anomaly.severity],
          ['状态', anomaly.resolved ? chalk.green('已解决') : chalk.red('待处理')],
          ['描述', anomaly.description],
          ['数据来源', `${anomaly.sourceData.source} -> ${anomaly.sourceData.fieldName}`],
          ['原始值', chalk.red(anomaly.sourceData.originalValue)],
          ['期望值', chalk.green(anomaly.sourceData.expectedValue || '-')]
        );
        console.log(anomalyTable.toString());
      }
    }
    
    console.log('');
  });

program
  .command('list-anomalies')
  .description('列出所有异常记录')
  .action(() => {
    ensureDataInitialized();
    const anomalies = dataStore.getAllAnomalies();
    if (anomalies.length === 0) {
      console.log(chalk.green('✅ 暂无异常记录'));
      return;
    }
    
    const table = new Table({
      head: ['异常ID', '票单号', '类型', '严重程度', '状态', '描述'],
      colWidths: [15, 18, 15, 10, 10, 30]
    });
    
    for (const a of anomalies) {
      table.push([
        a.id,
        a.ticketId,
        a.type,
        a.severity,
        a.resolved ? chalk.green('已解决') : chalk.red('待处理'),
        a.description.substring(0, 28) + '...'
      ]);
    }
    
    console.log(table.toString());
  });

program
  .command('manager-review <ticketId>')
  .description('模拟店长复核票单')
  .option('-a, --action <action>', '操作: approve(通过) 或 escalate(转交录音师)', 'escalate')
  .option('-n, --notes <notes>', '复核意见', '请录音师小段核对授权地区')
  .action((ticketId, options) => {
    ensureDataInitialized();
    const context = getReviewContext(ticketId);
    if (!context) {
      console.log(chalk.red(`❌ 未找到票单 ${ticketId}`));
      return;
    }
    
    const action = options.action === 'approve' ? 'approve' : 'escalate_to_audio';
    const result = managerReview(ticketId, action, options.notes);
    
    if (result.success) {
      console.log(chalk.green(`✅ ${result.message}`));
      if (result.verification) {
        console.log(chalk.gray(`   当前状态: ${result.verification.status}`));
        console.log(chalk.gray(`   下一步: ${result.verification.nextAction}`));
      }
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

program
  .command('engineer-fix <ticketId>')
  .description('模拟录音师小段补录音频备注')
  .option('-c, --cities <cities>', '授权城市，用逗号分隔', '北京,上海,广州,深圳,杭州')
  .option('-r, --remark <remark>', '备注', '已核对所有授权地区，补全缺失城市')
  .action((ticketId, options) => {
    ensureDataInitialized();
    const cities = options.cities.split(',').map((c: string) => c.trim());
    const result = engineerUpdateAudioRemark(ticketId, cities, options.remark);
    
    if (result.success) {
      console.log(chalk.green(`✅ ${result.message}`));
      console.log(chalk.gray(`   最新授权地区: ${cities.join('、')}`));
      if (result.verification) {
        console.log(chalk.gray(`   核销单状态: ${result.verification.status}`));
        console.log(chalk.gray(`   下一步: ${result.verification.nextAction}`));
      }
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

program
  .command('resolve-anomaly <anomalyId>')
  .description('店长标记异常为已解决')
  .option('-n, --notes <notes>', '解决说明', '已核对并确认授权地区')
  .action((anomalyId, options) => {
    ensureDataInitialized();
    const result = resolveAnomalyByManager(anomalyId, options.notes);
    if (result.success) {
      console.log(chalk.green(`✅ ${result.message}`));
    } else {
      console.log(chalk.red(`❌ ${result.message}`));
    }
  });

program
  .command('report')
  .description('生成分账报告')
  .action(() => {
    ensureDataInitialized();
    console.log(generateHumanReadableReport());
  });

function printTicketsTable(tickets: any[]) {
  const table = new Table({
    head: ['票单号', '音乐人', '直播日期', '打赏总额', '预计收入', '授权地区数', '状态'],
    colWidths: [18, 12, 12, 12, 12, 12, 15]
  });
  
  for (const t of tickets) {
    table.push([
      t.ticketId,
      t.musicianName,
      t.liveDate,
      `¥${t.totalTips.toFixed(2)}`,
      `¥${t.expectedRevenue.toFixed(2)}`,
      t.authorizedCities.length,
      t.status
    ]);
  }
  
  console.log(table.toString());
}

program.parse(process.argv);
