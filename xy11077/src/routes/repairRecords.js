const express = require('express');
const router = express.Router();
const RepairRecord = require('../models/RepairRecord');
const MergeValidator = require('../utils/mergeValidator');
const { AppError } = require('../middleware/errorHandler');

router.get('/', (req, res, next) => {
  try {
    const { building, roomNumber, status, assignedTeam } = req.query;
    let records = RepairRecord.getAll();

    if (building) {
      records = records.filter(r => r.building === building);
    }
    if (roomNumber) {
      records = records.filter(r => r.roomNumber === roomNumber);
    }
    if (status) {
      records = records.filter(r => r.status === status);
    }
    if (assignedTeam) {
      records = records.filter(r => r.assignedTeam === assignedTeam);
    }

    res.json({
      status: 'success',
      count: records.length,
      data: records
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const record = RepairRecord.findById(req.params.id);
    if (!record) {
      throw new AppError(
        `维修记录 ${req.params.id} 不存在`,
        404,
        'RECORD_NOT_FOUND',
        { recordId: req.params.id }
      );
    }
    res.json({
      status: 'success',
      data: record
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', (req, res, next) => {
  try {
    const requiredFields = ['building', 'roomNumber', 'repairType', 'description', 'reporter', 'reporterPhone'];
    const missingFields = requiredFields.filter(field => !req.body[field]);

    if (missingFields.length > 0) {
      throw new AppError(
        '缺少必填字段',
        400,
        'MISSING_REQUIRED_FIELDS',
        { missingFields }
      );
    }

    const newRecord = RepairRecord.create({
      ...req.body,
      status: req.body.status || 'pending'
    });

    res.status(201).json({
      status: 'success',
      message: '维修记录创建成功',
      data: newRecord
    });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const { expectedVersion } = req.body;
    if (expectedVersion !== undefined) {
      MergeValidator.checkVersionConflict(req.params.id, expectedVersion);
    }

    const result = RepairRecord.update(req.params.id, req.body);
    if (!result) {
      throw new AppError(
        `维修记录 ${req.params.id} 不存在`,
        404,
        'RECORD_NOT_FOUND',
        { recordId: req.params.id }
      );
    }

    res.json({
      status: 'success',
      message: '维修记录更新成功',
      data: {
        oldRecord: result.oldRecord,
        newRecord: result.newRecord
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/merge', (req, res, next) => {
  try {
    const { recordIds, primaryRecordId, mergeOperator, mergeReason } = req.body;

    const validation = MergeValidator.validateForMerge(recordIds);

    let primaryRecord;
    if (primaryRecordId) {
      primaryRecord = validation.records.find(r => r.id === primaryRecordId);
      if (!primaryRecord) {
        throw new AppError(
          `指定的主记录 ${primaryRecordId} 不在合并列表中`,
          400,
          'INVALID_PRIMARY_RECORD',
          { primaryRecordId, availableRecords: recordIds }
        );
      }
    } else {
      primaryRecord = validation.primaryRecord;
    }

    const otherRecords = validation.records.filter(r => r.id !== primaryRecord.id);

    const mergedDescription = [
      primaryRecord.description,
      ...otherRecords.map(r => `[合并自${r.id}] ${r.description}`)
    ].join('\n\n');

    const mergedRepairTypes = [...new Set([
      primaryRecord.repairType,
      ...otherRecords.map(r => r.repairType)
    ])];

    const updatedRecord = RepairRecord.update(primaryRecord.id, {
      description: mergedDescription,
      repairType: mergedRepairTypes.join('+'),
      status: 'merged',
      mergedIds: otherRecords.map(r => r.id)
    });

    RepairRecord.addMergeHistory(primaryRecord.id, {
      mergedRecordIds: otherRecords.map(r => r.id),
      operator: mergeOperator,
      reason: mergeReason,
      originalData: otherRecords.map(r => ({
        id: r.id,
        repairType: r.repairType,
        description: r.description,
        reporter: r.reporter
      }))
    });

    otherRecords.forEach(r => {
      RepairRecord.update(r.id, {
        status: 'merged_into',
        mergedInto: primaryRecord.id
      });
    });

    res.json({
      status: 'success',
      message: '维修记录合并成功',
      data: {
        mergedRecord: updatedRecord.newRecord,
        mergedCount: otherRecords.length + 1,
        warnings: validation.warnings
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/review', (req, res, next) => {
  try {
    const { stage, operator, operatorRole, changes, comments, confirmationSignature } = req.body;

    if (!['temporary_change', 'manager_confirm', 'final_archive'].includes(stage)) {
      throw new AppError(
        '无效的复核阶段',
        400,
        'INVALID_REVIEW_STAGE',
        {
          provided: stage,
          validStages: ['temporary_change', 'manager_confirm', 'final_archive']
        }
      );
    }

    const record = RepairRecord.addReviewLog(req.params.id, {
      stage,
      operator,
      operatorRole,
      changes,
      comments,
      confirmationSignature
    });

    if (!record) {
      throw new AppError(
        `维修记录 ${req.params.id} 不存在`,
        404,
        'RECORD_NOT_FOUND',
        { recordId: req.params.id }
      );
    }

    const stageNames = {
      'temporary_change': '临时改动',
      'manager_confirm': '负责人确认',
      'final_archive': '最终归档'
    };

    res.json({
      status: 'success',
      message: `${stageNames[stage]}复核完成`,
      data: record
    });
  } catch (err) {
    next(err);
  }
});

router.get('/export/csv', (req, res, next) => {
  try {
    const records = RepairRecord.getAll();
    const headers = ['id', 'building', 'roomNumber', 'repairType', 'description', 'reporter', 'reporterPhone', 'assignedTeam', 'status', 'createdAt', 'version'];
    
    let csv = headers.join(',') + '\n';
    records.forEach(r => {
      const row = headers.map(h => {
        let val = r[h] || '';
        if (typeof val === 'string' && val.includes(',')) {
          val = `"${val.replace(/"/g, '""')}"`;
        }
        return val;
      });
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=repair-records.csv');
    res.send('\uFEFF' + csv);
  } catch (err) {
    next(err);
  }
});

router.post('/import', (req, res, next) => {
  try {
    const { records, dryRun = false, importOperator } = req.body;

    if (!records || !Array.isArray(records)) {
      throw new AppError(
        '导入数据格式错误，请提供记录数组',
        400,
        'INVALID_IMPORT_FORMAT'
      );
    }

    const results = {
      success: [],
      failed: [],
      warnings: []
    };

    records.forEach((record, index) => {
      try {
        const requiredFields = ['building', 'roomNumber', 'repairType', 'description', 'reporter'];
        const missingFields = requiredFields.filter(f => !record[f]);

        if (missingFields.length > 0) {
          throw new Error(`缺少必填字段: ${missingFields.join(', ')}`);
        }

        const existingRecords = RepairRecord.findByDormitory(record.building, record.roomNumber);
        if (existingRecords.length > 0) {
          results.warnings.push({
            row: index + 1,
            message: '该寝室已有报修记录，请确认是否重复',
            existingRecordIds: existingRecords.map(r => r.id)
          });
        }

        if (!dryRun) {
          const newRecord = RepairRecord.create({
            ...record,
            importOperator,
            importedAt: new Date().toISOString()
          });
          results.success.push({ row: index + 1, recordId: newRecord.id });
        } else {
          results.success.push({ row: index + 1, wouldCreate: true });
        }
      } catch (err) {
        results.failed.push({
          row: index + 1,
          recordData: record,
          error: err.message
        });
      }
    });

    res.json({
      status: 'success',
      message: dryRun ? '导入预览完成' : '导入完成',
      dryRun,
      summary: {
        total: records.length,
        success: results.success.length,
        failed: results.failed.length,
        warnings: results.warnings.length
      },
      data: results
    });
  } catch (err) {
    next(err);
  }
});

router.get('/report/weekly', (req, res, next) => {
  try {
    const { weekStart, weekEnd } = req.query;
    
    if (!weekStart || !weekEnd) {
      throw new AppError(
        '请提供周报统计的起止日期',
        400,
        'MISSING_DATE_RANGE',
        { required: ['weekStart', 'weekEnd'] }
      );
    }

    const records = RepairRecord.getWeeklyReport(weekStart, weekEnd);
    
    const stats = {
      totalRecords: records.length,
      byStatus: {},
      byBuilding: {},
      byTeam: {},
      byRepairType: {}
    };

    records.forEach(r => {
      stats.byStatus[r.status] = (stats.byStatus[r.status] || 0) + 1;
      stats.byBuilding[r.building] = (stats.byBuilding[r.building] || 0) + 1;
      stats.byTeam[r.assignedTeam || 'unassigned'] = (stats.byTeam[r.assignedTeam || 'unassigned'] || 0) + 1;
      stats.byRepairType[r.repairType] = (stats.byRepairType[r.repairType] || 0) + 1;
    });

    res.json({
      status: 'success',
      data: {
        weekStart,
        weekEnd,
        statistics: stats,
        records
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
