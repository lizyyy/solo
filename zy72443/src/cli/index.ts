import { Command } from 'commander';
import Table from 'cli-table3';
import chalk from 'chalk';
import { importSampleTickets, RawTicketRow, importTicketRows } from '../core/ticketImporter';
import { createSampleAudioRemarks, runFullDemoWorkflow, getReviewContext, managerReview, engineerUpdateAudioRemark, resolveAnomalyByManager } from '../core/workflow';
import { generateHumanReadableReport, generateReport, traceCity } from '../core/reportGenerator';
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
    
    const { ticket, audioRemark, verification, anomalies, changeHistories } = context;
    
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
          ['原始值(票务)', chalk.red(anomaly.sourceData.originalValue)],
          ['期望值(音频)', chalk.green(anomaly.sourceData.expectedValue || '-')],
          ['解决人', anomaly.resolvedBy || '-'],
          ['解决说明', anomaly.resolutionNotes || '-']
        );
        console.log(anomalyTable.toString());
      }
    }
    
    if (changeHistories && changeHistories.length > 0) {
      console.log(chalk.yellow('\n📜 【修改历史时间线】'));
      const entityLabel: Record<string, string> = {
        ticket: '票务导出表',
        audio_remark: '音频文件备注',
        verification: '课时核销单',
        anomaly: '异常记录'
      };
      for (const h of changeHistories) {
        console.log(chalk.cyan(`  [${new Date(h.changedAt).toLocaleString('zh-CN')}] ${h.changedBy}`));
        console.log(`    修改对象: ${entityLabel[h.entityType] || h.entityType} (${h.entityId})`);
        console.log(`    修改字段: ${h.fieldName}`);
        console.log(`    改前: ${chalk.red(`"${h.oldValue}"`)} → 改后: ${chalk.green(`"${h.newValue}"`)}`);
        console.log(`    修改原因: ${h.changeReason}`);
        console.log('');
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

program
  .command('trace-city <city>')
  .description('按城市追溯：反查该城市涉及的票单、异常、修改历史')
  .action((city) => {
    ensureDataInitialized();
    console.log(traceCity(city));
  });

program
  .command('reset')
  .description('重置所有数据，清除持久化文件')
  .action(() => {
    dataStore.clear();
    dataInitialized = false;
    console.log(chalk.green('✅ 所有数据已重置，持久化文件已清空'));
  });

program
  .command('run-complete-flow')
  .description('端到端跑完完整流程：导入→店长复核→录音师补录→店长再复核→报告')
  .action(() => {
    dataStore.clear();
    dataInitialized = false;
    console.log(chalk.blue('\n🎵 音乐人直播打赏分账 - 端到端完整流程演示\n'));
    console.log(chalk.gray('='.repeat(70)));
    
    console.log(chalk.yellow('\n📌 第0步：清理数据并重新初始化'));
    const init = runFullDemoWorkflow(true);
    console.log(chalk.green(`   初始化完成：${init.tickets.length}票单 / ${init.verifications.length}核销单 / ${init.anomalies.filter(a=>!a.resolved).length}未解决异常`));
    
    const targetTicketId = 'TK20250601002';
    console.log(chalk.yellow(`\n📌 以票单 ${targetTicketId} (李南风) 为例走完整闭环`));
    
    console.log(chalk.cyan('\n   当前状态查看:'));
    const ctx0 = getReviewContext(targetTicketId);
    if (ctx0) {
      console.log(`   核销单状态: ${ctx0.verification?.status}`);
      console.log(`   票务授权地区: ${ctx0.ticket.authorizedCities.join('、')}`);
      console.log(`   音频授权地区: ${ctx0.audioRemark?.actualAuthorizedCities.join('、')}`);
      console.log(`   异常数: ${ctx0.anomalies.filter(a=>!a.resolved).length}`);
    }
    
    console.log(chalk.yellow('\n📌 第1步：店长复核，发现异常转交给录音师小段'));
    const r1 = managerReview(targetTicketId, 'escalate_to_audio', '发现授权地区异常，小段请核对杭州是否为合法授权地区');
    console.log(chalk.green(`   结果: ${r1.message}`));
    
    console.log(chalk.yellow('\n📌 第2步：录音师小段补录音频备注，补全北京,上海,杭州'));
    const r2 = engineerUpdateAudioRemark(
      targetTicketId, 
      ['北京', '上海', '杭州'], 
      '已确认杭州为合同内合法授权地区，补全备注。原备注："音频正常，注意：实际授权地区包含杭州，票务表中可能遗漏"'
    );
    console.log(chalk.green(`   结果: ${r2.message}`));
    if (r2.resolvedAnomalies && r2.resolvedAnomalies.length > 0) {
      console.log(`   自动解决异常: ${r2.resolvedAnomalies.map(a => a.id).join(', ')}`);
    }
    
    console.log(chalk.yellow('\n📌 第3步：店长再次复核，确认通过'));
    const r3 = managerReview(targetTicketId, 'approve', '已核对北京,上海,杭州均为有效授权地区，同意核销');
    console.log(chalk.green(`   结果: ${r3.message}`));
    
    console.log(chalk.yellow('\n📌 第4步：查看票单详情（含完整修改历史）'));
    const ctxFinal = getReviewContext(targetTicketId);
    if (ctxFinal) {
      console.log(chalk.cyan(`   最终核销单状态: ${ctxFinal.verification?.status}`));
      console.log(`   最终授权地区: ${ctxFinal.verification?.authorizedCities.join('、')}`);
      console.log(`   未解决异常: ${ctxFinal.anomalies.filter(a=>!a.resolved).length}`);
      console.log(`   修改历史记录数: ${ctxFinal.changeHistories?.length || 0}`);
    }
    
    console.log(chalk.yellow('\n📌 第5步：按"杭州"城市反查追溯'));
    console.log(traceCity('杭州'));
    
    console.log(chalk.yellow('\n📌 第6步：生成最终报告'));
    console.log(generateHumanReadableReport());
    
    console.log(chalk.blue('\n✅ 端到端流程演示完成！数据已保存在 data/store.json'));
    console.log(chalk.gray('   可运行 npm run start:cli -- detail TK20250601002 查看票单详情'));
    console.log(chalk.gray('   可运行 npm run start:cli -- trace-city 杭州 按城市追溯\n'));
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
