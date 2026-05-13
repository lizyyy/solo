const express = require('express');
const { Op, fn, col, literal } = require('sequelize');
const { AuditLog, SecurityIncident, DataRecord, Tenant, User, sequelize } = require('../models');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const { auditMiddleware } = require('../middlewares/audit');

const router = express.Router();

router.use(authMiddleware);
router.use(roleMiddleware('admin', 'customer_service'));

router.get('/audit-logs', 
  auditMiddleware('READ', 'Report'),
  async (req, res) => {
    try {
      const { tenantId, user } = req;
      const { 
        page = 1, 
        pageSize = 20, 
        action, 
        resourceType, 
        status, 
        userId,
        startDate,
        endDate
      } = req.query;
      
      const where = { tenantId };
      
      if (action) where.action = action;
      if (resourceType) where.resourceType = resourceType;
      if (status) where.status = status;
      if (userId) where.userId = userId;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const offset = (page - 1) * pageSize;
      
      const { count, rows } = await AuditLog.findAndCountAll({
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

router.get('/security-incidents', 
  auditMiddleware('READ', 'Report'),
  async (req, res) => {
    try {
      const { tenantId } = req;
      const { 
        page = 1, 
        pageSize = 20, 
        type, 
        severity, 
        status,
        startDate,
        endDate
      } = req.query;
      
      const where = { tenantId };
      
      if (type) where.type = type;
      if (severity) where.severity = severity;
      if (status) where.status = status;
      
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt[Op.gte] = new Date(startDate);
        if (endDate) where.createdAt[Op.lte] = new Date(endDate);
      }

      const offset = (page - 1) * pageSize;
      
      const { count, rows } = await SecurityIncident.findAndCountAll({
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

router.get('/risk-summary', 
  auditMiddleware('READ', 'Report'),
  async (req, res) => {
    try {
      const { tenantId } = req;
      const { startDate, endDate } = req.query;
      
      const dateWhere = {};
      if (startDate) dateWhere[Op.gte] = new Date(startDate);
      if (endDate) dateWhere[Op.lte] = new Date(endDate);
      
      const incidentWhere = { tenantId };
      if (Object.keys(dateWhere).length > 0) {
        incidentWhere.createdAt = dateWhere;
      }

      const auditWhere = { tenantId };
      if (Object.keys(dateWhere).length > 0) {
        auditWhere.createdAt = dateWhere;
      }

      const [incidentStats, auditStats] = await Promise.all([
        SecurityIncident.findAll({
          where: incidentWhere,
          attributes: [
            'type',
            'severity',
            'status',
            [fn('COUNT', col('id')), 'count']
          ],
          group: ['type', 'severity', 'status']
        }),
        AuditLog.findAll({
          where: auditWhere,
          attributes: [
            'action',
            'status',
            [fn('COUNT', col('id')), 'count']
          ],
          group: ['action', 'status']
        })
      ]);

      const totalIncidents = incidentStats.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
      const openIncidents = incidentStats
        .filter(item => item.dataValues.status === 'open')
        .reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
      const criticalIncidents = incidentStats
        .filter(item => item.dataValues.severity === 'critical')
        .reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
      const highIncidents = incidentStats
        .filter(item => item.dataValues.severity === 'high')
        .reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);

      const totalAuditLogs = auditStats.reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);
      const failedActions = auditStats
        .filter(item => item.dataValues.status === 'failure')
        .reduce((sum, item) => sum + parseInt(item.dataValues.count), 0);

      const incidentsByType = {};
      incidentStats.forEach(item => {
        if (!incidentsByType[item.dataValues.type]) {
          incidentsByType[item.dataValues.type] = 0;
        }
        incidentsByType[item.dataValues.type] += parseInt(item.dataValues.count);
      });

      const actionsByType = {};
      auditStats.forEach(item => {
        if (!actionsByType[item.dataValues.action]) {
          actionsByType[item.dataValues.action] = { total: 0, failed: 0 };
        }
        actionsByType[item.dataValues.action].total += parseInt(item.dataValues.count);
        if (item.dataValues.status === 'failure') {
          actionsByType[item.dataValues.action].failed += parseInt(item.dataValues.count);
        }
      });

      res.json({
        success: true,
        data: {
          summary: {
            totalIncidents,
            openIncidents,
            criticalIncidents,
            highIncidents,
            totalAuditLogs,
            failedActions
          },
          incidentsByType,
          actionsByType,
          timeRange: {
            startDate: startDate || null,
            endDate: endDate || null
          }
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

router.get('/tenant-access-stats', 
  auditMiddleware('READ', 'Report'),
  async (req, res) => {
    try {
      const { tenantId } = req;
      const { startDate, endDate } = req.query;
      
      const dateWhere = {};
      if (startDate) dateWhere[Op.gte] = new Date(startDate);
      if (endDate) dateWhere[Op.lte] = new Date(endDate);

      const [tenantSwitchLogs, crossTenantAttempts] = await Promise.all([
        AuditLog.findAll({
          where: {
            tenantId,
            action: 'TENANT_SWITCH',
            status: 'success',
            createdAt: dateWhere
          },
          attributes: [
            'userId',
            [fn('COUNT', col('id')), 'switchCount']
          ],
          group: ['userId']
        }),
        SecurityIncident.findAll({
          where: {
            tenantId,
            type: 'CROSS_TENANT_ACCESS',
            createdAt: dateWhere
          },
          attributes: [
            'userId',
            [fn('COUNT', col('id')), 'attemptCount']
          ],
          group: ['userId']
        })
      ]);

      const userIds = new Set();
      tenantSwitchLogs.forEach(log => userIds.add(log.userId));
      crossTenantAttempts.forEach(incident => userIds.add(incident.userId));
      
      const usersMap = {};
      if (userIds.size > 0) {
        const users = await User.findAll({
          where: { id: { [Op.in]: Array.from(userIds) } },
          attributes: ['id', 'username', 'name', 'role']
        });
        users.forEach(u => {
          usersMap[u.id] = u;
        });
      }

      const userStats = {};
      
      tenantSwitchLogs.forEach(log => {
        if (!userStats[log.userId]) {
          userStats[log.userId] = {
            user: usersMap[log.userId] || null,
            tenantSwitches: 0,
            crossTenantAttempts: 0
          };
        }
        userStats[log.userId].tenantSwitches = parseInt(log.dataValues.switchCount);
      });

      crossTenantAttempts.forEach(incident => {
        if (!userStats[incident.userId]) {
          userStats[incident.userId] = {
            user: usersMap[incident.userId] || null,
            tenantSwitches: 0,
            crossTenantAttempts: 0
          };
        }
        userStats[incident.userId].crossTenantAttempts = parseInt(incident.dataValues.attemptCount);
      });

      res.json({
        success: true,
        data: Object.values(userStats)
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

module.exports = router;
