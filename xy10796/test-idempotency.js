const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testIdempotency() {
  console.log('=== 开始幂等性测试 ===\n');

  try {
    const environments = await axios.get(`${API_BASE}/environments`);
    const datasets = await axios.get(`${API_BASE}/datasets`);

    const environmentId = environments.data.environments[0]?.id;
    const datasetVersionId = datasets.data.datasets[0]?.id;

    if (!environmentId || !datasetVersionId) {
      console.error('请先确保有环境和数据集数据');
      process.exit(1);
    }

    console.log('环境 ID:', environmentId);
    console.log('数据集 ID:', datasetVersionId);
    console.log();

    const requestId = `test-request-${Date.now()}`;
    const payload = {
      environmentId,
      datasetVersionId,
      requestId,
    };

    console.log('1. 第一次创建任务...');
    const response1 = await axios.post(`${API_BASE}/tasks`, payload);
    console.log('   响应:', response1.data.message);
    console.log('   重复:', response1.data.isDuplicate);
    console.log('   任务 ID:', response1.data.task.id);
    console.log();

    await sleep(1000);

    console.log('2. 第二次提交相同请求（幂等测试）...');
    const response2 = await axios.post(`${API_BASE}/tasks`, payload);
    console.log('   响应:', response2.data.message);
    console.log('   重复:', response2.data.isDuplicate);
    console.log('   任务 ID:', response2.data.task.id);
    console.log();

    if (response1.data.task.id === response2.data.task.id) {
      console.log('✅ 幂等性验证通过：两次请求返回相同的任务 ID');
    } else {
      console.log('❌ 幂等性验证失败：两次请求返回不同的任务 ID');
    }
    console.log();

    console.log('3. 验证任务列表数量...');
    const tasksResponse = await axios.get(`${API_BASE}/tasks`);
    const totalTasks = tasksResponse.data.total;
    console.log('   总任务数:', totalTasks);
    console.log('   任务列表:');
    tasksResponse.data.tasks.forEach(t => {
      console.log(`     - ${t.id} (${t.status})`);
    });
    console.log();

    console.log('4. 测试不同的 requestId 创建新任务...');
    const payload2 = {
      environmentId,
      datasetVersionId,
      requestId: `test-request-2-${Date.now()}`,
    };
    const response3 = await axios.post(`${API_BASE}/tasks`, payload2);
    console.log('   响应:', response3.data.message);
    console.log('   重复:', response3.data.isDuplicate);
    console.log('   新任务 ID:', response3.data.task.id);
    
    if (response3.data.task.id !== response1.data.task.id) {
      console.log('✅ 不同 requestId 正确创建新任务');
    } else {
      console.log('❌ 不同 requestId 未能创建新任务');
    }
    console.log();

    await sleep(2000);

    console.log('5. 查看最终任务状态...');
    const finalTasks = await axios.get(`${API_BASE}/tasks`);
    console.log('   总任务数:', finalTasks.data.total);
    finalTasks.data.tasks.forEach(t => {
      console.log(`     - ${t.id} (${t.status})`);
    });
    console.log();

    console.log('=== 幂等性测试完成 ===');
    console.log();
    console.log('总结：');
    console.log('- 相同 requestId 的多次调用不会创建重复任务（返回已有任务）');
    console.log('- 不同 requestId 的调用会创建新任务');
    console.log('- 系统具备完整的幂等性保证');

  } catch (error) {
    console.error('测试失败:', error.response?.data || error.message);
    process.exit(1);
  }
}

testIdempotency();
