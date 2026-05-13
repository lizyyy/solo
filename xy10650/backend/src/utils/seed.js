const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');
const OperationLogService = require('../services/operationLog');

const teams = [
  { name: '土建一班', leader: '张三', phone: '13800138001' },
  { name: '水电二班', leader: '李四', phone: '13800138002' },
  { name: '钢结构班', leader: '王五', phone: '13800138003' },
  { name: '装修班组', leader: '赵六', phone: '13800138004' }
];

const hazards = [
  { description: '施工现场未戴安全帽', location: '1号楼入口', risk_level: '高' },
  { description: '脚手架安全网破损', location: '2号楼3层', risk_level: '极高' },
  { description: '临时用电线路混乱', location: '配电室', risk_level: '高' },
  { description: '消防通道被占用', location: '西区仓库', risk_level: '中' },
  { description: '高空作业未系安全带', location: '3号楼楼顶', risk_level: '极高' },
  { description: '电梯井口防护缺失', location: '4号楼电梯间', risk_level: '高' },
  { description: '材料堆放杂乱', location: '东区堆场', risk_level: '低' },
  { description: '施工机械未接地', location: '塔吊区域', risk_level: '中' }
];

async function seed() {
  console.log('开始生成演示数据...');

  for (const team of teams) {
    await new Promise((resolve) => {
      db.run(
        `INSERT OR IGNORE INTO teams (id, name, leader, phone) VALUES (?, ?, ?, ?)`,
        [uuidv4(), team.name, team.leader, team.phone],
        resolve
      );
    });
  }
  console.log('✓ 班组数据生成完成');

  db.all(`SELECT id FROM teams`, async (err, teamRows) => {
    if (err) throw err;

    for (const [index, hazard] of hazards.entries()) {
      const teamId = teamRows[index % teamRows.length].id;
      const hazardId = uuidv4();
      const deadline = moment().add(index % 5 + 1, 'days').format('YYYY-MM-DD HH:mm:ss');
      const statuses = ['待整改', '整改中', '待复查', '已通过'];
      const status = statuses[index % statuses.length];

      await new Promise((resolve) => {
        db.run(
          `INSERT INTO hazards (id, description, location, risk_level, team_id, deadline, status)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [hazardId, hazard.description, hazard.location, hazard.risk_level, teamId, deadline, status],
          resolve
        );
      });

      await OperationLogService.log(
        uuidv4(),
        hazardId,
        '创建隐患',
        '系统管理员',
        null,
        { id: hazardId, ...hazard },
        '成功',
        '演示数据创建'
      );
    }
    console.log('✓ 隐患数据生成完成');

    const demoHazardId = uuidv4();
    const demoHazard = {
      id: demoHazardId,
      description: '演示用隐患-安全通道积水',
      location: '主入口',
      risk_level: '中',
      team_id: teamRows[0].id,
      deadline: moment().subtract(2, 'days').format('YYYY-MM-DD HH:mm:ss'),
      status: '待整改'
    };

    await new Promise((resolve) => {
      db.run(
        `INSERT INTO hazards (id, description, location, risk_level, team_id, deadline, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [demoHazard.id, demoHazard.description, demoHazard.location, demoHazard.risk_level, 
         demoHazard.team_id, demoHazard.deadline, demoHazard.status],
        resolve
      );
    });

    await OperationLogService.log(
      uuidv4(),
      demoHazardId,
      '创建隐患',
      '演示用户',
      null,
      demoHazard,
      '成功',
      '演示路径：成功创建隐患'
    );

    await OperationLogService.log(
      uuidv4(),
      demoHazardId,
      '提交复查',
      '演示用户',
      demoHazard,
      null,
      '拦截',
      '演示路径：拦截-状态不是待复查不能提交复查'
    );

    await OperationLogService.log(
      uuidv4(),
      demoHazardId,
      '提交复查',
      '演示用户',
      demoHazard,
      { ...demoHazard, status: '已通过' },
      '人工修正',
      '演示路径：人工修正-强制通过复查'
    );

    const repeatRequestId = uuidv4();
    await OperationLogService.log(
      repeatRequestId,
      demoHazardId,
      '创建隐患',
      '演示用户',
      null,
      demoHazard,
      '成功',
      '演示路径：第一次请求成功'
    );
    await OperationLogService.log(
      repeatRequestId,
      demoHazardId,
      '创建隐患',
      '演示用户',
      null,
      null,
      '重复提交',
      '演示路径：重复请求被识别'
    );

    console.log('✓ 演示路径数据生成完成');
    console.log('\n演示数据生成完毕！');
    console.log('可以通过以下路径体验：');
    console.log('  1. 成功路径：正常创建隐患');
    console.log('  2. 拦截路径：提交不符合规则的复查');
    console.log('  3. 人工修正路径：使用manual_override强制操作');
    console.log('  4. 重复提交路径：使用相同的X-Request-ID重复请求');
    process.exit(0);
  });
}

seed().catch(console.error);