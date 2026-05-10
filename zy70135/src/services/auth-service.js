const jwt = require('jsonwebtoken');
const config = require('../config');
const db = require('../models');
const { UnauthorizedError, NotFoundError, ValidationError } = require('../utils/errors');
const { AUDIT_ACTION, AUDIT_ENTITY_TYPE } = require('../core/constants');

class AuthService {
  static async login(username, password, requestContext = {}) {
    const user = await db.User.findOne({
      where: { username },
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!user) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedError('用户已被禁用');
    }

    const isValidPassword = await user.checkPassword(password);
    if (!isValidPassword) {
      throw new UnauthorizedError('用户名或密码错误');
    }

    await user.update({ lastLoginAt: new Date() });

    const token = this.generateToken(user);

    await this.recordLoginAudit(user, requestContext);

    return {
      user: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        email: user.email,
        role: user.role,
        businessLine: user.businessLine,
        permissions: user.getPermissions(),
      },
      token,
      tokenExpiresIn: config.jwt.expiresIn,
    };
  }

  static generateToken(user) {
    const payload = {
      userId: user.id,
      username: user.username,
      role: user.role,
      businessLineId: user.businessLineId,
    };

    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn,
    });
  }

  static async recordLoginAudit(user, requestContext) {
    return await db.AuditLog.create({
      action: AUDIT_ACTION.LOGIN,
      entityType: AUDIT_ENTITY_TYPE.USER,
      entityId: user.id,
      actorId: user.id,
      actorName: user.displayName,
      actorRole: user.role,
      businessLineId: user.businessLineId,
      ipAddress: requestContext.ipAddress,
      userAgent: requestContext.userAgent,
      requestId: requestContext.requestId,
      metadata: {
        loginTime: new Date().toISOString(),
      },
    });
  }

  static async createUser(userData, createdBy = null) {
    const existingUser = await db.User.findOne({
      where: { username: userData.username },
    });

    if (existingUser) {
      throw new ValidationError('用户名已存在', [
        { field: 'username', message: '用户名已存在' },
      ]);
    }

    const user = await db.User.create(userData);
    return user;
  }

  static async getCurrentUser(userId) {
    const user = await db.User.findByPk(userId, {
      include: [
        {
          model: db.BusinessLine,
          as: 'businessLine',
          attributes: ['id', 'code', 'name'],
        },
      ],
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    return {
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      email: user.email,
      role: user.role,
      businessLine: user.businessLine,
      permissions: user.getPermissions(),
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
    };
  }

  static async changePassword(userId, oldPassword, newPassword) {
    const user = await db.User.findByPk(userId);

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const isValidOldPassword = await user.checkPassword(oldPassword);
    if (!isValidOldPassword) {
      throw new ValidationError('原密码错误', [
        { field: 'oldPassword', message: '原密码错误' },
      ]);
    }

    if (newPassword.length < 6) {
      throw new ValidationError('新密码长度不能少于6位', [
        { field: 'newPassword', message: '新密码长度不能少于6位' },
      ]);
    }

    await user.update({ password: newPassword });

    return true;
  }
}

module.exports = AuthService;
