import * as path from 'path';
import { loadDataContext } from '../readers';
import { analyzeData, generateReviewSummary } from '../analyzer';
import { formatIssue } from './validate';
import { Issue, IssueSeverity } from '../types';

function formatTimeDiff(hours: number): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)} 分钟`;
  } else if (hours < 24) {
    return `${hours.toFixed(1)} 小时`;
  } else {
    const days = hours / 24;
    return `${days.toFixed(1)} 天`;
  }
}

function printStoreSummary(context: any, issues: Issue[], warnings: Issue[]): void {
  const storeMap: Record<string, { name: string; issues: number; warnings: number; rooms: number; tags: number; batches: number }> = {};

  context.rooms.forEach((room: any) => {
    if (!storeMap[room.storeId]) {
      storeMap[room.storeId] = {
        name: room.storeName,
        issues: 0,
        warnings: 0,
        rooms: 0,
        tags: 0,
        batches: 0
      };
    }
    storeMap[room.storeId].rooms++;
  });

  context.linenTags.forEach((tag: any) => {
    if (storeMap[tag.storeId]) {
      storeMap[tag.storeId].tags++;
    }
  });

  context.laundryBatches.forEach((batch: any) => {
    if (storeMap[batch.storeId]) {
      storeMap[batch.storeId].batches++;
    }
  });

  issues.forEach(issue => {
    if (storeMap[issue.storeId]) {
      storeMap[issue.storeId].issues++;
    }
  });

  warnings.forEach(issue => {
    if (storeMap[issue.storeId]) {
      storeMap[issue.storeId].warnings++;
    }
  });

  console.log('\n📊 门店汇总:');
  console.log('-'.repeat(90));
  console.log(`  ${'门店ID'.padEnd(10)} ${'名称'.padEnd(10)} ${'客房'.padEnd(6)} ${'标签'.padEnd(6)} ${'批次'.padEnd(6)} ${'错误'.padEnd(6)} ${'警告'.padEnd(6)}`);
  console.log('-'.repeat(90));

  Object.entries(storeMap).forEach(([storeId, data]) => {
    const status = data.issues > 0 ? '❌' : data.warnings > 0 ? '⚠️' : '✅';
    console.log(`  ${storeId.padEnd(10)} ${data.name.padEnd(10)} ${String(data.rooms).padEnd(6)} ${String(data.tags).padEnd(6)} ${String(data.batches).padEnd(6)} ${String(data.issues).padEnd(6)} ${String(data.warnings).padEnd(6)} ${status}`);
  });

  console.log('');
}

function printIssueTypeSummary(issues: Issue[], warnings: Issue[]): void {
  const typeCounts: Record<string, { count: number; severity: IssueSeverity }> = {};

  issues.forEach(issue => {
    if (!typeCounts[issue.type]) {
      typeCounts[issue.type] = { count: 0, severity: issue.severity };
    }
    typeCounts[issue.type].count++;
  });

  warnings.forEach(issue => {
    if (!typeCounts[issue.type]) {
      typeCounts[issue.type] = { count: 0, severity: issue.severity };
    }
    typeCounts[issue.type].count++;
  });

  console.log('\n📋 问题类型统计:');
  console.log('-'.repeat(60));

  Object.entries(typeCounts).forEach(([type, data]) => {
    const icon = data.severity === IssueSeverity.ERROR ? '❌' :
                 data.severity === IssueSeverity.WARNING ? '⚠️' : 'ℹ️';
    console.log(`  ${icon} ${type.padEnd(35)} ${String(data.count).padEnd(5)} 个`);
  });

  console.log('');
}

function printBatchFlow(context: any): void {
  console.log('\n📦 送洗批次流转状态:');
  console.log('-'.repeat(90));
  console.log(`  ${'批次ID'.padEnd(12)} ${'门店'.padEnd(8)} ${'状态'.padEnd(10)} ${'标签数'.padEnd(8)} ${'送洗时间'.padEnd(20)} ${'预计返回'.padEnd(20)}`);
  console.log('-'.repeat(90));

  context.laundryBatches.forEach((batch: any) => {
    const statusIcon = batch.status === '已送洗' ? '🚚' :
                       batch.status === '已创建' ? '⏳' :
                       batch.status === '已返回' ? '✅' : '❓';
    console.log(
      `  ${batch.batchId.padEnd(12)} ${batch.storeId.padEnd(8)} ${(statusIcon + ' ' + batch.status).padEnd(10)} ${String(batch.tags.length).padEnd(8)} ${(batch.sentAt || '-').padEnd(20)} ${(batch.expectedReturn || '-').padEnd(20)}`
    );
  });

  console.log('');
}

function printRoomCheckoutDetails(context: any): void {
  const crossMidnightRooms = context.rooms.filter((room: any) => {
    const hour = new Date(room.checkoutTime).getHours();
    return hour >= 0 && hour < 6;
  });

  if (crossMidnightRooms.length > 0) {
    console.log('\n🌙 跨午夜退房提醒:');
    console.log('-'.repeat(60));
    console.log(`  以下客房退房时间在凌晨 0:00-6:00 之间，请确认是否为实际退房时间:\n`);

    crossMidnightRooms.forEach((room: any) => {
      const checkoutDate = new Date(room.checkoutTime);
      const hour = checkoutDate.getHours();
      const minute = checkoutDate.getMinutes();
      console.log(`  🏨 ${room.storeName} (${room.storeId}) - 客房 ${room.roomNumber}`);
      console.log(`     退房时间: ${room.checkoutTime} (${hour}:${minute.toString().padStart(2, '0')})`);
      console.log('');
    });
  }
}

export async function runReview(dataDir: string, options: { detailed?: boolean; verbose?: boolean }): Promise<number> {
  try {
    const resolvedDataDir = path.resolve(dataDir);
    console.log(`📂 正在从目录读取数据: ${resolvedDataDir}`);

    const context = loadDataContext(resolvedDataDir);
    const { issues, warnings, infos } = analyzeData(context);
    const summary = generateReviewSummary(context, issues, warnings, infos);

    console.log('\n' + '='.repeat(80));
    console.log('📋 夜审复核报告');
    console.log('='.repeat(80));

    console.log('\n📈 总体概况:');
    console.log('-'.repeat(60));
    console.log(`  🛏️  今日退房客房数: ${summary.totalRooms}`);
    console.log(`  🏷️  涉及布草标签数: ${summary.totalTags}`);
    console.log(`  📦  送洗批次数量: ${summary.totalBatches}`);
    console.log(`  🌙  跨午夜退房数量: ${summary.crossMidnightCheckouts}`);

    console.log('\n⚠️  问题汇总:');
    console.log('-'.repeat(60));
    console.log(`  ❌ 严重问题: ${issues.length} 个`);
    console.log(`  ⚠️  警告: ${warnings.length} 个`);
    console.log(`  ℹ️  信息提示: ${infos.length} 个`);

    if (summary.duplicateTags > 0) {
      console.log(`  🔄  重复入袋标签: ${summary.duplicateTags} 个`);
    }
    if (summary.crossStoreMixes > 0) {
      console.log(`  🏪  跨店混包批次: ${summary.crossStoreMixes} 个`);
    }
    if (summary.overdueBatches > 0) {
      console.log(`  ⏰  超时未回批次: ${summary.overdueBatches} 个`);
    }

    if (options.detailed) {
      printStoreSummary(context, issues, warnings);
      printIssueTypeSummary(issues, warnings);
      printBatchFlow(context);
      printRoomCheckoutDetails(context);
    }

    if (options.verbose && (issues.length > 0 || warnings.length > 0)) {
      console.log('\n📝 详细问题列表:');
      console.log('='.repeat(80));

      if (issues.length > 0) {
        console.log('\n❌ 严重问题:');
        console.log('-'.repeat(60));
        issues.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }

      if (warnings.length > 0) {
        console.log('\n⚠️  警告:');
        console.log('-'.repeat(60));
        warnings.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }

      if (infos.length > 0) {
        console.log('\nℹ️  信息提示:');
        console.log('-'.repeat(60));
        infos.forEach((issue, index) => {
          console.log(formatIssue(issue, index));
        });
      }
    }

    console.log('\n' + '='.repeat(80));
    if (issues.length > 0) {
      console.log(`❌ 复核状态: 未通过 (存在 ${issues.length} 个严重问题)`);
    } else if (warnings.length > 0) {
      console.log(`⚠️  复核状态: 有条件通过 (存在 ${warnings.length} 个警告)`);
    } else {
      console.log('✅ 复核状态: 全部通过');
    }
    console.log('='.repeat(80) + '\n');

    return issues.length > 0 ? 1 : 0;

  } catch (error) {
    console.error('\n❌ 复核过程中发生错误:');
    console.error(`   ${(error as Error).message}`);
    console.error('');

    if (options.verbose) {
      console.error((error as Error).stack);
    }

    return 1;
  }
}