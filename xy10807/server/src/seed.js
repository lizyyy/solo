const db = require('./database');
const { v4: uuidv4 } = require('uuid');

const seedData = async () => {
  console.log('开始初始化数据...');

  const tenantId = 'tenant-acme-001';
  await new Promise((resolve, reject) => {
    db.run(`INSERT OR REPLACE INTO tenants (id, name, status) VALUES (?, ?, ?)`, 
      [tenantId, 'ACME 科技有限公司', 'active'], 
      (err) => err ? reject(err) : resolve()
    );
  });
  console.log('✅ 租户创建完成');

  const deptTechId = 'dept-tech-001';
  const deptFinanceId = 'dept-finance-001';
  const deptBackendId = 'dept-backend-001';
  
  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO departments (id, tenant_id, name, parent_id) VALUES (?, ?, ?, ?)`,
        [deptTechId, tenantId, '技术部', null],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO departments (id, tenant_id, name, parent_id) VALUES (?, ?, ?, ?)`,
        [deptFinanceId, tenantId, '财务部', null],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO departments (id, tenant_id, name, parent_id) VALUES (?, ?, ?, ?)`,
        [deptBackendId, tenantId, '后端开发组', deptTechId],
        (err) => err ? reject(err) : resolve()
      );
    })
  ]);
  console.log('✅ 部门创建完成');

  const roleAdminId = 'role-admin-001';
  const roleDevId = 'role-dev-001';
  const roleFinanceId = 'role-finance-001';
  
  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO roles (id, department_id, name, description) VALUES (?, ?, ?, ?)`,
        [roleAdminId, deptTechId, '技术总监', '技术部门管理员'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO roles (id, department_id, name, description) VALUES (?, ?, ?, ?)`,
        [roleDevId, deptBackendId, '后端开发工程师', '后端开发人员'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO roles (id, department_id, name, description) VALUES (?, ?, ?, ?)`,
        [roleFinanceId, deptFinanceId, '财务专员', '财务部门普通员工'],
        (err) => err ? reject(err) : resolve()
      );
    })
  ]);
  console.log('✅ 角色创建完成');

  const apiUserListId = 'api-user-list';
  const apiUserCreateId = 'api-user-create';
  const apiFinanceReportId = 'api-finance-report';
  const apiSystemConfigId = 'api-system-config';
  const apiLogQueryId = 'api-log-query';

  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
        [apiUserListId, '用户列表查询', '/api/users', 'GET', '查询系统用户列表', 'normal'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
        [apiUserCreateId, '用户创建', '/api/users', 'POST', '创建新用户', 'high'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
        [apiFinanceReportId, '财务报表', '/api/finance/report', 'GET', '查看财务报表', 'high'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
        [apiSystemConfigId, '系统配置', '/api/system/config', 'PUT', '修改系统配置', 'critical'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO api_resources (id, name, path, method, description, sensitivity_level) VALUES (?, ?, ?, ?, ?, ?)`,
        [apiLogQueryId, '日志查询', '/api/logs', 'GET', '查询系统日志', 'normal'],
        (err) => err ? reject(err) : resolve()
      );
    })
  ]);
  console.log('✅ API资源创建完成');

  const pkgBasicId = 'pkg-basic';
  const pkgAdvancedId = 'pkg-advanced';
  const pkgFinanceId = 'pkg-finance';
  const pkgAdminId = 'pkg-admin';

  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO permission_packages (id, name, description, tenant_id, is_inheritable) VALUES (?, ?, ?, ?, ?)`,
        [pkgBasicId, '基础权限包', '员工基础权限', tenantId, 1],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO permission_packages (id, name, description, tenant_id, is_inheritable) VALUES (?, ?, ?, ?, ?)`,
        [pkgAdvancedId, '开发权限包', '开发人员高级权限', tenantId, 0],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO permission_packages (id, name, description, tenant_id, is_inheritable) VALUES (?, ?, ?, ?, ?)`,
        [pkgFinanceId, '财务权限包', '财务部门专用权限', tenantId, 0],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO permission_packages (id, name, description, tenant_id, is_inheritable) VALUES (?, ?, ?, ?, ?)`,
        [pkgAdminId, '管理员权限包', '系统完整权限', tenantId, 1],
        (err) => err ? reject(err) : resolve()
      );
    })
  ]);
  console.log('✅ 权限包创建完成');

  const perms = [
    { packageId: pkgBasicId, apiId: apiUserListId, level: 'read' },
    { packageId: pkgBasicId, apiId: apiLogQueryId, level: 'read' },
    { packageId: pkgAdvancedId, apiId: apiUserCreateId, level: 'write' },
    { packageId: pkgFinanceId, apiId: apiFinanceReportId, level: 'admin' },
    { packageId: pkgAdminId, apiId: apiUserListId, level: 'admin' },
    { packageId: pkgAdminId, apiId: apiUserCreateId, level: 'admin' },
    { packageId: pkgAdminId, apiId: apiSystemConfigId, level: 'admin' },
    { packageId: pkgAdminId, apiId: apiLogQueryId, level: 'admin' },
  ];

  for (let i = 0; i < perms.length; i++) {
    const p = perms[i];
    await new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO package_permissions (id, package_id, api_resource_id, access_level) VALUES (?, ?, ?, ?)`,
        [`perm-${i}`, p.packageId, p.apiId, p.level],
        (err) => err ? reject(err) : resolve()
      );
    });
  }
  console.log('✅ 包权限配置完成');

  await Promise.all([
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
        ['rp-admin-basic', roleAdminId, pkgAdminId, 'system'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
        ['rp-dev-basic', roleDevId, pkgBasicId, 'system'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
        ['rp-dev-advanced', roleDevId, pkgAdvancedId, 'system'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
        ['rp-finance-basic', roleFinanceId, pkgBasicId, 'system'],
        (err) => err ? reject(err) : resolve()
      );
    }),
    new Promise((resolve, reject) => {
      db.run(`INSERT OR REPLACE INTO role_permissions (id, role_id, package_id, assigned_by) VALUES (?, ?, ?, ?)`,
        ['rp-finance-pkg', roleFinanceId, pkgFinanceId, 'system'],
        (err) => err ? reject(err) : resolve()
      );
    })
  ]);
  console.log('✅ 角色权限分配完成');

  console.log('\n🎉 数据初始化完成！');
  console.log(`租户ID: ${tenantId}`);
  console.log(`技术部ID: ${deptTechId}`);
  console.log(`财务部ID: ${deptFinanceId}`);
  console.log(`后端开发组ID: ${deptBackendId}`);
  console.log(`技术总监角色ID: ${roleAdminId}`);
  console.log(`后端开发工程师角色ID: ${roleDevId}`);
  console.log(`财务专员角色ID: ${roleFinanceId}`);
  
  process.exit(0);
};

seedData().catch(err => {
  console.error('数据初始化失败:', err);
  process.exit(1);
});
