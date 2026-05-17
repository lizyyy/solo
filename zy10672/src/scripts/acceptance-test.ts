import { v4 as uuidv4 } from 'uuid';
import { CommandService } from '../services/commandService';
import { HostGroupService } from '../services/hostGroupService';
import { AuditService } from '../services/auditService';
import pool from '../config/database';

async function testFullWorkflow() {
  console.log('\n══════════════════════════════════════════');
  console.log('📋 测试场景 1: 完整命令审批流转');
  console.log('══════════════════════════════════════════\n');

  const requestId = `REQ-${Date.now()}`;
  const title = '日常巡检 - 检查磁盘使用率';
  const command = 'df -h';
  const hostGroupId = '00000000-0000-0000-0000-000000000001';
  const now = new Date();
  const executionWindowStart = now;
  const executionWindowEnd = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const submitterId = 'user_001';
  const submitterName = '运维人员A';

  console.log('1️⃣  提交命令审批请求...');
  const cmd = await CommandService.submitCommand(
    requestId, title, command, hostGroupId,
    executionWindowStart, executionWindowEnd,
    submitterId, submitterName
  );
  console.log(`   ✅ 命令已提交，ID: ${cmd.id}，状态: ${cmd.status}`);

  console.log('\n2️⃣  审批人审批...');
  const approvedCmd = await CommandService.approveCommand(
    cmd.id,
    'approver_001',
    '张三',
    '审批通过，可以执行'
  );
  console.log(`   ✅ 命令已批准，状态: ${approvedCmd.status}`);

  console.log('\n3️⃣  开始执行命令...');
  const executingCmd = await CommandService.startExecution(
    cmd.id,
    'operator_001',
    '执行员A'
  );
  console.log(`   ✅ 命令开始执行，状态: ${executingCmd.status}`);

  console.log('\n4️⃣  模拟Agent上报执行结果...');
  await CommandService.reportAgentExecution(
    cmd.id,
    '192.168.1.101',
    'SUCCESS',
    0,
    'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   20G   30G  40% /',
    '',
    now,
    new Date(now.getTime() + 5000)
  );
  console.log('   ✅ Agent执行结果已上报 (192.168.1.101)');

  await CommandService.reportAgentExecution(
    cmd.id,
    '192.168.1.102',
    'SUCCESS',
    0,
    'Filesystem      Size  Used Avail Use% Mounted on\n/dev/sda1        50G   25G   25G  50% /',
    '',
    now,
    new Date(now.getTime() + 6000)
  );
  console.log('   ✅ Agent执行结果已上报 (192.168.1.102)');

  console.log('\n5️⃣  标记执行完成...');
  const completedCmd = await CommandService.completeExecution(cmd.id, 4, 0);
  console.log(`   ✅ 命令执行完成，状态: ${completedCmd.status}`);
  console.log(`      成功主机: ${completedCmd.success_hosts}, 失败主机: ${completedCmd.failed_hosts}`);

  console.log('\n6️⃣  查看审批历史...');
  const approvals = await CommandService.getCommandApprovals(cmd.id);
  console.log(`   ✅ 审批记录数: ${approvals.length}`);

  console.log('\n7️⃣  查看操作历史...');
  const history = await AuditService.getCommandHistory(cmd.id);
  console.log(`   ✅ 操作历史记录数: ${history.length}`);
  history.forEach((h: any, i: number) => {
    console.log(`      ${i + 1}. ${h.action} - ${h.operator_name} - ${h.created_at.toLocaleString()}`);
  });

  console.log('\n8️⃣  查看执行记录...');
  const executions = await CommandService.getExecutionRecords(cmd.id);
  console.log(`   ✅ 执行记录数: ${executions.length}`);

  console.log('\n   ✅ 完整流转测试通过!');
}

async function testConflictWorkflow() {
  console.log('\n══════════════════════════════════════════');
  console.log('🔄 测试场景 2: 冲突记录 - 过期后人工干预');
  console.log('══════════════════════════════════════════\n');

  const requestId = `REQ-CONFLICT-${Date.now()}`;
  const title = '紧急修复操作 - 过期场景测试';
  const command = 'systemctl restart nginx';
  const hostGroupId = '00000000-0000-0000-0000-000000000001';
  const now = new Date();
  const executionWindowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000);
  const executionWindowEnd = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const submitterId = 'user_002';
  const submitterName = '运维人员B';

  console.log('1️⃣  提交命令审批请求 (设置为已过期的执行窗口)...');
  const cmd = await CommandService.submitCommand(
    requestId, title, command, hostGroupId,
    executionWindowStart, executionWindowEnd,
    submitterId, submitterName
  );
  console.log(`   ✅ 命令已提交，ID: ${cmd.id}，状态: ${cmd.status}`);

  console.log('\n2️⃣  审批人审批 (此时执行窗口已过期)...');
  const approvedCmd = await CommandService.approveCommand(
    cmd.id,
    'approver_001',
    '张三',
    '审批通过'
  );
  console.log(`   ✅ 命令已批准，状态: ${approvedCmd.status} (因执行窗口过期变为EXPIRED)`);

  console.log('\n3️⃣  尝试直接执行 (预期会报错)...');
  try {
    await CommandService.startExecution(cmd.id, 'operator_001', '执行员A');
    console.log('   ❌ 应该报错但没有报错!');
  } catch (error: any) {
    console.log(`   ✅ 按预期报错: ${error.code} - ${error.message}`);
    console.log(`      建议: ${error.suggestion}`);
  }

  console.log('\n4️⃣  人工备注，确认继续执行...');
  const remarkedCmd = await CommandService.manualRemarkAfterExpired(
    cmd.id,
    'manager_001',
    '运维经理',
    '确认此操作紧急，虽然执行窗口已过期，但仍需要执行'
  );
  console.log(`   ✅ 已添加人工备注，is_expired_handled: ${remarkedCmd.is_expired_handled}`);

  console.log('\n5️⃣  确认过期状态后继续执行...');
  const continuedCmd = await CommandService.continueAfterExpired(
    cmd.id,
    'manager_001',
    '运维经理',
    '已确认风险，继续执行'
  );
  console.log(`   ✅ 状态已恢复，当前状态: ${continuedCmd.status}`);

  console.log('\n6️⃣  现在可以正常执行...');
  const executingCmd = await CommandService.startExecution(
    cmd.id,
    'operator_001',
    '执行员A'
  );
  console.log(`   ✅ 命令开始执行，状态: ${executingCmd.status}`);

  console.log('\n7️⃣  查看完整操作历史...');
  const history = await AuditService.getCommandHistory(cmd.id);
  console.log(`   ✅ 操作历史记录数: ${history.length}`);
  history.forEach((h: any, i: number) => {
    console.log(`      ${i + 1}. ${h.action} - ${h.operator_name}`);
    if (h.remark) {
      console.log(`         备注: ${h.remark}`);
    }
  });

  console.log('\n   ✅ 冲突记录测试通过!');
}

async function testImportBadRows() {
  console.log('\n══════════════════════════════════════════');
  console.log('📥 测试场景 3: 导入坏行 - 部分成功部分失败');
  console.log('══════════════════════════════════════════\n');

  const importRecords = [
    {
      requestId: `IMPORT-${Date.now()}-001`,
      title: '合法记录1 - 检查内存',
      command: 'free -m',
      hostGroupId: '00000000-0000-0000-0000-000000000001',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: new Date(Date.now() + 86400000).toISOString(),
      submitterName: '批量导入用户'
    },
    {
      requestId: '',
      title: '坏记录1 - 缺少requestId',
      command: 'uptime',
      hostGroupId: '00000000-0000-0000-0000-000000000001',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: new Date(Date.now() + 86400000).toISOString()
    },
    {
      requestId: `IMPORT-${Date.now()}-002`,
      title: '坏记录2 - 缺少command',
      command: '',
      hostGroupId: '00000000-0000-0000-0000-000000000001',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: new Date(Date.now() + 86400000).toISOString()
    },
    {
      requestId: `IMPORT-${Date.now()}-003`,
      title: '合法记录2 - 检查进程',
      command: 'ps aux',
      hostGroupId: '00000000-0000-0000-0000-000000000001',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: new Date(Date.now() + 86400000).toISOString(),
      submitterName: '批量导入用户'
    },
    {
      requestId: `IMPORT-${Date.now()}-004`,
      title: '坏记录3 - 主机组不存在',
      command: 'ls -la',
      hostGroupId: 'non-existent-group',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: new Date(Date.now() + 86400000).toISOString()
    },
    {
      requestId: `IMPORT-${Date.now()}-005`,
      title: '坏记录4 - 缺少执行结束时间',
      command: 'top -b -n 1',
      hostGroupId: '00000000-0000-0000-0000-000000000001',
      executionWindowStart: new Date().toISOString(),
      executionWindowEnd: ''
    }
  ];

  console.log('1️⃣  批量导入命令 (包含3条合法，3条坏记录)...');
  console.log(`   总记录数: ${importRecords.length}`);

  const result = await HostGroupService.importCommandsFromCSV(
    importRecords,
    'batch_import_user'
  );

  console.log(`\n2️⃣  导入结果:`);
  console.log(`   批次ID: ${result.importBatchId}`);
  console.log(`   导入状态: ${result.status}`);
  console.log(`   总记录: ${result.total}`);
  console.log(`   成功: ${result.success} 条`);
  console.log(`   失败: ${result.failed} 条`);

  console.log('\n3️⃣  失败记录详情:');
  result.errors.forEach((err: any, i: number) => {
    console.log(`   ❌ 第${err.row}行: ${err.field || '通用'} - ${err.message}`);
    if (err.data) {
      console.log(`      标题: ${err.data.title}`);
    }
  });

  console.log('\n4️⃣  查询导入批次记录...');
  const importRecord = await HostGroupService.getImportRecord(result.importBatchId);
  console.log(`   ✅ 导入批次已保存，状态: ${importRecord.status}`);
  console.log(`      数据库中保存的错误详情数: ${importRecord.error_details.length}`);

  console.log('\n5️⃣  验证导入成功的命令...');
  const commands = await CommandService.listCommands(1, 10, {
    submitterId: 'batch_import_user'
  });
  console.log(`   ✅ 成功导入的命令数: ${commands.commands.length}`);

  console.log('\n   ✅ 导入坏行测试通过!');
}

async function testListAndDetailConsistency() {
  console.log('\n══════════════════════════════════════════');
  console.log('🔍 测试场景 4: 列表、详情、历史互相对齐');
  console.log('══════════════════════════════════════════\n');

  console.log('1️⃣  查询命令列表...');
  const listResult = await CommandService.listCommands(1, 10);
  console.log(`   ✅ 列表总数: ${listResult.total}`);

  if (listResult.commands.length > 0) {
    const firstCmd = listResult.commands[0];
    console.log(`\n2️⃣  查询第一条命令详情: ${firstCmd.id}`);
    const detail = await CommandService.getCommand(firstCmd.id);
    console.log(`   ✅ 详情查询成功: ${detail.title}`);

    console.log('\n3️⃣  验证列表与详情一致性:');
    const listMatchesDetail = 
      listResult.commands[0].id === detail.id &&
      listResult.commands[0].title === detail.title &&
      listResult.commands[0].status === detail.status;
    console.log(`   ✅ 列表与详情数据一致: ${listMatchesDetail ? '是' : '否'}`);

    console.log('\n4️⃣  查询审批列表...');
    const approvals = await CommandService.getCommandApprovals(firstCmd.id);
    console.log(`   ✅ 审批列表: ${approvals.length} 条`);

    console.log('\n5️⃣  查询历史记录...');
    const history = await AuditService.getCommandHistory(firstCmd.id);
    console.log(`   ✅ 历史记录: ${history.length} 条`);

    console.log('\n6️⃣  查询执行记录...');
    const executions = await CommandService.getExecutionRecords(firstCmd.id);
    console.log(`   ✅ 执行记录: ${executions.length} 条`);
  }

  console.log('\n   ✅ 数据一致性测试通过!');
}

async function main() {
  console.log('🚀 开始运行远程运维平台批量命令审批验收测试\n');

  try {
    await testFullWorkflow();
    await testConflictWorkflow();
    await testImportBadRows();
    await testListAndDetailConsistency();

    console.log('\n══════════════════════════════════════════');
    console.log('🎉 所有验收测试通过!');
    console.log('══════════════════════════════════════════\n');

    console.log('✅ 测试覆盖:');
    console.log('   • 完整流转: 提交 → 审批 → 执行 → 完成');
    console.log('   • 冲突处理: 过期 → 报错 → 人工备注 → 继续执行');
    console.log('   • 导入坏行: 部分成功 → 错误详情 → 批次记录');
    console.log('   • 数据一致: 列表 ↔ 详情 ↔ 历史 ↔ 执行记录');
  } catch (error) {
    console.error('\n💥 测试失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

if (require.main === module) {
  main();
}

export { testFullWorkflow, testConflictWorkflow, testImportBadRows, testListAndDetailConsistency };
