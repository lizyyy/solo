const dayjs = require('dayjs');

const today = dayjs().format('YYYY-MM-DD');

console.log('========================================');
console.log('  滑翔伞飞行窗口 API - 拦截/待复核样例');
console.log('========================================');
console.log(`\n今日日期: ${today}`);
console.log('\n以下样例演示各种错误场景和拦截机制:');
console.log('----------------------------------------');

const cases = [
  {
    name: '【拦截场景1】缺字段验证',
    description: '创建申请时缺少必填字段 date 和 timeSlot',
    curl: `curl -X POST http://localhost:3000/api/flights \\
  -H "Content-Type: application/json" \\
  -d '{ "studentId": "s1" }'`,
    expectation: {
      success: false,
      error: '缺少必填字段',
      missingFields: ['date', 'timeSlot']
    },
    why: '系统在 createFlightRequest 中验证 required: [studentId, date, timeSlot]'
  },
  {
    name: '【拦截场景2】重复提交',
    description: '同一学员在同一时段重复提交申请',
    steps: [
      {
        step: '先创建第一个申请',
        curl: `curl -X POST http://localhost:3000/api/flights \\
  -H "Content-Type: application/json" \\
  -d '{
    "studentId": "s2",
    "date": "${today}",
    "timeSlot": "morning"
  }'`
      },
      {
        step: '再创建第二个相同的申请（会被拦截）',
        curl: `curl -X POST http://localhost:3000/api/flights \\
  -H "Content-Type: application/json" \\
  -d '{
    "studentId": "s2",
    "date": "${today}",
    "timeSlot": "morning"
  }'`
      }
    ],
    expectation: {
      success: false,
      error: '重复提交：该学员在此时段已有飞行申请'
    },
    why: '系统检查同一 studentId + date + timeSlot 是否已有非终态申请'
  },
  {
    name: '【待复核场景1】天气不匹配 - 等级不足',
    description: '学员赵小白(beginner)尝试申请要求intermediate级别的天气窗口w1',
    prerequisite: '先创建申请: s1, today, morning',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/weather \\
  -H "Content-Type: application/json" \\
  -d '{ "weatherId": "w1" }'`,
    expectation: {
      success: false,
      error: '学员等级不足',
      needsReview: true,
      status: 'needs_review'
    },
    why: 'w1的minLevel是intermediate，赵小白是beginner → 等级不够 → 进入待复核'
  },
  {
    name: '【待复核场景2】天气不匹配 - 风速超标',
    description: '下午w2风速25m/s，即使advanced学员，风速超标会被拦截',
    prerequisite: '创建申请: s3(advanced), today, afternoon',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/weather \\
  -H "Content-Type: application/json" \\
  -d '{ "weatherId": "w2" }'`,
    expectation: {
      success: false,
      error: '风速超过学员能力范围',
      details: '当前风速25m/s，限制25m/s（刚好达到边界）',
      needsReview: true
    },
    why: '高级学员风速上限25m/s，w2的isFlyable=false（风速过高）'
  },
  {
    name: '【待复核场景3】教练不可用',
    description: '选择王强(c3)，但他今日上午排班是设备维护（不可用）',
    prerequisite: '先完成: s2申请 + w1天气检查通过',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/coach \\
  -H "Content-Type: application/json" \\
  -d '{ "coachId": "c3" }'`,
    expectation: {
      success: false,
      error: '教练不可用：设备维护',
      needsReview: true,
      status: 'needs_review'
    },
    why: '王强(c3)今日上午排班 isAvailable=false → 进入待复核'
  },
  {
    name: '【待复核场景4】装备维护中',
    description: '选择e3 Gamma-3，它当前状态是maintenance',
    prerequisite: '先完成: s2申请 + w1天气 + c1教练',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/equipment \\
  -H "Content-Type: application/json" \\
  -d '{ "equipmentIds": ["e3", "e4", "e5"] }'`,
    expectation: {
      success: false,
      error: '装备检查未通过',
      issues: ['装备 伞具 Gamma-3 状态为 maintenance，不可使用'],
      needsReview: true,
      status: 'needs_review'
    },
    why: 'e3.status=maintenance → 装备检查失败 → 进入待复核'
  },
  {
    name: '【拦截场景3】非法状态流转 - 跳步',
    description: '创建申请后直接跳过天气检查去查教练',
    prerequisite: '只创建申请，不做天气检查',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/coach \\
  -H "Content-Type: application/json" \\
  -d '{ "coachId": "c1" }'`,
    expectation: {
      success: false,
      error: '非法状态流转',
      currentStatus: 'draft',
      expectedPrevious: 'weather_check'
    },
    why: '状态机强制顺序: draft → weather_check → schedule_check → ...'
  },
  {
    name: '【拦截场景4】装备缺失必备类型',
    description: '只选了主伞，没选备份伞和头盔',
    prerequisite: '先完成: s2申请 + w1天气 + c1教练',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/equipment \\
  -H "Content-Type: application/json" \\
  -d '{ "equipmentIds": ["e1"] }'`,
    expectation: {
      success: false,
      error: '装备检查未通过',
      issues: ['缺少必备装备类型: reserve, helmet'],
      needsReview: false
    },
    why: 'REQUIRED_TYPES = [canopy, reserve, helmet]，必须齐全'
  },
  {
    name: '【人工修正演示】从待复核恢复流程',
    description: '当申请进入needs_review后，通过人工复核修正并继续',
    steps: [
      {
        step: '1. 假设申请因装备问题进入 needs_review',
        curl: '（见场景4）'
      },
      {
        step: '2. 人工复核 - 修正装备为 e1,e4,e5，然后提交审批',
        curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/review \\
  -H "Content-Type: application/json" \\
  -d '{
    "reviewer": "安全员-老王",
    "decision": "approve",
    "corrections": {
      "equipmentIds": ["e1", "e4", "e5"]
    }
  }'`
      },
      {
        step: '3. 现在状态变为 pending_approval，可以继续审批流程',
        curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/approve \\
  -H "Content-Type: application/json" \\
  -d '{ "approver": "安全主管" }'`
      }
    ],
    expectation: {
      success: true,
      status: 'approved'
    },
    why: 'manualReview 接口允许人工修正(天气/教练/装备)后恢复流程'
  }
];

cases.forEach((c, idx) => {
  console.log(`\n\n=== 样例 ${idx + 1}: ${c.name} ===`);
  console.log(`\n描述: ${c.description}`);
  if (c.prerequisite) {
    console.log(`前提: ${c.prerequisite}`);
  }
  
  if (c.steps) {
    c.steps.forEach(s => {
      console.log(`\n${s.step}:`);
      console.log(s.curl);
    });
  } else {
    console.log(`\ncurl:`);
    console.log(c.curl);
  }
  
  console.log(`\n预期结果:`);
  console.log(JSON.stringify(c.expectation, null, 2));
  console.log(`\n原因: ${c.why}`);
});

console.log('\n\n========================================');
console.log('  状态流转说明');
console.log('========================================');
console.log('\n正常流程:');
console.log('  draft → weather_check → schedule_check → equipment_check');
console.log('  → pending_approval → approved → completed');
console.log('\n异常流程:');
console.log('  任一环节检查失败 → needs_review');
console.log('  needs_review --人工修正/审批--> pending_approval 或 rejected');
console.log('\n状态拦截规则:');
console.log('  - 只能从当前状态流转到下一个状态（不能跳步）');
console.log('  - approved 之前的状态可以 reject/cancel');
console.log('  - needs_review 必须人工处理后才能继续');
console.log('\n');
