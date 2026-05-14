import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import { runQuery, getQuery, allQuery } from '../database';
import { ApiResponse } from '../types';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { date, engineerName, riskType, isDirty, archived, page = 1, pageSize = 20 } = req.query;

    let sql = `SELECT * FROM duty_records WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM duty_records WHERE 1=1`;
    const params: any[] = [];

    if (date) {
      sql += ` AND date = ?`;
      countSql += ` AND date = ?`;
      params.push(date);
    }
    if (engineerName) {
      sql += ` AND engineer_name LIKE ?`;
      countSql += ` AND engineer_name LIKE ?`;
      params.push(`%${engineerName}%`);
    }
    if (riskType && riskType !== 'all') {
      sql += ` AND risk_type = ?`;
      countSql += ` AND risk_type = ?`;
      params.push(riskType);
    }
    if (isDirty !== undefined) {
      sql += ` AND is_dirty = ?`;
      countSql += ` AND is_dirty = ?`;
      params.push(isDirty === 'true' ? 1 : 0);
    }
    if (archived !== undefined) {
      sql += ` AND archived = ?`;
      countSql += ` AND archived = ?`;
      params.push(archived === 'true' ? 1 : 0);
    }

    sql += ` ORDER BY date DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)];

    const records = await allQuery(sql, queryParams);
    const countResult = await getQuery(countSql, params);

    res.json({
      success: true,
      data: {
        records: records.map((r: any) => ({
          id: r.id,
          date: r.date,
          engineerId: r.engineer_id,
          engineerName: r.engineer_name,
          shiftType: r.shift_type,
          status: r.status,
          riskType: r.risk_type,
          anomalyType: r.anomaly_type,
          anomalyDescription: r.anomaly_description,
          mergeError: r.merge_error === 1,
          mergedWith: r.merged_with,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          archived: r.archived === 1,
          archiveBatchId: r.archive_batch_id,
          isDirty: r.is_dirty === 1,
          remarks: r.remarks,
          manuallyReviewed: r.manually_reviewed === 1,
          reviewedBy: r.reviewed_by,
          reviewedAt: r.reviewed_at,
          manualReviewNote: r.manual_review_note,
        })),
        total: countResult.total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

const SYSTEM_JUDGMENT_FIELDS = ['riskType', 'anomalyType', 'isDirty', 'mergeError'];

router.post('/correct/:recordId', async (req, res) => {
  try {
    const { recordId } = req.params;
    const { operatorId, operatorName, remarks, corrections } = req.body;

    if (!operatorId || !operatorName) {
      return res.status(400).json({
        success: false,
        error: '缺少操作者信息',
      } as ApiResponse);
    }

    const record = await getQuery('SELECT * FROM duty_records WHERE id = ?', [recordId]);
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' } as ApiResponse);
    }

    if (corrections) {
      const attemptedSystemFields = SYSTEM_JUDGMENT_FIELDS.filter(
        field => corrections[field] !== undefined
      );
      if (attemptedSystemFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `不能直接修改系统判断字段: ${attemptedSystemFields.join(', ')}。如需标记人工复核状态，请使用 manualReviewNote 字段`,
        } as ApiResponse);
      }
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];
    const appliedCorrections: any = {};

    if (corrections) {
      if (corrections.status !== undefined) {
        updateFields.push('status = ?');
        updateValues.push(corrections.status);
        appliedCorrections.status = corrections.status;
      }
      if (corrections.manualReviewNote !== undefined) {
        updateFields.push('manual_review_note = ?');
        updateValues.push(corrections.manualReviewNote);
        appliedCorrections.manualReviewNote = corrections.manualReviewNote;
      }
    }

    const oldRemarks = record.remarks || '';
    const newRemarks = oldRemarks 
      ? `${oldRemarks}\n[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${operatorName}: ${remarks || '人工修正'}`
      : `[${moment().format('YYYY-MM-DD HH:mm:ss')}] ${operatorName}: ${remarks || '人工修正'}`;
    
    updateFields.push('remarks = ?');
    updateValues.push(newRemarks);
    updateFields.push('manually_reviewed = ?');
    updateValues.push(1);
    updateFields.push('reviewed_by = ?');
    updateValues.push(operatorName);
    updateFields.push('reviewed_at = ?');
    updateValues.push(moment().toISOString());
    updateFields.push('updated_at = ?');
    updateValues.push(moment().toISOString());

    if (updateFields.length > 0) {
      await runQuery(
        `UPDATE duty_records SET ${updateFields.join(', ')} WHERE id = ?`,
        [...updateValues, recordId]
      );
    }

    const systemJudgmentBackup = {
      originalRiskType: record.risk_type,
      originalAnomalyType: record.anomaly_type,
      originalIsDirty: record.is_dirty,
      originalMergeError: record.merge_error,
    };

    await runQuery(
      `INSERT INTO operation_logs (
        id, operation_type, operator_id, operator_name, record_id,
        old_value, new_value, remarks, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(), 'manual_correction', operatorId, operatorName, recordId,
        JSON.stringify({ ...record, ...systemJudgmentBackup }), 
        JSON.stringify({ ...record, ...appliedCorrections, remarks: newRemarks, manuallyReviewed: true }),
        remarks, moment().toISOString(),
      ]
    );

    const updatedRecord = await getQuery('SELECT * FROM duty_records WHERE id = ?', [recordId]);

    res.json({
      success: true,
      data: {
        id: updatedRecord.id,
        remarks: updatedRecord.remarks,
        manuallyReviewed: true,
        reviewedBy: operatorName,
        reviewedAt: moment().toISOString(),
        systemJudgmentPreserved: {
          riskType: record.risk_type,
          anomalyType: record.anomaly_type,
          isDirty: record.is_dirty === 1,
          mergeError: record.merge_error === 1,
        },
      },
      message: '人工修正已记录，系统判断字段已保留原值，仅添加复核标记',
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.get('/batches', async (req, res) => {
  try {
    const { batchNo, operatorId, status, page = 1, pageSize = 20 } = req.query;

    let sql = `SELECT * FROM archive_batches WHERE 1=1`;
    let countSql = `SELECT COUNT(*) as total FROM archive_batches WHERE 1=1`;
    const params: any[] = [];

    if (batchNo) {
      sql += ` AND batch_no LIKE ?`;
      countSql += ` AND batch_no LIKE ?`;
      params.push(`%${batchNo}%`);
    }
    if (operatorId) {
      sql += ` AND operator_id = ?`;
      countSql += ` AND operator_id = ?`;
      params.push(operatorId);
    }
    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      countSql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    const queryParams = [...params, Number(pageSize), (Number(page) - 1) * Number(pageSize)];

    const batches = await allQuery(sql, queryParams);
    const countResult = await getQuery(countSql, params);

    res.json({
      success: true,
      data: {
        batches: batches.map((b: any) => ({
          id: b.id,
          batchNo: b.batch_no,
          name: b.name,
          status: b.status,
          operatorId: b.operator_id,
          operatorName: b.operator_name,
          totalCount: b.total_count,
          successCount: b.success_count,
          failCount: b.fail_count,
          archivePath: b.archive_path,
          createdAt: b.created_at,
          executedAt: b.executed_at,
          completedAt: b.completed_at,
          requestId: b.request_id,
          remarks: b.remarks,
        })),
        total: countResult.total,
        page: Number(page),
        pageSize: Number(pageSize),
      },
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.get('/batches/:batchId/details', async (req, res) => {
  try {
    const { batchId } = req.params;

    const details = await allQuery(`
      SELECT d.*, r.date, r.engineer_name, r.risk_type, r.anomaly_type, r.is_dirty
      FROM archive_details d
      JOIN duty_records r ON d.record_id = r.id
      WHERE d.batch_id = ?
      ORDER BY d.created_at DESC
    `, [batchId]);

    res.json({
      success: true,
      data: details.map((d: any) => ({
        id: d.id,
        recordId: d.record_id,
        date: d.date,
        engineerName: d.engineer_name,
        riskType: d.risk_type,
        anomalyType: d.anomaly_type,
        isDirty: d.is_dirty === 1,
        status: d.status,
        errorMessage: d.error_message,
        createdAt: d.created_at,
      })),
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.get('/erase-requests', async (req, res) => {
  try {
    const { startTime, endTime, status, page = 1, pageSize = 20 } = req.query;

    let sql = `SELECT * FROM erase_requests WHERE 1=1`;
    const params: any[] = [];

    if (startTime) {
      sql += ` AND created_at >= ?`;
      params.push(startTime);
    }
    if (endTime) {
      sql += ` AND created_at <= ?`;
      params.push(endTime);
    }
    if (status && status !== 'all') {
      sql += ` AND status = ?`;
      params.push(status);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

    const requests = await allQuery(sql, params);

    res.json({
      success: true,
      data: requests.map((r: any) => ({
        id: r.id,
        requestNo: r.request_no,
        requesterId: r.requester_id,
        requesterName: r.requester_name,
        reason: r.reason,
        status: r.status,
        recordIds: JSON.parse(r.record_ids || '[]'),
        approvedBy: r.approved_by,
        approvedAt: r.approved_at,
        executedAt: r.executed_at,
        createdAt: r.created_at,
        remarks: r.remarks,
      })),
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

router.get('/audit/trace', async (req, res) => {
  try {
    const { executeTime } = req.query;

    if (!executeTime) {
      return res.status(400).json({
        success: false,
        error: '请提供执行时间',
      } as ApiResponse);
    }

    const timeBefore = moment(executeTime as string).subtract(1, 'hour').toISOString();
    const timeAfter = moment(executeTime as string).add(1, 'hour').toISOString();

    const eraseRequests = await allQuery(`
      SELECT * FROM erase_requests
      WHERE executed_at BETWEEN ? AND ?
      ORDER BY executed_at DESC
    `, [timeBefore, timeAfter]);

    const archiveBatches = await allQuery(`
      SELECT * FROM archive_batches
      WHERE completed_at BETWEEN ? AND ?
      ORDER BY completed_at DESC
    `, [timeBefore, timeAfter]);

    const operationLogs = await allQuery(`
      SELECT * FROM operation_logs
      WHERE created_at BETWEEN ? AND ?
      ORDER BY created_at DESC
    `, [timeBefore, timeAfter]);

    res.json({
      success: true,
      data: {
        executeTime,
        eraseRequests: eraseRequests.map((r: any) => ({
          id: r.id,
          requestNo: r.request_no,
          requesterName: r.requester_name,
          reason: r.reason,
          status: r.status,
          executedAt: r.executed_at,
          timeDiff: moment(r.executed_at).diff(moment(executeTime as string), 'minutes'),
        })),
        archiveBatches: archiveBatches.map((b: any) => ({
          id: b.id,
          batchNo: b.batch_no,
          operatorName: b.operator_name,
          status: b.status,
          totalCount: b.total_count,
          successCount: b.success_count,
          failCount: b.fail_count,
          completedAt: b.completed_at,
          timeDiff: moment(b.completed_at).diff(moment(executeTime as string), 'minutes'),
        })),
        operationLogs: operationLogs.map((l: any) => ({
          id: l.id,
          operationType: l.operation_type,
          operatorName: l.operator_name,
          batchId: l.batch_id,
          recordId: l.record_id,
          remarks: l.remarks,
          createdAt: l.created_at,
          timeDiff: moment(l.created_at).diff(moment(executeTime as string), 'minutes'),
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

router.get('/operation-logs', async (req, res) => {
  try {
    const { batchId, operationType, page = 1, pageSize = 20 } = req.query;

    let sql = `SELECT * FROM operation_logs WHERE 1=1`;
    const params: any[] = [];

    if (batchId) {
      sql += ` AND batch_id = ?`;
      params.push(batchId);
    }
    if (operationType) {
      sql += ` AND operation_type = ?`;
      params.push(operationType);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(Number(pageSize), (Number(page) - 1) * Number(pageSize));

    const logs = await allQuery(sql, params);

    res.json({
      success: true,
      data: logs.map((l: any) => ({
        id: l.id,
        batchId: l.batch_id,
        operationType: l.operation_type,
        operatorId: l.operator_id,
        operatorName: l.operator_name,
        recordId: l.record_id,
        remarks: l.remarks,
        createdAt: l.created_at,
      })),
    } as ApiResponse);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message,
    } as ApiResponse);
  }
});

export default router;