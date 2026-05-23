import chalk from 'chalk';
import { formatDate, getNights } from '../utils/date.js';

export function printSummary(result) {
  const { stats, errors, conflicts, sources } = result;
  
  console.log('\n' + chalk.bold.blue('='.repeat(60)));
  console.log(chalk.bold.blue('            民宿房态导入结果摘要'));
  console.log(chalk.bold.blue('='.repeat(60)) + '\n');

  console.log(chalk.bold('📊 统计信息'));
  console.log(`   输入文件数: ${sources.length}`);
  sources.forEach(s => {
    console.log(`     - ${s.platform}: ${s.filePath} (${s.rowCount} 条)`);
  });
  console.log(`   总房源数: ${stats.totalRooms}`);
  console.log(`   有效订单数: ${stats.validBookings}`);
  console.log(`   合并后订单数: ${stats.mergedBookings}`);
  console.log(`   锁房数: ${stats.lockBookings}`);
  console.log('');

  if (errors.length > 0) {
    console.log(chalk.bold.red('⚠️  解析错误 ') + `(${errors.length} 条)`);
    const errorGroups = {};
    for (const error of errors.slice(0, 10)) {
      const key = `${error.source}:${error.row}`;
      if (!errorGroups[key]) errorGroups[key] = [];
      errorGroups[key].push(error);
    }
    for (const [key, errs] of Object.entries(errorGroups)) {
      console.log(chalk.yellow(`   ${key}:`));
      for (const e of errs) {
        console.log(`     • ${e.message}`);
      }
    }
    if (errors.length > 10) {
      console.log(chalk.gray(`   ... 还有 ${errors.length - 10} 条错误，请查看完整报告`));
    }
    console.log('');
  }

  if (conflicts.length > 0) {
    console.log(chalk.bold.yellow('🚨 房态冲突 ') + `(${conflicts.length} 条)`);
    const byRoom = {};
    for (const conflict of conflicts) {
      if (!byRoom[conflict.roomName]) byRoom[conflict.roomName] = [];
      byRoom[conflict.roomName].push(conflict);
    }
    for (const [roomName, roomConflicts] of Object.entries(byRoom)) {
      console.log(chalk.yellow(`   【${roomName}】`));
      for (const conflict of roomConflicts) {
        const typeLabel = conflict.type === 'lock_conflict' 
          ? chalk.red('[锁房冲突]')
          : chalk.yellow('[订单冲突]');
        console.log(`     ${typeLabel} ${formatDate(conflict.overlapStart)} ~ ${formatDate(conflict.overlapEnd)} (${conflict.nights}晚)`);
        for (const b of conflict.bookings) {
          console.log(`       ↳ ${b.platform} 第${b.rowIndex}行: ${b.guest || b.reason || '无信息'}`);
        }
      }
    }
    console.log('');
  }

  console.log(chalk.bold.green('✅ 合并后各房源订单概览'));
  const allRooms = Object.keys(result.mergedBookings).sort();
  for (const roomName of allRooms) {
    const bookings = result.mergedBookings[roomName] || [];
    const locks = result.lockBookings[roomName] || [];
    const totalNights = bookings.reduce((sum, b) => sum + getNights(b.checkIn, b.checkOut), 0);
    console.log(`   【${roomName}】${bookings.length}个订单, ${locks.length}个锁房, 共${totalNights}晚`);
    bookings.slice(0, 3).forEach(b => {
      const guest = b.guest || '未知客人';
      const srcCount = b.sources && b.sources.length > 1 ? ` [合并自${b.sources.length}条]` : '';
      console.log(`     • ${formatDate(b.checkIn)} ~ ${formatDate(b.checkOut)} (${getNights(b.checkIn, b.checkOut)}晚) ${guest}${srcCount}`);
    });
    if (bookings.length > 3) {
      console.log(chalk.gray(`     ... 还有 ${bookings.length - 3} 个订单`));
    }
  }

  console.log('\n' + chalk.bold.blue('='.repeat(60)));
}

export function printError(message) {
  console.error(chalk.bold.red('\n❌ 错误: ') + message);
}

export function printInfo(message) {
  console.log(chalk.blue('ℹ️  ' + message));
}
