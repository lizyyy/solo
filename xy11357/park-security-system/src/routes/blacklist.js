const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { asyncHandler, ValidationError, NotFoundError, ConflictError, BadRequestError } = require('../middleware/errorHandler');
const { createAuditLog, AuditAction, AuditModule, AuditStatus } = require('../utils/audit');
const { ImportErrorRecorder, getImportRecord, getImportErrors } = require('../utils/importError');
const {
  createBlacklistItem,
  getBlacklistByBlacklistId,
  getBlacklistById,
  getBlacklist,
  updateBlacklist,
  deleteBlacklist,
  checkBlacklist,
  validateBlacklistData
} = require('../models/blacklist');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '../../uploads') });

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateBlacklistData(req.body);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const existing = await getBlacklistByBlacklistId(req.body.blacklist_id);
  if (existing) {
    throw new ConflictError('黑名单ID已存在');
  }

  const item = await createBlacklistItem(req.body);

  await createAuditLog(AuditAction.CREATE, AuditModule.BLACKLIST, AuditStatus.SUCCESS, {
    operator: req.body.operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: item
  });

  res.json({
    success: true,
    data: item
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20, type, id_number, name, status, check_date } = req.query;

  const result = await getBlacklist(
    { type, id_number, name, status, check_date },
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
  const item = await getBlacklistById(req.params.id);
  if (!item) {
    throw new NotFoundError('黑名单记录不存在');
  }

  res.json({
    success: true,
    data: item
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const item = await getBlacklistById(req.params.id);
  if (!item) {
    throw new NotFoundError('黑名单记录不存在');
  }

  const errors = validateBlacklistData(req.body, true);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const updated = await updateBlacklist(req.params.id, req.body);

  await createAuditLog(AuditAction.UPDATE, AuditModule.BLACKLIST, AuditStatus.SUCCESS, {
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
  const item = await getBlacklistById(req.params.id);
  if (!item) {
    throw new NotFoundError('黑名单记录不存在');
  }

  await deleteBlacklist(req.params.id);

  await createAuditLog(AuditAction.DELETE, AuditModule.BLACKLIST, AuditStatus.SUCCESS, {
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

router.post('/check', asyncHandler(async (req, res) => {
  const { type, id_number, check_date } = req.body;

  if (!type || !id_number) {
    throw new ValidationError('类型和标识号码不能为空');
  }

  const result = await checkBlacklist(type, id_number, check_date);

  await createAuditLog(AuditAction.CHECK, AuditModule.BLACKLIST, AuditStatus.SUCCESS, {
    operator: req.body.operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: { type, id_number, check_date },
    responseData: { inBlacklist: !!result }
  });

  res.json({
    success: true,
    data: {
      inBlacklist: !!result,
      blacklistItem: result
    }
  });
}));

router.post('/import/json', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('请上传JSON文件');
  }

  const errorRecorder = new ImportErrorRecorder('blacklist', req.file.originalname, req.body.operator || 'system');
  const batchId = await errorRecorder.init();

  const results = [];
  const filePath = req.file.path;

  try {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    let dataArray;

    try {
      const parsed = JSON.parse(fileContent);
      dataArray = Array.isArray(parsed) ? parsed : parsed.data || parsed.list || [parsed];
    } catch (err) {
      throw new BadRequestError('JSON格式不正确');
    }

    for (let i = 0; i < dataArray.length; i++) {
      const row = dataArray[i];
      const rowNumber = i + 2;
      const data = mapJsonRowToBlacklist(row);
      const errors = validateBlacklistData(data);

      if (errors.length > 0) {
        errorRecorder.addError(
          rowNumber,
          row,
          errors.map(e => e.message).join('; '),
          generateSuggestion(errors, row)
        );
        continue;
      }

      try {
        const existing = await getBlacklistByBlacklistId(data.blacklist_id);
        if (existing) {
          errorRecorder.addError(
            rowNumber,
            row,
            '黑名单ID已存在',
            '请修改黑名单ID或使用更新接口'
          );
          continue;
        }

        const item = await createBlacklistItem(data, batchId);
        results.push(item);
        errorRecorder.addSuccess();
      } catch (err) {
        errorRecorder.addError(
          rowNumber,
          row,
          err.message,
          '请检查数据格式是否正确'
        );
      }
    }

    const summary = await errorRecorder.finish();

    await createAuditLog(AuditAction.IMPORT, AuditModule.BLACKLIST, summary.failCount > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS, {
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

function mapJsonRowToBlacklist(row) {
  return {
    blacklist_id: row['黑名单ID'] || row['blacklist_id'] || row['id'],
    type: row['类型'] || row['type'],
    id_number: row['标识号码'] || row['id_number'] || row['号码'],
    name: row['姓名'] || row['name'],
    reason: row['原因'] || row['reason'],
    level: row['级别'] || row['level'],
    status: row['状态'] || row['status'],
    effective_date: row['生效日期'] || row['effective_date'],
    expiry_date: row['失效日期'] || row['expiry_date']
  };
}

function generateSuggestion(errors, row) {
  const suggestions = [];

  for (const error of errors) {
    if (error.field === 'type') {
      suggestions.push('类型必须是 person、vehicle 或 id_card');
    } else if (error.field === 'id_number') {
      suggestions.push('标识号码不能为空');
    } else if (error.field === 'reason') {
      suggestions.push('拉黑原因不能为空');
    }
  }

  return suggestions.join('; ');
}

module.exports = router;
