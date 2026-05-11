const dayjs = require('dayjs');

const today = dayjs().format('YYYY-MM-DD');

console.log('========================================');
console.log('  滑翔伞飞行窗口 API - 顺利样例');
console.log('========================================');
console.log(`\n今日日期: ${today}`);
console.log('\n场景: 学员"钱中间"(intermediate)申请今日上午飞行');
console.log('      → 教练"张明"(advanced)');
console.log('      → 装备: Alpha-1 + 备份伞 S-1 + 头盔 H-1');
console.log('\n执行步骤 (请按顺序执行以下 curl 命令):');
console.log('----------------------------------------');

const steps = [
  {
    step: 1,
    name: '创建飞行申请',
    curl: `curl -X POST http://localhost:3000/api/flights \\
  -H "Content-Type: application/json" \\
  -d '{
    "studentId": "s2",
    "date": "${today}",
    "timeSlot": "morning",
    "notes": "首次复飞，状态良好"
  }'`,
    note: '记录返回的 data.id，后续步骤需要替换 ${REQUEST_ID}'
  },
  {
    step: 2,
    name: '天气窗口检查 (使用 w1 今日上午)',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/weather \\
  -H "Content-Type: application/json" \\
  -d '{ "weatherId": "w1" }'`,
    note: '检查点: 今日上午天气 (w1): 东风15m/s，温度22°C，要求 intermediate 级别'
  },
  {
    step: 3,
    name: '教练排班检查 (张明 c1)',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/coach \\
  -H "Content-Type: application/json" \\
  -d '{ "coachId": "c1" }'`,
    note: '检查点: 张明(c1)今日上午可用，且等级 advanced >= intermediate'
  },
  {
    step: 4,
    name: '装备检查 (e1, e4, e5)',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/equipment \\
  -H "Content-Type: application/json" \\
  -d '{ "equipmentIds": ["e1", "e4", "e5"] }'`,
    note: '检查点: 三件套齐全（主伞+备份伞+头盔），状态都是 available'
  },
  {
    step: 5,
    name: '提交审批',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/submit \\
  -H "Content-Type: application/json" \\
  -d '{}'`,
    note: '状态变为 pending_approval'
  },
  {
    step: 6,
    name: '审批通过',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/approve \\
  -H "Content-Type: application/json" \\
  -d '{
    "approver": "安全主管-李总",
    "notes": "条件良好，同意放飞"
  }'`,
    note: '状态变为 approved'
  },
  {
    step: 7,
    name: '完成飞行并提交安全报告',
    curl: `curl -X POST http://localhost:3000/api/flights/\${REQUEST_ID}/complete \\
  -H "Content-Type: application/json" \\
  -d '{
    "flightDuration": 45,
    "altitude": 800,
    "weatherConditions": {
      "windSpeed": 14,
      "windDirection": "E",
      "temperature": 23
    },
    "incidents": [],
    "notes": "飞行平稳，学员表现良好",
    "safetyRating": "normal"
  }'`,
    note: '状态变为 completed，生成安全报告'
  },
  {
    step: 8,
    name: '查看申请详情（可选）',
    curl: `curl http://localhost:3000/api/flights/\${REQUEST_ID}`,
    note: '查看完整的申请历史和状态流转'
  },
  {
    step: 9,
    name: '导出安全报表（可选）',
    curl: `curl "http://localhost:3000/api/reports/safety?startDate=${today}"`,
    note: '查看今日安全统计'
  }
];

steps.forEach(s => {
  console.log(`\n【步骤 ${s.step}】${s.name}`);
  console.log(`\n${s.curl}`);
  console.log(`\n说明: ${s.note}`);
  console.log('----------------------------------------');
});

console.log('\n========================================');
console.log('  样例说明');
console.log('========================================');
console.log('\n为什么这个样例会顺利通过:');
console.log('  1. 天气: 今日上午(w1) 东风15m/s (preferred: NE/E/SE)');
console.log('     - 风速 15 <= intermediate 限制 20');
console.log('     - 能见度 10 >= 5');
console.log('     - 最低要求 intermediate，学员刚好达标');
console.log('');
console.log('  2. 教练: 张明(c1)');
console.log('     - 今日上午排班可用');
console.log('     - 等级 advanced >= intermediate');
console.log('     - 无时段冲突');
console.log('');
console.log('  3. 装备: e1(Alpha-1) + e4(备份伞) + e5(头盔)');
console.log('     - 三件套齐全');
console.log('     - 状态都是 available');
console.log('     - 适合 intermediate 级别');
console.log('     - 风速 15 未超过各装备上限');
console.log('     - 检定期限都在有效期内');
console.log('\n');
