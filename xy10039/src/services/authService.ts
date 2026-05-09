import jwt from 'jsonwebtoken';
import { User } from '../models';
import { config } from '../config/environment';
import { JwtPayload, UserRole, LogAction, LogEntity } from '../types';
import { AuditService } from './auditService';
import { ConflictError, NotFoundError, CustomError } from '../middleware/errorHandler';

export class AuthService {
  static async register(
    email: string,
    password: string,
    name: string,
    role: UserRole = UserRole.OPERATOR
  ): Promise<User> {
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      throw new ConflictError('用户已存在');
    }

    const user = await User.create({ email, password, name, role });
    await AuditService.log(LogAction.CREATE, LogEntity.USER, user.id, user.id, undefined, {
      email,
      name,
      role
    });

    return user;
  }

  static async login(
    email: string,
    password: string
  ): Promise<{ token: string; user: User }> {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      throw new NotFoundError('用户');
    }

    if (!user.isActive) {
      throw new CustomError('账户已被禁用', 403, 'ACCOUNT_DISABLED');
    }

    const isValid = await user.comparePassword(password);
    if (!isValid) {
      throw new CustomError('密码错误', 401, 'INVALID_CREDENTIALS');
    }

    const payload: JwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    const token = jwt.sign(
      payload,
      config.jwtSecret,
      {
        expiresIn: '24h'
      } as any
    );

    await user.update({ lastLoginAt: new Date() });
    await AuditService.log(LogAction.LOGIN, LogEntity.USER, user.id, user.id);

    return { token, user };
  }

  static async getProfile(userId: string): Promise<User> {
    const user = await User.findByPk(userId, {
      attributes: { exclude: ['password'] }
    });
    if (!user) {
      throw new NotFoundError('用户', userId);
    }
    return user;
  }

  static async listUsers(): Promise<User[]> {
    return User.findAll({
      attributes: { exclude: ['password'] },
      order: [['createdAt', 'DESC']]
    });
  }

  static async updateUserRole(
    userId: string,
    newRole: UserRole,
    currentUserId: string
  ): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new NotFoundError('用户', userId);
    }

    const oldValues = { role: user.role };
    await user.update({ role: newRole });

    await AuditService.log(
      LogAction.UPDATE,
      LogEntity.USER,
      user.id,
      currentUserId,
      oldValues,
      { role: newRole }
    );

    return user;
  }
}
