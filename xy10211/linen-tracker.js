#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const db = require('./linen-database');

function printHelp() {
  console.log(`
民宿布草洗涤追踪 CLI

使用方法:
  node linen-tracker.js <command> [options]

命令:
  init                    初始化数据库（首次使用）
  import-rooms <file>     导入房源布草档案 (CSV/JSON)
  import-wash <file>      导入送洗批次记录 (CSV/JSON)
  import-return <file>    导入回收记录 (CSV/JSON)
  import-damage <file>    导入报损记录 (CSV/JSON)
  check-batch <batch_id>  核对指定批次的回收差异
  list-rooms              列出所有房源及布草配置
  list-batches            列出所有洗消批次
  list-review             列出需要人工确认的记录
  summary                 显示汇总统计
  help                    显示帮助信息

示例:
  node linen-tracker.js import-rooms samples/rooms.csv
  node linen-tracker.js check-batch BATCH-2026-001
`);
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  if (lines.length < 2) return { headers: [], rows: [] };

  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const values = lines[i].split(',').map(v => v.trim());
    const row = {};
    headers.forEach((h, idx) => {
      row[h] = values[idx] || '';
    });
    rows.push(row);
  }

  return { headers, rows };
}

function parseJSON(content) {
  const data = JSON.parse(content);
  if (Array.isArray(data)) {
    return data;
  }
  if (data.rows && Array.isArray(data.rows)) {
    return data.rows;
  }
  return [data];
}

function readFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const ext = path.extname(filePath).toLowerCase();

  if (ext === '.json') {
    return parseJSON(content);
  } else {
    const csv = parseCSV(content);
    return csv.rows;
  }
}

function validateRow(row, requiredFields, rowNum) {
  const errors = [];
  for (const field of requiredFields) {
    if (!row[field] || String(row[field]).trim() === '') {
      errors.push(`缺少必填字段: ${field}`);
    }
  }
  return errors;
}

function logImportResult(fileName, recordType, stats) {
  const log = db.prepare(`
    INSERT INTO import_logs (file_name, record_type, total_rows, processed_rows, skipped_rows, needs_review_rows, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
  `).run(fileName, recordType, stats.total, stats.processed, stats.skipped, stats.needsReview);

  return log.lastInsertRowid;
}

function logError(importLogId, rowNum, errorType, message, rawData) {
  db.prepare(`
    INSERT INTO import_errors (import_log_id, row_number, error_type, error_message, raw_data)
    VALUES (?, ?, ?, ?, ?)
  `).run(importLogId, rowNum, errorType, message, JSON.stringify(rawData));
}

function addReviewItem(data) {
  const existing = db.prepare(`
    SELECT id FROM review_items 
    WHERE batch_id = ? AND room_id = ? AND linen_type = ? AND issue_type = ? AND status = 'pending'
  `).get(data.batch_id, data.room_id, data.linen_type, data.issue_type);

  if (!existing) {
    db.prepare(`
      INSERT INTO review_items 
      (batch_id, room_id, linen_type, issue_type, issue_description, 
       sent_quantity, returned_quantity, damaged_quantity, expected_quantity, actual_quantity)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      data.batch_id, data.room_id, data.linen_type, data.issue_type, data.description,
      data.sent || 0, data.returned || 0, data.damaged || 0, data.expected || 0, data.actual || 0
    );
  }
}

function importRooms(filePath) {
  const rows = readFile(filePath);
  const stats = { total: rows.length, processed: 0, skipped: 0, needsReview: 0 };
  const importLogId = logImportResult(path.basename(filePath), 'rooms', stats);

  const requiredFields = ['room_id', 'room_name'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const errors = validateRow(row, requiredFields, rowNum);
    if (errors.length > 0) {
      stats.skipped++;
      logError(importLogId, rowNum, 'missing_fields', errors.join('; '), row);
      console.log(`  [跳过] 第 ${rowNum} 行: ${errors.join('; ')}`);
      continue;
    }

    const existing = db.prepare(`SELECT room_id FROM rooms WHERE room_id = ?`).get(row.room_id);
    if (existing) {
      try {
        db.prepare(`
          UPDATE rooms SET
            room_name = ?, floor = ?, bed_type = ?, bed_count = ?,
            duvet_sets = ?, sheets = ?, pillowcases = ?,
            bath_towels = ?, face_towels = ?, bath_mats = ?,
            updated_at = datetime('now')
          WHERE room_id = ?
        `).run(
          row.room_name,
          parseInt(row.floor) || null,
          row.bed_type || null,
          parseInt(row.bed_count) || 1,
          parseInt(row.duvet_sets) || 0,
          parseInt(row.sheets) || 0,
          parseInt(row.pillowcases) || 0,
          parseInt(row.bath_towels) || 0,
          parseInt(row.face_towels) || 0,
          parseInt(row.bath_mats) || 0,
          row.room_id
        );
        stats.processed++;
        console.log(`  [更新] 房源 ${row.room_id}: ${row.room_name}`);
      } catch (e) {
        stats.skipped++;
        logError(importLogId, rowNum, 'update_error', e.message, row);
        console.log(`  [跳过] 第 ${rowNum} 行: 更新失败 - ${e.message}`);
      }
    } else {
      try {
        db.prepare(`
          INSERT INTO rooms 
          (room_id, room_name, floor, bed_type, bed_count,
           duvet_sets, sheets, pillowcases, bath_towels, face_towels, bath_mats)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          row.room_id,
          row.room_name,
          parseInt(row.floor) || null,
          row.bed_type || null,
          parseInt(row.bed_count) || 1,
          parseInt(row.duvet_sets) || 0,
          parseInt(row.sheets) || 0,
          parseInt(row.pillowcases) || 0,
          parseInt(row.bath_towels) || 0,
          parseInt(row.face_towels) || 0,
          parseInt(row.bath_mats) || 0
        );
        stats.processed++;
        console.log(`  [新增] 房源 ${row.room_id}: ${row.room_name}`);
      } catch (e) {
        stats.skipped++;
        logError(importLogId, rowNum, 'insert_error', e.message, row);
        console.log(`  [跳过] 第 ${rowNum} 行: 插入失败 - ${e.message}`);
      }
    }
  }

  db.prepare(`UPDATE import_logs SET processed_rows = ?, skipped_rows = ?, needs_review_rows = ? WHERE id = ?`)
    .run(stats.processed, stats.skipped, stats.needsReview, importLogId);

  console.log('\n=== 导入结果 ===');
  console.log(`总行数: ${stats.total}`);
  console.log(`处理成功: ${stats.processed}`);
  console.log(`跳过行数: ${stats.skipped}`);
  if (stats.skipped > 0) {
    console.log(`查看详细错误: import_errors 表`);
  }
}

function importWash(filePath) {
  const rows = readFile(filePath);
  const stats = { total: rows.length, processed: 0, skipped: 0, needsReview: 0 };
  const importLogId = logImportResult(path.basename(filePath), 'wash', stats);

  const requiredFields = ['batch_id', 'batch_date', 'room_id', 'linen_type', 'quantity_sent'];

  const seenKeys = new Set();
  const duplicateKeys = new Set();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const errors = validateRow(row, requiredFields, rowNum);
    if (errors.length > 0) {
      stats.skipped++;
      logError(importLogId, rowNum, 'missing_fields', errors.join('; '), row);
      console.log(`  [跳过] 第 ${rowNum} 行: ${errors.join('; ')}`);
      continue;
    }

    const room = db.prepare(`SELECT room_id FROM rooms WHERE room_id = ?`).get(row.room_id);
    if (!room) {
      stats.needsReview++;
      addReviewItem({
        batch_id: row.batch_id,
        room_id: row.room_id,
        linen_type: row.linen_type,
        issue_type: 'unknown_room',
        description: `房源 ${row.room_id} 不存在，请确认房源编码是否正确`,
        sent: parseInt(row.quantity_sent) || 0
      });
      console.log(`  [待确认] 第 ${rowNum} 行: 房源 ${row.room_id} 不存在`);
    }

    const linenType = db.prepare(`SELECT type_code FROM linen_types WHERE type_code = ?`).get(row.linen_type);
    if (!linenType) {
      stats.needsReview++;
      addReviewItem({
        batch_id: row.batch_id,
        room_id: row.room_id,
        linen_type: row.linen_type,
        issue_type: 'unknown_linen_type',
        description: `布草类型 ${row.linen_type} 不存在，请确认类型编码`,
        sent: parseInt(row.quantity_sent) || 0
      });
      console.log(`  [待确认] 第 ${rowNum} 行: 布草类型 ${row.linen_type} 不存在`);
    }

    const key = `${row.batch_id}-${row.room_id}-${row.linen_type}`;
    if (seenKeys.has(key)) {
      duplicateKeys.add(key);
      stats.skipped++;
      logError(importLogId, rowNum, 'duplicate', `重复记录: ${key}`, row);
      console.log(`  [跳过] 第 ${rowNum} 行: 重复记录 ${key}`);
      continue;
    }
    seenKeys.add(key);

    const existing = db.prepare(`
      SELECT id FROM wash_items WHERE batch_id = ? AND room_id = ? AND linen_type = ?
    `).get(row.batch_id, row.room_id, row.linen_type);

    const batch = db.prepare(`SELECT batch_id FROM wash_batches WHERE batch_id = ?`).get(row.batch_id);
    if (!batch) {
      db.prepare(`INSERT INTO wash_batches (batch_id, batch_date, vendor) VALUES (?, ?, ?)`)
        .run(row.batch_id, row.batch_date, row.vendor || null);
    }

    const qtySent = parseInt(row.quantity_sent) || 0;

    if (existing) {
      const current = db.prepare(`SELECT quantity_sent FROM wash_items WHERE id = ?`).get(existing.id);
      if (current.quantity_sent !== qtySent) {
        stats.needsReview++;
        addReviewItem({
          batch_id: row.batch_id,
          room_id: row.room_id,
          linen_type: row.linen_type,
          issue_type: 'quantity_mismatch',
          description: `送洗数量冲突: 原有 ${current.quantity_sent}，新数据 ${qtySent}，需人工确认`,
          expected: current.quantity_sent,
          actual: qtySent
        });
        console.log(`  [待确认] 第 ${rowNum} 行: ${row.batch_id}/${row.room_id}/${row.linen_type} 数量冲突`);
      }
      db.prepare(`UPDATE wash_items SET quantity_sent = ?, notes = ?, updated_at = datetime('now') WHERE id = ?`)
        .run(qtySent, row.notes || null, existing.id);
    } else {
      db.prepare(`
        INSERT INTO wash_items (batch_id, room_id, linen_type, quantity_sent, notes)
        VALUES (?, ?, ?, ?, ?)
      `).run(row.batch_id, row.room_id, row.linen_type, qtySent, row.notes || null);
    }

    stats.processed++;
    console.log(`  [处理] ${row.batch_id}: ${row.room_id} ${row.linen_type} x${qtySent}`);
  }

  const batches = db.prepare(`SELECT batch_id FROM wash_batches`).all();
  for (const b of batches) {
    const totals = db.prepare(`
      SELECT 
        COALESCE(SUM(quantity_sent), 0) as total_sent,
        COALESCE(SUM(quantity_returned), 0) as total_returned,
        COALESCE(SUM(quantity_damaged), 0) as total_damaged
      FROM wash_items WHERE batch_id = ?
    `).get(b.batch_id);

    let status = 'sent';
    if (totals.total_returned > 0) {
      if (totals.total_returned === totals.total_sent) {
        status = 'returned';
      } else {
        status = 'partial';
      }
    }

    db.prepare(`
      UPDATE wash_batches 
      SET total_sent = ?, total_returned = ?, total_damaged = ?, status = ?, updated_at = datetime('now')
      WHERE batch_id = ?
    `).run(totals.total_sent, totals.total_returned, totals.total_damaged, status, b.batch_id);
  }

  db.prepare(`UPDATE import_logs SET processed_rows = ?, skipped_rows = ?, needs_review_rows = ? WHERE id = ?`)
    .run(stats.processed, stats.skipped, stats.needsReview, importLogId);

  console.log('\n=== 导入结果 ===');
  console.log(`总行数: ${stats.total}`);
  console.log(`处理成功: ${stats.processed}`);
  console.log(`跳过行数: ${stats.skipped}`);
  console.log(`待人工确认: ${stats.needsReview}`);
}

function importReturn(filePath) {
  const rows = readFile(filePath);
  const stats = { total: rows.length, processed: 0, skipped: 0, needsReview: 0 };
  const importLogId = logImportResult(path.basename(filePath), 'return', stats);

  const requiredFields = ['batch_id', 'room_id', 'linen_type', 'quantity_returned', 'return_date'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const errors = validateRow(row, requiredFields, rowNum);
    if (errors.length > 0) {
      stats.skipped++;
      logError(importLogId, rowNum, 'missing_fields', errors.join('; '), row);
      console.log(`  [跳过] 第 ${rowNum} 行: ${errors.join('; ')}`);
      continue;
    }

    const qtyReturned = parseInt(row.quantity_returned) || 0;
    const qtyDamaged = parseInt(row.quantity_damaged) || 0;

    const washItem = db.prepare(`
      SELECT id, quantity_sent, quantity_returned, quantity_damaged 
      FROM wash_items 
      WHERE batch_id = ? AND room_id = ? AND linen_type = ?
    `).get(row.batch_id, row.room_id, row.linen_type);

    if (!washItem) {
      stats.needsReview++;
      addReviewItem({
        batch_id: row.batch_id,
        room_id: row.room_id,
        linen_type: row.linen_type,
        issue_type: 'no_wash_record',
        description: `回收记录找不到对应的送洗记录: 批次 ${row.batch_id}`,
        returned: qtyReturned,
        damaged: qtyDamaged
      });
      console.log(`  [待确认] 第 ${rowNum} 行: 无对应送洗记录 ${row.batch_id}/${row.room_id}/${row.linen_type}`);
    } else {
      const totalReturned = washItem.quantity_returned + qtyReturned;
      const totalDamaged = washItem.quantity_damaged + qtyDamaged;
      const total = totalReturned + totalDamaged;

      if (total > washItem.quantity_sent) {
        stats.needsReview++;
        addReviewItem({
          batch_id: row.batch_id,
          room_id: row.room_id,
          linen_type: row.linen_type,
          issue_type: 'over_return',
          description: `回收数量超过送洗数量: 送洗 ${washItem.quantity_sent}，累计回收+报损 ${total}`,
          sent: washItem.quantity_sent,
          returned: totalReturned,
          damaged: totalDamaged,
          expected: washItem.quantity_sent,
          actual: total
        });
        console.log(`  [待确认] 第 ${rowNum} 行: 回收超量 ${row.batch_id}/${row.room_id}/${row.linen_type}`);
      }

      db.prepare(`
        UPDATE wash_items 
        SET quantity_returned = ?, quantity_damaged = ?, updated_at = datetime('now')
        WHERE id = ?
      `).run(totalReturned, totalDamaged, washItem.id);
    }

    db.prepare(`
      INSERT INTO return_records 
      (batch_id, room_id, linen_type, quantity_returned, quantity_damaged, return_date, received_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.batch_id, row.room_id, row.linen_type, qtyReturned, qtyDamaged, row.return_date, row.received_by || null, row.notes || null);

    stats.processed++;
    console.log(`  [回收] ${row.batch_id}: ${row.room_id} ${row.linen_type} 回收${qtyReturned} 报损${qtyDamaged}`);
  }

  const batches = db.prepare(`SELECT batch_id FROM wash_batches`).all();
  for (const b of batches) {
    const totals = db.prepare(`
      SELECT 
        COALESCE(SUM(quantity_sent), 0) as total_sent,
        COALESCE(SUM(quantity_returned), 0) as total_returned,
        COALESCE(SUM(quantity_damaged), 0) as total_damaged
      FROM wash_items WHERE batch_id = ?
    `).get(b.batch_id);

    let status = 'sent';
    if (totals.total_returned > 0) {
      if (totals.total_returned + totals.total_damaged === totals.total_sent) {
        status = 'returned';
      } else {
        status = 'partial';
      }
    }

    db.prepare(`
      UPDATE wash_batches 
      SET total_sent = ?, total_returned = ?, total_damaged = ?, status = ?, updated_at = datetime('now')
      WHERE batch_id = ?
    `).run(totals.total_sent, totals.total_returned, totals.total_damaged, status, b.batch_id);
  }

  db.prepare(`UPDATE import_logs SET processed_rows = ?, skipped_rows = ?, needs_review_rows = ? WHERE id = ?`)
    .run(stats.processed, stats.skipped, stats.needsReview, importLogId);

  console.log('\n=== 导入结果 ===');
  console.log(`总行数: ${stats.total}`);
  console.log(`处理成功: ${stats.processed}`);
  console.log(`跳过行数: ${stats.skipped}`);
  console.log(`待人工确认: ${stats.needsReview}`);
}

function importDamage(filePath) {
  const rows = readFile(filePath);
  const stats = { total: rows.length, processed: 0, skipped: 0, needsReview: 0 };
  const importLogId = logImportResult(path.basename(filePath), 'damage', stats);

  const requiredFields = ['room_id', 'linen_type', 'quantity', 'reported_date'];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    const errors = validateRow(row, requiredFields, rowNum);
    if (errors.length > 0) {
      stats.skipped++;
      logError(importLogId, rowNum, 'missing_fields', errors.join('; '), row);
      console.log(`  [跳过] 第 ${rowNum} 行: ${errors.join('; ')}`);
      continue;
    }

    const qty = parseInt(row.quantity) || 0;

    db.prepare(`
      INSERT INTO damage_records 
      (batch_id, room_id, linen_type, quantity, damage_type, reported_date, reported_by, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(row.batch_id || null, row.room_id, row.linen_type, qty, row.damage_type || null, row.reported_date, row.reported_by || null, row.notes || null);

    stats.processed++;
    console.log(`  [报损] ${row.room_id} ${row.linen_type} x${qty} (${row.damage_type || '未说明'})`);
  }

  db.prepare(`UPDATE import_logs SET processed_rows = ?, skipped_rows = ?, needs_review_rows = ? WHERE id = ?`)
    .run(stats.processed, stats.skipped, stats.needsReview, importLogId);

  console.log('\n=== 导入结果 ===');
  console.log(`总行数: ${stats.total}`);
  console.log(`处理成功: ${stats.processed}`);
  console.log(`跳过行数: ${stats.skipped}`);
}

function checkBatch(batchId) {
  const batch = db.prepare(`SELECT * FROM wash_batches WHERE batch_id = ?`).get(batchId);
  if (!batch) {
    console.log(`批次 ${batchId} 不存在`);
    return;
  }

  console.log(`\n=== 批次核对: ${batchId} ===`);
  console.log(`批次日期: ${batch.batch_date}`);
  console.log(`供应商: ${batch.vendor || '未指定'}`);
  console.log(`状态: ${batch.status}`);
  console.log(`\n总计 - 送洗: ${batch.total_sent}, 回收: ${batch.total_returned}, 报损: ${batch.total_damaged}`);
  console.log(`差异: ${batch.total_sent - batch.total_returned - batch.total_damaged}\n`);

  const items = db.prepare(`
    SELECT wi.*, r.room_name
    FROM wash_items wi
    LEFT JOIN rooms r ON wi.room_id = r.room_id
    WHERE wi.batch_id = ?
    ORDER BY wi.room_id, wi.linen_type
  `).all(batchId);

  console.log('--- 明细核对 ---');
  for (const item of items) {
    const diff = item.quantity_sent - item.quantity_returned - item.quantity_damaged;
    const status = diff === 0 ? '✓' : diff > 0 ? '⚠' : '✗';
    console.log(`  ${status} ${item.room_id} (${item.room_name || '?'}) - ${item.linen_type}:`);
    console.log(`      送洗: ${item.quantity_sent}, 回收: ${item.quantity_returned}, 报损: ${item.quantity_damaged}, 差异: ${diff}`);

    if (diff !== 0) {
      addReviewItem({
        batch_id: batchId,
        room_id: item.room_id,
        linen_type: item.linen_type,
        issue_type: diff > 0 ? 'missing' : 'over',
        description: diff > 0 ? `缺少 ${diff} 件，需确认去向` : `多回 ${Math.abs(diff)} 件，需确认来源`,
        sent: item.quantity_sent,
        returned: item.quantity_returned,
        damaged: item.quantity_damaged,
        expected: item.quantity_sent,
        actual: item.quantity_returned + item.quantity_damaged
      });
    }
  }

  const rooms = db.prepare(`
    SELECT DISTINCT room_id FROM wash_items WHERE batch_id = ?
  `).all(batchId);

  console.log('\n--- 房源布草配置核对 ---');
  for (const r of rooms) {
    const room = db.prepare(`SELECT * FROM rooms WHERE room_id = ?`).get(r.room_id);
    if (!room) continue;

    const roomItems = items.filter(i => i.room_id === r.room_id);
    const sentByType = {};
    const returnedByType = {};
    const damagedByType = {};

    roomItems.forEach(i => {
      sentByType[i.linen_type] = (sentByType[i.linen_type] || 0) + i.quantity_sent;
      returnedByType[i.linen_type] = (returnedByType[i.linen_type] || 0) + i.quantity_returned;
      damagedByType[i.linen_type] = (damagedByType[i.linen_type] || 0) + i.quantity_damaged;
    });

    const standard = {
      duvet: room.duvet_sets,
      sheet: room.sheets,
      pillowcase: room.pillowcases,
      bath_towel: room.bath_towels,
      face_towel: room.face_towels,
      bath_mat: room.bath_mats
    };

    console.log(`\n  ${room.room_id} (${room.room_name}) 配置:`);
    for (const [type, std] of Object.entries(standard)) {
      const sent = sentByType[type] || 0;
      if (std > 0 || sent > 0) {
        const diff = sent - std;
        const status = diff === 0 ? '✓' : diff > 0 ? '↑' : '↓';
        console.log(`    ${status} ${type}: 送洗${sent}, 配置${std}, 差异${diff}`);
        if (diff !== 0) {
          addReviewItem({
            batch_id: batchId,
            room_id: room.room_id,
            linen_type: type,
            issue_type: diff > 0 ? 'over_sent' : 'under_sent',
            description: diff > 0 ? `送洗数量超出配置 ${diff} 件，旺季可能缺套` : `送洗数量少于配置 ${Math.abs(diff)} 件`,
            expected: std,
            actual: sent
          });
        }
      }
    }
  }

  const pendingReviews = db.prepare(`
    SELECT COUNT(*) as count FROM review_items WHERE batch_id = ? AND status = 'pending'
  `).get(batchId);

  console.log(`\n--- 核对结果 ---`);
  console.log(`待人工确认项: ${pendingReviews.count}`);
}

function listRooms() {
  const rooms = db.prepare(`SELECT * FROM rooms ORDER BY room_id`).all();

  console.log('\n=== 房源布草档案 ===\n');
  console.log('房号\t名称\t楼层\t床型\t被套\t床单\t枕套\t浴巾\t面巾\t地巾');
  console.log('----------------------------------------------------------------------------------');

  for (const r of rooms) {
    console.log(`${r.room_id}\t${r.room_name}\t${r.floor || '-'}\t${r.bed_type || '-'}\t${r.duvet_sets}\t${r.sheets}\t${r.pillowcases}\t${r.bath_towels}\t${r.face_towels}\t${r.bath_mats}`);
  }

  console.log(`\n共 ${rooms.length} 个房源`);
}

function listBatches() {
  const batches = db.prepare(`SELECT * FROM wash_batches ORDER BY batch_date DESC, batch_id DESC`).all();

  console.log('\n=== 洗消批次列表 ===\n');
  console.log('批次ID\t\t日期\t\t供应商\t状态\t送洗\t回收\t报损\t差异');
  console.log('----------------------------------------------------------------------------------');

  for (const b of batches) {
    const diff = b.total_sent - b.total_returned - b.total_damaged;
    console.log(`${b.batch_id}\t${b.batch_date}\t${b.vendor || '-'}\t${b.status}\t${b.total_sent}\t${b.total_returned}\t${b.total_damaged}\t${diff}`);
  }

  console.log(`\n共 ${batches.length} 个批次`);
}

function listReview() {
  const items = db.prepare(`
    SELECT ri.*, r.room_name, b.batch_date
    FROM review_items ri
    LEFT JOIN rooms r ON ri.room_id = r.room_id
    LEFT JOIN wash_batches b ON ri.batch_id = b.batch_id
    WHERE ri.status = 'pending'
    ORDER BY ri.created_at DESC
  `).all();

  console.log('\n=== 需要人工确认的记录 ===\n');

  if (items.length === 0) {
    console.log('没有待确认的记录 ✓');
    return;
  }

  for (const item of items) {
    console.log(`\n[${item.id}] ${item.issue_type}`);
    console.log(`  批次: ${item.batch_id || '-'} (${item.batch_date || '-'})`);
    console.log(`  房源: ${item.room_id} (${item.room_name || '?'})`);
    console.log(`  布草: ${item.linen_type || '-'}`);
    console.log(`  描述: ${item.issue_description}`);
    if (item.sent_quantity !== null) console.log(`  送洗: ${item.sent_quantity}`);
    if (item.returned_quantity !== null) console.log(`  回收: ${item.returned_quantity}`);
    if (item.damaged_quantity !== null) console.log(`  报损: ${item.damaged_quantity}`);
    if (item.expected_quantity !== null || item.actual_quantity !== null) {
      console.log(`  预期/实际: ${item.expected_quantity} / ${item.actual_quantity}`);
    }
  }

  console.log(`\n共 ${items.length} 项待确认`);
}

function showSummary() {
  const roomCount = db.prepare(`SELECT COUNT(*) as count FROM rooms`).get().count;
  const batchCount = db.prepare(`SELECT COUNT(*) as count FROM wash_batches`).get().count;
  const pendingReview = db.prepare(`SELECT COUNT(*) as count FROM review_items WHERE status = 'pending'`).get().count;

  const totals = db.prepare(`
    SELECT 
      COALESCE(SUM(total_sent), 0) as total_sent,
      COALESCE(SUM(total_returned), 0) as total_returned,
      COALESCE(SUM(total_damaged), 0) as total_damaged
    FROM wash_batches
  `).get();

  const byType = db.prepare(`
    SELECT 
      linen_type,
      SUM(quantity_sent) as sent,
      SUM(quantity_returned) as returned,
      SUM(quantity_damaged) as damaged
    FROM wash_items
    GROUP BY linen_type
    ORDER BY linen_type
  `).all();

  const missing = db.prepare(`
    SELECT 
      wi.batch_id,
      wi.room_id,
      wi.linen_type,
      (wi.quantity_sent - wi.quantity_returned - wi.quantity_damaged) as missing_qty
    FROM wash_items wi
    WHERE (wi.quantity_sent - wi.quantity_returned - wi.quantity_damaged) > 0
    ORDER BY missing_qty DESC
  `).all();

  console.log('\n=== 汇总统计 ===\n');
  console.log(`房源数量: ${roomCount}`);
  console.log(`洗消批次: ${batchCount}`);
  console.log(`\n总量统计:`);
  console.log(`  累计送洗: ${totals.total_sent}`);
  console.log(`  累计回收: ${totals.total_returned}`);
  console.log(`  累计报损: ${totals.total_damaged}`);
  console.log(`  在途/缺失: ${totals.total_sent - totals.total_returned - totals.total_damaged}`);
  console.log(`\n按布草类型统计:`);
  console.log('类型\t\t送洗\t回收\t报损\t在途');
  console.log('----------------------------------------');
  for (const t of byType) {
    const m = t.sent - t.returned - t.damaged;
    console.log(`${t.linen_type}\t\t${t.sent}\t${t.returned}\t${t.damaged}\t${m}`);
  }

  if (missing.length > 0) {
    console.log(`\n⚠ 缺失物品 (${missing.length}项):`);
    for (const m of missing) {
      console.log(`  ${m.batch_id} - ${m.room_id} ${m.linen_type}: 缺${m.missing_qty}件`);
    }
  }

  console.log(`\n待人工确认: ${pendingReview} 项`);
}

const args = process.argv.slice(2);
const command = args[0];

if (!command || command === 'help') {
  printHelp();
  process.exit(0);
}

switch (command) {
  case 'init':
    console.log('数据库已初始化 ✓');
    break;
  case 'import-rooms':
    if (!args[1]) {
      console.log('请指定房源档案文件路径');
      process.exit(1);
    }
    importRooms(args[1]);
    break;
  case 'import-wash':
    if (!args[1]) {
      console.log('请指定送洗记录文件路径');
      process.exit(1);
    }
    importWash(args[1]);
    break;
  case 'import-return':
    if (!args[1]) {
      console.log('请指定回收记录文件路径');
      process.exit(1);
    }
    importReturn(args[1]);
    break;
  case 'import-damage':
    if (!args[1]) {
      console.log('请指定报损记录文件路径');
      process.exit(1);
    }
    importDamage(args[1]);
    break;
  case 'check-batch':
    if (!args[1]) {
      console.log('请指定批次ID');
      process.exit(1);
    }
    checkBatch(args[1]);
    break;
  case 'list-rooms':
    listRooms();
    break;
  case 'list-batches':
    listBatches();
    break;
  case 'list-review':
    listReview();
    break;
  case 'summary':
    showSummary();
    break;
  default:
    console.log(`未知命令: ${command}`);
    printHelp();
    process.exit(1);
}
