const crypto = require('crypto');
const { prepare, WORKFLOW_STEPS } = require('./database');

function hashContent(content) {
  return crypto.createHash('md5').update(JSON.stringify(content)).digest('hex');
}

function recordHistory(entityType, entityId, operationType, fieldName, oldValue, newValue, operator, note) {
  const stmt = prepare(`
    INSERT INTO operation_history 
    (entity_type, entity_id, operation_type, field_name, old_value, new_value, operator, operation_note)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(entityType, entityId, operationType, fieldName, 
    oldValue ? JSON.stringify(oldValue) : null,
    newValue ? JSON.stringify(newValue) : null,
    operator, note);
}

function generateBatchId() {
  return 'BATCH_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
}

function initWorkflowSteps(contractId, operator) {
  const insertStmt = prepare(`
    INSERT INTO workflow_steps (contract_screenshot_id, step_name, step_status, step_order, operator)
    VALUES (?, ?, 'pending', ?, ?)
  `);
  
  WORKFLOW_STEPS.forEach(step => {
    insertStmt.run(contractId, step.name, step.order, operator);
  });
  
  const updateStmt = prepare(`
    UPDATE workflow_steps 
    SET step_status = 'completed', completed_at = datetime('now')
    WHERE contract_screenshot_id = ? AND step_name = 'contract_import'
  `);
  updateStmt.run(contractId);
}

function importContractScreenshots(rows, sourceFile, operator) {
  const batchId = generateBatchId();
  const fileHash = hashContent(rows);
  
  prepare(`
    INSERT INTO import_batches (batch_id, source_file, total_rows, imported_by)
    VALUES (?, ?, ?, ?)
  `).run(batchId, sourceFile, rows.length, operator);
  
  const checkExistsByRow = prepare(`
    SELECT id FROM contract_screenshots 
    WHERE song_name = ? AND hotel_name = ? AND room_type = ? 
      AND room_count = ? AND original_row_number = ?
    LIMIT 1
  `);
  
  const insertContract = prepare(`
    INSERT INTO contract_screenshots 
    (import_batch_id, original_row_number, song_name, song_name_type, hotel_name, 
     room_type, room_count, check_in_date, check_out_date, remarks, source_file, file_hash, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  let importedCount = 0;
  let duplicateCount = 0;
  const importedIds = [];
  
  rows.forEach((row, index) => {
    const originalRowNumber = row.original_row_number || (index + 1);
    const songName = row.song_name || row.歌曲名称 || '';
    const hotelName = row.hotel_name || row.酒店名称 || '';
    const roomType = row.room_type || row.房型 || '';
    const roomCount = parseInt(row.room_count || row.房间数 || 0);
    
    const existing = checkExistsByRow.get(songName, hotelName, roomType, roomCount, originalRowNumber);
    if (existing) {
      duplicateCount++;
      importedIds.push(existing.id);
      return;
    }
    
    try {
      insertContract.run(
        batchId,
        originalRowNumber,
        songName,
        row.song_name_type || 'unknown',
        hotelName,
        roomType,
        roomCount,
        row.check_in_date || row.入住日期 || '',
        row.check_out_date || row.退房日期 || '',
        row.remarks || row.备注 || '',
        sourceFile,
        fileHash,
        operator
      );
      
      const inserted = checkExistsByRow.get(songName, hotelName, roomType, roomCount, originalRowNumber);
      if (inserted) {
        importedCount++;
        importedIds.push(inserted.id);
        initWorkflowSteps(inserted.id, operator);
        recordHistory('contract_screenshot', inserted.id, 'create', null, null, row, operator, '合同截图导入');
      } else {
        duplicateCount++;
      }
    } catch (e) {
      if (e.message.includes('UNIQUE') || e.message.includes('constraint')) {
        duplicateCount++;
        const existingAfter = checkExistsByRow.get(songName, hotelName, roomType, roomCount, originalRowNumber);
        if (existingAfter) {
          importedIds.push(existingAfter.id);
        }
      } else {
        throw e;
      }
    }
  });
  
  prepare(`
    UPDATE import_batches 
    SET imported_rows = ?, duplicate_rows = ?
    WHERE batch_id = ?
  `).run(importedCount, duplicateCount, batchId);
  
  importedIds.forEach(contractId => {
    createOrUpdateRoomLinkage(contractId, operator);
  });
  
  return {
    batch_id: batchId,
    total_rows: rows.length,
    imported_rows: importedCount,
    duplicate_rows: duplicateCount,
    contract_ids: importedIds
  };
}

function findCanonicalSongName(songName) {
  const exactMatch = prepare(`
    SELECT canonical_name, alias_type, id as alias_id
    FROM song_aliases 
    WHERE alias_name = ? AND is_active = 1
    LIMIT 1
  `).get(songName);
  
  if (exactMatch) {
    return exactMatch;
  }
  
  const canonicalMatch = prepare(`
    SELECT canonical_name, 'canonical' as alias_type, null as alias_id
    FROM song_aliases 
    WHERE canonical_name = ? AND is_active = 1
    LIMIT 1
  `).get(songName);
  
  if (canonicalMatch) {
    return canonicalMatch;
  }
  
  return null;
}

function checkNameConflict(songName, contractId) {
  const canonicalMatch = findCanonicalSongName(songName);
  if (!canonicalMatch) {
    return { hasConflict: false };
  }
  
  const canonicalName = canonicalMatch.canonical_name;
  
  const allAliases = prepare(`
    SELECT canonical_name, alias_name, alias_type
    FROM song_aliases 
    WHERE canonical_name = ? AND is_active = 1
  `).all(canonicalName);
  
  if (allAliases.length > 1) {
    const aliasTypes = [...new Set(allAliases.map(m => m.alias_type))];
    if (aliasTypes.includes('live_name') && aliasTypes.includes('copyright_name')) {
      return {
        hasConflict: true,
        conflictType: 'live_vs_copyright',
        detail: `规范名 "${canonicalName}" 同时存在现场名和版权名，请音乐老师复核`,
        matches: allAliases
      };
    }
  }
  
  const allMatches = prepare(`
    SELECT canonical_name, alias_name, alias_type
    FROM song_aliases 
    WHERE (alias_name = ? OR canonical_name = ?) AND is_active = 1
  `).all(songName, songName);
  
  const canonicalNames = [...new Set(allMatches.map(m => m.canonical_name))];
  if (canonicalNames.length > 1) {
    return {
      hasConflict: true,
      conflictType: 'multiple_canonical',
      detail: `歌曲名 "${songName}" 匹配到多个规范名: ${canonicalNames.join(', ')}`,
      matches: allMatches
    };
  }
  
  return { hasConflict: false };
}

function createOrUpdateRoomLinkage(contractId, operator) {
  const contract = prepare('SELECT * FROM contract_screenshots WHERE id = ?').get(contractId);
  if (!contract) return null;
  
  const existing = prepare('SELECT * FROM room_linkages WHERE contract_screenshot_id = ?').get(contractId);
  const match = findCanonicalSongName(contract.song_name);
  const conflict = checkNameConflict(contract.song_name, contractId);
  
  let linkageStatus = 'pending';
  let conflictDetail = null;
  let canonicalName = match ? match.canonical_name : contract.song_name;
  let matchedAliasId = match ? match.alias_id : null;
  
  if (conflict.hasConflict) {
    linkageStatus = 'pending_review';
    conflictDetail = JSON.stringify(conflict);
  } else if (match) {
    linkageStatus = 'normal';
  } else {
    linkageStatus = 'no_alias';
  }
  
  if (existing) {
    const oldValues = { ...existing };
    
    prepare(`
      UPDATE room_linkages
      SET song_canonical_name = ?, matched_alias_id = ?, hotel_name = ?, room_type = ?, 
          room_count = ?, linkage_status = ?, conflict_detail = ?, updated_at = datetime('now')
      WHERE id = ?
    `).run(canonicalName, matchedAliasId, contract.hotel_name, contract.room_type, 
           contract.room_count, linkageStatus, conflictDetail, existing.id);
    
    recordHistory('room_linkage', existing.id, 'update', 'linkage_status', 
      oldValues.linkage_status, linkageStatus, operator, '联动状态更新');
    
    return existing.id;
  } else {
    const result = prepare(`
      INSERT INTO room_linkages
      (contract_screenshot_id, song_canonical_name, matched_alias_id, hotel_name, 
       room_type, room_count, linkage_status, conflict_detail)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(contractId, canonicalName, matchedAliasId, contract.hotel_name, 
           contract.room_type, contract.room_count, linkageStatus, conflictDetail);
    
    recordHistory('room_linkage', result.lastInsertRowid, 'create', null, null, {
      contract_screenshot_id: contractId,
      song_canonical_name: canonicalName,
      linkage_status: linkageStatus
    }, operator, '创建房型联动');
    
    return result.lastInsertRowid;
  }
}

function updateWorkflowStep(contractId, stepName, status, operator, note) {
  const step = WORKFLOW_STEPS.find(s => s.name === stepName);
  if (!step) throw new Error(`无效的步骤名: ${stepName}`);
  
  const existing = prepare(`
    SELECT * FROM workflow_steps 
    WHERE contract_screenshot_id = ? AND step_name = ?
  `).get(contractId, stepName);
  
  if (!existing) throw new Error(`合同 ${contractId} 没有步骤 ${stepName}`);
  
  const oldStatus = existing.step_status;
  
  prepare(`
    UPDATE workflow_steps
    SET step_status = ?, completed_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE completed_at END,
        operator = ?, step_note = ?
    WHERE contract_screenshot_id = ? AND step_name = ?
  `).run(status, status, operator, note, contractId, stepName);
  
  recordHistory('workflow_step', existing.id, 'update', 'step_status', 
    oldStatus, status, operator, note || `步骤状态更新为 ${status}`);
  
  if (stepName === 'alias_check' && status === 'completed') {
    createOrUpdateRoomLinkage(contractId, operator);
  }
  
  const allSteps = prepare(`
    SELECT step_status FROM workflow_steps WHERE contract_screenshot_id = ?
  `).all(contractId);
  
  const allCompleted = allSteps.every(s => s.step_status === 'completed');
  if (allCompleted) {
    prepare(`
      UPDATE contract_screenshots 
      SET status = 'confirmed', updated_at = datetime('now')
      WHERE id = ?
    `).run(contractId);
  }
  
  return true;
}

function updateContractRemarks(contractId, remarks, operator) {
  const existing = prepare('SELECT remarks FROM contract_screenshots WHERE id = ?').get(contractId);
  if (!existing) throw new Error('合同记录不存在');
  
  const oldRemarks = existing.remarks;
  
  prepare(`
    UPDATE contract_screenshots 
    SET remarks = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(remarks, contractId);
  
  recordHistory('contract_screenshot', contractId, 'update', 'remarks', 
    oldRemarks, remarks, operator, '更新备注');
  
  return true;
}

function reviewLinkage(linkageId, reviewDecision, reviewNote, operator) {
  const linkage = prepare('SELECT * FROM room_linkages WHERE id = ?').get(linkageId);
  if (!linkage) throw new Error('联动记录不存在');
  
  const oldStatus = linkage.linkage_status;
  let newStatus = oldStatus;
  
  if (reviewDecision === 'confirm_normal') {
    newStatus = 'normal';
  } else if (reviewDecision === 'mark_conflict') {
    newStatus = 'name_conflict';
  }
  
  prepare(`
    UPDATE room_linkages
    SET linkage_status = ?, review_note = ?, reviewed_by = ?, reviewed_at = datetime('now'), updated_at = datetime('now')
    WHERE id = ?
  `).run(newStatus, reviewNote, operator, linkageId);
  
  recordHistory('room_linkage', linkageId, 'review', 'linkage_status', 
    oldStatus, newStatus, operator, `音乐老师复核: ${reviewNote || reviewDecision}`);
  
  return true;
}

function addSongAlias(canonicalName, aliasName, aliasType, source, operator) {
  try {
    const existing = prepare(`
      SELECT id FROM song_aliases WHERE canonical_name = ? AND alias_name = ?
    `).get(canonicalName, aliasName);
    
    if (existing) {
      return existing.id;
    }
    
    const result = prepare(`
      INSERT INTO song_aliases (canonical_name, alias_name, alias_type, source)
      VALUES (?, ?, ?, ?)
    `).run(canonicalName, aliasName, aliasType || 'live_name', source);
    
    recordHistory('song_alias', result.lastInsertRowid, 'create', null, null, {
      canonical_name: canonicalName,
      alias_name: aliasName,
      alias_type: aliasType
    }, operator, '添加曲目别名');
    
    const allContracts = prepare('SELECT id, song_name FROM contract_screenshots').all();
    allContracts.forEach(c => {
      const match = findCanonicalSongName(c.song_name);
      if (match && match.canonical_name === canonicalName) {
        createOrUpdateRoomLinkage(c.id, operator);
      } else if (c.song_name === aliasName || c.song_name === canonicalName) {
        createOrUpdateRoomLinkage(c.id, operator);
      }
    });
    
    return result.lastInsertRowid;
  } catch (e) {
    if (e.message.includes('UNIQUE')) {
      const existing = prepare(`
        SELECT id FROM song_aliases WHERE canonical_name = ? AND alias_name = ?
      `).get(canonicalName, aliasName);
      return existing.id;
    }
    throw e;
  }
}

function getContractWithHistory(contractId) {
  const contract = prepare('SELECT * FROM contract_screenshots WHERE id = ?').get(contractId);
  if (!contract) return null;
  
  const linkage = prepare('SELECT * FROM room_linkages WHERE contract_screenshot_id = ?').get(contractId);
  
  const workflowStepsData = prepare(`
    SELECT ws.*,
      CASE ws.step_name 
        WHEN 'contract_import' THEN '合同页截图导入'
        WHEN 'alias_check' THEN '核对曲目别名表'
        WHEN 'weekly_report' THEN '更新店长周报'
        ELSE ws.step_name
      END as label
    FROM workflow_steps ws
    WHERE ws.contract_screenshot_id = ?
    ORDER BY ws.step_order
  `).all(contractId);
  
  const history1 = prepare(`
    SELECT * FROM operation_history 
    WHERE entity_type = 'contract_screenshot' AND entity_id = ?
  `).all(contractId);
  
  let history2 = [];
  if (linkage) {
    history2 = prepare(`
      SELECT * FROM operation_history 
      WHERE entity_type = 'room_linkage' AND entity_id = ?
    `).all(linkage.id);
  }
  
  const history3 = prepare(`
    SELECT * FROM operation_history 
    WHERE entity_type = 'workflow_step' AND entity_id IN (
      SELECT id FROM workflow_steps WHERE contract_screenshot_id = ?
    )
  `).all(contractId);
  
  const allHistory = [...history1, ...history2, ...history3].sort((a, b) => {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  
  return {
    contract,
    linkage,
    workflow: workflowStepsData,
    history: allHistory
  };
}

function getWeeklyReportData() {
  return prepare(`
    SELECT 
      cl.song_canonical_name,
      GROUP_CONCAT(DISTINCT cs.song_name) as original_names,
      cl.hotel_name,
      cl.room_type,
      SUM(cl.room_count) as total_rooms,
      cl.linkage_status,
      cl.conflict_detail,
      GROUP_CONCAT(DISTINCT cs.import_batch_id) as batches
    FROM room_linkages cl
    JOIN contract_screenshots cs ON cl.contract_screenshot_id = cs.id
    GROUP BY cl.song_canonical_name, cl.hotel_name, cl.room_type, cl.linkage_status
    ORDER BY cl.song_canonical_name, cl.hotel_name
  `).all();
}

module.exports = {
  importContractScreenshots,
  createOrUpdateRoomLinkage,
  updateWorkflowStep,
  updateContractRemarks,
  reviewLinkage,
  addSongAlias,
  getContractWithHistory,
  getWeeklyReportData,
  findCanonicalSongName,
  checkNameConflict
};
