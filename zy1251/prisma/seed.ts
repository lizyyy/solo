import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const SALT_ROUNDS = 10;

async function main() {
  console.log('🌱 开始初始化 seed 数据...');

  const tenant = await prisma.tenant.upsert({
    where: { slug: 'demo' },
    update: {},
    create: {
      name: '演示租户',
      slug: 'demo',
    },
  });

  console.log(`✅ 租户创建/更新: ${tenant.name}`);

  const hashedAdminPassword = await bcrypt.hash('Admin@123', SALT_ROUNDS);
  const hashedUserPassword = await bcrypt.hash('User@123', SALT_ROUNDS);

  const superAdminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'super_admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '超级管理员',
      code: 'super_admin',
      description: '拥有系统所有权限的超级管理员角色',
      isSystem: true,
    },
  });

  const adminRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'admin' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '管理员',
      code: 'admin',
      description: '拥有用户管理和角色查看权限的管理员角色',
      isSystem: true,
    },
  });

  const userRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'user' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '普通用户',
      code: 'user',
      description: '基础用户角色，拥有基本的访问权限',
      isSystem: true,
    },
  });

  const guestRole = await prisma.role.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'guest' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '访客',
      code: 'guest',
      description: '访客角色，拥有最小权限',
      isSystem: true,
    },
  });

  console.log(`✅ 角色创建完成: ${[superAdminRole, adminRole, userRole, guestRole].map(r => r.name).join(', ')}`);

  const userResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'user_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '用户管理',
      code: 'user_management',
      type: 'api',
      path: '/api/users',
      description: '用户相关的资源管理',
    },
  });

  const roleResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'role_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '角色管理',
      code: 'role_management',
      type: 'api',
      path: '/api/roles',
      description: '角色相关的资源管理',
    },
  });

  const permissionResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'permission_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '权限管理',
      code: 'permission_management',
      type: 'api',
      path: '/api/permissions',
      description: '权限相关的资源管理',
    },
  });

  const resourceResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'resource_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '资源管理',
      code: 'resource_management',
      type: 'api',
      path: '/api/resources',
      description: '资源相关的管理',
    },
  });

  const reportResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'report_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '报告管理',
      code: 'report_management',
      type: 'api',
      path: '/api/permission-check',
      description: '权限报告和权限检查',
    },
  });

  const auditLogResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'audit_log_management' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '审计日志',
      code: 'audit_log_management',
      type: 'api',
      path: '/api/audit-logs',
      description: '审计日志查看',
    },
  });

  const demoResource = await prisma.resource.upsert({
    where: { tenantId_code: { tenantId: tenant.id, code: 'demo_resource' } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: '演示资源',
      code: 'demo_resource',
      type: 'api',
      path: '/api/demo',
      description: '用于权限演示的示例资源',
    },
  });

  console.log(`✅ 资源创建完成`);

  const permissions = [
    { resourceId: userResource.id, name: '查看用户列表', code: 'user:list', description: '查看用户列表权限' },
    { resourceId: userResource.id, name: '查看用户详情', code: 'user:view', description: '查看用户详情权限' },
    { resourceId: userResource.id, name: '创建用户', code: 'user:create', description: '创建用户权限' },
    { resourceId: userResource.id, name: '更新用户', code: 'user:update', description: '更新用户权限' },
    { resourceId: userResource.id, name: '删除用户', code: 'user:delete', description: '删除用户权限' },
    { resourceId: userResource.id, name: '解锁用户', code: 'user:unlock', description: '解锁用户权限' },
    { resourceId: userResource.id, name: '分配角色', code: 'user:assign_role', description: '给用户分配角色权限' },

    { resourceId: roleResource.id, name: '查看角色列表', code: 'role:list', description: '查看角色列表权限' },
    { resourceId: roleResource.id, name: '查看角色详情', code: 'role:view', description: '查看角色详情权限' },
    { resourceId: roleResource.id, name: '创建角色', code: 'role:create', description: '创建角色权限' },
    { resourceId: roleResource.id, name: '更新角色', code: 'role:update', description: '更新角色权限' },
    { resourceId: roleResource.id, name: '删除角色', code: 'role:delete', description: '删除角色权限' },

    { resourceId: permissionResource.id, name: '查看权限列表', code: 'permission:list', description: '查看权限列表权限' },
    { resourceId: permissionResource.id, name: '创建权限', code: 'permission:create', description: '创建权限权限' },
    { resourceId: permissionResource.id, name: '更新权限', code: 'permission:update', description: '更新权限权限' },
    { resourceId: permissionResource.id, name: '删除权限', code: 'permission:delete', description: '删除权限权限' },

    { resourceId: resourceResource.id, name: '查看资源列表', code: 'resource:list', description: '查看资源列表权限' },
    { resourceId: resourceResource.id, name: '创建资源', code: 'resource:create', description: '创建资源权限' },
    { resourceId: resourceResource.id, name: '更新资源', code: 'resource:update', description: '更新资源权限' },
    { resourceId: resourceResource.id, name: '删除资源', code: 'resource:delete', description: '删除资源权限' },

    { resourceId: reportResource.id, name: '权限检查', code: 'permission:check', description: '权限检查权限' },
    { resourceId: reportResource.id, name: '生成报告', code: 'report:generate', description: '生成权限报告权限' },

    { resourceId: auditLogResource.id, name: '查看审计日志', code: 'audit:view', description: '查看审计日志权限' },

    { resourceId: demoResource.id, name: '读取演示资源', code: 'demo:read', description: '读取演示资源权限' },
    { resourceId: demoResource.id, name: '写入演示资源', code: 'demo:write', description: '写入演示资源权限' },
    { resourceId: demoResource.id, name: '删除演示资源', code: 'demo:delete', description: '删除演示资源权限' },
  ];

  const createdPermissions: Record<string, { id: string; code: string }> = {};

  for (const perm of permissions) {
    const created = await prisma.permission.upsert({
      where: { tenantId_code: { tenantId: tenant.id, code: perm.code } },
      update: {},
      create: {
        tenantId: tenant.id,
        ...perm,
      },
    });
    createdPermissions[perm.code] = { id: created.id, code: created.code };
  }

  console.log(`✅ 权限创建完成: ${permissions.length} 个权限`);

  const superAdminPermCodes = Object.keys(createdPermissions);
  const adminPermCodes = [
    'user:list', 'user:view', 'user:create', 'user:update', 'user:unlock', 'user:assign_role',
    'role:list', 'role:view',
    'permission:list',
    'resource:list',
    'permission:check',
    'report:generate',
    'audit:view',
    'demo:read', 'demo:write',
  ];
  const userPermCodes = [
    'demo:read', 'demo:write',
    'permission:check',
  ];
  const guestPermCodes = [
    'demo:read',
  ];

  const superAdminRolePerms = superAdminPermCodes.map(code => ({
    roleId: superAdminRole.id,
    permissionId: createdPermissions[code].id,
    tenantId: tenant.id,
  }));

  const adminRolePerms = adminPermCodes.map(code => ({
    roleId: adminRole.id,
    permissionId: createdPermissions[code].id,
    tenantId: tenant.id,
  }));

  const userRolePerms = userPermCodes.map(code => ({
    roleId: userRole.id,
    permissionId: createdPermissions[code].id,
    tenantId: tenant.id,
  }));

  const guestRolePerms = guestPermCodes.map(code => ({
    roleId: guestRole.id,
    permissionId: createdPermissions[code].id,
    tenantId: tenant.id,
  }));

  for (const rp of [...superAdminRolePerms, ...adminRolePerms, ...userRolePerms, ...guestRolePerms]) {
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: rp.roleId, permissionId: rp.permissionId } },
      update: {},
      create: rp,
    });
  }

  console.log(`✅ 角色权限关联完成`);

  const superAdminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'superadmin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'superadmin@demo.com',
      passwordHash: hashedAdminPassword,
      name: '超级管理员',
      isActive: true,
    },
  });

  const adminUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'admin@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'admin@demo.com',
      passwordHash: hashedAdminPassword,
      name: '管理员用户',
      isActive: true,
    },
  });

  const regularUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'user@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'user@demo.com',
      passwordHash: hashedUserPassword,
      name: '普通用户',
      isActive: true,
    },
  });

  const guestUser = await prisma.user.upsert({
    where: { tenantId_email: { tenantId: tenant.id, email: 'guest@demo.com' } },
    update: {},
    create: {
      tenantId: tenant.id,
      email: 'guest@demo.com',
      passwordHash: hashedUserPassword,
      name: '访客用户',
      isActive: true,
    },
  });

  console.log(`✅ 测试用户创建完成`);

  const userRoles = [
    { userId: superAdminUser.id, roleId: superAdminRole.id, tenantId: tenant.id, assignedBy: 'seed' },
    { userId: adminUser.id, roleId: adminRole.id, tenantId: tenant.id, assignedBy: 'seed' },
    { userId: regularUser.id, roleId: userRole.id, tenantId: tenant.id, assignedBy: 'seed' },
    { userId: guestUser.id, roleId: guestRole.id, tenantId: tenant.id, assignedBy: 'seed' },
  ];

  for (const ur of userRoles) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: ur.userId, roleId: ur.roleId } },
      update: {},
      create: ur,
    });
  }

  console.log(`✅ 用户角色分配完成`);

  console.log('\n🎉 Seed 数据初始化完成！');
  console.log('\n📋 租户信息:');
  console.log(`   - 租户名称: ${tenant.name}`);
  console.log(`   - 租户代码 (slug): ${tenant.slug}`);

  console.log('\n👤 测试用户:');
  console.log(`   1. 超级管理员`);
  console.log(`      - 邮箱: superadmin@demo.com`);
  console.log(`      - 密码: Admin@123`);
  console.log(`      - 角色: super_admin`);
  console.log(`   2. 管理员`);
  console.log(`      - 邮箱: admin@demo.com`);
  console.log(`      - 密码: Admin@123`);
  console.log(`      - 角色: admin`);
  console.log(`   3. 普通用户`);
  console.log(`      - 邮箱: user@demo.com`);
  console.log(`      - 密码: User@123`);
  console.log(`      - 角色: user`);
  console.log(`   4. 访客`);
  console.log(`      - 邮箱: guest@demo.com`);
  console.log(`      - 密码: User@123`);
  console.log(`      - 角色: guest`);

  console.log('\n🎭 角色:');
  console.log(`   - super_admin: 超级管理员 - 拥有所有权限`);
  console.log(`   - admin: 管理员 - 用户管理、权限检查`);
  console.log(`   - user: 普通用户 - 基础读写权限`);
  console.log(`   - guest: 访客 - 只读权限`);

  console.log('\n🚀 现在可以运行 npm run dev 启动服务了！');
}

main()
  .catch((e) => {
    console.error('Seed 初始化失败:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
