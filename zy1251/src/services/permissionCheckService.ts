import prisma from '../lib/prisma';

interface PermissionCheckResult {
  userId: string;
  userEmail: string;
  permissionCode: string;
  permissionName: string;
  resource: {
    id: string;
    name: string;
    code: string;
    type: string;
    path?: string | null;
    method?: string | null;
  };
  granted: boolean;
  grantedBy?: {
    roleId: string;
    roleName: string;
    roleCode: string;
  };
  reason?: string;
}

interface RolePermissionResult {
  roleId: string;
  roleName: string;
  roleCode: string;
  isSystem: boolean;
  permissions: Array<{
    id: string;
    name: string;
    code: string;
    description?: string | null;
    resource: {
      id: string;
      name: string;
      code: string;
      type: string;
      path?: string | null;
      method?: string | null;
    };
  }>;
}

export class PermissionCheckService {
  async checkUserPermission(
    userId: string,
    tenantId: string,
    permissionCode: string
  ): Promise<PermissionCheckResult> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
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
        },
      },
    });

    if (!user || user.tenantId !== tenantId) {
      return {
        userId,
        userEmail: 'unknown',
        permissionCode,
        permissionName: '',
        resource: {
          id: '',
          name: '',
          code: '',
          type: '',
        },
        granted: false,
        reason: '用户不存在或不属于当前租户',
      };
    }

    if (!user.isActive) {
      return {
        userId: user.id,
        userEmail: user.email,
        permissionCode,
        permissionName: '',
        resource: {
          id: '',
          name: '',
          code: '',
          type: '',
        },
        granted: false,
        reason: '用户已被禁用',
      };
    }

    const targetPermission = await prisma.permission.findFirst({
      where: {
        tenantId,
        code: permissionCode,
      },
      include: {
        resource: true,
      },
    });

    if (!targetPermission) {
      return {
        userId: user.id,
        userEmail: user.email,
        permissionCode,
        permissionName: '',
        resource: {
          id: '',
          name: '',
          code: '',
          type: '',
        },
        granted: false,
        reason: '权限代码不存在',
      };
    }

    for (const userRole of user.userRoles) {
      const role = userRole.role;
      const hasPermission = role.rolePermissions.some(
        (rp) => rp.permission.code === permissionCode
      );

      if (hasPermission) {
        return {
          userId: user.id,
          userEmail: user.email,
          permissionCode: targetPermission.code,
          permissionName: targetPermission.name,
          resource: {
            id: targetPermission.resource.id,
            name: targetPermission.resource.name,
            code: targetPermission.resource.code,
            type: targetPermission.resource.type,
            path: targetPermission.resource.path,
            method: targetPermission.resource.method,
          },
          granted: true,
          grantedBy: {
            roleId: role.id,
            roleName: role.name,
            roleCode: role.code,
          },
        };
      }
    }

    return {
      userId: user.id,
      userEmail: user.email,
      permissionCode: targetPermission.code,
      permissionName: targetPermission.name,
      resource: {
        id: targetPermission.resource.id,
        name: targetPermission.resource.name,
        code: targetPermission.resource.code,
        type: targetPermission.resource.type,
        path: targetPermission.resource.path,
        method: targetPermission.resource.method,
      },
      granted: false,
      reason: '用户没有分配的角色包含此权限',
    };
  }

  async checkUserPermissions(
    userId: string,
    tenantId: string,
    permissionCodes: string[]
  ): Promise<PermissionCheckResult[]> {
    return Promise.all(
      permissionCodes.map((code) => this.checkUserPermission(userId, tenantId, code))
    );
  }

  async getUserRolePermissions(
    userId: string,
    tenantId: string
  ): Promise<RolePermissionResult[]> {
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
      roleId: ur.role.id,
      roleName: ur.role.name,
      roleCode: ur.role.code,
      isSystem: ur.role.isSystem,
      permissions: ur.role.rolePermissions.map((rp) => ({
        id: rp.permission.id,
        name: rp.permission.name,
        code: rp.permission.code,
        description: rp.permission.description,
        resource: {
          id: rp.permission.resource.id,
          name: rp.permission.resource.name,
          code: rp.permission.resource.code,
          type: rp.permission.resource.type,
          path: rp.permission.resource.path,
          method: rp.permission.resource.method,
        },
      })),
    }));
  }

  async checkRolePermission(
    roleId: string,
    tenantId: string,
    permissionCode: string
  ): Promise<{
    roleId: string;
    roleName: string;
    roleCode: string;
    isSystem: boolean;
    permissionCode: string;
    permissionName: string;
    resource: {
      id: string;
      name: string;
      code: string;
      type: string;
      path?: string | null;
      method?: string | null;
    };
    granted: boolean;
    reason?: string;
  }> {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
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

    if (!role || role.tenantId !== tenantId) {
      return {
        roleId,
        roleName: '',
        roleCode: '',
        isSystem: false,
        permissionCode,
        permissionName: '',
        resource: {
          id: '',
          name: '',
          code: '',
          type: '',
        },
        granted: false,
        reason: '角色不存在或不属于当前租户',
      };
    }

    const targetPermission = await prisma.permission.findFirst({
      where: {
        tenantId,
        code: permissionCode,
      },
      include: {
        resource: true,
      },
    });

    if (!targetPermission) {
      return {
        roleId: role.id,
        roleName: role.name,
        roleCode: role.code,
        isSystem: role.isSystem,
        permissionCode,
        permissionName: '',
        resource: {
          id: '',
          name: '',
          code: '',
          type: '',
        },
        granted: false,
        reason: '权限代码不存在',
      };
    }

    const hasPermission = role.rolePermissions.some(
      (rp) => rp.permission.code === permissionCode
    );

    return {
      roleId: role.id,
      roleName: role.name,
      roleCode: role.code,
      isSystem: role.isSystem,
      permissionCode: targetPermission.code,
      permissionName: targetPermission.name,
      resource: {
        id: targetPermission.resource.id,
        name: targetPermission.resource.name,
        code: targetPermission.resource.code,
        type: targetPermission.resource.type,
        path: targetPermission.resource.path,
        method: targetPermission.resource.method,
      },
      granted: hasPermission,
      reason: hasPermission ? undefined : '角色未分配此权限',
    };
  }
}

export const permissionCheckService = new PermissionCheckService();
