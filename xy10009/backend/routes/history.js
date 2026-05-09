const express = require('express');
const { HistoryRecord, User } = require('../models');
const { requireLogin, requireAdmin } = require('../middleware/auth');
const { Op } = require('sequelize');

const router = express.Router();

router.get('/', requireLogin, async (req, res, next) => {
  try {
    const { 
      page = 1, 
      pageSize = 20, 
      module, 
      action, 
      entityId,
      entityType,
      changedBy,
      startDate,
      endDate
    } = req.query;

    const offset = (page - 1) * pageSize;
    const where = {};

    if (module) {
      where.module = module;
    }

    if (action) {
      where.action = action;
    }

    if (entityId) {
      where.entityId = entityId;
    }

    if (entityType) {
      where.entityType = entityType;
    }

    if (changedBy) {
      where.changedBy = changedBy;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt[Op.gte] = new Date(startDate);
      }
      if (endDate) {
        where.createdAt[Op.lte] = new Date(endDate);
      }
    }

    const { rows: records, count } = await HistoryRecord.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'operator', 
          attributes: ['id', 'fullName', 'username'] 
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    });

    const formattedRecords = records.map(record => {
      const json = record.toJSON();
      return {
        ...json,
        oldValue: json.oldValue ? JSON.parse(json.oldValue) : null,
        newValue: json.newValue ? JSON.parse(json.newValue) : null
      };
    });

    res.json({
      success: true,
      data: {
        records: formattedRecords,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

router.get('/:id', requireLogin, async (req, res, next) => {
  try {
    const record = await HistoryRecord.findByPk(req.params.id, {
      include: [
        { 
          model: User, 
          as: 'operator', 
          attributes: ['id', 'fullName', 'username'] 
        }
      ]
    });

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '历史记录不存在'
      });
    }

    const json = record.toJSON();
    const formattedRecord = {
      ...json,
      oldValue: json.oldValue ? JSON.parse(json.oldValue) : null,
      newValue: json.newValue ? JSON.parse(json.newValue) : null
    };

    res.json({
      success: true,
      data: formattedRecord
    });
  } catch (error) {
    next(error);
  }
});

router.get('/entity/:entityId', requireLogin, async (req, res, next) => {
  try {
    const { entityType, page = 1, pageSize = 20 } = req.query;
    const offset = (page - 1) * pageSize;

    const where = {
      entityId: req.params.entityId
    };

    if (entityType) {
      where.entityType = entityType;
    }

    const { rows: records, count } = await HistoryRecord.findAndCountAll({
      where,
      include: [
        { 
          model: User, 
          as: 'operator', 
          attributes: ['id', 'fullName', 'username'] 
        }
      ],
      order: [['createdAt', 'DESC']],
      limit: parseInt(pageSize),
      offset: parseInt(offset)
    });

    const formattedRecords = records.map(record => {
      const json = record.toJSON();
      return {
        ...json,
        oldValue: json.oldValue ? JSON.parse(json.oldValue) : null,
        newValue: json.newValue ? JSON.parse(json.newValue) : null
      };
    });

    res.json({
      success: true,
      data: {
        records: formattedRecords,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;