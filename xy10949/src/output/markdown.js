import { writeFileSync } from 'fs';
import { formatDate, getNights } from '../utils/date.js';

export function generateMarkdown(result, outputPath) {
  const lines = [];
  
  lines.push('# 民宿房态合并报告');
  lines.push('');
  lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push('');
  
  lines.push('## 📊 统计概览');
  lines.push('');
  lines.push('| 指标 | 数值 |');
  lines.push('|------|------|');
  lines.push(`| 输入文件 | ${result.sources.length} |`);
  lines.push(`| 总房源数 | ${result.stats.totalRooms} |`);
  lines.push(`| 有效订单数 | ${result.stats.validBookings} |`);
  lines.push(`| 合并后订单数 | ${result.stats.mergedBookings} |`);
  lines.push(`| 锁房数 | ${result.stats.lockBookings} |`);
  lines.push(`| 解析错误 | ${result.errors.length} |`);
  lines.push(`| 房态冲突 | ${result.conflicts.length} |`);
  lines.push('');

  lines.push('### 输入文件');
  lines.push('');
  for (const s of result.sources) {
    lines.push(`- **${s.platform}**: \`${s.filePath}\` (${s.rowCount} 条记录)`);
  }
  lines.push('');

  if (result.errors.length > 0) {
    lines.push('## ⚠️ 解析错误详情');
    lines.push('');
    lines.push('| 源文件 | 行号 | 列 | 错误信息 | 原始值 |');
    lines.push('|--------|------|----|----------|--------|');
    for (const e of result.errors) {
      lines.push(`| ${e.source} | ${e.row || '-'} | ${e.column || '-'} | ${e.message} | \`${e.value || ''}\` |`);
    }
    lines.push('');
  }

  if (result.conflicts.length > 0) {
    lines.push('## 🚨 房态冲突详情');
    lines.push('');
    
    const byRoom = {};
    for (const conflict of result.conflicts) {
      if (!byRoom[conflict.roomName]) byRoom[conflict.roomName] = [];
      byRoom[conflict.roomName].push(conflict);
    }

    for (const [roomName, roomConflicts] of Object.entries(byRoom)) {
      lines.push(`### ${roomName}`);
      lines.push('');
      
      for (const conflict of roomConflicts) {
        const typeLabel = conflict.type === 'lock_conflict' ? '🔒 锁房冲突' : '⚠️ 订单冲突';
        lines.push(`#### ${typeLabel}: ${formatDate(conflict.overlapStart)} ~ ${formatDate(conflict.overlapEnd)} (${conflict.nights}晚)`);
        lines.push('');
        lines.push('| 平台 | 行号 | 客人/原因 | 入住 | 退房 |');
        lines.push('|------|------|-----------|------|------|');
        for (const b of conflict.bookings) {
          lines.push(`| ${b.platform} | ${b.rowIndex} | ${b.guest || b.reason || '-'} | ${formatDate(b.checkIn)} | ${formatDate(b.checkOut)} |`);
        }
        lines.push('');
      }
    }
  }

  lines.push('## ✅ 合并后房态详情');
  lines.push('');

  const allRooms = Object.keys(result.mergedBookings).sort();
  for (const roomName of allRooms) {
    lines.push(`### ${roomName}`);
    lines.push('');
    
    const bookings = result.mergedBookings[roomName] || [];
    const locks = result.lockBookings[roomName] || [];
    
    if (locks.length > 0) {
      lines.push('#### 🔒 锁房记录');
      lines.push('');
      lines.push('| 入住 | 退房 | 晚数 | 原因 | 来源 |');
      lines.push('|------|------|------|------|------|');
      for (const b of locks) {
        const sources = b.sources ? b.sources.map(s => `${s.platform}#${s.rowIndex}`).join(', ') : `${b.platform}#${b.rowIndex}`;
        lines.push(`| ${formatDate(b.checkIn)} | ${formatDate(b.checkOut)} | ${getNights(b.checkIn, b.checkOut)} | ${b.reason || '-'} | ${sources} |`);
      }
      lines.push('');
    }

    if (bookings.length > 0) {
      lines.push('#### 📅 预订记录');
      lines.push('');
      lines.push('| 入住 | 退房 | 晚数 | 客人 | 来源 | 合并数 |');
      lines.push('|------|------|------|------|------|--------|');
      for (const b of bookings) {
        const sources = b.sources ? b.sources.map(s => `${s.platform}#${s.rowIndex}`).join(', ') : `${b.platform}#${b.rowIndex}`;
        const mergeCount = b.sources ? b.sources.length : 1;
        lines.push(`| ${formatDate(b.checkIn)} | ${formatDate(b.checkOut)} | ${getNights(b.checkIn, b.checkOut)} | ${b.guest || '-'} | ${sources} | ${mergeCount} |`);
      }
      lines.push('');
    }
  }

  if (result.invalidRecords.length > 0) {
    lines.push('## ❌ 无法处理的记录');
    lines.push('');
    lines.push('| 源文件 | 行号 | 房源 | 入住日期 | 退房日期 | 错误 |');
    lines.push('|--------|------|------|----------|----------|------|');
    for (const r of result.invalidRecords) {
      const errors = r.errors ? r.errors.map(e => e.message).join('; ') : '未知错误';
      lines.push(`| ${r.source} | ${r.rowIndex} | ${r.roomName || '-'} | ${r.checkInStr || '-'} | ${r.checkOutStr || '-'} | ${errors} |`);
    }
    lines.push('');
  }

  lines.push('---');
  lines.push('*报告由民宿房态导入工具自动生成*');

  writeFileSync(outputPath, lines.join('\n'), 'utf-8');
}
