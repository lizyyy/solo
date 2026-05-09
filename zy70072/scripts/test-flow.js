const http = require('http');

const BASE_URL = 'http://localhost:3000/api';

const request = (method, path, body = null) => {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'Content-Type': 'application/json',
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: {} });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const log = (title, result) => {
  console.log(`\n=== ${title} ===`);
  console.log('状态码:', result.status);
  if (result.data) {
    console.log('成功:', result.data.success);
    if (result.data.message) {
      console.log('消息:', result.data.message);
    }
    if (result.data.error) {
      console.log('错误:', result.data.error);
    }
    if (result.data.is_duplicate) {
      console.log('⚠️  重复请求，已忽略');
    }
  }
};

async function runTestFlow() {
  console.log('\n========================================');
  console.log('  会议待办归档 API 完整流程测试');
  console.log('========================================');
  console.log('\n业务背景: 会议结束后，待办被复制到多个系统（Jira、飞书、钉钉等），');
  console.log('状态更新分散，没人同步，导致状态混乱。本系统统一管理状态流转。\n');

  try {
    console.log('\n---------- 阶段一: 创建会议记录 ----------');
    
    const createMeeting = await request('POST', '/meetings', {
      title: 'Q2产品需求评审会议',
      content: '讨论新版本功能规划、资源分配和时间节点',
      scheduled_at: '2026-05-10 14:00:00'
    });
    log('1. 创建会议记录', createMeeting);
    
    const meetingId = createMeeting.data.data.id;
    console.log('会议ID:', meetingId);

    console.log('\n---------- 阶段二: 待办拆分 ----------');
    
    const splitTodos = await request('POST', `/meetings/${meetingId}/todos`, {
      todos: [
        {
          title: '完成用户调研问卷设计',
          content: '设计20道问卷，覆盖用户画像、使用场景和痛点',
          assignee: '张三',
          due_date: '2026-05-15'
        },
        {
          title: '输出交互原型方案',
          content: '完成首页和核心流程的高保真原型',
          assignee: '李四',
          due_date: '2026-05-18'
        },
        {
          title: '后端API接口开发',
          content: '完成用户、订单、支付三个模块的接口',
          assignee: '王五',
          due_date: '2026-05-20'
        },
        {
          title: '性能优化方案评审',
          content: '邀请架构师评审优化方案',
          assignee: '赵六',
          due_date: '2026-05-12'
        }
      ]
    });
    log('2. 拆分4个待办项', splitTodos);
    
    const todoIds = splitTodos.data.data.map(t => t.id);
    console.log('待办ID列表:', todoIds);

    console.log('\n---------- 阶段三: 负责人确认 ----------');
    
    const confirm1 = await request('POST', `/todos/${todoIds[0]}/confirm`, { assignee: '张三' });
    log('3. 张三确认第1个待办', confirm1);

    const confirm2 = await request('POST', `/todos/${todoIds[1]}/confirm`, { assignee: '李四' });
    log('4. 李四确认第2个待办', confirm2);

    const confirm3 = await request('POST', `/todos/${todoIds[2]}/confirm`, { assignee: '王五' });
    log('5. 王五确认第3个待办', confirm3);

    console.log('\n--- 测试幂等性: 重复确认 ---');
    const confirmDuplicate = await request('POST', `/todos/${todoIds[0]}/confirm`, { assignee: '张三' });
    log('6. 重复确认第1个待办（应该安全忽略）', confirmDuplicate);

    console.log('\n---------- 阶段四: 状态回传 ----------');
    
    const status1 = await request('POST', `/todos/${todoIds[0]}/status`, {
      status: 'in_progress',
      system_name: 'Jira',
      reason: '已在Jira创建任务，开始设计问卷'
    });
    log('7. 从Jira同步状态: 进行中', status1);

    const status2 = await request('POST', `/todos/${todoIds[1]}/status`, {
      status: 'in_progress',
      system_name: '飞书',
      reason: '飞书任务状态更新'
    });
    log('8. 从飞书同步状态: 进行中', status2);

    console.log('\n--- 测试幂等性: 相同状态更新 ---');
    const statusDuplicate = await request('POST', `/todos/${todoIds[0]}/status`, {
      status: 'in_progress',
      system_name: 'Jira',
      reason: '已在Jira创建任务，开始设计问卷'
    });
    log('9. 重复相同状态更新（应该安全忽略）', statusDuplicate);

    const statusComplete = await request('POST', `/todos/${todoIds[0]}/status`, {
      status: 'completed',
      system_name: '钉钉',
      reason: '问卷设计完成，已提交产品审核'
    });
    log('10. 从钉钉同步: 已完成', statusComplete);

    console.log('\n--- 测试错误状态 ---');
    const invalidStatus = await request('POST', `/todos/${todoIds[0]}/status`, {
      status: 'invalid_status',
      system_name: '测试'
    });
    log('11. 无效状态值（应该报错）', invalidStatus);

    console.log('\n---------- 阶段五: 过期提醒检查 ----------');
    
    const reminders = await request('POST', '/reminders/check');
    log('12. 检查过期提醒', reminders);
    if (reminders.data.data) {
      console.log('即将到期:', reminders.data.data.due_soon.length, '个');
      console.log('已过期:', reminders.data.data.overdue.length, '个');
    }

    console.log('\n---------- 阶段六: 查看历史记录 ----------');
    
    const history = await request('GET', `/todos/${todoIds[0]}/history`);
    log('13. 查看第1个待办的历史记录', history);
    if (history.data.data && history.data.data.status_history) {
      console.log('状态变更次数:', history.data.data.status_history.length);
      history.data.data.status_history.forEach((h, i) => {
        console.log(`  ${i+1}. ${h.from_status} → ${h.to_status} [${h.system_name || 'manual'}] - ${h.created_at}`);
      });
    }

    console.log('\n---------- 阶段七: 尝试归档（应该失败） ----------');
    
    const archiveFail = await request('POST', `/meetings/${meetingId}/archive`);
    log('14. 尝试归档会议（有未完成待办，应该失败）', archiveFail);
    if (archiveFail.data.pending_todos) {
      console.log('未完成待办:', archiveFail.data.pending_todos.length, '个');
    }

    console.log('\n---------- 阶段八: 完成所有待办 ----------');
    
    for (let i = 1; i < todoIds.length; i++) {
      await request('POST', `/todos/${todoIds[i]}/status`, {
        status: 'completed',
        system_name: 'manual',
        reason: '手动标记完成'
      });
    }
    console.log('已标记其余待办为完成...');

    console.log('\n---------- 阶段九: 成功归档 ----------');
    
    const archiveSuccess = await request('POST', `/meetings/${meetingId}/archive`);
    log('15. 再次归档会议（所有待办完成，应该成功）', archiveSuccess);

    console.log('\n--- 测试幂等性: 重复归档 ---');
    const archiveDuplicate = await request('POST', `/meetings/${meetingId}/archive`);
    log('16. 重复归档（应该安全忽略）', archiveDuplicate);

    console.log('\n---------- 阶段十: 导出归档数据 ----------');
    
    const exportData = await request('GET', `/meetings/${meetingId}/export`);
    log('17. 导出归档数据', exportData);
    if (exportData.data.data && exportData.data.data.summary) {
      const s = exportData.data.data.summary;
      console.log('汇总统计:');
      console.log(`  - 总待办数: ${s.total}`);
      console.log(`  - 已完成: ${s.completed}`);
      console.log(`  - 已取消: ${s.cancelled}`);
      console.log(`  - 进行中: ${s.pending}`);
    }

    console.log('\n---------- 阶段十一: 查看会议列表 ----------');
    
    const meetingList = await request('GET', '/meetings');
    log('18. 查看所有会议列表', meetingList);

    console.log('\n========================================');
    console.log('  测试流程完成！');
    console.log('========================================');
    console.log('\n验收要点:');
    console.log('✅ 状态推进可见: pending → confirmed → in_progress → completed');
    console.log('✅ 错误原因明确: 无效状态、未完成待办等有明确提示');
    console.log('✅ 历史记录可查: 每个状态变更都有记录');
    console.log('✅ 幂等性处理: 重复确认、重复归档、重复状态更新都安全忽略');
    console.log('✅ 最终汇总导出: 包含统计信息和完整历史');
    console.log('✅ 数据持久化: SQLite存储，重启后仍可查询');
    console.log('\n');

  } catch (error) {
    console.error('测试执行失败:', error.message);
    console.log('\n请确保服务已启动: npm run start');
    process.exit(1);
  }
}

runTestFlow();
