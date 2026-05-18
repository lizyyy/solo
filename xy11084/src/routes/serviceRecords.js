const express = require('express');
const router = express.Router();
const storage = require('../utils/storage');
const ServiceRecord = require('../models/ServiceRecord');
const ConflictDetector = require('../models/ConflictDetector');
const { BusinessError, ValidationError, NotFoundError } = require('../middleware/errorHandler');

function generateId() {
  return 'R' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

router.get('/', (req, res, next) => {
  try {
    const records = storage.getRecords();
    const { volunteerId, serviceDate, publicityStatus } = req.query;
    let filtered = records;

    if (volunteerId) {
      filtered = filtered.filter(r => r.volunteerId === volunteerId);
    }
    if (serviceDate) {
      filtered = filtered.filter(r => r.serviceDate === serviceDate);
    }
    if (publicityStatus) {
      filtered = filtered.filter(r => r.publicityStatus === publicityStatus);
    }

    res.json({
      success: true,
      data: filtered,
      total: filtered.length
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', (req, res, next) => {
  try {
    const record = storage.getRecordById(req.params.id);
    if (!record) {
      throw new NotFoundError('服务记录', req.params.id);
    }
    res.json({
      success: true,
      data: record
    });
  } catch (error) {
    next(error);
  }
});

router.post('/', (req, res, next) => {
  try {
    const data = {
      id: generateId(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const record = new ServiceRecord(data);
    const validationErrors = record.validate();

    if (validationErrors.length > 0) {
      throw new ValidationError('服务记录数据验证失败', validationErrors);
    }

    const existingRecords = storage.getRecords();
    const conflicts = ConflictDetector.detectAllConflicts(record, existingRecords);

    if (conflicts.length > 0) {
      const criticalConflict = conflicts.find(c => c.severity === 'critical');
      if (criticalConflict) {
        throw new BusinessError(
          criticalConflict.type,
          criticalConflict.message,
          criticalConflict.detail,
          criticalConflict.suggestion,
          criticalConflict.severity
        );
      }

      return res.status(409).json({
        success: false,
        warning: true,
        message: '检测到业务争议点',
        conflicts: conflicts,
        data: record
      });
    }

    const saved = storage.addRecord(record);
    res.status(201).json({
      success: true,
      message: '服务记录创建成功',
      data: saved
    });
  } catch (error) {
    next(error);
  }
});

router.put('/:id', (req, res, next) => {
  try {
    const existing = storage.getRecordById(req.params.id);
    if (!existing) {
      throw new NotFoundError('服务记录', req.params.id);
    }

    const data = {
      ...existing,
      ...req.body,
      id: req.params.id,
      updatedAt: new Date().toISOString()
    };

    const record = new ServiceRecord(data);
    const validationErrors = record.validate();

    if (validationErrors.length > 0) {
      throw new ValidationError('服务记录数据验证失败', validationErrors);
    }

    const existingRecords = storage.getRecords();
    const conflicts = ConflictDetector.detectAllConflicts(record, existingRecords);

    if (conflicts.length > 0) {
      const criticalConflict = conflicts.find(c => c.severity === 'critical');
      if (criticalConflict) {
        throw new BusinessError(
          criticalConflict.type,
          criticalConflict.message,
          criticalConflict.detail,
          criticalConflict.suggestion,
          criticalConflict.severity
        );
      }

      return res.status(409).json({
        success: false,
        warning: true,
        message: '检测到业务争议点',
        conflicts: conflicts,
        data: record
      });
    }

    const updated = storage.updateRecord(req.params.id, data);
    res.json({
      success: true,
      message: '服务记录更新成功',
      data: updated
    });
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', (req, res, next) => {
  try {
    const existing = storage.getRecordById(req.params.id);
    if (!existing) {
      throw new NotFoundError('服务记录', req.params.id);
    }

    if (existing.publicityStatus === 'publicized') {
      throw new BusinessError(
        'PUBLICIZED_RECORD_DELETE_ATTEMPT',
        `业务争议：尝试删除已公示的服务记录[${existing.id}]`,
        {
          recordId: existing.id,
          volunteerName: existing.volunteerName,
          serviceDate: existing.serviceDate,
          publicityStatus: existing.publicityStatus
        },
        '已公示的记录禁止删除。如需作废，应创建作废记录并关联原记录，保留完整审计轨迹。',
        'critical'
      );
    }

    storage.deleteRecord(req.params.id);
    res.json({
      success: true,
      message: '服务记录删除成功'
    });
  } catch (error) {
    next(error);
  }
});

router.post('/import', (req, res, next) => {
  try {
    const { records, createdBy } = req.body;
    
    if (!Array.isArray(records)) {
      throw new ValidationError('导入数据格式错误', ['records必须为数组格式']);
    }

    const results = {
      success: [],
      failed: [],
      conflicts: []
    };

    const existingRecords = storage.getRecords();

    for (let i = 0; i < records.length; i++) {
      const row = records[i];
      const rowNumber = i + 1;

      try {
        const data = {
          id: generateId(),
          ...row,
          createdBy: createdBy || 'batch_import',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const record = new ServiceRecord(data);
        const validationErrors = record.validate();

        if (validationErrors.length > 0) {
          results.failed.push({
            row: rowNumber,
            data: row,
            errors: validationErrors,
            reason: '数据验证失败'
          });
          continue;
        }

        const conflicts = ConflictDetector.detectAllConflicts(record, [...existingRecords, ...results.success.map(r => r.data)]);

        if (conflicts.length > 0) {
          results.conflicts.push({
            row: rowNumber,
            data: record,
            conflicts: conflicts,
            reason: '检测到业务争议'
          });
          continue;
        }

        const saved = storage.addRecord(record);
        results.success.push({
          row: rowNumber,
          data: saved
        });
      } catch (rowError) {
        results.failed.push({
          row: rowNumber,
          data: row,
          reason: rowError.message
        });
      }
    }

    res.json({
      success: true,
      message: `批量导入完成：成功${results.success.length}条，失败${results.failed.length}条，争议${results.conflicts.length}条`,
      summary: {
        total: records.length,
        success: results.success.length,
        failed: results.failed.length,
        conflicts: results.conflicts.length
      },
      details: results
    });
  } catch (error) {
    next(error);
  }
});

router.get('/export/data', (req, res, next) => {
  try {
    const records = storage.getRecords();
    const { format = 'json' } = req.query;

    if (format === 'csv') {
      const headers = ['ID', '志愿者ID', '志愿者姓名', '服务日期', '服务项目', '服务地点', '开始时间', '结束时间', '服务时长', '签到方式', '签到状态', '证明人', '证据编号', '公示状态', '公示日期', '是否迟到补签', '是否代签', '代签人', '备注'];
      const csvContent = [
        headers.join(','),
        ...records.map(r => [
          r.id, r.volunteerId, r.volunteerName, r.serviceDate, r.serviceProject,
          r.serviceLocation || '', r.startTime || '', r.endTime || '', r.serviceHours,
          r.checkInMethod || '', r.checkInStatus || '', r.witness || '', r.evidenceId || '',
          r.publicityStatus, r.publicityDate || '', r.isLateMakeup ? '是' : '否',
          r.isProxySign ? '是' : '否', r.proxySigner || '', (r.remarks || '').replace(/,/g, '，')
        ].join(','))
      ].join('\n');

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=service-records.csv');
      res.send('\uFEFF' + csvContent);
    } else {
      res.json({
        success: true,
        data: records,
        exportTime: new Date().toISOString(),
        total: records.length
      });
    }
  } catch (error) {
    next(error);
  }
});

router.get('/statistics/summary', (req, res, next) => {
  try {
    const records = storage.getRecords();
    const volunteers = storage.getVolunteers();

    const totalHours = records.reduce((sum, r) => sum + (r.serviceHours || 0), 0);
    const publicizedCount = records.filter(r => r.publicityStatus === 'publicized').length;
    const pendingCount = records.filter(r => r.publicityStatus === 'pending').length;
    const proxySignCount = records.filter(r => r.isProxySign).length;
    const lateMakeupCount = records.filter(r => r.isLateMakeup).length;

    res.json({
      success: true,
      data: {
        totalVolunteers: volunteers.length,
        totalRecords: records.length,
        totalServiceHours: Math.round(totalHours * 100) / 100,
        publicizedRecords: publicizedCount,
        pendingRecords: pendingCount,
        proxySignRecords: proxySignCount,
        lateMakeupRecords: lateMakeupCount
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;