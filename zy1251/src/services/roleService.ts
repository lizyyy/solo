import prisma from '../lib/prisma';

export class RoleService {
  async createRole(data: {
    tenantId: string;
    name: string;
    code: string;
    description?: string;
    permissionIds?: string[];
  }) {
    const existingRole = await prisma.role.findUnique({
      where: {
        tenantId_code: {
          tenantId: data.tenantId,
          code: data.code,
        },
      },
    });

    if (existingRole) {
      throw new Error('角色代码已存在');
    }

    const role = await prisma.role.create({
      data: {
        tenantId: data.tenantId,
        name: data.name,
        code: data.code,
        description: data.description,
      },
    });

    if (data.permissionIds && data.permissionIds.length > 0) {
      await prisma.rolePermission.createMany({
        data: data.permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
          tenantId: data.tenantId,
        })),
      });
    }

    return this.getRoleWithPermissions(role.id);
  }

  async updateRole(
    id: string,
    tenantId: string,
    data: {
      name?: string;
      description?: string;
      permissionIds?: string[];
    }
  ) {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new Error('角色不存在');
    }

    if (role.isSystem) {
      throw new Error('系统角色不可修改');
    }

    await prisma.role.update({
      where: { id },
      data: {
        name: data.name,
        description: data.description,
      },
    });

    if (data.permissionIds !== undefined) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: id },
      });

      if (data.permissionIds.length > 0) {
        await prisma.rolePermission.createMany({
          data: data.permissionIds.map((permissionId) => ({
            roleId: id,
            permissionId,
            tenantId,
          })),
        });
      }
    }

    return this.getRoleWithPermissions(id);
  }

  async deleteRole(id: string, tenantId: string) {
    const role = await prisma.role.findUnique({
      where: { id },
    });

    if (!role || role.tenantId !== tenantId) {
      throw new Error('角色不存在');
    }

    if (role.isSystem) {
      throw new Error('系统角色不可删除');
    }

    await prisma.role.delete({
      where: { id },
    });
  }

  async getRoleWithPermissions(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
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
    });

    if (!role) {
      return null;
    }

    return {
      id: role.id,
      name: role.name,
      code: role.code,
      description: role.description,
      isSystem: role.isSystem,
      permissions: role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        code: rp.permission.code,
        description: rp.permission.description,
        resource: rp.permission.resource
          ? {
              id: rp.permission.resource.id,
              name: rp.permission.resource.name,
              code: rp.permission.resource.code,
              type: rp.permission.resource.type,
              path: rp.permission.resource.path,
              method: rp.permission.resource.method,
            }
          : null,
      })),
    };
  }

  async listRoles(tenantId: string, options?: { page?: number; pageSize?: number }) {
    const page = options?.page || 1;
    const pageSize = options?.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const [roles, total] = await Promise.all([
      prisma.role.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'asc' },
        skip,
        take: pageSize,
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
          _count: {
            select: { userRoles: true },
          },
        },
      }),
      prisma.role.count({ where: { tenantId } }),
    ]);

    return {
      roles: roles.map((role) => ({
        id: role.id,
        name: role.name,
        code: role.code,
        description: role.description,
        isSystem: role.isSystem,
        userCount: role._count.userRoles,
        permissions: role.rolePermissions.map((rp) => ({
          id: rp.permission.id,
          name: rp.permission.name,
          code: rp.permission.code,
          resource: rp.permission.resource?.name,
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

  async assignRoleToUser(
    userId: string,
    roleId: string,
    tenantId: string,
    assignedBy: string
  ) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    const role = await prisma.role.findUnique({
      where: { id: roleId },
    });

    if (!user || user.tenantId !== tenantId) {
      throw new Error('用户不存在');
    }

    if (!role || role.tenantId !== tenantId) {
      throw new Error('角色不存在');
    }

    const existingAssignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (existingAssignment) {
      return existingAssignment;
    }

    return prisma.userRole.create({
      data: {
        userId,
        roleId,
        tenantId,
        assignedBy,
      },
    });
  }

  async removeRoleFromUser(userId: string, roleId: string, tenantId: string) {
    const assignment = await prisma.userRole.findUnique({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });

    if (!assignment || assignment.tenantId !== tenantId) {
      throw new Error('用户角色关联不存在');
    }

    await prisma.userRole.delete({
      where: {
        userId_roleId: {
          userId,
          roleId,
        },
      },
    });
  }

  async getUserRoles(userId: string, tenantId: string) {
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

    return userRoles.map((ur) => ({
      id: ur.role.id,
      name: ur.role.name,
      code: ur.role.code,
      description: ur.role.description,
      assignedAt: ur.assignedAt,
      assignedBy: ur.assignedBy,
      permissions: ur.role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        code: rp.permission.code,
        resource: rp.permission.resource?.name,
      })),
    }));
  }
}

export const roleService = new RoleService();
