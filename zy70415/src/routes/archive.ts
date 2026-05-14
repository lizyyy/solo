import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import fs from 'fs';
import path from 'path';
import archiver from 'archiver';
import { createObjectCsvWriter } from 'csv-writer';
import { runQuery, getQuery, allQuery } from '../database';
import { ApiResponse } from '../types';

const router = express.Router();

const archivePath = process.env.ARCHIVE_PATH || './archives';
const exportPath = process.env.EXPORT_PATH || './exports';

if (!fs.existsSync(archivePath)) fs.mkdirSync(archivePath, { recursive: true });
if (!fs.existsSync(exportPath)) fs.mkdirSync(exportPath, { recursive: true });

const RETENTION_DAYS = 30;

router.post('/candidates', async (req, res) => {
  try {
    const { startDate, endDate, includeDirty, operatorId, operatorName, retentionDays } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        error: '缺少操作者信息',
      } as ApiResponse);
    }

    const effectiveRetentionDays = retentionDays || RETENTION_DAYS;
    const expirationDate = moment().subtract(effectiveRetentionDays, 'days').format('YYYY-MM-DD');

    let sql = `
      SELECT id, date, engineer_name, risk_type, anomaly_type, is_dirty, remarks
      FROM duty_records
      WHERE archived = 0 AND date <= ?
    `;
    const params: any[] = [expirationDate];

    if (startDate) {
      sql += ` AND date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      sql += ` AND date <= ?`;
      params.push(endDate);
    }
    if (!includeDirty) {
      sql += ` AND is_dirty = 0`;
    }

    sql += ` ORDER BY date DESC`;

    const candidates = await allQuery(sql, params);

    let allSql = `SELECT COUNT(*) as total FROM duty_records WHERE archived = 0`;
    const allCountResult = await getQuery(allSql, []);
    const excludedCount = allCountResult.total - candidates.length;

    const batchNo = `ARCH-${moment().format('YYYYMMDD')}-${String(Math.floor(Math.random() * 1000)).padStart(3, '0')}`;
    const batchId = uuidv4();

    await runQuery(
      `INSERT INTO archive_batches (
        id, batch_no, name, status, operator_id, operator_name,
        total_count, success_count, fail_count, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        batchId, batchNo, `${startDate || 'all'}_to_${endDate || 'all'}_archive`,
        'candidate', operatorId, operatorName, candidates.length, 0, 0,
        moment().toISOString(),
      ]
    );

    for (const candidate of candidates) {
      await runQuery(
        `INSERT INTO archive_details (id, batch_id, record_id, status, created_at)
         VALUES (?, ?, ?, ?, ?)`,
        [uuidv4(), batchId, candidate.id, 'pending', moment().toISOString()]
      );
    }

    await runQuery(
      `INSERT INTO operation_logs (id, batch_id, operation_type, operator_id, operator_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), batchId, 'generate_candidates', operatorId, operatorName, moment().toISOString()]
    );

    res.json({
      success: true,
      data: {
        batchId,
        batchNo,
        retentionDays: effectiveRetentionDays,
        expirationDate,
        totalCandidateCount: candidates.length,
        excludedDueToNotExpired: excludedCount,
        candidates: candidates.map((c: any) => ({
          recordId: c.id,
          date: c.date,
          engineerName: c.engineer_name,
          riskType: c.risk_type,
          anomalyType: c.anomaly_type,
          isDirty: c.is_dirty === 1,
          remarks: c.remarks,
        })),
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.post('/execute/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { operatorId, operatorName } = req.body;

    const batch = await getQuery('SELECT * FROM archive_batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' } as ApiResponse);
    }
    if (batch.status !== 'candidate') {
      return res.status(400).json({ success: false, error: '批次状态不正确' } as ApiResponse);
    }

    await runQuery(
      `UPDATE archive_batches SET status = 'executing', executed_at = ? WHERE id = ?`,
      [moment().toISOString(), batchId]
    );

    const details = await allQuery('SELECT * FROM archive_details WHERE batch_id = ?', [batchId]);

    let successCount = 0;
    let failCount = 0;

    const zipFileName = `${batch.batch_no}.zip`;
    const zipFilePath = path.join(archivePath, zipFileName);
    const output = fs.createWriteStream(zipFilePath);
    const archive = archiver('zip', { zlib: { level: 9 } });

    archive.pipe(output);

    for (const detail of details) {
      try {
        const record = await getQuery('SELECT * FROM duty_records WHERE id = ?', [detail.record_id]);
        if (!record) throw new Error('记录不存在');

        const recordJson = JSON.stringify({
          id: record.id,
          date: record.date,
          engineerName: record.engineer_name,
          shiftType: record.shift_type,
          status: record.status,
          riskType: record.risk_type,
          anomalyType: record.anomaly_type,
          anomalyDescription: record.anomaly_description,
          mergeError: record.merge_error,
          mergedWith: record.merged_with,
          isDirty: record.is_dirty,
          remarks: record.remarks,
          archivedAt: moment().toISOString(),
        }, null, 2);

        archive.append(recordJson, { name: `record_${record.id}.json` });

        await runQuery(
          `UPDATE duty_records SET archived = 1, archive_batch_id = ?, updated_at = ? WHERE id = ?`,
          [batchId, moment().toISOString(), detail.record_id]
        );

        await runQuery(
          `UPDATE archive_details SET status = 'success' WHERE id = ?`,
          [detail.id]
        );

        successCount++;
      } catch (err: any) {
        await runQuery(
          `UPDATE archive_details SET status = 'failed', error_message = ? WHERE id = ?`,
          [err.message, detail.id]
        );
        failCount++;
      }
    }

    await archive.finalize();

    const batchStatus = failCount === 0 ? 'success' : (successCount > 0 ? 'partial_success' : 'failed');

    await runQuery(
      `UPDATE archive_batches 
       SET status = ?, success_count = ?, fail_count = ?, archive_path = ?, completed_at = ?
       WHERE id = ?`,
      [batchStatus, successCount, failCount, zipFilePath, moment().toISOString(), batchId]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, batch_id, operation_type, operator_id, operator_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), batchId, 'execute_archive', operatorId, operatorName, moment().toISOString()]
    );

    res.json({
      success: true,
      data: {
        batchId,
        batchNo: batch.batch_no,
        status: batchStatus,
        totalCount: details.length,
        successCount,
        failCount,
        archivePath: zipFilePath,
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.post('/export/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { exportType, operatorId, operatorName } = req.body;

    const batch = await getQuery('SELECT * FROM archive_batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' } as ApiResponse);
    }

    const details = await allQuery(`
      SELECT d.*, r.date, r.engineer_name, r.risk_type, r.anomaly_type, r.is_dirty
      FROM archive_details d
      JOIN duty_records r ON d.record_id = r.id
      WHERE d.batch_id = ?
    `, [batchId]);

    const exportId = uuidv4();
    const fileName = `${batch.batch_no}_export_${moment().format('YYYYMMDDHHmmss')}.csv`;
    const filePath = path.join(exportPath, fileName);

    const csvWriter = createObjectCsvWriter({
      path: filePath,
      header: [
        { id: 'recordId', title: '记录ID' },
        { id: 'date', title: '日期' },
        { id: 'engineerName', title: '工程师' },
        { id: 'riskType', title: '风险类型' },
        { id: 'anomalyType', title: '异常类型' },
        { id: 'isDirty', title: '是否脏数据' },
        { id: 'status', title: '归档状态' },
        { id: 'errorMessage', title: '错误信息' },
      ],
    });

    await csvWriter.writeRecords(details.map((d: any) => ({
      recordId: d.record_id,
      date: d.date,
      engineerName: d.engineer_name,
      riskType: d.risk_type,
      anomalyType: d.anomaly_type,
      isDirty: d.is_dirty === 1 ? '是' : '否',
      status: d.status,
      errorMessage: d.error_message || '',
    })));

    await runQuery(
      `INSERT INTO export_records (
        id, batch_id, export_type, file_path, file_name,
        operator_id, operator_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [exportId, batchId, exportType || 'csv', filePath, fileName, operatorId, operatorName, moment().toISOString()]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, batch_id, operation_type, operator_id, operator_name, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [uuidv4(), batchId, 'export', operatorId, operatorName, moment().toISOString()]
    );

    res.json({
      success: true,
      data: {
        exportId,
        fileName,
        filePath,
        recordCount: details.length,
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.post('/rollback-candidates/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { operatorId, operatorName, recordIds } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        error: '缺少操作者信息',
      } as ApiResponse);
    }

    const batch = await getQuery('SELECT * FROM archive_batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' } as ApiResponse);
    }

    let details;
    if (recordIds && recordIds.length > 0) {
      const placeholders = recordIds.map(() => '?').join(',');
      details = await allQuery(
        `SELECT d.*, r.date, r.engineer_name, r.risk_type, r.anomaly_type, r.is_dirty 
         FROM archive_details d
         JOIN duty_records r ON d.record_id = r.id
         WHERE d.batch_id = ? AND d.record_id IN (${placeholders})`,
        [batchId, ...recordIds]
      );
    } else {
      details = await allQuery(`
        SELECT d.*, r.date, r.engineer_name, r.risk_type, r.anomaly_type, r.is_dirty 
        FROM archive_details d
        JOIN duty_records r ON d.record_id = r.id
        WHERE d.batch_id = ?`,
        [batchId]
      );
    }

    if (details.length === 0) {
      return res.status(400).json({ success: false, error: '没有可回滚的记录' } as ApiResponse);
    }

    const rollbackCandidateId = uuidv4();
    
    await runQuery(
      `INSERT INTO operation_logs (id, batch_id, operation_type, operator_id, operator_name, remarks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [rollbackCandidateId, batchId, 'rollback_candidate', operatorId, operatorName, 
       JSON.stringify({ recordIds: details.map((d: any) => d.record_id), status: 'pending' }), 
       moment().toISOString()]
    );

    res.json({
      success: true,
      data: {
        rollbackCandidateId,
        batchId,
        batchNo: batch.batch_no,
        totalCandidates: details.length,
        candidates: details.map((d: any) => ({
          detailId: d.id,
          recordId: d.record_id,
          date: d.date,
          engineerName: d.engineer_name,
          riskType: d.risk_type,
          anomalyType: d.anomaly_type,
          isDirty: d.is_dirty === 1,
          archiveStatus: d.status,
        })),
        warning: '请确认以上回滚清单无误后，调用 /rollback-execute 接口并传入 rollbackCandidateId 执行回滚',
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.post('/rollback-execute/:batchId', async (req, res) => {
  try {
    const { batchId } = req.params;
    const { operatorId, operatorName, rollbackCandidateId } = req.body;

    if (!rollbackCandidateId) {
      return res.status(400).json({
        success: false,
        error: '必须先调用 /rollback-candidates 生成回滚候选清单，并传入 rollbackCandidateId',
      } as ApiResponse);
    }

    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        error: '缺少操作者信息',
      } as ApiResponse);
    }

    const candidateLog = await getQuery(
      `SELECT * FROM operation_logs WHERE id = ? AND batch_id = ? AND operation_type = ?`,
      [rollbackCandidateId, batchId, 'rollback_candidate']
    );

    if (!candidateLog) {
      return res.status(400).json({ success: false, error: '回滚候选清单不存在或已过期' } as ApiResponse);
    }

    const candidateData = JSON.parse(candidateLog.remarks || '{}');
    if (candidateData.status === 'executed') {
      return res.status(400).json({ success: false, error: '该回滚候选清单已执行过' } as ApiResponse);
    }

    const recordIds = candidateData.recordIds || [];
    if (recordIds.length === 0) {
      return res.status(400).json({ success: false, error: '回滚候选清单为空' } as ApiResponse);
    }

    const batch = await getQuery('SELECT * FROM archive_batches WHERE id = ?', [batchId]);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' } as ApiResponse);
    }

    const placeholders = recordIds.map(() => '?').join(',');
    const details = await allQuery(
      `SELECT * FROM archive_details WHERE batch_id = ? AND record_id IN (${placeholders})`,
      [batchId, ...recordIds]
    );

    let successCount = 0;
    let failCount = 0;

    for (const detail of details) {
      try {
        await runQuery(
          `UPDATE duty_records SET archived = 0, archive_batch_id = NULL, updated_at = ? WHERE id = ?`,
          [moment().toISOString(), detail.record_id]
        );
        await runQuery(`DELETE FROM archive_details WHERE id = ?`, [detail.id]);
        successCount++;
      } catch (err: any) {
        failCount++;
      }
    }

    await runQuery(
      `UPDATE operation_logs SET remarks = ? WHERE id = ?`,
      [JSON.stringify({ ...candidateData, status: 'executed' }), rollbackCandidateId]
    );

    await runQuery(
      `INSERT INTO operation_logs (id, batch_id, operation_type, operator_id, operator_name, remarks, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [uuidv4(), batchId, 'rollback_executed', operatorId, operatorName,
       JSON.stringify({ rollbackCandidateId, successCount, failCount }),
       moment().toISOString()]
    );

    res.json({
      success: true,
      data: {
        batchId,
        rollbackCandidateId,
        totalRollback: details.length,
        successCount,
        failCount,
        message: '回滚已执行，所有操作均已留痕',
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

export default router;