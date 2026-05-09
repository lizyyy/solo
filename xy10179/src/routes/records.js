const express = require('express');
const { Op } = require('sequelize');
const { DataRecord, sequelize, SecurityIncident } = require('../models');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const { tenantIsolationMiddleware, verifyRecordTenant } = require('../middlewares/tenantIsolation');
const { auditMiddleware } = require('../middlewares/audit');

const router = express.Router();

router.use(authMiddleware);
router.use(tenantIsolationMiddleware);

router.post('/', 
  auditMiddleware('CREATE', 'DataRecord'),
  async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
      const { title, content, status, idempotencyKey } = req.body;
      const { user, tenantId } = req;

      if (!title) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: '标题不能为空'
        });
      }

      if (idempotencyKey) {
        const existingRecord = await DataRecord.findOne({
          where: {
            tenantId,
            createdBy: user.id
          },
          order: [['createdAt', 'DESC']],
          transaction: t
        });

        if (existingRecord && existingRecord.title === title) {
          await SecurityIncident.create({
            tenantId,
            userId: user.id,
            type: 'REPEAT_SUBMISSION',
            severity: 'low',
            description: '检测到重复提交',
            details: JSON.stringify({
              idempotencyKey,
              existingRecordId: existingRecord.id,
              title
            }),
            ipAddress: req.ip
          }, { transaction: t });

          await t.commit();
          return res.status(409).json({
            success: false,
            error: 'DUPLICATE',
            message: '检测到重复提交，请求已忽略',
            data: { existingRecordId: existingRecord.id }
          });
        }
      }

      const record = await DataRecord.create({
        tenantId,
        title,
        content: content || '',
        status: status || 'draft',
        createdBy: user.id,
        updatedBy: user.id
      }, { transaction: t });

      res.locals.createdRecord = record.toJSON();
      
      await t.commit();
      
      res.status(201).json({
        success: true,
        data: record
      });
    } catch (error) {
      await t.rollback();
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

router.get('/', 
  auditMiddleware('READ', 'DataRecord'),
  async (req, res) => {
    try {
      const { tenantId } = req;
      const { page = 1, pageSize = 10, status, keyword } = req.query;
      
      const where = { tenantId };
      
      if (status) {
        where.status = status;
      }
      
      if (keyword) {
        where[Op.or] = [
          { title: { [Op.like]: `%${keyword}%` } },
          { content: { [Op.like]: `%${keyword}%` } }
        ];
      }

      const offset = (page - 1) * pageSize;
      
      const { count, rows } = await DataRecord.findAndCountAll({
        where,
        limit: parseInt(pageSize),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']]
      });

      res.json({
        success: true,
        data: rows,
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: count,
          totalPages: Math.ceil(count / pageSize)
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

router.get('/:id', 
  auditMiddleware('READ', 'DataRecord'),
  verifyRecordTenant,
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: req.record
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

router.put('/:id', 
  auditMiddleware('UPDATE', 'DataRecord'),
  verifyRecordTenant,
  async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
      const { title, content, status } = req.body;
      const { user, record } = req;

      if (title !== undefined && !title) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          error: 'BAD_REQUEST',
          message: '标题不能为空'
        });
      }

      const updateData = {
        updatedBy: user.id
      };
      
      if (title !== undefined) updateData.title = title;
      if (content !== undefined) updateData.content = content;
      if (status !== undefined) updateData.status = status;

      await record.update(updateData, { transaction: t });
      
      res.locals.afterState = record.toJSON();
      
      await t.commit();
      
      res.json({
        success: true,
        data: record
      });
    } catch (error) {
      await t.rollback();
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

router.delete('/:id', 
  auditMiddleware('DELETE', 'DataRecord'),
  verifyRecordTenant,
  roleMiddleware('admin', 'customer_service'),
  async (req, res) => {
    const t = await sequelize.transaction();
    
    try {
      const { record } = req;
      
      await record.destroy({ transaction: t, force: true });
      
      await t.commit();
      
      res.json({
        success: true,
        message: '删除成功'
      });
    } catch (error) {
      await t.rollback();
      
      res.status(500).json({
        success: false,
        error: 'INTERNAL_ERROR',
        message: error.message
      });
    }
  }
);

module.exports = router;
