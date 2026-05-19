const axios = require('axios');

const BASE_URL = 'http://localhost:3000/api';

async function testAPI() {
  console.log('='.repeat(60));
  console.log('开始测试陪检员调度系统API');
  console.log('='.repeat(60));
  console.log('');

  try {
    console.log('1. 查询所有陪检员');
    const escortsRes = await axios.get(`${BASE_URL}/escorts`);
    console.log(`   成功！共找到 ${escortsRes.data.total} 名陪检员`);
    escortsRes.data.data.forEach(e => {
      console.log(`   - ${e.name} (${e.employee_id})`);
    });
    console.log('');

    console.log('2. 查询所有预约单');
    const apptsRes = await axios.get(`${BASE_URL}/appointments`);
    console.log(`   成功！共找到 ${apptsRes.data.total} 条预约单`);
    console.log('');

    console.log('3. 查询所有任务');
    const tasksRes = await axios.get(`${BASE_URL}/tasks`);
    console.log(`   成功！共找到 ${tasksRes.data.total} 条任务`);
    const tasks = tasksRes.data.data;
    console.log('');

    if (tasks.length > 0 && escortsRes.data.data.length > 0) {
      const taskId = tasks[0].id;
      const escortId = escortsRes.data.data[0].id;
      const escortName = escortsRes.data.data[0].name;

      console.log(`4. 派单 - 任务 ${taskId} 派给 ${escortName}`);
      const assignRes = await axios.post(`${BASE_URL}/tasks/${taskId}/assign`, {
        escort_id: escortId,
        operator: '测试员'
      });
      console.log(`   ${assignRes.data.message}`);
      console.log('');

      console.log(`5. 接单 - 任务 ${taskId}`);
      const acceptRes = await axios.post(`${BASE_URL}/tasks/${taskId}/accept`, {
        operator: escortName
      });
      console.log(`   ${acceptRes.data.message}`);
      console.log(`   等待时间: ${acceptRes.data.data.waiting_time} 分钟`);
      console.log('');

      console.log(`6. 开始陪检 - 任务 ${taskId}`);
      const startRes = await axios.post(`${BASE_URL}/tasks/${taskId}/start`, {
        operator: escortName
      });
      console.log(`   ${startRes.data.message}`);
      console.log('');

      console.log(`7. 完成陪检 - 任务 ${taskId}`);
      const completeRes = await axios.post(`${BASE_URL}/tasks/${taskId}/complete`, {
        operator: escortName
      });
      console.log(`   ${completeRes.data.message}`);
      console.log(`   实际时长: ${completeRes.data.data.actual_duration} 分钟`);
      console.log('');

      if (tasks.length > 1) {
        const taskId2 = tasks[1].id;
        console.log(`8. 插队处理 - 任务 ${taskId2}`);
        const insertRes = await axios.post(`${BASE_URL}/tasks/${taskId2}/insert`, {
          operator: '护士长'
        });
        console.log(`   ${insertRes.data.message}`);
        console.log('');

        console.log(`9. 取消任务 - 任务 ${taskId2}`);
        const cancelRes = await axios.post(`${BASE_URL}/tasks/${taskId2}/cancel`, {
          reason: '患者临时取消',
          operator: '服务台'
        });
        console.log(`   ${cancelRes.data.message}`);
        console.log('');
      }

      console.log('10. 查询任务日志');
      const logsRes = await axios.get(`${BASE_URL}/tasks/${taskId}/logs`);
      console.log(`   成功！共 ${logsRes.data.data.length} 条日志`);
      logsRes.data.data.forEach(log => {
        console.log(`   - [${log.created_at.substring(0, 19)}] ${log.action}`);
      });
      console.log('');
    }

    console.log('11. 按状态筛选任务 (pending)');
    const pendingRes = await axios.get(`${BASE_URL}/tasks?status=pending`);
    console.log(`   成功！共 ${pendingRes.data.total} 条待处理任务`);
    console.log('');

    console.log('12. 查询已完成任务');
    const completedRes = await axios.get(`${BASE_URL}/tasks?status=completed`);
    console.log(`   成功！共 ${completedRes.data.total} 条已完成任务`);
    console.log('');

    console.log('13. 查询插队任务');
    const insertedRes = await axios.get(`${BASE_URL}/tasks?is_inserted=true`);
    console.log(`   成功！共 ${insertedRes.data.total} 条插队任务`);
    console.log('');

    console.log('='.repeat(60));
    console.log('所有测试完成！');
    console.log('='.repeat(60));

  } catch (err) {
    console.error('测试失败:', err.message);
    if (err.response) {
      console.error('错误详情:', err.response.data);
    }
    process.exit(1);
  }
}

if (require.main === module) {
  testAPI();
}

module.exports = testAPI;
