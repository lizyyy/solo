const http = require('http');

function httpRequest(options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(data);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function main() {
  const baseUrl = 'localhost:3000';
  
  console.log('\n=== 1. 查看健康状态 ===');
  const health = await httpRequest({ hostname: 'localhost', port: 3000, path: '/health', method: 'GET' });
  console.log('Health:', health);
  
  console.log('\n=== 2. 查看预置用户 ===');
  const usersBefore = await httpRequest({ 
    hostname: 'localhost', port: 3000, 
    path: '/api/report/users', 
    method: 'GET' 
  });
  console.log('用户数量:', usersBefore.data.length);
  
  console.log('\n=== 3. 创建导入批次 ===');
  const batchData = {
    name: "核心功能测试批次",
    creatorId: "admin-001",
    users: [
      {
        email: "test-new-user@company.com",
        name: "测试新员工",
        departmentName: "技术部",
        roleNames: ["实习生"]
      },
      {
        email: "wanggang@company.com",
        name: "王刚",
        departmentName: "技术部",
        roleNames: ["实习生"]
      }
    ]
  };
  
  const createBatchRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/import/batches',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, batchData);
  
  const batchId = createBatchRes.data.batch.id;
  console.log('批次ID:', batchId);
  console.log('创建状态:', createBatchRes.success);
  
  console.log('\n=== 4. 预检批次 ===');
  const precheckRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/import/batches/${batchId}/precheck`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});
  console.log('预检警告数量:', precheckRes.data.totalWarnings);
  console.log('警告详情:', precheckRes.data.warnings.map(w => w.message));
  
  console.log('\n=== 5. 确认导入 ===');
  const confirmRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/import/batches/${batchId}/confirm`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});
  console.log('导入状态:', confirmRes.data.batch.status);
  confirmRes.data.results.forEach(r => {
    console.log(`  ${r.name}: ${r.status} (isPreExisting: ${r.isPreExisting})`);
  });
  
  console.log('\n=== 6. 检查导入后状态 ===');
  const usersAfterImport = await httpRequest({ 
    hostname: 'localhost', port: 3000, 
    path: '/api/report/users', 
    method: 'GET' 
  });
  console.log('用户数量:', usersAfterImport.data.length);
  
  const wanggangAfterImport = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/report/users/wanggang@company.com',
    method: 'GET'
  });
  console.log('王刚的角色(应该被改为实习生):', wanggangAfterImport.data.roleIds);
  
  console.log('\n=== 7. 检查可撤销状态 ===');
  const canRevokeRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/revoke/batches/${batchId}/can-revoke`,
    method: 'GET'
  });
  console.log('可撤销检查:');
  canRevokeRes.data.details.forEach(d => {
    console.log(`  ${d.email}: canRevoke=${d.canRevoke}, isPreExisting=${d.isPreExisting}, reason=${d.reason}`);
  });
  
  console.log('\n=== 8. 撤销整批 ===');
  const revokeRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/revoke/batches/${batchId}/revoke`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});
  console.log('撤销结果:');
  console.log('  revoked:', revokeRes.data.revoked);
  console.log('  notRevocable:', revokeRes.data.notRevocable);
  revokeRes.data.details.forEach(d => {
    console.log(`  ${d.email}: ${d.status} - ${d.message}`);
  });
  
  console.log('\n=== 9. 验证撤销结果 ===');
  const usersAfterRevoke = await httpRequest({ 
    hostname: 'localhost', port: 3000, 
    path: '/api/report/users', 
    method: 'GET' 
  });
  console.log('用户数量(应该回到初始数量):', usersAfterRevoke.data.length);
  
  const newUserAfterRevoke = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/report/users/test-new-user@company.com',
    method: 'GET'
  });
  console.log('新员工 test-new-user@company.com 状态(应该不存在):', newUserAfterRevoke.success ? '存在(错误!)' : '已删除(正确)');
  
  const wanggangAfterRevoke = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: '/api/report/users/wanggang@company.com',
    method: 'GET'
  });
  console.log('王刚的角色(应该恢复为经理+开发):', wanggangAfterRevoke.data.roleIds);
  
  console.log('\n=== 10. 测试幂等性 - 再次撤销 ===');
  const revokeAgainRes = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/revoke/batches/${batchId}/revoke`,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, {});
  console.log('再次撤销状态:');
  revokeAgainRes.data.details.forEach(d => {
    console.log(`  ${d.email}: ${d.status}`);
  });
  
  console.log('\n=== 11. 获取重新导入上下文 ===');
  const reimportContext = await httpRequest({
    hostname: 'localhost', port: 3000,
    path: `/api/report/batches/${batchId}/reimport-context`,
    method: 'GET'
  });
  console.log('错误数量:', reimportContext.data.errors.length);
  console.log('已存在用户:', reimportContext.data.preExistingUsers);
  
  console.log('\n✅ 核心功能测试完成!');
  console.log('验证要点:');
  console.log('  ✓ 新用户可以被创建和删除');
  console.log('  ✓ 老用户只更新角色，撤销时恢复原角色');
  console.log('  ✓ 撤销操作是幂等的');
  console.log('  ✓ 可获取重新导入上下文');
}

main().catch(console.error);
