const express = require('express');
const jwt = require('jsonwebtoken');
const { secret, expiresIn } = require('../config/jwt');
const { User, Tenant, AuditLog } = require('../models');
const { authMiddleware, roleMiddleware } = require('../middlewares/auth');
const { auditMiddleware } = require('../middlewares/audit');

const router = express.Router();

router.post('/login', auditMiddleware('LOGIN', 'Auth'), async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: '用户名和密码不能为空'
      });
    }

    const user = await User.findOne({
      where: { username },
      include: [
        { model: Tenant, as: 'tenant' },
        { model: Tenant, as: 'currentTenant' }
      ]
    });

    if (!user || user.status !== 'active') {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '用户名或密码错误'
      });
    }

    const isPasswordValid = await user.validatePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        error: 'UNAUTHORIZED',
        message: '用户名或密码错误'
      });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          username: user.username,
          name: user.name,
          role: user.role,
          tenantId: user.tenantId,
          currentTenantId: user.currentTenantId,
          currentTenant: user.currentTenant
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
});

router.post('/switch-tenant', authMiddleware, auditMiddleware('TENANT_SWITCH', 'Tenant'), async (req, res) => {
  try {
    const { tenantId } = req.body;
    const user = req.user;

    if (!tenantId) {
      return res.status(400).json({
        success: false,
        error: 'BAD_REQUEST',
        message: '租户ID不能为空'
      });
    }

    if (user.role !== 'admin' && user.role !== 'customer_service') {
      return res.status(403).json({
        success: false,
        error: 'FORBIDDEN',
        message: '只有管理员和客服可以切换租户'
      });
    }

    const targetTenant = await Tenant.findByPk(tenantId);
    if (!targetTenant || targetTenant.status !== 'active') {
      return res.status(404).json({
        success: false,
        error: 'NOT_FOUND',
        message: '租户不存在或已禁用'
      });
    }

    await user.switchTenant(tenantId);
    user.currentTenant = targetTenant;

    const newToken = jwt.sign(
      { userId: user.id, username: user.username, role: user.role },
      secret,
      { expiresIn }
    );

    res.json({
      success: true,
      data: {
        token: newToken,
        currentTenantId: user.currentTenantId,
        currentTenant: {
          id: targetTenant.id,
          name: targetTenant.name,
          code: targetTenant.code
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
});

router.get('/me', authMiddleware, auditMiddleware('READ', 'User'), async (req, res) => {
  try {
    const user = req.user;
    const currentTenant = await Tenant.findByPk(user.currentTenantId);
    const originalTenant = await Tenant.findByPk(user.tenantId);

    res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        name: user.name,
        role: user.role,
        originalTenant: {
          id: originalTenant.id,
          name: originalTenant.name,
          code: originalTenant.code
        },
        currentTenant: currentTenant ? {
          id: currentTenant.id,
          name: currentTenant.name,
          code: currentTenant.code
        } : null
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'INTERNAL_ERROR',
      message: error.message
    });
  }
});

module.exports = router;
