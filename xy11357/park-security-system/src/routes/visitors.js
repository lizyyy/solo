const express = require('express');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const multer = require('multer');
const { asyncHandler, ValidationError, NotFoundError, ConflictError } = require('../middleware/errorHandler');
const { createAuditLog, AuditAction, AuditModule, AuditStatus } = require('../utils/audit');
const { ImportErrorRecorder, getImportRecord, getImportErrors } = require('../utils/importError');
const {
  createVisitor,
  getVisitorByVisitorId,
  getVisitorById,
  getVisitors,
  updateVisitor,
  deleteVisitor,
  validateVisitorData
} = require('../models/visitor');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '../../uploads') });

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateVisitorData(req.body);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const existing = await getVisitorByVisitorId(req.body.visitor_id);
  if (existing) {
    throw new ConflictError('访客ID已存在');
  }

  const visitor = await createVisitor(req.body);

  await createAuditLog(AuditAction.CREATE, AuditModule.VISITOR, AuditStatus.SUCCESS, {
    operator: req.body.operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: visitor
  });

  res.json({
    success: true,
    data: visitor
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20, name, phone, visit_date, status } = req.query;

  const result = await getVisitors(
    { name, phone, visit_date, status },
    parseInt(page),
    parseInt(pageSize)
  );

  res.json({
    success: true,
    data: result.list,
    pagination: result.pagination
  });
}));

router.get('/:id', asyncHandler(async (req, res) => {
  const visitor = await getVisitorById(req.params.id);
  if (!visitor) {
    throw new NotFoundError('访客记录不存在');
  }

  res.json({
    success: true,
    data: visitor
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const visitor = await getVisitorById(req.params.id);
  if (!visitor) {
    throw new NotFoundError('访客记录不存在');
  }

  const errors = validateVisitorData(req.body, true);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const updated = await updateVisitor(req.params.id, req.body);

  await createAuditLog(AuditAction.UPDATE, AuditModule.VISITOR, AuditStatus.SUCCESS, {
    operator: req.body.operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: updated
  });

  res.json({
    success: true,
    data: updated
  });
}));

router.delete('/:id', asyncHandler(async (req, res) => {
  const visitor = await getVisitorById(req.params.id);
  if (!visitor) {
    throw new NotFoundError('访客记录不存在');
  }

  await deleteVisitor(req.params.id);

  await createAuditLog(AuditAction.DELETE, AuditModule.VISITOR, AuditStatus.SUCCESS, {
    operator: 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: { id: req.params.id }
  });

  res.json({
    success: true,
    message: '删除成功'
  });
}));

router.post('/import/csv', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('请上传CSV文件');
  }

  const errorRecorder = new ImportErrorRecorder('visitor', req.file.originalname, req.body.operator || 'system');
  const batchId = await errorRecorder.init();

  const results = [];
  const filePath = req.file.path;
  let rowNumber = 1;

  try {
    const rows = [];
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          rowNumber++;
          rows.push({ row, rowNumber });
        })
        .on('end', resolve)
        .on('error', reject);
    });

    for (const { row, rowNumber: rn } of rows) {
      const data = mapCsvRowToVisitor(row);
      const errors = validateVisitorData(data);

      if (errors.length > 0) {
        errorRecorder.addError(
          rn,
          row,
          errors.map(e => e.message).join('; '),
          generateSuggestion(errors, row)
        );
        continue;
      }

      try {
        const existing = await getVisitorByVisitorId(data.visitor_id);
        if (existing) {
          errorRecorder.addError(
            rn,
            row,
            '访客ID已存在',
            '请修改访客ID或使用更新接口'
          );
          continue;
        }

        const visitor = await createVisitor(data, batchId);
        results.push(visitor);
        errorRecorder.addSuccess();
      } catch (err) {
        errorRecorder.addError(
          rn,
          row,
          err.message,
          '请检查数据格式是否正确'
        );
      }
    }

    const summary = await errorRecorder.finish();

    await createAuditLog(AuditAction.IMPORT, AuditModule.VISITOR, summary.failCount > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS, {
      operator: req.body.operator || 'system',
      ipAddress: req.ip,
      requestId: req.requestId,
      requestData: { fileName: req.file.originalname },
      responseData: summary
    });

    res.json({
      success: true,
      data: {
        batchId,
        imported: results.length,
        failed: summary.failCount,
        total: summary.totalCount
      },
      message: summary.failCount > 0 ? '导入完成，部分数据失败' : '导入成功'
    });
  } finally {
    fs.unlink(filePath, () => {});
  }
}));

router.get('/import/:batchId', asyncHandler(async (req, res) => {
  const record = await getImportRecord(req.params.batchId);
  if (!record) {
    throw new NotFoundError('导入记录不存在');
  }

  const errors = await getImportErrors(req.params.batchId);

  res.json({
    success: true,
    data: {
      record,
      errors
    }
  });
}));

function mapCsvRowToVisitor(row) {
  return {
    visitor_id: row['访客ID'] || row['visitor_id'] || row['id'],
    name: row['姓名'] || row['name'],
    phone: row['手机号'] || row['phone'] || row['手机号码'],
    id_card: row['身份证号'] || row['id_card'] || row['身份证'],
    company: row['公司'] || row['company'] || row['单位'],
    visit_reason: row['来访事由'] || row['visit_reason'] || row['事由'],
    visit_date: row['来访日期'] || row['visit_date'] || row['日期'],
    visit_time_start: row['开始时间'] || row['visit_time_start'],
    visit_time_end: row['结束时间'] || row['visit_time_end'],
    license_plate: row['车牌号'] || row['license_plate'] || row['车牌'],
    host_name: row['被访人'] || row['host_name'] || row['接待人'],
    host_dept: row['被访部门'] || row['host_dept'] || row['部门'],
    status: row['状态'] || row['status']
  };
}

function generateSuggestion(errors, row) {
  const suggestions = [];

  for (const error of errors) {
    if (error.field === 'name') {
      suggestions.push('姓名字段不能为空，请检查CSV中"姓名"列是否有值');
    } else if (error.field === 'phone') {
      suggestions.push('手机号格式应为11位数字，例如：13800138000');
    } else if (error.field === 'visit_date') {
      suggestions.push('访问日期格式应为YYYY-MM-DD，例如：2024-01-15');
    } else if (error.field === 'id_card') {
      suggestions.push('身份证号格式应为15或18位');
    }
  }

  return suggestions.join('; ');
}

module.exports = router;
