import prisma from '../lib/prisma';
import { hashPassword } from '../utils/password';

export class UserService {
  async createUser(data: {
    tenantId: string;
    email: string;
    password: string;
    name?: string;
    roleIds?: string[];
    createdBy: string;
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

    return prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          tenantId: data.tenantId,
          email: data.email,
          passwordHash,
          name: data.name,
        },
      });

      if (data.roleIds && data.roleIds.length > 0) {
        const roles = await tx.role.findMany({
          where: {
            id: { in: data.roleIds },
            tenantId: data.tenantId,
          },
        });

        if (roles.length !== data.roleIds.length) {
          throw new Error('部分角色不存在');
        }

        await tx.userRole.createMany({
          data: data.roleIds.map((roleId) => ({
            userId: user.id,
            roleId,
            tenantId: data.tenantId,
            assignedBy: data.createdBy,
          })),
        });
      }

      return this.getUserWithRoles(user.id);
    });
  }

  async updateUser(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      isActive?: boolean;
      password?: string;
    }
  ) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new Error('用户不存在');
    }

    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) {
      updateData.name = data.name;
    }

    if (data.isActive !== undefined) {
      updateData.isActive = data.isActive;
      if (!data.isActive) {
        await prisma.refreshToken.updateMany({
          where: { userId: id, isRevoked: false },
          data: { isRevoked: true },
        });
      }
    }

    if (data.password) {
      updateData.passwordHash = await hashPassword(data.password);
      updateData.loginAttempts = 0;
      updateData.lockedUntil = null;
    }

    await prisma.user.update({
      where: { id },
      data: updateData,
    });

    return this.getUserWithRoles(id);
  }

  async deleteUser(id: string, tenantId: string) {
    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new Error('用户不存在');
    }

    await prisma.user.delete({
      where: { id },
    });
  }

  async getUserWithRoles(id: string) {
    const user = await prisma.user.findUnique({
      where: { id },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      isActive: user.isActive,
      loginAttempts: user.loginAttempts,
      lockedUntil: user.lockedUntil,
      lastLoginAt: user.lastLoginAt,
      createdAt: user.createdAt,
      roles: user.userRoles.map((ur) => ({
        id: ur.role.id,
        name: ur.role.name,
        code: ur.role.code,
      })),
    };
  }

  async listUsers(tenantId: string, options?: { search?: string; isActive?: boolean; page?: number; pageSize?: number }) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { tenantId };

    if (options?.search) {
      where.OR = [
        { email: { contains: options.search } },
        { name: { contains: options.search } },
      ];
    }

    if (options?.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
        include: {
          userRoles: {
            include: {
              role: true,
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        isActive: user.isActive,
        loginAttempts: user.loginAttempts,
        lockedUntil: user.lockedUntil,
        lastLoginAt: user.lastLoginAt,
        createdAt: user.createdAt,
        roles: user.userRoles.map((ur) => ({
          id: ur.role.id,
          name: ur.role.name,
          code: ur.role.code,
        })),
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async unlockUser(userId: string, tenantId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new Error('用户不存在');
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        loginAttempts: 0,
        lockedUntil: null,
      },
    });

    return this.getUserWithRoles(userId);
  }
}

export const userService = new UserService();
