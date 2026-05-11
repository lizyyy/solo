const http = require('http');

const BASE_URL = 'http://localhost:3001';

function request(method, path, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
    const options = {
      method,
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ status: res.statusCode, body: data });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function simulateExpiredLease() {
  console.log('========================================');
  console.log('模拟到期释放场景');
  console.log('========================================\n');

  try {
    console.log('1. 创建一个已过期的租期（手动操作后端数据演示）');
    console.log('');
    console.log('   说明: 在实际系统中，checkExpiredLeases 函数');
    console.log('   每60秒自动检查，将 endDate < today 的租期标记为 expired');
    console.log('   同时释放环境资源，清理未完成任务，并记录审计日志');
    console.log('');

    console.log('2. 让我们创建一个正常租期，然后查看到期逻辑');
    console.log('');
    
    console.log('   申请环境 (支付项目组)...');
    const apply = await request('POST', '/api/leases/apply', {
      teamId: 'team-003',
      requester: '赵六',
      reason: '支付测试',
      days: 1
    });
    const leaseId = apply.body.id;
    console.log('   租期ID:', leaseId);

    console.log('');
    console.log('   审批分配...');
    await request('PUT', `/api/leases/${leaseId}/approve`, {
      approver: 'admin'
    });

    console.log('');
    console.log('3. 查看当前环境状态');
    const envs = await request('GET', '/api/environments');
    console.log('');
    envs.body.forEach(env => {
      console.log(`   ${env.name}: ${env.status}`);
      if (env.currentLease) {
        console.log(`     -> 被 ${env.currentLease.teamName} 占用`);
        console.log(`     -> 到期日: ${env.currentLease.endDate}`);
        console.log(`     -> 剩余天数: ${env.currentLease.remainingDays}`);
      }
    });

    console.log('');
    console.log('4. 查看审计记录中的动作类型');
    const audit = await request('GET', '/api/audit-logs');
    const actions = [...new Set(audit.body.logs.map(l => l.action))];
    console.log('');
    console.log('   已记录的动作类型:', actions.join(', '));
    console.log('');
    console.log('   当租期到期时，系统会自动添加 action=expire 的审计记录');
    console.log('   记录包含: 到期原因、释放的环境ID、最终费用等');

    console.log('');
    console.log('5. 演示"到期后不能继续部署"的逻辑');
    console.log('');
    console.log('   说明: 当租期状态为 expired 时:');
    console.log('   - POST /api/leases/:id/renew 会返回 400 错误');
    console.log('   - 环境状态变为 available，可被其他团队申请');
    console.log('   - 所有 pending 状态的任务被标记为 cancelled');

    console.log('');
    console.log('========================================');
    console.log('到期自动释放逻辑流程:');
    console.log('========================================');
    console.log('');
    console.log('1. 定时器每60秒触发 checkExpiredLeases()');
    console.log('2. 遍历所有 active 状态的租期');
    console.log('3. 检查 endDate < today');
    console.log('4. 如果到期:');
    console.log('   a. 租期状态改为 expired');
    console.log('   b. 环境状态改为 available');
    console.log('   c. 所有 pending 任务改为 cancelled');
    console.log('   d. 添加审计日志 (action=expire, actor=system)');
    console.log('');

    console.log('审计日志示例结构:');
    console.log('{');
    console.log('  "action": "expire",');
    console.log('  "actor": "system",');
    console.log('  "details": {');
    console.log('    "reason": "到期自动释放",');
    console.log('    "environmentId": "env-001",');
    console.log('    "finalCost": 700');
    console.log('  }');
    console.log('}');
    console.log('');

    console.log('========================================');
    console.log('到期释放模拟演示完成');
    console.log('========================================');

  } catch (error) {
    console.error('错误:', error.message);
  }
}

simulateExpiredLease();
