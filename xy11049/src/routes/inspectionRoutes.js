const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');

const {
    getInspectionList,
    getInspectionDetail,
    getInspectionHistory,
    createInspection,
    updateInspection,
    exportReport
} = require('../services/inspectionService');

const { run, get, beginTransaction, commit, rollback } = require('../database/db');
const { checkAllConflicts } = require('../services/conflictService');

const upload = multer({ dest: path.join(__dirname, '../../uploads/') });

router.get('/', async (req, res) => {
    try {
        const records = await getInspectionList(req.query);
        res.json({
            success: true,
            data: records,
            total: records.length
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const record = await getInspectionDetail(req.params.id);
        if (!record) {
            return res.status(404).json({
                success: false,
                error: '记录不存在'
            });
        }
        res.json({
            success: true,
            data: record
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/:id/history', async (req, res) => {
    try {
        const history = await getInspectionHistory(req.params.id);
        res.json({
            success: true,
            data: history
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const result = await createInspection(req.body, req.body.operator || 'api_user');
        
        if (result.shouldBlock) {
            return res.status(409).json({
                success: false,
                hasConflicts: true,
                conflicts: result.conflicts,
                message: '存在严重冲突，请处理后再提交',
                data: result.record
            });
        }

        const statusCode = result.hasConflicts ? 201 : 200;
        res.status(statusCode).json({
            success: true,
            hasConflicts: result.hasConflicts,
            conflicts: result.conflicts,
            data: result.record
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const result = await updateInspection(
            req.params.id, 
            req.body, 
            req.body.operator || 'api_user'
        );

        if (result.blocked) {
            return res.status(409).json(result);
        }

        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.get('/export/report', async (req, res) => {
    try {
        const result = await exportReport(req.query);
        res.json({
            success: true,
            fileName: result.fileName,
            recordCount: result.recordCount,
            data: result.records
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

router.post('/import/csv', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).json({
            success: false,
            error: '未上传文件'
        });
    }

    const batchNo = `BATCH-${Date.now()}`;
    const results = {
        success: [],
        conflicts: [],
        errors: []
    };
    let rowNumber = 0;

    try {
        await run(
            `INSERT INTO import_batches (batch_no, file_name, total_rows, success_rows, conflict_rows, error_rows, import_status, imported_by)
             VALUES (?, ?, ?, 0, 0, 0, 'processing', ?)`,
            [batchNo, req.file.originalname, 0, req.body.operator || 'api_user']
        );

        const records = [];
        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    records.push(row);
                })
                .on('end', resolve)
                .on('error', reject);
        });

        await run('UPDATE import_batches SET total_rows = ? WHERE batch_no = ?', [records.length, batchNo]);

        for (const row of records) {
            rowNumber++;
            
            try {
                const record = {
                    record_no: row['记录编号'] || row['record_no'],
                    team_code: row['养护队编号'] || row['team_code'],
                    plant_code: row['绿植编号'] || row['plant_code'],
                    inspector_name: row['巡检人员'] || row['inspector_name'],
                    inspection_date: row['巡检日期'] || row['inspection_date'],
                    inspection_time: row['巡检时间'] || row['inspection_time'],
                    weather_condition: row['天气'] || row['weather_condition'],
                    temperature: parseFloat(row['温度'] || row['temperature']) || null,
                    plant_health_status: row['健康状态'] || row['plant_health_status'],
                    issue_type: row['问题类型'] || row['issue_type'] || null,
                    issue_description: row['问题描述'] || row['issue_description'] || null,
                    issue_severity: row['严重程度'] || row['issue_severity'] || '一般',
                    recurrence_count: parseInt(row['复发次数'] || row['recurrence_count']) || 0,
                    upgrade_flag: (row['是否升级'] || row['upgrade_flag']) === '是' ? true : false,
                    treatment_measure: row['处理措施'] || row['treatment_measure'] || null,
                    treatment_person: row['处理人'] || row['treatment_person'] || null,
                    follow_up_date: row['跟进日期'] || row['follow_up_date'] || null,
                    record_status: row['记录状态'] || row['record_status'] || '待处理',
                    import_batch_no: batchNo,
                    data_source: 'CSV_IMPORT'
                };

                const team = await get('SELECT id FROM maintenance_teams WHERE team_code = ?', [record.team_code]);
                const plant = await get('SELECT id FROM green_plants WHERE plant_code = ?', [record.plant_code]);

                if (!team || !plant) {
                    throw new Error(`养护队或绿植不存在: team=${record.team_code}, plant=${record.plant_code}`);
                }

                record.team_id = team.id;
                record.plant_id = plant.id;

                const conflictResult = await checkAllConflicts(record, false);

                if (conflictResult.hasConflicts) {
                    results.conflicts.push({
                        rowNumber,
                        record_no: record.record_no,
                        conflicts: conflictResult.conflicts,
                        data: record
                    });

                    await run(
                        `INSERT INTO import_error_logs (batch_no, row_number, row_data, error_type, error_message)
                         VALUES (?, ?, ?, ?, ?)`,
                        [batchNo, rowNumber, JSON.stringify(record), 'CONFLICT', JSON.stringify(conflictResult.conflicts)]
                    );
                } else {
                    await createInspection(record, 'csv_import');
                    results.success.push({
                        rowNumber,
                        record_no: record.record_no
                    });
                }
            } catch (rowError) {
                results.errors.push({
                    rowNumber,
                    error: rowError.message,
                    data: row
                });

                await run(
                    `INSERT INTO import_error_logs (batch_no, row_number, row_data, error_type, error_message)
                     VALUES (?, ?, ?, ?, ?)`,
                    [batchNo, rowNumber, JSON.stringify(row), 'ERROR', rowError.message]
                );
            }
        }

        await run(
            `UPDATE import_batches 
             SET success_rows = ?, conflict_rows = ?, error_rows = ?, import_status = 'completed', completed_at = CURRENT_TIMESTAMP 
             WHERE batch_no = ?`,
            [results.success.length, results.conflicts.length, results.errors.length, batchNo]
        );

        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            batchNo,
            total: records.length,
            successCount: results.success.length,
            conflictCount: results.conflicts.length,
            errorCount: results.errors.length,
            results: {
                success: results.success,
                conflicts: results.conflicts,
                errors: results.errors
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            batchNo,
            error: error.message,
            results
        });
    }
});

module.exports = router;
