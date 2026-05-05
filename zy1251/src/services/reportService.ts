import prisma from '../lib/prisma';
import { permissionCheckService } from './permissionCheckService';

interface ReportSection {
  title: string;
  content: string;
}

interface PermissionCheckReport {
  title: string;
  generatedAt: string;
  tenantId: string;
  sections: ReportSection[];
}

export class ReportService {
  async generatePermissionReport(tenantId: string): Promise<PermissionCheckReport> {
    const sections: ReportSection[] = [];

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    sections.push({
      title: '报告概览',
      content: `
- **租户名称**: ${tenant?.name || '未知'}
- **租户代码**: ${tenant?.slug || '未知'}
- **生成时间**: ${new Date().toLocaleString('zh-CN')}
- **报告类型**: 权限核对报告
`,
    });

    const roles = await prisma.role.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
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
    });

    sections.push({
      title: '角色统计',
      content: `
共配置 ${roles.length} 个角色

| 角色名称 | 角色代码 | 是否系统角色 | 用户数 | 权限数 |
|---------|---------|-------------|-------|-------|
${roles
  .map(
    (r) =>
      `| ${r.name} | ${r.code} | ${r.isSystem ? '是' : '否'} | ${r._count.userRoles} | ${r.rolePermissions.length} |`
  )
  .join('\n')}
`,
    });

    sections.push({
      title: '角色权限详情',
      content: roles
        .map((role) => {
          const permissionsByResource = new Map<string, Array<{ name: string; code: string }>>();

          role.rolePermissions.forEach((rp) => {
            const resourceName = rp.permission.resource?.name || '未分类';
            if (!permissionsByResource.has(resourceName)) {
              permissionsByResource.set(resourceName, []);
            }
            permissionsByResource.get(resourceName)!.push({
              name: rp.permission.name,
              code: rp.permission.code,
            });
          });

          let content = `\n#### ${role.name} (\`${role.code}\`)\n\n`;
          content += `- **类型**: ${role.isSystem ? '系统角色' : '自定义角色'}\n`;
          content += `- **关联用户数**: ${role._count.userRoles}\n`;
          content += `- **权限数**: ${role.rolePermissions.length}\n\n`;

          if (role.description) {
            content += `> ${role.description}\n\n`;
          }

          permissionsByResource.forEach((permissions, resourceName) => {
            content += `**资源**: ${resourceName}\n\n`;
            content += `| 权限名称 | 权限代码 |\n|---------|---------|\n`;
            permissions.forEach((p) => {
              content += `| ${p.name} | \`${p.code}\` |\n`;
            });
            content += '\n';
          });

          return content;
        })
        .join('---\n'),
    });

    const resources = await prisma.resource.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        permissions: true,
        _count: {
          select: { permissions: true },
        },
      },
    });

    sections.push({
      title: '资源统计',
      content: `
共配置 ${resources.length} 个资源

| 资源名称 | 资源代码 | 类型 | 权限数 |
|---------|---------|------|-------|
${resources
  .map(
    (r) =>
      `| ${r.name} | ${r.code} | ${r.type} | ${r._count.permissions} |`
  )
  .join('\n')}
`,
    });

    const users = await prisma.user.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
      include: {
        userRoles: {
          include: {
            role: true,
          },
        },
      },
    });

    const activeUsers = users.filter((u) => u.isActive);
    const lockedUsers = users.filter((u) => u.lockedUntil && u.lockedUntil > new Date());
    const usersWithoutRoles = users.filter((u) => u.userRoles.length === 0);

    sections.push({
      title: '用户统计',
      content: `
- **总用户数**: ${users.length}
- **活跃用户**: ${activeUsers.length}
- **锁定用户**: ${lockedUsers.length}
- **无角色用户**: ${usersWithoutRoles.length}

| 用户邮箱 | 用户名 | 状态 | 角色数 |
|---------|--------|------|-------|
${users
  .map((u) => {
    const status = u.lockedUntil && u.lockedUntil > new Date() 
      ? '锁定' 
      : u.isActive 
        ? '活跃' 
        : '禁用';
    return `| ${u.email} | ${u.name || '-'} | ${status} | ${u.userRoles.length} |`;
  })
  .join('\n')}
`,
    });

    if (usersWithoutRoles.length > 0) {
      sections.push({
        title: '⚠️ 无角色用户列表',
        content: `
以下用户未分配任何角色，这意味着他们登录后可能无法访问任何资源。

| 用户邮箱 | 用户名 |
|---------|--------|
${usersWithoutRoles.map((u) => `| ${u.email} | ${u.name || '-'} |`).join('\n')}
`,
      });
    }

    const allPermissions = await prisma.permission.findMany({
      where: { tenantId },
      include: {
        _count: {
          select: { rolePermissions: true },
        },
      },
    });

    const unusedPermissions = allPermissions.filter((p) => p._count.rolePermissions === 0);

    if (unusedPermissions.length > 0) {
      sections.push({
        title: '⚠️ 未使用权限',
        content: `
以下权限未被任何角色使用，建议清理。

| 权限名称 | 权限代码 |
|---------|---------|
${unusedPermissions.map((p) => `| ${p.name} | ${p.code} |`).join('\n')}
`,
      });
    }

    sections.push({
      title: '建议与最佳实践',
      content: `
1. **最小权限原则**: 只给用户分配完成工作所需的最小权限集合
2. **定期审计**: 定期检查用户权限分配，移除不再需要的权限
3. **角色设计**: 使用角色作为权限的容器，避免直接给用户分配权限
4. **锁定策略**: 配置合理的密码错误锁定策略，防止暴力破解
5. **日志监控**: 关注审计日志中的异常行为（如大量登录失败）
`,
    });

    return {
      title: '权限核对报告',
      generatedAt: new Date().toISOString(),
      tenantId,
      sections,
    };
  }

  async generateUserPermissionReport(
    userId: string,
    tenantId: string
  ): Promise<PermissionCheckReport> {
    const sections: ReportSection[] = [];

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
      throw new Error('用户不存在');
    }

    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
    });

    sections.push({
      title: '报告概览',
      content: `
- **租户**: ${tenant?.name || '未知'}
- **用户邮箱**: ${user.email}
- **用户名**: ${user.name || '-'}
- **生成时间**: ${new Date().toLocaleString('zh-CN')}
- **账户状态**: ${
        user.lockedUntil && user.lockedUntil > new Date()
          ? `已锁定 (解锁时间: ${user.lockedUntil.toLocaleString('zh-CN')})`
          : user.isActive
          ? '活跃'
          : '已禁用'
      }
- **登录失败次数**: ${user.loginAttempts}
- **最后登录**: ${user.lastLoginAt?.toLocaleString('zh-CN') || '从未登录'}
`,
    });

    const roles = user.userRoles.map((ur) => ur.role);

    sections.push({
      title: '分配的角色',
      content: `
共分配 ${roles.length} 个角色

| 角色名称 | 角色代码 | 是否系统角色 | 权限数 |
|---------|---------|-------------|-------|
${roles
  .map(
    (r) =>
      `| ${r.name} | ${r.code} | ${r.isSystem ? '是' : '否'} | ${r.rolePermissions.length} |`
  )
  .join('\n')}
`,
    });

    const allPermissions = new Map<
      string,
      {
        name: string;
        code: string;
        resourceName: string;
        resourceCode: string;
        grantedByRoles: string[];
      }
    >();

    user.userRoles.forEach((ur) => {
      const role = ur.role;
      role.rolePermissions.forEach((rp) => {
        const perm = rp.permission;
        const key = perm.code;

        if (allPermissions.has(key)) {
          allPermissions.get(key)!.grantedByRoles.push(role.code);
        } else {
          allPermissions.set(key, {
            name: perm.name,
            code: perm.code,
            resourceName: perm.resource?.name || '未分类',
            resourceCode: perm.resource?.code || 'unknown',
            grantedByRoles: [role.code],
          });
        }
      });
    });

    const permissionsByResource = new Map<string, Array<{ name: string; code: string; grantedByRoles: string[] }>>();

    allPermissions.forEach((p) => {
      if (!permissionsByResource.has(p.resourceName)) {
        permissionsByResource.set(p.resourceName, []);
      }
      permissionsByResource.get(p.resourceName)!.push({
        name: p.name,
        code: p.code,
        grantedByRoles: p.grantedByRoles,
      });
    });

    sections.push({
      title: '有效权限列表',
      content: `
共拥有 ${allPermissions.size} 项有效权限

${Array.from(permissionsByResource.entries())
  .map(([resourceName, permissions]) => {
    let content = `\n#### 资源: ${resourceName}\n\n`;
    content += `| 权限名称 | 权限代码 | 授予角色 |\n|---------|---------|---------|\n`;
    permissions.forEach((p) => {
      content += `| ${p.name} | \`${p.code}\` | ${p.grantedByRoles.map((r) => `\`${r}\``).join(', ')} |\n`;
    });
    return content;
  })
  .join('')}
`,
    });

    if (roles.length === 0) {
      sections.push({
        title: '⚠️ 风险提示',
        content: `
该用户未分配任何角色。这意味着：
1. 用户可以登录（如果账户状态正常）
2. 用户无法访问任何需要权限验证的接口
3. 建议检查用户角色配置

**建议**: 为用户分配至少一个角色，或者如果该账户不再使用，考虑禁用或删除。
`,
      });
    }

    return {
      title: `用户权限报告 - ${user.email}`,
      generatedAt: new Date().toISOString(),
      tenantId,
      sections,
    };
  }

  reportToMarkdown(report: PermissionCheckReport): string {
    let markdown = `# ${report.title}\n\n`;
    markdown += `> 生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}\n\n`;
    markdown += `---\n\n`;

    report.sections.forEach((section) => {
      markdown += `## ${section.title}\n\n`;
      markdown += `${section.content}\n`;
      markdown += `---\n\n`;
    });

    return markdown;
  }
}

export const reportService = new ReportService();
