const { get, all, run } = require('../database/db');

const CONFLICT_TYPES = {
    RECURRENCE_WITHOUT_UPGRADE: 'recurrence_without_upgrade',
    BOARD_INCONSISTENCY: 'board_inconsistency',
    DUPLICATE_RECORD: 'duplicate_record',
    FIELD_MISMATCH: 'field_mismatch'
};

async function checkRecurrenceConflict(plantId, inspectionDate, issueType, currentSeverity) {
    const recentRecords = await all(
        `SELECT * FROM inspection_records 
         WHERE plant_id = ? 
         AND issue_type = ? 
         AND inspection_date <= ? 
         AND inspection_date >= DATE(?, '-30 days')
         ORDER BY inspection_date DESC`,
        [plantId, issueType, inspectionDate, inspectionDate]
    );

    if (recentRecords.length >= 2) {
        const latestRecord = recentRecords[0];
        const recurrenceCount = latestRecord.recurrence_count || 0;
        
        if (recurrenceCount >= 2 && !latestRecord.upgrade_flag) {
            return {
                hasConflict: true,
                conflictType: CONFLICT_TYPES.RECURRENCE_WITHOUT_UPGRADE,
                severity: 'high',
                message: `同一绿植"${issueType}"问题已复发${recurrenceCount}次但未升级处理`,
                details: {
                    plantId,
                    issueType,
                    recurrenceCount,
                    lastOccurrenceDate: latestRecord.inspection_date,
                    currentSeverity,
                    suggestedAction: '建议立即升级问题级别并通知主管'
                }
            };
        }
    }

    return { hasConflict: false };
}

async function checkBoardConsistency(recordId) {
    const record = await get(
        `SELECT ir.*, gp.plant_name, mt.team_name
         FROM inspection_records ir
         LEFT JOIN green_plants gp ON ir.plant_id = gp.id
         LEFT JOIN maintenance_teams mt ON ir.team_id = mt.id
         WHERE ir.id = ?`,
        [recordId]
    );

    if (!record) {
        return { hasConflict: false };
    }

    const inconsistencies = [];

    if (record.record_status === '待升级' && record.board_sync_status === '未同步') {
        inconsistencies.push({
            field: 'board_sync_status',
            expected: '已同步',
            actual: '未同步',
            message: '待升级记录未同步到巡检看板'
        });
    }

    if (record.issue_severity === '严重' && record.board_sync_status === '未同步') {
        inconsistencies.push({
            field: 'board_sync_status',
            expected: '已同步',
            actual: '未同步',
            message: '严重问题记录未同步到巡检看板'
        });
    }

    if (inconsistencies.length > 0) {
        return {
            hasConflict: true,
            conflictType: CONFLICT_TYPES.BOARD_INCONSISTENCY,
            severity: 'medium',
            message: '巡检记录与看板数据存在不一致',
            details: {
                recordId,
                recordNo: record.record_no,
                inconsistencies
            }
        };
    }

    return { hasConflict: false };
}

async function checkDuplicateRecord(recordNo, excludeId = null) {
    let sql = 'SELECT id FROM inspection_records WHERE record_no = ?';
    let params = [recordNo];
    
    if (excludeId) {
        sql += ' AND id != ?';
        params.push(excludeId);
    }

    const existing = await get(sql, params);
    
    if (existing) {
        return {
            hasConflict: true,
            conflictType: CONFLICT_TYPES.DUPLICATE_RECORD,
            severity: 'high',
            message: '记录编号重复',
            details: { recordNo, existingRecordId: existing.id }
        };
    }

    return { hasConflict: false };
}

function validateRecordFields(record) {
    const errors = [];

    if (!record.record_no || record.record_no.trim() === '') {
        errors.push({ field: 'record_no', message: '记录编号不能为空' });
    }

    if (!record.inspection_date) {
        errors.push({ field: 'inspection_date', message: '巡检日期不能为空' });
    }

    if (!record.inspection_time) {
        errors.push({ field: 'inspection_time', message: '巡检时间不能为空' });
    }

    if (!record.plant_health_status) {
        errors.push({ field: 'plant_health_status', message: '绿植健康状态不能为空' });
    }

    if (record.plant_health_status === '异常' && !record.issue_type) {
        errors.push({ field: 'issue_type', message: '异常状态必须填写问题类型' });
    }

    if (errors.length > 0) {
        return {
            hasConflict: true,
            conflictType: CONFLICT_TYPES.FIELD_MISMATCH,
            severity: 'medium',
            message: '记录字段验证失败',
            details: { errors }
        };
    }

    return { hasConflict: false };
}

async function checkAllConflicts(record, isUpdate = false) {
    const conflicts = [];

    const fieldValidation = validateRecordFields(record);
    if (fieldValidation.hasConflict) {
        conflicts.push(fieldValidation);
    }

    const duplicateCheck = await checkDuplicateRecord(record.record_no, isUpdate ? record.id : null);
    if (duplicateCheck.hasConflict) {
        conflicts.push(duplicateCheck);
    }

    if (record.plant_id && record.issue_type && record.plant_health_status === '异常') {
        const recurrenceConflict = await checkRecurrenceConflict(
            record.plant_id,
            record.inspection_date,
            record.issue_type,
            record.issue_severity
        );
        if (recurrenceConflict.hasConflict) {
            conflicts.push(recurrenceConflict);
        }
    }

    return {
        hasConflicts: conflicts.length > 0,
        conflicts,
        shouldBlock: conflicts.some(c => c.severity === 'high')
    };
}

async function saveConflictHistory(recordId, operationType, conflicts, operator = 'system') {
    const conflictInfo = JSON.stringify(conflicts);
    await run(
        `INSERT INTO inspection_history (record_id, operation_type, operation_detail, operator, conflict_info)
         VALUES (?, ?, ?, ?, ?)`,
        [recordId, operationType, '冲突检测记录', operator, conflictInfo]
    );
}

module.exports = {
    CONFLICT_TYPES,
    checkRecurrenceConflict,
    checkBoardConsistency,
    checkDuplicateRecord,
    validateRecordFields,
    checkAllConflicts,
    saveConflictHistory
};
