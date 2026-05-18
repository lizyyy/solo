const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const Exemption = require('../models/Exemption');
const ImportLog = require('../models/ImportLog');
const { exemptionSchema } = require('../middleware/validation');

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('只允许上传CSV文件'), false);
    }
  }
});

const ensureDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

ensureDir(path.join(__dirname, '../../uploads/'));
ensureDir(path.join(__dirname, '../../exports/'));

router.post('/import', upload.single('file'), async (req, res) => {
  const batchId = `BATCH_${Date.now()}`;
  const importedBy = req.body.importedBy || 'system';

  const importLog = await ImportLog.create({
    batchId,
    importedBy,
    status: 'processing'
  });

  try {
    if (!req.file) {
      throw new Error('未找到上传文件');
    }

    const results = [];
    const errors = [];
    let rowNumber = 0;

    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    importLog.totalRows = results.length;

    const successRecords = [];

    for (const record of results) {
      rowNumber++;

      try {
        const normalizedRecord = {
          datasetName: record.datasetName || record['数据集名称'],
          datasetCode: record.datasetCode || record['数据集编码'],
          fieldName: record.fieldName || record['字段名称'],
          fieldAlias: record.fieldAlias || record['字段别名'] || null,
          fieldPath: record.fieldPath || record['字段路径'] || null,
          exemptionReason: record.exemptionReason || record['豁免原因'],
          approver: record.approver || record['审批人'],
          approverEmail: record.approverEmail || record['审批人邮箱'] || null,
          expireDate: record.expireDate || record['到期时间'],
          createdBy: record.createdBy || record['创建人'] || importedBy,
          isNestedJson: (record.isNestedJson || record['是否嵌套JSON']) === 'true',
          metadata: record.metadata ? JSON.parse(record.metadata) : null
        };

        const { error } = exemptionSchema.validate(normalizedRecord, { abortEarly: false });
        if (error) {
          errors.push({
            row: rowNumber,
            record: normalizedRecord,
            errors: error.details.map(d => d.message)
          });
          continue;
        }

        const existing = await Exemption.findOne({
          where: {
            datasetCode: normalizedRecord.datasetCode,
            fieldName: normalizedRecord.fieldName,
            fieldPath: normalizedRecord.fieldPath || null,
            status: 'active'
          }
        });

        if (existing) {
          errors.push({
            row: rowNumber,
            record: normalizedRecord,
            errors: ['该字段已存在生效中的豁免审批记录']
          });
          continue;
        }

        const exemption = await Exemption.create(normalizedRecord);
        successRecords.push(exemption);

      } catch (err) {
        errors.push({
          row: rowNumber,
          record,
          errors: [err.message]
        });
      }
    }

    fs.unlinkSync(req.file.path);

    importLog.successRows = successRecords.length;
    importLog.failedRows = errors.length;
    importLog.failedDetails = errors;
    importLog.status = 'completed';
    await importLog.save();

    res.json({
      success: true,
      message: `批量导入完成: 成功 ${successRecords.length} 条, 失败 ${errors.length} 条`,
      batchId,
      data: {
        total: results.length,
        success: successRecords.length,
        failed: errors.length,
        failedDetails: errors
      }
    });

  } catch (error) {
    importLog.status = 'failed';
    importLog.failedDetails = { error: error.message };
    await importLog.save();

    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: '批量导入失败',
      error: error.message
    });
  }
});

router.get('/import/logs', async (req, res) => {
  try {
    const { batchId, status, page = 1, pageSize = 20 } = req.query;

    const where = {};
    if (batchId) where.batchId = batchId;
    if (status) where.status = status;

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await ImportLog.findAndCountAll({
      where,
      offset,
      limit,
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        list: rows,
        total: count,
        page: parseInt(page),
        pageSize: limit,
        totalPages: Math.ceil(count / limit)
      }
    });
  } catch (error) {
    console.error('查询导入日志失败:', error);
    res.status(500).json({
      success: false,
      message: '查询导入日志失败',
      error: error.message
    });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { datasetCode, status, approver } = req.query;

    const where = {};
    if (datasetCode) where.datasetCode = datasetCode;
    if (status) where.status = status;
    if (approver) where.approver = approver;

    const exemptions = await Exemption.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const exportData = exemptions.map(e => ({
      ID: e.id,
      数据集名称: e.datasetName,
      数据集编码: e.datasetCode,
      字段名称: e.fieldName,
      字段别名: e.fieldAlias,
      字段路径: e.fieldPath,
      豁免原因: e.exemptionReason,
      审批人: e.approver,
      审批人邮箱: e.approverEmail,
      到期时间: e.expireDate,
      状态: e.status,
      创建人: e.createdBy,
      是否嵌套JSON: e.isNestedJson ? '是' : '否',
      创建时间: e.createdAt,
      更新时间: e.updatedAt
    }));

    const json2csvParser = new Parser();
    const csv = json2csvParser.parse(exportData);

    const filename = `exemption_approvals_${Date.now()}.csv`;
    const filepath = path.join(__dirname, '../../exports/', filename);

    fs.writeFileSync(filepath, '\ufeff' + csv, 'utf8');

    res.download(filepath, filename, (err) => {
      if (err) {
        console.error('下载文件失败:', err);
      }
    });

  } catch (error) {
    console.error('导出豁免审批表失败:', error);
    res.status(500).json({
      success: false,
      message: '导出豁免审批表失败',
      error: error.message
    });
  }
});

module.exports = router;
