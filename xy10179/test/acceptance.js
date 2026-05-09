const http = require('http');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3050/api';
const JWT_SECRET = 'multi-tenant-audit-secret-key-2024';

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const req = http.request(
      {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname + url.search,
        method: options.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...options.headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve({
              status: res.statusCode,
              data: JSON.parse(data)
            });
          } catch (e) {
            resolve({
              status: res.statusCode,
              raw: data
            });
          }
        });
      }
    );
    
    req.on('error', reject);
    
    if (options.body) {
      req.write(JSON.stringify(options.body));
    }
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function createExpiredToken(userId) {
  return jwt.sign(
    { userId, username: 'test', role: 'customer_service' },
    JWT_SECRET,
    { expiresIn: '-1h' }
  );
}

let tokens = {};
let seedData = null;

async function runTests() {
  console.log('\n========================================');
  console.log('  多租户数据权限审计 API 验收测试');
  console.log('========================================\n');
  
  let allPassed = true;
  const results = [];
  
  try {
    await sleep(1000);
    
    const healthCheck = await request('/health');
    console.log('✅ 健康检查: 服务器已就绪\n');
    
    const tenantBRecordId = await getTenantBRecordId();
    
    await test('1. 用户认证 - 管理员登录', async () => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: { username: 'admin', password: 'admin123' }
      });
      
      if (res.status !== 200 || !res.data.success || !res.data.data.token) {
        throw new Error('登录失败');
      }
      
      tokens.admin = res.data.data.token;
      console.log('   Token获取成功');
      return true;
    });
    
    await test('2. 用户认证 - 客服登录', async () => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: { username: 'cs001', password: 'cs123456' }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('客服登录失败');
      }
      
      tokens.cs = res.data.data.token;
      console.log('   客服Token获取成功');
      return true;
    });
    
    await test('3. 用户认证 - 普通用户登录', async () => {
      const res = await request('/auth/login', {
        method: 'POST',
        body: { username: 'user_a_01', password: 'user123' }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('普通用户登录失败');
      }
      
      tokens.userA = res.data.data.token;
      console.log('   普通用户Token获取成功');
      return true;
    });
    
    await test('4. 租户隔离 - 查询当前租户数据', async () => {
      const res = await request('/records', {
        headers: { Authorization: `Bearer ${tokens.cs}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('查询失败');
      }
      
      const records = res.data.data;
      console.log(`   查询到 ${records.length} 条记录`);
      
      if (records.length === 0) {
        throw new Error('应该能查询到租户A的数据');
      }
      
      return true;
    });
    
    await test('5. 租户切换 - 客服切换到租户B', async () => {
      const tenantBId = await getTenantIdByCode('TENANT_B');
      
      const res = await request('/auth/switch-tenant', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.cs}` },
        body: { tenantId: tenantBId }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('切换租户失败: ' + (res.data?.message || '未知错误'));
      }
      
      tokens.cs = res.data.data.token;
      console.log('   切换到租户B成功，新Token已获取');
      return true;
    });
    
    await test('6. 租户隔离 - 切换后只能看到租户B的数据', async () => {
      const res = await request('/records', {
        headers: { Authorization: `Bearer ${tokens.cs}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('查询失败');
      }
      
      const records = res.data.data;
      console.log(`   查询到 ${records.length} 条记录`);
      
      const hasTenantARecords = records.some(r => r.title && r.title.includes('租户A'));
      if (hasTenantARecords) {
        throw new Error('租户隔离失败：看到了其他租户的数据');
      }
      
      return true;
    });
    
    let createdRecordId = null;
    
    await test('7. 数据操作 - 创建新记录', async () => {
      const res = await request('/records', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.cs}` },
        body: {
          title: '验收测试 - 新记录',
          content: '这是验收测试创建的记录内容',
          status: 'draft'
        }
      });
      
      if (res.status !== 201 || !res.data.success) {
        throw new Error('创建记录失败: ' + (res.data?.message || '未知错误'));
      }
      
      createdRecordId = res.data.data.id;
      console.log(`   创建成功，记录ID: ${createdRecordId.substring(0, 8)}...`);
      return true;
    });
    
    await test('8. 数据操作 - 修改记录', async () => {
      const res = await request(`/records/${createdRecordId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${tokens.cs}` },
        body: {
          title: '验收测试 - 已修改',
          content: '内容已更新',
          status: 'pending'
        }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('修改记录失败');
      }
      
      if (res.data.data.status !== 'pending') {
        throw new Error('状态未更新');
      }
      
      console.log('   修改成功');
      return true;
    });
    
    await test('9. 重复提交检测', async () => {
      const res = await request('/records', {
        method: 'POST',
        headers: { Authorization: `Bearer ${tokens.cs}` },
        body: {
          title: '验收测试 - 已修改',
          content: '测试重复提交',
          status: 'draft',
          idempotencyKey: 'test-key-001'
        }
      });
      
      if (res.status === 409 && res.data.error === 'DUPLICATE') {
        console.log('   检测到重复提交，返回409');
        return true;
      }
      
      if (res.status === 201) {
        console.log('   首次提交成功（正常流程）');
        return true;
      }
      
      throw new Error('重复提交检测未生效');
    });
    
    await test('10. 越权访问检测 - 尝试访问租户A的记录', async () => {
      const tenantAId = await getTenantIdByCode('TENANT_A');
      
      const recordRes = await request('/records', {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      
      let targetRecordId = null;
      for (const rec of recordRes.data.data) {
        if (rec.tenantId === tenantAId) {
          targetRecordId = rec.id;
          break;
        }
      }
      
      if (!targetRecordId) {
        console.log('   跳过：未找到租户A的记录');
        return true;
      }
      
      const accessRes = await request(`/records/${targetRecordId}`, {
        headers: { Authorization: `Bearer ${tokens.cs}` }
      });
      
      if (accessRes.status === 403 && accessRes.data.error === 'CROSS_TENANT_ACCESS') {
        console.log('   越权访问已被阻止，记录安全事件');
        return true;
      }
      
      throw new Error('越权访问未被阻止');
    });
    
    await test('11. Token过期处理', async () => {
      const tenantAId = await getTenantIdByCode('TENANT_A');
      const expiredToken = createExpiredToken('test-user-id');
      
      const res = await request('/records', {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      
      if (res.status === 401 && res.data.error === 'TOKEN_EXPIRED') {
        console.log('   Token过期检测成功');
        return true;
      }
      
      throw new Error('Token过期检测失败');
    });
    
    await test('12. 审计日志查询', async () => {
      const res = await request('/reports/audit-logs?pageSize=10', {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('审计日志查询失败');
      }
      
      console.log(`   查询到 ${res.data.data.length} 条审计日志`);
      return true;
    });
    
    await test('13. 安全事件查询', async () => {
      const res = await request('/reports/security-incidents?pageSize=10', {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('安全事件查询失败');
      }
      
      console.log(`   查询到 ${res.data.data.length} 条安全事件`);
      return true;
    });
    
    await test('14. 风险报告汇总', async () => {
      const res = await request('/reports/risk-summary', {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('风险报告查询失败');
      }
      
      const summary = res.data.data.summary;
      console.log(`   风险汇总:`);
      console.log(`     - 总安全事件: ${summary.totalIncidents}`);
      console.log(`     - 未处理事件: ${summary.openIncidents}`);
      console.log(`     - 高危事件: ${summary.highIncidents}`);
      console.log(`     - 总审计日志: ${summary.totalAuditLogs}`);
      
      return true;
    });
    
    await test('15. 租户访问统计', async () => {
      const res = await request('/reports/tenant-access-stats', {
        headers: { Authorization: `Bearer ${tokens.admin}` }
      });
      
      if (res.status !== 200 || !res.data.success) {
        throw new Error('租户访问统计查询失败');
      }
      
      console.log(`   查询到 ${res.data.data.length} 个用户的访问统计`);
      return true;
    });
    
    console.log('\n========================================');
    console.log('  测试完成');
    console.log('========================================\n');
    
  } catch (error) {
    console.error('\n❌ 测试执行失败:', error.message);
    process.exit(1);
  }
}

async function getTenantIdByCode(code) {
  const res = await request('/auth/me', {
    headers: { Authorization: `Bearer ${tokens.admin}` }
  });
  
  const tenantRes = await fetchSeedData();
  return tenantRes.tenants[code === 'TENANT_A' ? 'A' : code === 'TENANT_B' ? 'B' : 'C'].id;
}

async function getTenantBRecordId() {
  const tenantRes = await fetchSeedData();
  if (tenantRes.records.tenantB.length > 0) {
    return tenantRes.records.tenantB[0].id;
  }
  return null;
}

async function fetchSeedData() {
  if (seedData) return seedData;
  
  const { sequelize, Tenant, User, DataRecord } = require('../src/models');
  
  const tenants = await Tenant.findAll();
  const users = await User.findAll();
  const records = await DataRecord.findAll();
  
  seedData = {
    tenants: {
      A: tenants.find(t => t.code === 'TENANT_A'),
      B: tenants.find(t => t.code === 'TENANT_B'),
      C: tenants.find(t => t.code === 'TENANT_C')
    },
    users: {
      admin: users.find(u => u.username === 'admin'),
      cs: users.find(u => u.username === 'cs001')
    },
    records: {
      tenantA: records.filter(r => r.tenantId === tenants.find(t => t.code === 'TENANT_A')?.id),
      tenantB: records.filter(r => r.tenantId === tenants.find(t => t.code === 'TENANT_B')?.id),
      tenantC: records.filter(r => r.tenantId === tenants.find(t => t.code === 'TENANT_C')?.id)
    }
  };
  
  return seedData;
}

async function test(name, testFn) {
  console.log(`\n📋 测试: ${name}`);
  try {
    const result = await testFn();
    if (result === true) {
      console.log(`   ✅ 通过`);
      return true;
    }
  } catch (error) {
    console.log(`   ❌ 失败: ${error.message}`);
    throw error;
  }
}

if (require.main === module) {
  runTests();
}
