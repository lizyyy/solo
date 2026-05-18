const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const Exemption = require('../models/Exemption');
const ExportLog = require('../models/ExportLog');
const { validateExportCheck } = require('../middleware/validation');

router.post('/check', validateExportCheck, async (req, res) => {
  try {
    const { exportId, datasetCode, fields, exportedBy } = req.body;

    const exemptions = await Exemption.findAll({
      where: {
        datasetCode,
        [Op.or]: [
          { fieldName: { [Op.in]: fields } },
          { fieldAlias: { [Op.in]: fields } },
          { fieldPath: { [Op.in]: fields } }
        ]
      }
    });

    const activeExemptions = exemptions.filter(e =>
      e.status === 'active' && new Date(e.expireDate) > new Date()
    );

    const expiredExemptions = exemptions.filter(e =>
      e.status === 'expired' || new Date(e.expireDate) <= new Date()
    );

    const approvedFields = activeExemptions.map(e => ({
      fieldName: e.fieldName,
      fieldAlias: e.fieldAlias,
      fieldPath: e.fieldPath,
      expireDate: e.expireDate,
      approver: e.approver
    }));

    const expiredFields = expiredExemptions.map(e => ({
      fieldName: e.fieldName,
      fieldAlias: e.fieldAlias,
      fieldPath: e.fieldPath,
      expireDate: e.expireDate,
      approver: e.approver,
      reason: '豁免审批已过期，需重新申请'
    }));

    const unapprovedFields = fields.filter(f => {
      const found = exemptions.find(e =>
        e.fieldName === f || e.fieldAlias === f || e.fieldPath === f
      );
      return !found;
    }).map(f => ({
      fieldName: f,
      fieldAlias: null,
      fieldPath: null,
      reason: '未找到豁免审批记录'
    }));

    const allExpiredOrUnapproved = [...expiredFields, ...unapprovedFields];

    let status;
    if (allExpiredOrUnapproved.length === 0) {
      status = 'allowed';
    } else if (allExpiredOrUnapproved.length === fields.length) {
      status = 'blocked';
    } else {
      status = 'partial';
    }

    await ExportLog.create({
      exportId,
      datasetCode,
      fields,
      expiredFields: allExpiredOrUnapproved,
      exportedBy,
      status
    });

    const response = {
      success: true,
      exportId,
      status,
      message: status === 'allowed'
        ? '所有字段豁免审批有效，允许明文导出'
        : status === 'blocked'
          ? '所有字段豁免审批已过期或不存在，拦截导出'
          : '部分字段豁免审批有问题，需处理后重新导出',
      approvedFields,
      needReapprovalFields: allExpiredOrUnapproved
    };

    if (status === 'blocked' || allExpiredOrUnapproved.length > 0) {
      return res.status(403).json(response);
    }

    res.json(response);
  } catch (error) {
    console.error('导出豁免检查失败:', error);
    res.status(500).json({
      success: false,
      message: '导出豁免检查失败',
      error: error.message
    });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { exportId, datasetCode, status, page = 1, pageSize = 20 } = req.query;

    const where = {};
    if (exportId) where.exportId = exportId;
    if (datasetCode) where.datasetCode = datasetCode;
    if (status) where.status = status;

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await ExportLog.findAndCountAll({
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
    console.error('查询导出日志失败:', error);
    res.status(500).json({
      success: false,
      message: '查询导出日志失败',
      error: error.message
    });
  }
});

module.exports = router;
