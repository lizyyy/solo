import prisma from '../lib/prisma';

export class PermissionService {
  async createPermission(data: {
    tenantId: string;
    resourceId: string;
    name: string;
    code: string;
    description?: string;
  }) {
    const resource = await prisma.resource.findUnique({
      where: { id: data.resourceId },
    });

    if (!resource || resource.tenantId !== data.tenantId) {
      throw new Error('资源不存在');
    }

    const existingPermission = await prisma.permission.findUnique({
      where: {
        tenantId_code: {
          tenantId: data.tenantId,
          code: data.code,
        },
      },
    });

    if (existingPermission) {
      throw new Error('权限代码已存在');
    }

    return prisma.permission.create({
      data,
      include: {
        resource: true,
      },
    });
  }

  async updatePermission(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
    }
  ) {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission || permission.tenantId !== tenantId) {
      throw new Error('权限不存在');
    }

    return prisma.permission.update({
      where: { id },
      data,
      include: {
        resource: true,
      },
    });
  }

  async deletePermission(id: string, tenantId: string) {
    const permission = await prisma.permission.findUnique({
      where: { id },
    });

    if (!permission || permission.tenantId !== tenantId) {
      throw new Error('权限不存在');
    }

    await prisma.permission.delete({
      where: { id },
    });
  }

  async listPermissions(tenantId: string, options?: { resourceId?: string; page?: number; pageSize?: number }) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 100;
    const skip = (page - 1) * pageSize;

    const where: Record<string, unknown> = { tenantId };
    if (options?.resourceId) {
      where.resourceId = options.resourceId;
    }

    const [permissions, total] = await Promise.all([
      prisma.permission.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
        include: {
          resource: true,
          _count: {
            select: { rolePermissions: true },
          },
        },
      }),
      prisma.permission.count({ where }),
    ]);

    return {
      permissions: permissions.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        description: p.description,
        resource: p.resource
          ? {
              id: p.resource.id,
              name: p.resource.name,
              code: p.resource.code,
              type: p.resource.type,
            }
          : null,
        roleCount: p._count.rolePermissions,
      })),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  async getUserPermissions(userId: string, tenantId: string) {
    const userRoles = await prisma.userRole.findMany({
      where: {
        userId,
        tenantId,
      },
      include: {
        role: {
          include: {
            rolePermissions: {
              include: {
                permission: {
                  include: {
                    resource: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    const permissions = new Map<string, unknown>();

    userRoles.forEach((ur) => {
      ur.role.rolePermissions.forEach((rp) => {
        const perm = rp.permission;
        if (!permissions.has(perm.id)) {
          permissions.set(perm.id, {
            id: perm.id,
            name: perm.name,
            code: perm.code,
            description: perm.description,
            resource: perm.resource
              ? {
                  id: perm.resource.id,
                  name: perm.resource.name,
                  code: perm.resource.code,
                  type: perm.resource.type,
                  path: perm.resource.path,
                  method: perm.resource.method,
                }
              : null,
            grantedByRole: ur.role.code,
          });
        }
      });
    });

    return Array.from(permissions.values());
  }
}

export const permissionService = new PermissionService();
