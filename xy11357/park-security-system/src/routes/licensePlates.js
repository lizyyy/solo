const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const { asyncHandler, ValidationError, NotFoundError, ConflictError, BadRequestError } = require('../middleware/errorHandler');
const { createAuditLog, AuditAction, AuditModule, AuditStatus } = require('../utils/audit');
const { ImportErrorRecorder, getImportRecord, getImportErrors } = require('../utils/importError');
const {
  createLicensePlate,
  getLicensePlateByPlateId,
  getLicensePlateById,
  getLicensePlates,
  updateLicensePlate,
  deleteLicensePlate,
  validateLicensePlateData
} = require('../models/licensePlate');

const router = express.Router();

const upload = multer({ dest: path.join(__dirname, '../../uploads') });

router.post('/', asyncHandler(async (req, res) => {
  const errors = validateLicensePlateData(req.body);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const existing = await getLicensePlateByPlateId(req.body.plate_id);
  if (existing) {
    throw new ConflictError('车牌ID已存在');
  }

  const plate = await createLicensePlate(req.body);

  await createAuditLog(AuditAction.CREATE, AuditModule.LICENSE_PLATE, AuditStatus.SUCCESS, {
    operator: req.body.operator || 'system',
    ipAddress: req.ip,
    requestId: req.requestId,
    requestData: req.body,
    responseData: plate
  });

  res.json({
    success: true,
    data: plate
  });
}));

router.get('/', asyncHandler(async (req, res) => {
  const { page = 1, pageSize = 20, plate_number, owner_name, status, valid_date } = req.query;

  const result = await getLicensePlates(
    { plate_number, owner_name, status, valid_date },
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
  const plate = await getLicensePlateById(req.params.id);
  if (!plate) {
    throw new NotFoundError('车牌记录不存在');
  }

  res.json({
    success: true,
    data: plate
  });
}));

router.put('/:id', asyncHandler(async (req, res) => {
  const plate = await getLicensePlateById(req.params.id);
  if (!plate) {
    throw new NotFoundError('车牌记录不存在');
  }

  const errors = validateLicensePlateData(req.body, true);
  if (errors.length > 0) {
    throw new ValidationError('数据验证失败', errors);
  }

  const updated = await updateLicensePlate(req.params.id, req.body);

  await createAuditLog(AuditAction.UPDATE, AuditModule.LICENSE_PLATE, AuditStatus.SUCCESS, {
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
  const plate = await getLicensePlateById(req.params.id);
  if (!plate) {
    throw new NotFoundError('车牌记录不存在');
  }

  await deleteLicensePlate(req.params.id);

  await createAuditLog(AuditAction.DELETE, AuditModule.LICENSE_PLATE, AuditStatus.SUCCESS, {
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

router.post('/import/json', upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new ValidationError('请上传JSON文件');
  }

  const errorRecorder = new ImportErrorRecorder('license_plate', req.file.originalname, req.body.operator || 'system');
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
      const data = mapJsonRowToPlate(row);
      const errors = validateLicensePlateData(data);

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
        const existing = await getLicensePlateByPlateId(data.plate_id);
        if (existing) {
          errorRecorder.addError(
            rowNumber,
            row,
            '车牌ID已存在',
            '请修改车牌ID或使用更新接口'
          );
          continue;
        }

        const plate = await createLicensePlate(data, batchId);
        results.push(plate);
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

    await createAuditLog(AuditAction.IMPORT, AuditModule.LICENSE_PLATE, summary.failCount > 0 ? AuditStatus.PARTIAL : AuditStatus.SUCCESS, {
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

function mapJsonRowToPlate(row) {
  return {
    plate_id: row['车牌ID'] || row['plate_id'] || row['id'],
    plate_number: row['车牌号码'] || row['plate_number'] || row['车牌'],
    owner_name: row['车主姓名'] || row['owner_name'] || row['车主'],
    owner_phone: row['车主电话'] || row['owner_phone'] || row['电话'],
    valid_start_date: row['有效开始日期'] || row['valid_start_date'] || row['开始日期'],
    valid_end_date: row['有效结束日期'] || row['valid_end_date'] || row['结束日期'],
    vehicle_type: row['车辆类型'] || row['vehicle_type'] || row['类型'],
    visit_reason: row['来访事由'] || row['visit_reason'] || row['事由'],
    status: row['状态'] || row['status']
  };
}

function generateSuggestion(errors, row) {
  const suggestions = [];

  for (const error of errors) {
    if (error.field === 'plate_number') {
      suggestions.push('车牌号码不能为空');
    } else if (error.field === 'valid_start_date') {
      suggestions.push('有效开始日期格式应为YYYY-MM-DD，例如：2024-01-15');
    } else if (error.field === 'valid_end_date') {
      suggestions.push('有效结束日期格式应为YYYY-MM-DD，例如：2024-01-15');
    }
  }

  return suggestions.join('; ');
}

module.exports = router;
