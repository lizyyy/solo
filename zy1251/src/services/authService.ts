import prisma from '../lib/prisma';
import { hashPassword, comparePassword } from '../utils/password';
import { generateAccessToken, generateRefreshToken, verifyToken } from '../utils/jwt';
import { config } from '../config';
import { v4 as uuidv4 } from 'uuid';

export class AuthService {
  async register(data: {
    tenantId: string;
    email: string;
    password: string;
    name?: string;
  }) {
    const existingUser = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: data.tenantId,
          email: data.email,
        },
      },
    });

    if (existingUser) {
      throw new Error('用户已存在');
    }

    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        tenantId: data.tenantId,
        email: data.email,
        passwordHash,
        name: data.name,
      },
    });

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
    };
  }

  async login(data: {
    tenantId: string;
    email: string;
    password: string;
    ipAddress?: string;
    userAgent?: string;
  }) {
    const user = await prisma.user.findUnique({
      where: {
        tenantId_email: {
          tenantId: data.tenantId,
          email: data.email,
        },
      },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      throw new Error('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new Error('账户已被禁用');
    }

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMinutes = Math.ceil(
        (user.lockedUntil.getTime() - Date.now()) / (1000 * 60)
      );
      throw new Error(`账户已锁定，请 ${remainingMinutes} 分钟后重试`);
    }

    const isPasswordValid = await comparePassword(data.password, user.passwordHash);

    if (!isPasswordValid) {
      const newLoginAttempts = user.loginAttempts + 1;
      
      if (newLoginAttempts >= config.login.maxAttempts) {
        const lockedUntil = new Date(
          Date.now() + config.login.lockoutDurationMinutes * 60 * 1000
        );
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newLoginAttempts,
            lockedUntil,
          },
        });
        throw new Error(`密码错误次数过多，账户已锁定 ${config.login.lockoutDurationMinutes} 分钟`);
      } else {
        await prisma.user.update({
          where: { id: user.id },
          data: {
            loginAttempts: newLoginAttempts,
          },
        });
        throw new Error(
          `用户名或密码错误，剩余尝试次数: ${config.login.maxAttempts - newLoginAttempts}`
        );
      }
    }

    await prisma.user.update({
      where: { id: user.id },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);

    const payload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    const expiresIn = this.parseExpiresIn(config.jwt.refreshExpiresIn);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    };
  }

  async refreshToken(data: {
    refreshToken: string;
  }) {
    const payload = verifyToken(data.refreshToken);

    if (!payload || payload.type !== 'refresh') {
      throw new Error('无效的刷新令牌');
    }

    const storedToken = await prisma.refreshToken.findUnique({
      where: { token: data.refreshToken },
      include: {
        user: {
          include: {
            userRoles: {
              include: {
                role: true,
              },
            },
          },
        },
      },
    });

    if (!storedToken || storedToken.isRevoked || storedToken.expiresAt < new Date()) {
      throw new Error('刷新令牌已过期或已被撤销');
    }

    const user = storedToken.user;
    if (!user.isActive) {
      throw new Error('用户已被禁用');
    }

    await prisma.refreshToken.update({
      where: { token: data.refreshToken },
      data: { isRevoked: true },
    });

    const roles = user.userRoles.map((ur) => ur.role.code);

    const newPayload = {
      userId: user.id,
      tenantId: user.tenantId,
      email: user.email,
      roles,
    };

    const accessToken = generateAccessToken(newPayload);
    const refreshToken = generateRefreshToken(newPayload);

    const expiresIn = this.parseExpiresIn(config.jwt.refreshExpiresIn);
    await prisma.refreshToken.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt: new Date(Date.now() + expiresIn),
      },
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        roles,
      },
    };
  }

  async logout(userId: string, refreshToken?: string) {
    if (refreshToken) {
      await prisma.refreshToken.updateMany({
        where: {
          userId,
          token: refreshToken,
        },
        data: { isRevoked: true },
      });
    } else {
      await prisma.refreshToken.updateMany({
        where: { userId },
        data: { isRevoked: true },
      });
    }
  }

  private parseExpiresIn(expiresIn: string): number {
    const unit = expiresIn.slice(-1);
    const value = parseInt(expiresIn.slice(0, -1), 10);

    switch (unit) {
      case 's':
        return value * 1000;
      case 'm':
        return value * 60 * 1000;
      case 'h':
        return value * 60 * 60 * 1000;
      case 'd':
        return value * 24 * 60 * 60 * 1000;
      default:
        return value * 1000;
    }
  }
}

export const authService = new AuthService();
