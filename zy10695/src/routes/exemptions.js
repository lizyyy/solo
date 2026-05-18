const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const moment = require('moment');
const Exemption = require('../models/Exemption');
const { validateExemption } = require('../middleware/validation');

router.get('/', async (req, res) => {
  try {
    const {
      datasetCode,
      fieldName,
      status,
      approver,
      isExpired,
      page = 1,
      pageSize = 20
    } = req.query;

    const where = {};
    if (datasetCode) where.datasetCode = datasetCode;
    if (fieldName) where.fieldName = { [Op.like]: `%${fieldName}%` };
    if (status) where.status = status;
    if (approver) where.approver = approver;
    if (isExpired === 'true') {
      where.expireDate = { [Op.lt]: new Date() };
    } else if (isExpired === 'false') {
      where.expireDate = { [Op.gte]: new Date() };
    }

    const offset = (page - 1) * pageSize;
    const limit = parseInt(pageSize);

    const { count, rows } = await Exemption.findAndCountAll({
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
    console.error('查询豁免审批列表失败:', error);
    res.status(500).json({
      success: false,
      message: '查询豁免审批列表失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exemption = await Exemption.findByPk(req.params.id);
    if (!exemption) {
      return res.status(404).json({
        success: false,
        message: '豁免审批记录不存在'
      });
    }

    res.json({
      success: true,
      data: exemption
    });
  } catch (error) {
    console.error('查询豁免审批详情失败:', error);
    res.status(500).json({
      success: false,
      message: '查询豁免审批详情失败',
      error: error.message
    });
  }
});

router.post('/', validateExemption, async (req, res) => {
  try {
    const { datasetCode, fieldName, fieldPath } = req.body;

    const existing = await Exemption.findOne({
      where: {
        datasetCode,
        fieldName,
        fieldPath: fieldPath || null,
        status: 'active'
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: '该字段已存在生效中的豁免审批记录'
      });
    }

    const exemption = await Exemption.create(req.body);

    res.status(201).json({
      success: true,
      message: '豁免审批创建成功',
      data: exemption
    });
  } catch (error) {
    console.error('创建豁免审批失败:', error);
    res.status(500).json({
      success: false,
      message: '创建豁免审批失败',
      error: error.message
    });
  }
});

router.put('/:id', validateExemption, async (req, res) => {
  try {
    const exemption = await Exemption.findByPk(req.params.id);
    if (!exemption) {
      return res.status(404).json({
        success: false,
        message: '豁免审批记录不存在'
      });
    }

    const { datasetCode, fieldName, fieldPath } = req.body;
    const existing = await Exemption.findOne({
      where: {
        id: { [Op.ne]: req.params.id },
        datasetCode,
        fieldName,
        fieldPath: fieldPath || null,
        status: 'active'
      }
    });

    if (existing) {
      return res.status(409).json({
        success: false,
        message: '该字段已存在生效中的豁免审批记录'
      });
    }

    await exemption.update(req.body);

    res.json({
      success: true,
      message: '豁免审批更新成功',
      data: exemption
    });
  } catch (error) {
    console.error('更新豁免审批失败:', error);
    res.status(500).json({
      success: false,
      message: '更新豁免审批失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const exemption = await Exemption.findByPk(req.params.id);
    if (!exemption) {
      return res.status(404).json({
        success: false,
        message: '豁免审批记录不存在'
      });
    }

    await exemption.update({ status: 'revoked' });

    res.json({
      success: true,
      message: '豁免审批已撤销'
    });
  } catch (error) {
    console.error('撤销豁免审批失败:', error);
    res.status(500).json({
      success: false,
      message: '撤销豁免审批失败',
      error: error.message
    });
  }
});

router.get('/expiring/soon', async (req, res) => {
  try {
    const { days = 7 } = req.query;
    const soonDate = moment().add(days, 'days').toDate();

    const expiring = await Exemption.findAll({
      where: {
        status: 'active',
        expireDate: {
          [Op.between]: [new Date(), soonDate]
        }
      },
      order: [['expireDate', 'ASC']]
    });

    res.json({
      success: true,
      data: expiring
    });
  } catch (error) {
    console.error('查询即将到期豁免审批失败:', error);
    res.status(500).json({
      success: false,
      message: '查询即将到期豁免审批失败',
      error: error.message
    });
  }
});

module.exports = router;
