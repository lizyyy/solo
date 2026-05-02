const { initDatabase } = require('../src/storage/database');
const topologyService = require('../src/services/topology-service');
const resourceService = require('../src/services/resource-service');
const planStateMachine = require('../src/services/plan-state-machine');

/**
 * 初始化示例数据
 * 用于演示和测试
 */

async function initSampleData() {
  console.log('正在初始化示例数据...');
  
  // 等待数据库初始化
  await initDatabase();
  
  console.log('1. 创建线路拓扑...');
  
  // 创建 1 号线
  const line1 = topologyService.createLine({
    id: 'LINE-001',
    name: '1号线',
    color: '#FF0000',
    description: '东西向主干线，连接市区东西两端'
  });
  
  // 创建 2 号线
  const line2 = topologyService.createLine({
    id: 'LINE-002',
    name: '2号线',
    color: '#0088FF',
    description: '南北向主干线，连接市区南北两端'
  });
  
  console.log('2. 创建车站...');
  
  // 1 号线车站
  const stationsLine1 = [
    { id: 'ST-001', line_id: 'LINE-001', name: '东客站', sequence: 0, is_terminal: true },
    { id: 'ST-002', line_id: 'LINE-001', name: '人民广场', sequence: 1 },
    { id: 'ST-003', line_id: 'LINE-001', name: '中心站', sequence: 2 },
    { id: 'ST-004', line_id: 'LINE-001', name: '科技园', sequence: 3 },
    { id: 'ST-005', line_id: 'LINE-001', name: '西站', sequence: 4, is_terminal: true }
  ];
  
  // 2 号线车站
  const stationsLine2 = [
    { id: 'ST-011', line_id: 'LINE-002', name: '北站', sequence: 0, is_terminal: true },
    { id: 'ST-012', line_id: 'LINE-002', name: '市政中心', sequence: 1 },
    { id: 'ST-013', line_id: 'LINE-002', name: '中心站', sequence: 2 },
    { id: 'ST-014', line_id: 'LINE-002', name: '商业中心', sequence: 3 },
    { id: 'ST-015', line_id: 'LINE-002', name: '南站', sequence: 4, is_terminal: true }
  ];
  
  for (const station of [...stationsLine1, ...stationsLine2]) {
    topologyService.createStation(station);
  }
  
  console.log('3. 创建区间...');
  
  // 1 号线区间
  const sectionsLine1 = [
    { id: 'SEC-001', line_id: 'LINE-001', name: '东客站-人民广场区间', start_station_id: 'ST-001', end_station_id: 'ST-002', length_km: 2.5 },
    { id: 'SEC-002', line_id: 'LINE-001', name: '人民广场-中心站区间', start_station_id: 'ST-002', end_station_id: 'ST-003', length_km: 1.8 },
    { id: 'SEC-003', line_id: 'LINE-001', name: '中心站-科技园区间', start_station_id: 'ST-003', end_station_id: 'ST-004', length_km: 3.2 },
    { id: 'SEC-004', line_id: 'LINE-001', name: '科技园-西站区间', start_station_id: 'ST-004', end_station_id: 'ST-005', length_km: 2.1 }
  ];
  
  // 2 号线区间
  const sectionsLine2 = [
    { id: 'SEC-011', line_id: 'LINE-002', name: '北站-市政中心区间', start_station_id: 'ST-011', end_station_id: 'ST-012', length_km: 1.5 },
    { id: 'SEC-012', line_id: 'LINE-002', name: '市政中心-中心站区间', start_station_id: 'ST-012', end_station_id: 'ST-013', length_km: 2.0 },
    { id: 'SEC-013', line_id: 'LINE-002', name: '中心站-商业中心区间', start_station_id: 'ST-013', end_station_id: 'ST-014', length_km: 1.7 },
    { id: 'SEC-014', line_id: 'LINE-002', name: '商业中心-南站区间', start_station_id: 'ST-014', end_station_id: 'ST-015', length_km: 2.3 }
  ];
  
  for (const section of [...sectionsLine1, ...sectionsLine2]) {
    topologyService.createSection(section);
  }
  
  console.log('4. 创建施工队...');
  
  const teams = [
    { id: 'TEAM-001', name: '轨道维修一队', leader_name: '张建国', leader_phone: '13800000001', team_size: 15, specialization: '轨道检修、更换钢轨' },
    { id: 'TEAM-002', name: '轨道维修二队', leader_name: '李强', leader_phone: '13800000002', team_size: 12, specialization: '道岔检修、轨道巡检' },
    { id: 'TEAM-003', name: '接触网维护一队', leader_name: '王军', leader_phone: '13800000003', team_size: 10, specialization: '接触网检修、绝缘子清扫' },
    { id: 'TEAM-004', name: '接触网维护二队', leader_name: '刘伟', leader_phone: '13800000004', team_size: 8, specialization: '接触网应急抢修' },
    { id: 'TEAM-005', name: '信号调试组', leader_name: '陈明', leader_phone: '13800000005', team_size: 8, specialization: '信号系统调试、ATP 测试' },
    { id: 'TEAM-006', name: '应急抢修队', leader_name: '赵刚', leader_phone: '13800000006', team_size: 20, specialization: '紧急故障抢修、多专业协作' }
  ];
  
  for (const team of teams) {
    resourceService.createTeam(team);
  }
  
  console.log('5. 创建接触网分区...');
  
  const catenaryZones = [
    { id: 'CAT-001', line_id: 'LINE-001', name: '1号线供电分区A（东段）', start_section_id: 'SEC-001', end_section_id: 'SEC-002', power_supply: '变电所A' },
    { id: 'CAT-002', line_id: 'LINE-001', name: '1号线供电分区B（西段）', start_section_id: 'SEC-003', end_section_id: 'SEC-004', power_supply: '变电所B' },
    { id: 'CAT-003', line_id: 'LINE-002', name: '2号线供电分区A（北段）', start_section_id: 'SEC-011', end_section_id: 'SEC-012', power_supply: '变电所C' },
    { id: 'CAT-004', line_id: 'LINE-002', name: '2号线供电分区B（南段）', start_section_id: 'SEC-013', end_section_id: 'SEC-014', power_supply: '变电所D' }
  ];
  
  for (const zone of catenaryZones) {
    resourceService.createCatenaryZone(zone);
  }
  
  console.log('6. 创建行车调度命令...');
  
  const dispatchCommands = [
    { id: 'CMD-001', code: 'BLK-001', name: '区间封锁命令', command_type: 'blockade', description: '封锁指定区间进行施工作业，禁止列车进入' },
    { id: 'CMD-002', code: 'BLK-002', name: '车站封锁命令', command_type: 'blockade', description: '封锁指定车站进行施工作业' },
    { id: 'CMD-003', code: 'POW-001', name: '接触网停电命令', command_type: 'power', description: '对指定接触网分区进行停电操作' },
    { id: 'CMD-004', code: 'POW-002', name: '接触网送电命令', command_type: 'power', description: '对指定接触网分区进行送电操作' },
    { id: 'CMD-005', code: 'TRF-001', name: '行车调整命令', command_type: 'traffic', description: '调整行车计划，配合施工作业' },
    { id: 'CMD-006', code: 'EMG-001', name: '紧急抢修命令', command_type: 'emergency', description: '紧急情况下的抢修作业命令' }
  ];
  
  for (const cmd of dispatchCommands) {
    resourceService.createDispatchCommand(cmd);
  }
  
  console.log('7. 创建示例封锁计划...');
  
  // 今日日期（用于生成时间）
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().slice(0, 10);
  
  const plans = [
    // 计划 1：轨道检修
    {
      plan_number: 'BLK-20240520-0001',
      line_id: 'LINE-001',
      work_type: '轨道检修',
      work_content: '更换东客站-人民广场区间磨耗超标钢轨，共涉及3处病害点',
      construction_team_id: 'TEAM-001',
      priority: 1,
      is_emergency: false,
      status: 'draft',
      start_time: `${dateStr} 23:30:00`,
      end_time: `${tomorrowStr} 04:30:00`,
      first_train_time: `${tomorrowStr} 05:30:00`,
      power_off_required: false,
      catenary_zone_ids: [],
      section_ids: ['SEC-001', 'SEC-002'],
      station_ids: ['ST-001', 'ST-002', 'ST-003'],
      dispatch_command_id: 'CMD-001',
      applicant_id: 'APP-001',
      applicant_name: '张三',
      notes: '需配合探伤报告确认病害位置'
    },
    // 计划 2：接触网维护
    {
      plan_number: 'BLK-20240520-0002',
      line_id: 'LINE-001',
      work_type: '接触网维护',
      work_content: '接触网绝缘子清扫和检查，中心站-科技园区间',
      construction_team_id: 'TEAM-003',
      priority: 2,
      is_emergency: false,
      status: 'draft',
      start_time: `${dateStr} 23:45:00`,
      end_time: `${tomorrowStr} 04:00:00`,
      first_train_time: `${tomorrowStr} 05:30:00`,
      power_off_required: true,
      catenary_zone_ids: ['CAT-002'],
      section_ids: ['SEC-003'],
      station_ids: ['ST-003', 'ST-004'],
      dispatch_command_id: 'CMD-003',
      applicant_id: 'APP-002',
      applicant_name: '李四',
      notes: '需确认停电作业票已办理'
    },
    // 计划 3：信号调试
    {
      plan_number: 'BLK-20240520-0003',
      line_id: 'LINE-002',
      work_type: '信号调试',
      work_content: '中心站 ATP 系统升级调试',
      construction_team_id: 'TEAM-005',
      priority: 1,
      is_emergency: false,
      status: 'draft',
      start_time: `${dateStr} 23:50:00`,
      end_time: `${tomorrowStr} 03:30:00`,
      first_train_time: `${tomorrowStr} 05:30:00`,
      power_off_required: false,
      catenary_zone_ids: [],
      section_ids: ['SEC-012', 'SEC-013'],
      station_ids: ['ST-012', 'ST-013', 'ST-014'],
      dispatch_command_id: 'CMD-001',
      applicant_id: 'APP-003',
      applicant_name: '王五',
      notes: '需配合厂家工程师到场'
    },
    // 计划 4：紧急抢修（已提交）
    {
      plan_number: 'BLK-20240520-0004',
      line_id: 'LINE-002',
      work_type: '紧急抢修',
      work_content: '南站附近道岔故障紧急抢修，影响早高峰运营',
      construction_team_id: 'TEAM-006',
      priority: 10,
      is_emergency: true,
      status: 'submitted',
      start_time: `${dateStr} 23:00:00`,
      end_time: `${tomorrowStr} 05:00:00`,
      first_train_time: `${tomorrowStr} 05:30:00`,
      power_off_required: false,
      catenary_zone_ids: [],
      section_ids: ['SEC-014'],
      station_ids: ['ST-014', 'ST-015'],
      dispatch_command_id: 'CMD-006',
      applicant_id: 'APP-004',
      applicant_name: '赵六',
      notes: '运营期间发现故障，已登记运统-46'
    }
  ];
  
  for (const plan of plans) {
    planStateMachine.createPlan(plan);
  }
  
  console.log('');
  console.log('========================================');
  console.log('示例数据初始化完成！');
  console.log('========================================');
  console.log('');
  console.log('已创建数据：');
  console.log(`  - 线路: 2 条 (1号线、2号线)`);
  console.log(`  - 车站: 10 个`);
  console.log(`  - 区间: 8 个`);
  console.log(`  - 施工队: 6 个`);
  console.log(`  - 接触网分区: 4 个`);
  console.log(`  - 调度命令: 6 个`);
  console.log(`  - 封锁计划: 4 个（草稿3个，已提交1个紧急抢修）`);
  console.log('');
  console.log('数据已保存到 data/blockade.db');
  console.log('');
  console.log('下一步：运行 npm start 启动服务');
  console.log('========================================');
  
  process.exit(0);
}

initSampleData().catch(error => {
  console.error('初始化示例数据失败:', error);
  process.exit(1);
});
