const { get, all, run, beginTransaction, commit, rollback } = require('../database/db');
const { checkAllConflicts, saveConflictHistory, checkBoardConsistency } = require('./conflictService');
const createCsvWriter = require('csv-writer').createObjectCsvWriter;
const path = require('path');
const fs = require('fs');

async function getInspectionList(params = {}) {
    let sql = `
        SELECT 
            ir.id,
            ir.record_no,
            mt.team_code,
            mt.team_name,
            gp.plant_code,
            gp.plant_name,
            ir.inspector_name,
            ir.inspection_date,
            ir.inspection_time,
            ir.weather_condition,
            ir.temperature,
            ir.plant_health_status,
            ir.issue_type,
            ir.issue_severity,
            ir.recurrence_count,
            ir.upgrade_flag,
            ir.record_status,
            ir.board_sync_status,
            ir.created_at
        FROM inspection_records ir
        LEFT JOIN maintenance_teams mt ON ir.team_id = mt.id
        LEFT JOIN green_plants gp ON ir.plant_id = gp.id
        WHERE 1=1
    `;

    const paramsArray = [];

    if (params.team_code) {
        sql += ' AND mt.team_code = ?';
        paramsArray.push(params.team_code);
    }

    if (params.plant_code) {
        sql += ' AND gp.plant_code = ?';
        paramsArray.push(params.plant_code);
    }

    if (params.start_date) {
        sql += ' AND ir.inspection_date >= ?';
        paramsArray.push(params.start_date);
    }

    if (params.end_date) {
        sql += ' AND ir.inspection_date <= ?';
        paramsArray.push(params.end_date);
    }

    if (params.record_status) {
        sql += ' AND ir.record_status = ?';
        paramsArray.push(params.record_status);
    }

    if (params.has_conflicts) {
        sql += ' AND ir.recurrence_count >= 2 AND ir.upgrade_flag = 0';
    }

    sql += ' ORDER BY ir.inspection_date DESC, ir.created_at DESC';

    if (params.limit) {
        sql += ' LIMIT ?';
        paramsArray.push(parseInt(params.limit));
    }

    const records = await all(sql, paramsArray);
    
    for (const record of records) {
        const boardCheck = await checkBoardConsistency(record.id);
        record.board_inconsistent = boardCheck.hasConflict;
        record.conflicts = boardCheck.hasConflict ? boardCheck : null;
    }

    return records;
}

async function getInspectionDetail(id) {
    const record = await get(`
        SELECT 
            ir.*,
            mt.team_code,
            mt.team_name,
            gp.plant_code,
            gp.plant_name,
            gp.plant_type,
            gp.location_area,
            gp.location_detail
        FROM inspection_records ir
        LEFT JOIN maintenance_teams mt ON ir.team_id = mt.id
        LEFT JOIN green_plants gp ON ir.plant_id = gp.id
        WHERE ir.id = ?
    `, [id]);

    if (!record) {
        return null;
    }

    const boardCheck = await checkBoardConsistency(id);
    record.board_inconsistent = boardCheck.hasConflict;
    record.consistency_issues = boardCheck.hasConflict ? boardCheck.details : null;

    return record;
}

async function getInspectionHistory(recordId) {
    return await all(`
        SELECT * FROM inspection_history 
        WHERE record_id = ? 
        ORDER BY created_at DESC
    `, [recordId]);
}

async function createInspection(record, operator = 'system') {
    const team = await get('SELECT id FROM maintenance_teams WHERE team_code = ?', [record.team_code]);
    if (!team) {
        throw new Error(`养护队编码不存在: ${record.team_code}`);
    }

    const plant = await get('SELECT id FROM green_plants WHERE plant_code = ?', [record.plant_code]);
    if (!plant) {
        throw new Error(`绿植编码不存在: ${record.plant_code}`);
    }

    record.team_id = team.id;
    record.plant_id = plant.id;

    const conflictResult = await checkAllConflicts(record, false);

    try {
        await beginTransaction();

        const result = await run(
            `INSERT INTO inspection_records 
            (record_no, team_id, plant_id, inspector_name, inspection_date, inspection_time, 
             weather_condition, temperature, plant_health_status, issue_type, issue_description, 
             issue_severity, recurrence_count, upgrade_flag, last_recurrence_date, treatment_measure, 
             treatment_person, follow_up_date, record_status, board_sync_status, data_source, import_batch_no, version)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                record.record_no, record.team_id, record.plant_id, record.inspector_name, record.inspection_date, record.inspection_time,
                record.weather_condition || null, record.temperature || null, record.plant_health_status, record.issue_type || null, record.issue_description || null,
                record.issue_severity || '一般', record.recurrence_count || 0, record.upgrade_flag || false, record.last_recurrence_date || null, record.treatment_measure || null,
                record.treatment_person || null, record.follow_up_date || null, record.record_status || '待处理', record.board_sync_status || '未同步', record.data_source || 'API',
                record.import_batch_no || null, 1
            ]
        );

        const recordId = result.lastID;

        await run(
            `INSERT INTO inspection_history (record_id, operation_type, operation_detail, operator, new_values)
             VALUES (?, ?, ?, ?, ?)`,
            [recordId, 'CREATE', '创建巡检记录', operator, JSON.stringify(record)]
        );

        if (conflictResult.hasConflicts) {
            await saveConflictHistory(recordId, 'CONFLICT_DETECTED', conflictResult.conflicts, operator);
        }

        await commit();

        return {
            id: recordId,
            hasConflicts: conflictResult.hasConflicts,
            conflicts: conflictResult.conflicts,
            shouldBlock: conflictResult.shouldBlock,
            record: await getInspectionDetail(recordId)
        };
    } catch (error) {
        await rollback();
        throw error;
    }
}

async function updateInspection(id, updateData, operator = 'system') {
    const existing = await get('SELECT * FROM inspection_records WHERE id = ?', [id]);
    if (!existing) {
        throw new Error('记录不存在');
    }

    if (updateData.team_code) {
        const team = await get('SELECT id FROM maintenance_teams WHERE team_code = ?', [updateData.team_code]);
        if (team) {
            updateData.team_id = team.id;
        }
    }

    if (updateData.plant_code) {
        const plant = await get('SELECT id FROM green_plants WHERE plant_code = ?', [updateData.plant_code]);
        if (plant) {
            updateData.plant_id = plant.id;
        }
    }

    const recordForCheck = { ...existing, ...updateData, id };
    const conflictResult = await checkAllConflicts(recordForCheck, true);

    if (conflictResult.shouldBlock && !updateData.force_update) {
        return {
            success: false,
            blocked: true,
            hasConflicts: true,
            conflicts: conflictResult.conflicts,
            message: '存在严重冲突，禁止静默覆盖。如需强制更新请设置force_update=true'
        };
    }

    try {
        await beginTransaction();

        const updateFields = [];
        const updateValues = [];

        const allowedFields = [
            'inspector_name', 'inspection_date', 'inspection_time', 'weather_condition',
            'temperature', 'plant_health_status', 'issue_type', 'issue_description',
            'issue_severity', 'recurrence_count', 'upgrade_flag', 'last_recurrence_date',
            'treatment_measure', 'treatment_person', 'follow_up_date', 'record_status',
            'board_sync_status', 'team_id', 'plant_id'
        ];

        for (const field of allowedFields) {
            if (updateData[field] !== undefined) {
                updateFields.push(`${field} = ?`);
                updateValues.push(updateData[field]);
            }
        }

        updateFields.push('version = version + 1');
        updateFields.push('updated_at = CURRENT_TIMESTAMP');

        if (updateFields.length > 0) {
            updateValues.push(id);
            await run(
                `UPDATE inspection_records SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );
        }

        await run(
            `INSERT INTO inspection_history (record_id, operation_type, operation_detail, operator, old_values, new_values, conflict_info)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                id, 
                updateData.force_update ? 'FORCE_UPDATE' : 'UPDATE',
                '更新巡检记录',
                operator,
                JSON.stringify(existing),
                JSON.stringify(updateData),
                conflictResult.hasConflicts ? JSON.stringify(conflictResult.conflicts) : null
            ]
        );

        await commit();

        return {
            success: true,
            id,
            hasConflicts: conflictResult.hasConflicts,
            conflicts: conflictResult.conflicts,
            record: await getInspectionDetail(id)
        };
    } catch (error) {
        await rollback();
        throw error;
    }
}

async function exportReport(params = {}) {
    const records = await getInspectionList(params);

    const exportDir = path.join(__dirname, '../../exports');
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    const fileName = `inspection_report_${Date.now()}.csv`;
    const filePath = path.join(exportDir, fileName);

    const csvWriter = createCsvWriter({
        path: filePath,
        header: [
            { id: 'record_no', title: '记录编号' },
            { id: 'team_code', title: '养护队编号' },
            { id: 'team_name', title: '养护队名称' },
            { id: 'plant_code', title: '绿植编号' },
            { id: 'plant_name', title: '绿植名称' },
            { id: 'inspector_name', title: '巡检人员' },
            { id: 'inspection_date', title: '巡检日期' },
            { id: 'inspection_time', title: '巡检时间' },
            { id: 'weather_condition', title: '天气' },
            { id: 'temperature', title: '温度' },
            { id: 'plant_health_status', title: '健康状态' },
            { id: 'issue_type', title: '问题类型' },
            { id: 'issue_severity', title: '严重程度' },
            { id: 'recurrence_count', title: '复发次数' },
            { id: 'upgrade_flag', title: '是否升级' },
            { id: 'record_status', title: '记录状态' },
            { id: 'board_sync_status', title: '看板同步状态' },
            { id: 'has_conflict', title: '是否有冲突' },
            { id: 'conflict_desc', title: '冲突描述' }
        ]
    });

    const csvData = records.map(r => ({
        ...r,
        upgrade_flag: r.upgrade_flag ? '是' : '否',
        has_conflict: r.board_inconsistent ? '是' : '否',
        conflict_desc: r.conflicts ? r.conflicts.message : ''
    }));

    await csvWriter.writeRecords(csvData);

    return {
        filePath,
        fileName,
        recordCount: records.length,
        records: csvData
    };
}

module.exports = {
    getInspectionList,
    getInspectionDetail,
    getInspectionHistory,
    createInspection,
    updateInspection,
    exportReport
};
