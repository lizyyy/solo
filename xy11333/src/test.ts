import { db } from './storage/database';
import { importService } from './services/importService';
import { taskService } from './services/taskService';
import { securityService } from './services/securityService';
import { exportService } from './services/exportService';
import * as path from 'path';

async function runTests() {
  console.log('='.repeat(60));
  console.log('门诊服务台台账系统 - 功能测试');
  console.log('='.repeat(60));

  console.log('\n📁 测试1: 导入陪检员数据（JSON）');
  console.log('-'.repeat(60));
  const escortsResult = await importService.importEscortsFromJson(
    path.join(__dirname, '../data/escorts.json'),
    'admin'
  );
  console.log(`成功: ${escortsResult.successCount} 条`);
  console.log(`失败: ${escortsResult.failedCount} 条`);
  console.log(`警告: ${escortsResult.warningCount} 条`);
  console.log(`批次ID: ${escortsResult.batchId}`);

  if (escortsResult.failedCount > 0) {
    const importReport = importService.getImportReport(escortsResult.batchId);
    console.log('\n失败记录详情:');
    importReport.failedRecords.forEach(r => {
      console.log(`  行${r.originalIndex}: ${JSON.stringify(r.errors)}`);
    });
  }

  console.log('\n📋 测试2: 导入预约单数据（CSV）');
  console.log('-'.repeat(60));
  const appointmentsResult = await importService.importAppointmentsFromCsv(
    path.join(__dirname, '../data/appointments.csv'),
    'admin'
  );
  console.log(`成功: ${appointmentsResult.successCount} 条`);
  console.log(`失败: ${appointmentsResult.failedCount} 条`);
  console.log(`警告: ${appointmentsResult.warningCount} 条`);
  console.log(`批次ID: ${appointmentsResult.batchId}`);

  if (appointmentsResult.warningCount > 0) {
    const importReport = importService.getImportReport(appointmentsResult.batchId);
    console.log('\n警告记录详情:');
    importReport.warningRecords.forEach(r => {
      console.log(`  行${r.originalIndex}: ${JSON.stringify(r.errors)}`);
    });
  }

  console.log('\n🏥 测试3: 从预约单创建陪检任务');
  console.log('-'.repeat(60));
  const appointments = appointmentsResult.records;
  const tasks = [];
  for (const apt of appointments.slice(0, 5)) {
    const task = taskService.createTaskFromAppointment(apt.id, {
      createdBy: 'admin',
    });
    if (task) {
      tasks.push(task);
      console.log(`创建任务: ${task.taskNo} - ${task.patientName}`);
    }
  }

  console.log('\n👤 测试4: 获取陪检员列表（脱敏演示）');
  console.log('-'.repeat(60));
  const allEscorts = db.getAllEscorts();
  console.log('Guest权限:');
  console.log(securityService.maskEscorts(allEscorts.slice(0, 2), 'guest'));
  console.log('\nAdmin权限:');
  console.log(securityService.maskEscorts(allEscorts.slice(0, 2), 'admin'));

  console.log('\n📋 测试5: 任务分配与接单流程');
  console.log('-'.repeat(60));
  if (tasks.length > 0 && allEscorts.length > 0) {
    const task1 = tasks[0];
    const escort1 = allEscorts[0];
    console.log(`分配任务 ${task1.taskNo} 给陪检员 ${escort1.name}`);
    const assigned = taskService.assignTask({
      taskId: task1.id,
      escortId: escort1.id,
      operator: 'admin',
      operatorLevel: 'admin',
      reason: '自动分配',
    });
    console.log('分配后状态:', assigned?.status);

    console.log(`\n陪检员接单: ${task1.taskNo}`);
    const accepted = taskService.acceptTask({
      taskId: task1.id,
      operator: escort1.name,
      operatorLevel: 'staff',
    });
    console.log('接单后状态:', accepted?.status);
    console.log('等待时长(分钟):', accepted?.waitDuration);
  }

  console.log('\n✅ 测试6: 完成任务');
  console.log('-'.repeat(60));
  if (tasks.length > 0) {
    const task1 = tasks[0];
    const completed = taskService.completeTask({
      taskId: task1.id,
      operator: 'system',
      operatorLevel: 'admin',
    });
    console.log('完成后状态:', completed?.status);
    console.log('实际用时(分钟):', completed?.actualDuration);
  }

  console.log('\n❌ 测试7: 取消任务');
  console.log('-'.repeat(60));
  if (tasks.length > 1) {
    const task2 = tasks[1];
    const cancelled = taskService.cancelTask({
      taskId: task2.id,
      operator: 'admin',
      operatorLevel: 'admin',
      cancelReason: '患者临时取消检查',
    });
    console.log('取消后状态:', cancelled?.status);
    console.log('取消原因:', cancelled?.cancelReason);
  }

  console.log('\n🚀 测试8: 插队任务（紧急任务）');
  console.log('-'.repeat(60));
  if (appointments.length > 3) {
    const insertedTask = taskService.insertTask({
      appointmentId: appointments[3].id,
      createdBy: 'nurse',
      insertReason: '急诊患者，需要优先陪检',
    });
    console.log('插队任务编号:', insertedTask?.taskNo);
    console.log('是否插队:', insertedTask?.isInserted);
    console.log('插队原因:', insertedTask?.insertReason);
    console.log('优先级:', insertedTask?.priority);
  }

  console.log('\n📊 测试9: 任务统计');
  console.log('-'.repeat(60));
  const stats = taskService.getTaskStatistics();
  console.log('总任务数:', stats.total);
  console.log('待处理:', stats.pending);
  console.log('已分配:', stats.assigned);
  console.log('进行中:', stats.inProgress);
  console.log('已完成:', stats.completed);
  console.log('已取消:', stats.cancelled);
  console.log('已超时:', stats.timeout);
  console.log('平均等待时长(分钟):', stats.avgWaitTime.toFixed(1));
  console.log('平均处理时长(分钟):', stats.avgDuration.toFixed(1));

  console.log('\n📜 测试10: 操作历史记录');
  console.log('-'.repeat(60));
  if (tasks.length > 0) {
    const history = taskService.getTaskHistory(tasks[0].id);
    console.log(`任务 ${tasks[0].taskNo} 的操作历史 (${history.length} 条):`);
    history.forEach(h => {
      console.log(`  [${new Date(h.timestamp).toLocaleString()}] ${h.operator} - ${h.action}`);
      if (h.reason) console.log(`    原因: ${h.reason}`);
    });
  }

  console.log('\n📤 测试11: 导出任务数据');
  console.log('-'.repeat(60));
  const exportResult = exportService.exportTasks({
    format: 'json',
    userLevel: 'guest',
    includeSensitive: false,
  });
  console.log(`导出成功: ${exportResult.count} 条记录`);
  if (exportResult.data) {
    const saved = exportService.saveToFile(
      exportResult.data,
      path.join(__dirname, '../output/tasks_export.json')
    );
    console.log('文件已保存:', saved ? '成功' : '失败');
  }

  console.log('\n⚠️  测试12: 查看未解决错误日志');
  console.log('-'.repeat(60));
  const errors = db.getUnresolvedErrors();
  console.log(`未解决错误: ${errors.length} 条`);
  errors.forEach(e => {
    console.log(`  [${e.errorType}] ${e.errorCode}: ${e.message}`);
  });

  console.log('\n🔐 测试13: 权限验证');
  console.log('-'.repeat(60));
  console.log('Guest是否可以分配任务:', securityService.canPerformAction('guest', 'assign', 'task'));
  console.log('Staff是否可以分配任务:', securityService.canPerformAction('staff', 'assign', 'task'));
  console.log('Guest是否可以导出数据:', securityService.canPerformAction('guest', 'export', 'task'));
  console.log('Manager是否可以导出数据:', securityService.canPerformAction('manager', 'export', 'task'));

  console.log('\n🔄 测试14: 数据持久化验证（重启前数据）');
  console.log('-'.repeat(60));
  console.log('当前陪检员数量:', db.getAllEscorts().length);
  console.log('当前任务数量:', taskService.getTaskStatistics().total);
  console.log('待处理任务数量:', taskService.getPendingTasks().length);
  console.log('\n✅ 所有测试完成！数据已保存到数据库。');
  console.log('📁 数据库文件: outpatient_ledger.db');
  console.log('='.repeat(60));
}

runTests().catch(console.error);
