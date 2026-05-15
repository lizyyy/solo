const { initDatabase } = require('../database/schema');
const ExportService = require('../services/exportService');
const { UserDAO } = require('../database/dao');
const moment = require('moment');

const mockOperator = {
  id: 'mock-user-001',
  name: '合规管理员',
  username: 'compliance_admin',
  role: 'admin'
};

async function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testSuccessScenario() {
  console.log('\n=== 场景1: 成功导出 ===');
  
  try {
    const users = await UserDAO.getAll();
    const operatorIds = users.slice(0, 2).map(u => u.id);
    
    const task = await ExportService.createTask({
      task_name: '成功导出测试任务',
      filter_snapshot: {
        operator_ids: operatorIds,
        start_time: moment().subtract(30, 'days').toISOString(),
        end_time: moment().toISOString(),
        event_types: ['login', 'logout', 'view'],
        modules: ['用户管理', '日志查询'],
        statuses: ['success']
      }
    }, mockOperator);
    
    console.log('创建任务成功，任务ID:', task.id);
    console.log('任务状态:', task.status);
    
    await wait(2000);
    
    const detail = await ExportService.getTaskDetail(task.id);
    console.log('最终状态:', detail.task.status);
    if (detail.task.status === 'completed') {
      console.log('导出文件:', detail.task.file_name);
      console.log('导出记录数:', detail.task.exported_count);
      console.log('✓ 成功场景测试通过');
    } else {
      console.log('错误信息:', detail.task.error_message);
    }
    
    return task.id;
  } catch (error) {
    console.log('✗ 成功场景测试失败:', error.message);
  }
}

async function testFailedScenario() {
  console.log('\n=== 场景2: 失败导出（无数据） ===');
  
  try {
    const users = await UserDAO.getAll();
    const operatorIds = users.slice(0, 1).map(u => u.id);
    
    const task = await ExportService.createTask({
      task_name: '失败导出测试任务',
      filter_snapshot: {
        operator_ids: operatorIds,
        start_time: moment().add(1, 'days').toISOString(),
        end_time: moment().add(2, 'days').toISOString()
      }
    }, mockOperator);
    
    console.log('创建任务成功，任务ID:', task.id);
    
    await wait(2000);
    
    const detail = await ExportService.getTaskDetail(task.id);
    console.log('最终状态:', detail.task.status);
    console.log('错误信息:', detail.task.error_message);
    
    if (detail.task.status === 'failed') {
      console.log('✓ 失败场景测试通过');
    }
    
    return task.id;
  } catch (error) {
    console.log('✗ 失败场景测试失败:', error.message);
  }
}

async function testDuplicateScenario() {
  console.log('\n=== 场景3: 重复提交 ===');
  
  try {
    const users = await UserDAO.getAll();
    const operatorIds = users.slice(0, 2).map(u => u.id);
    
    const filter = {
      operator_ids: operatorIds,
      start_time: moment().subtract(30, 'days').toISOString(),
      end_time: moment().toISOString()
    };
    
    console.log('创建第一个任务...');
    const task1 = await ExportService.createTask({
      task_name: '重复任务1',
      filter_snapshot: filter
    }, mockOperator);
    console.log('任务1创建成功，ID:', task1.id);
    
    console.log('立即创建第二个相同筛选条件的任务...');
    const task2 = await ExportService.createTask({
      task_name: '重复任务2',
      filter_snapshot: filter
    }, mockOperator);
    console.log('任务2创建成功，ID:', task2.id);
    
  } catch (error) {
    console.log('预期错误:', error.message);
    if (error.message.includes('相同筛选条件')) {
      console.log('✓ 重复提交场景测试通过');
    } else {
      console.log('✗ 重复提交场景测试失败');
    }
  }
}

async function testCorrectScenario(failedTaskId) {
  console.log('\n=== 场景4: 人工修正并重试 ===');
  
  if (!failedTaskId) {
    console.log('跳过（需要失败任务ID）');
    return;
  }
  
  try {
    const users = await UserDAO.getAll();
    const operatorIds = users.map(u => u.id);
    
    const newFilter = {
      operator_ids: operatorIds,
      start_time: moment().subtract(30, 'days').toISOString(),
      end_time: moment().toISOString()
    };
    
    console.log('修正筛选条件并重试...');
    const updatedTask = await ExportService.correctAndRetry(failedTaskId, newFilter, mockOperator);
    console.log('任务更新成功，ID:', updatedTask.id);
    
    await wait(2000);
    
    const detail = await ExportService.getTaskDetail(failedTaskId);
    console.log('最终状态:', detail.task.status);
    
    if (detail.task.status === 'completed') {
      console.log('✓ 人工修正场景测试通过');
    }
  } catch (error) {
    console.log('✗ 人工修正场景测试失败:', error.message);
  }
}

async function runAllTests() {
  console.log('开始运行测试场景...');
  
  await initDatabase();
  
  await wait(500);
  
  const successTaskId = await testSuccessScenario();
  await wait(1000);
  
  const failedTaskId = await testFailedScenario();
  await wait(1000);
  
  await testDuplicateScenario();
  await wait(1000);
  
  await testCorrectScenario(failedTaskId);
  
  console.log('\n=== 所有测试完成 ===');
  
  console.log('\n查看任务列表:');
  const tasks = await ExportService.getTaskList();
  tasks.forEach(t => {
    console.log(`  ${t.task_name} - 状态: ${t.status}`);
  });
}

runAllTests().catch(error => {
  console.error('测试运行失败:', error);
  process.exit(1);
});
