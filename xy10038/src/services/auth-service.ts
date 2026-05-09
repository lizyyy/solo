import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma';
import logger from '../config/logger';
import { config } from '../config';
import { JwtPayload } from '../types';
import { UnauthorizedError, NotFoundError, BadRequestError } from '../utils/errors';

export class AuthService {
  async login(username: string, password: string): Promise<{ token: string; user: any }> {
    const user = await prisma.user.findUnique({
      where: { username }
    });

    if (!user) {
      logger.warn(`登录失败: 用户 ${username} 不存在`);
      throw new UnauthorizedError('用户名或密码错误');
    }

    if (!user.isActive) {
      logger.warn(`登录失败: 用户 ${username} 已被禁用`);
      throw new UnauthorizedError('账户已被禁用');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      logger.warn(`登录失败: 用户 ${username} 密码错误`);
      throw new UnauthorizedError('用户名或密码错误');
    }

    const payload: JwtPayload = {
      userId: user.id,
      username: user.username,
      role: user.role
    };

    const token = jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn
    });

    logger.info(`用户 ${username} 登录成功`);

    const { passwordHash, ...userWithoutPassword } = user;
    return { token, user: userWithoutPassword };
  }

  async register(data: {
    username: string;
    email: string;
    password: string;
    role?: any;
  }): Promise<any> {
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email }
        ]
      }
    });

    if (existingUser) {
      throw new BadRequestError('用户名或邮箱已存在');
    }

    const passwordHash = await bcrypt.hash(data.password, 12);

    const user = await prisma.user.create({
      data: {
        username: data.username,
        email: data.email,
        passwordHash,
        role: data.role || 'OPERATOR'
      }
    });

    const { passwordHash: _, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async verifyToken(token: string): Promise<JwtPayload> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new UnauthorizedError('Token已过期');
      }
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('无效的Token');
      }
      throw new UnauthorizedError('认证失败');
    }
  }

  async getCurrentUser(userId: string): Promise<any> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const { passwordHash, ...userWithoutPassword } = user;
    return userWithoutPassword;
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new BadRequestError('旧密码错误');
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({
      where: { id: userId },
      data: { passwordHash }
    });

    logger.info(`用户 ${user.username} 修改密码成功`);
  }
}

export const authService = new AuthService();
