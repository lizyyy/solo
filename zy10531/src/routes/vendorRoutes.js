const express = require('express');
const router = express.Router();
const Joi = require('joi');
const vendorService = require('../services/vendorService');
const validationService = require('../services/validationService');
const exportService = require('../services/exportService');

const vendorSchema = Joi.object({
  vendor_code: Joi.string().required(),
  vendor_name: Joi.string().allow(null, ''),
  business_license: Joi.string().allow(null, ''),
  business_license_expiry: Joi.string().allow(null, ''),
  contact_person: Joi.string().allow(null, ''),
  contact_phone: Joi.string().allow(null, ''),
  contact_email: Joi.string().allow(null, ''),
  payment_bank: Joi.string().allow(null, ''),
  payment_account: Joi.string().allow(null, ''),
  payment_account_name: Joi.string().allow(null, '')
});

const correctionSchema = Joi.object({
  vendor_code: Joi.string().required(),
  validation_id: Joi.string().allow(null, ''),
  field_name: Joi.string().required(),
  old_value: Joi.string().allow(null, ''),
  new_value: Joi.string().required(),
  corrected_by: Joi.string().required(),
  correction_note: Joi.string().allow(null, '')
});

const statusSchema = Joi.object({
  status: Joi.string().valid('pending', 'validating', 'passed', 'failed', 'corrected').required()
});

router.post('/', async (req, res) => {
  try {
    const { error, value } = vendorSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '请求参数验证失败',
        errors: error.details.map(d => d.message)
      });
    }

    const vendor = await vendorService.createOrUpdate(value);
    const validationResult = await validationService.validateVendor(value);

    if (validationResult.status === 'passed') {
      await vendorService.updateStatus(value.vendor_code, 'passed');
    } else {
      await vendorService.updateStatus(value.vendor_code, 'failed');
    }

    res.json({
      success: true,
      data: {
        vendor,
        validation: validationResult
      }
    });
  } catch (err) {
    console.error('创建供应商失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, limit, offset } = req.query;
    const vendors = await vendorService.getAll({
      status,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined
    });

    res.json({
      success: true,
      data: vendors
    });
  } catch (err) {
    console.error('查询供应商列表失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/:vendorCode', async (req, res) => {
  try {
    const vendor = await vendorService.getByCode(req.params.vendorCode);
    if (!vendor) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    const validationHistory = await vendorService.getValidationHistory(req.params.vendorCode);
    const correctionHistory = await vendorService.getCorrectionHistory(req.params.vendorCode);

    res.json({
      success: true,
      data: {
        vendor,
        validationHistory,
        correctionHistory
      }
    });
  } catch (err) {
    console.error('查询供应商详情失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.put('/:vendorCode/status', async (req, res) => {
  try {
    const { error, value } = statusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '状态参数验证失败',
        errors: error.details.map(d => d.message)
      });
    }

    const result = await vendorService.updateStatus(req.params.vendorCode, value.status);
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '供应商不存在'
      });
    }

    res.json({
      success: true,
      message: '状态更新成功',
      data: { status: value.status }
    });
  } catch (err) {
    console.error('更新供应商状态失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.post('/corrections', async (req, res) => {
  try {
    const { error, value } = correctionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({
        success: false,
        message: '修正记录参数验证失败',
        errors: error.details.map(d => d.message)
      });
    }

    const correction = await vendorService.addCorrectionRecord(value);

    const vendor = await vendorService.getByCode(value.vendor_code);
    if (vendor) {
      const updateData = { vendor_code: value.vendor_code };
      updateData[value.field_name] = value.new_value;
      await vendorService.createOrUpdate(updateData);
    }

    res.json({
      success: true,
      message: '修正记录添加成功',
      data: correction
    });
  } catch (err) {
    console.error('添加修正记录失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/:vendorCode/corrections', async (req, res) => {
  try {
    const corrections = await vendorService.getCorrectionHistory(req.params.vendorCode);
    res.json({
      success: true,
      data: corrections
    });
  } catch (err) {
    console.error('查询修正记录失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/:vendorCode/validations', async (req, res) => {
  try {
    const validations = await vendorService.getValidationHistory(req.params.vendorCode);
    res.json({
      success: true,
      data: validations
    });
  } catch (err) {
    console.error('查询校验历史失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/validations/:validationId/missing-items', async (req, res) => {
  try {
    const missingItems = await validationService.getMissingItems(req.params.validationId);
    res.json({
      success: true,
      data: missingItems
    });
  } catch (err) {
    console.error('查询缺失项失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.put('/missing-items/:missingItemId/resolve', async (req, res) => {
  try {
    await validationService.resolveMissingItem(req.params.missingItemId, true);
    res.json({
      success: true,
      message: '缺失项已标记为已解决'
    });
  } catch (err) {
    console.error('解决缺失项失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.post('/:vendorCode/export/excel', async (req, res) => {
  try {
    const { validation_id } = req.body;
    if (!validation_id) {
      return res.status(400).json({
        success: false,
        message: 'validation_id 是必需的'
      });
    }

    const result = await exportService.exportToExcel(req.params.vendorCode, validation_id);
    res.json({
      success: true,
      message: 'Excel报告导出成功',
      data: {
        reportId: result.reportId,
        filePath: result.filePath
      }
    });
  } catch (err) {
    console.error('导出Excel报告失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.post('/:vendorCode/export/json', async (req, res) => {
  try {
    const { validation_id } = req.body;
    if (!validation_id) {
      return res.status(400).json({
        success: false,
        message: 'validation_id 是必需的'
      });
    }

    const result = await exportService.generateReport(req.params.vendorCode, validation_id, 'json');
    res.json({
      success: true,
      message: 'JSON报告生成成功',
      data: result.reportContent
    });
  } catch (err) {
    console.error('生成JSON报告失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/reports/:reportId', async (req, res) => {
  try {
    const report = await exportService.getReport(req.params.reportId);
    if (!report) {
      return res.status(404).json({
        success: false,
        message: '报告不存在'
      });
    }

    res.json({
      success: true,
      data: JSON.parse(report.report_content)
    });
  } catch (err) {
    console.error('查询报告失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

router.get('/reports', async (req, res) => {
  try {
    const { vendor_code } = req.query;
    const reports = await exportService.getAllReports(vendor_code);
    res.json({
      success: true,
      data: reports.map(r => ({
        ...r,
        report_content: JSON.parse(r.report_content)
      }))
    });
  } catch (err) {
    console.error('查询报告列表失败:', err);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: err.message
    });
  }
});

module.exports = router;
