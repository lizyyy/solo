const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE_URL = 'http://localhost:3000';

function curl(method, endpoint, data = null, isFile = false) {
  let cmd = `curl -s -X ${method} ${BASE_URL}${endpoint}`;
  if (data && !isFile) {
    cmd += ` -H "Content-Type: application/json" -d '${JSON.stringify(data)}'`;
  }
  if (data && isFile) {
    cmd += ` -F "file=@${data}"`;
  }
  try {
    const result = execSync(cmd, { encoding: 'utf8' });
    return JSON.parse(result);
  } catch (e) {
    return { error: e.message };
  }
}

async function runTests() {
  console.log('=== 开放平台权限降级服务 验收测试 ===\n');

  console.log('1. 完整流程测试 (APP_FLOW_001)');
  console.log('   创建应用...');
  const createResult = curl('POST', '/api/applications', {
    app_id: 'APP_FLOW_001',
    app_name: '流程测试应用',
    owner: '测试员',
    permissions: [
      { permission_key: 'api.read', permission_name: '接口读取', original_level: 3, target_level: 1 },
      { permission_key: 'api.write', permission_name: '接口写入', original_level: 3, target_level: 1 }
    ]
  });
  console.log('   结果:', createResult);

  console.log('\n   提交降级申请...');
  const downgradeResult = curl('POST', '/api/applications/APP_FLOW_001/downgrade', {
    downgrade_reason: '接口调用异常，需要降权观察',
    audit_opinion: '同意进入待审核状态',
    operator: '审核员A',
    old_token_high_permission: false
  });
  console.log('   结果:', downgradeResult);

  console.log('\n   审核通过执行降级...');
  const approveResult = curl('POST', '/api/applications/APP_FLOW_001/approve-downgrade', {
    operator: '审核员B',
    audit_opinion: '情况属实，执行降级'
  });
  console.log('   结果:', approveResult);

  console.log('\n   提交恢复申请...');
  const requestRestoreResult = curl('POST', '/api/applications/APP_FLOW_001/request-restore', {
    operator: '应用开发者',
    reason: '问题已修复，申请恢复权限'
  });
  console.log('   结果:', requestRestoreResult);

  console.log('\n   审核恢复...');
  const restoreResult = curl('POST', '/api/applications/APP_FLOW_001/restore', {
    operator: '审核员B',
    audit_opinion: '验证通过，恢复权限'
  });
  console.log('   结果:', restoreResult);

  console.log('\n   查看状态历史...');
  const historyResult = curl('GET', '/api/applications/APP_FLOW_001/history');
  console.log('   历史记录数:', historyResult.data?.length || 0);

  console.log('\n2. 冲突记录测试 (APP_CONFLICT_001)');
  console.log('   创建应用...');
  curl('POST', '/api/applications', {
    app_id: 'APP_CONFLICT_001',
    app_name: '冲突测试应用',
    owner: '测试员'
  });

  console.log('   提交降级申请（带冲突）...');
  const conflictResult = curl('POST', '/api/applications/APP_CONFLICT_001/downgrade', {
    downgrade_reason: '存在安全风险需要降级',
    audit_opinion: '检测到高权限旧token',
    operator: '审核员A',
    old_token_high_permission: true
  });
  console.log('   conflict_detected:', conflictResult.conflict_detected);
  console.log('   conflict_details:', conflictResult.conflict_details);

  console.log('\n   查看详情验证...');
  const detailResult = curl('GET', '/api/applications/APP_CONFLICT_001');
  const hasConflictRecord = detailResult.downgrade_records?.some(r => r.conflict_detected === 1);
  console.log('   降级记录包含冲突标记:', hasConflictRecord);

  console.log('\n3. 导入坏行测试');
  const csvContent = `app_id,app_name,owner,status
APP_IMPORT_001,导入成功应用,导入者,normal
,缺少app_id的应用,导入者,normal
APP_IMPORT_003,,缺少名称的应用,normal
APP_IMPORT_004,缺少owner的应用,,normal
APP_IMPORT_005,导入成功应用2,导入者2,downgrade_pending`;
  
  const csvPath = path.join(__dirname, '..', 'test_import.csv');
  fs.writeFileSync(csvPath, csvContent, 'utf8');
  console.log('   测试CSV已创建');

  console.log('   执行导入...');
  let cmd = `curl -s -X POST ${BASE_URL}/api/import -F "file=@${csvPath}"`;
  const importResult = JSON.parse(execSync(cmd, { encoding: 'utf8' }));
  console.log('   成功:', importResult.success);
  console.log('   失败:', importResult.failed);
  console.log('   错误数:', importResult.errors?.length || 0);
  fs.unlinkSync(csvPath);

  console.log('\n4. 导出测试');
  const exportCmd = `curl -s ${BASE_URL}/api/export`;
  const exportResult = execSync(exportCmd, { encoding: 'utf8' });
  console.log('   导出CSV行数:', exportResult.split('\n').length);

  console.log('\n5. 数据一致性检查');
  const listResult = curl('GET', '/api/applications?page=1&limit=20');
  console.log('   列表总记录数:', listResult.total);
  
  const statsResult = curl('GET', '/api/status-stats');
  console.log('   各状态统计:', statsResult.data);

  console.log('\n=== 测试完成 ===');
  console.log('\n请核对：');
  console.log('- 完整流程应用状态是否经过 normal -> downgrade_pending -> downgraded -> restore_request -> normal');
  console.log('- 冲突应用是否标记了 conflict_detected = true');
  console.log('- 导入是否成功 2 条，失败 3 条');
  console.log('- 列表、详情、历史、导出数据是否一致');
}

runTests().catch(console.error);
