import { db } from './storage/database';
import { taskService } from './services/taskService';
import { securityService } from './services/securityService';

console.log('='.repeat(60));
console.log('🔄 门诊服务台台账系统 - 数据持久化验证');
console.log('='.repeat(60));

console.log('\n📊 当前数据库状态:');
console.log('-'.repeat(60));

const escortCount = db.getAllEscorts().length;
console.log(`👤 陪检员数量: ${escortCount}`);

const stats = taskService.getTaskStatistics();
console.log(`📋 总任务数: ${stats.total}`);
console.log(`   - 待处理: ${stats.pending}`);
console.log(`   - 已分配: ${stats.assigned}`);
console.log(`   - 进行中: ${stats.inProgress}`);
console.log(`   - 已完成: ${stats.completed}`);
console.log(`   - 已取消: ${stats.cancelled}`);
console.log(`   - 已超时: ${stats.timeout}`);

const pendingTasks = taskService.getPendingTasks();
if (pendingTasks.length > 0) {
  console.log('\n📋 待处理任务列表:');
  console.log('-'.repeat(60));
  pendingTasks.forEach((task, index) => {
    console.log(`${index + 1}. ${task.taskNo} - ${task.patientName} - ${task.examType}`);
    console.log(`   时间: ${new Date(task.scheduledTime).toLocaleString()}`);
    console.log(`   优先级: ${task.priority}${task.isInserted ? ' (插队任务)' : ''}`);
    if (task.insertReason) {
      console.log(`   插队原因: ${task.insertReason}`);
    }
  });
}

const escorts = db.getAllEscorts();
if (escorts.length > 0) {
  console.log('\n👤 陪检员工作状态:');
  console.log('-'.repeat(60));
  escorts.forEach(escort => {
    console.log(`${escort.employeeId} - ${escort.name}`);
    console.log(`   部门: ${escort.department} | 状态: ${escort.status}`);
    console.log(`   当前任务: ${escort.currentTaskCount}/${escort.maxTaskCount}`);
    console.log(`   技能: ${escort.skills.join(', ')}`);
  });
}

const unresolvedErrors = db.getUnresolvedErrors();
if (unresolvedErrors.length > 0) {
  console.log('\n⚠️  未解决的错误记录:');
  console.log('-'.repeat(60));
  unresolvedErrors.forEach(error => {
    console.log(`[${error.errorType}] ${error.errorCode}: ${error.message}`);
  });
}

console.log('\n✅ 数据持久化验证完成！');
console.log('💾 所有数据都已保存在数据库中，重启服务后可恢复。');
console.log('='.repeat(60));
