const { sequelize } = require('../src/models');
const NetworkNode = require('../src/models/NetworkNode');
const Pipe = require('../src/models/Pipe');
const Valve = require('../src/models/Valve');
const Community = require('../src/models/Community');
const Hospital = require('../src/models/Hospital');
const FireHydrant = require('../src/models/FireHydrant');
const PriorityUser = require('../src/models/PriorityUser');

const sampleData = {
  networkNodes: [
    { id: 'N001', name: '水源站A', nodeType: 'source', longitude: 116.4074, latitude: 39.9042, elevation: 50, zoneId: 'ZONE1' },
    { id: 'N002', name: '干线节点1', nodeType: 'junction', longitude: 116.4174, latitude: 39.9042, elevation: 48, zoneId: 'ZONE1' },
    { id: 'N003', name: '干线节点2', nodeType: 'junction', longitude: 116.4274, latitude: 39.9042, elevation: 46, zoneId: 'ZONE1' },
    { id: 'N004', name: '分支节点1-东', nodeType: 'endpoint', longitude: 116.4224, latitude: 39.9142, elevation: 45, zoneId: 'ZONE1' },
    { id: 'N005', name: '分支节点1-西', nodeType: 'endpoint', longitude: 116.4224, latitude: 39.8942, elevation: 44, zoneId: 'ZONE1' },
    { id: 'N006', name: '分支节点2-北', nodeType: 'endpoint', longitude: 116.4324, latitude: 39.9142, elevation: 43, zoneId: 'ZONE1' },
    { id: 'N007', name: '分支节点2-南', nodeType: 'endpoint', longitude: 116.4324, latitude: 39.8942, elevation: 42, zoneId: 'ZONE1' }
  ],
  pipes: [
    { id: 'P001', name: '水源-干线1', startNodeId: 'N001', endNodeId: 'N002', diameter: 600, material: '铸铁', length: 1200, status: 'active' },
    { id: 'P002', name: '干线1-干线2', startNodeId: 'N002', endNodeId: 'N003', diameter: 500, material: '铸铁', length: 1500, status: 'active' },
    { id: 'P003', name: '干线2-东分支', startNodeId: 'N003', endNodeId: 'N004', diameter: 300, material: 'PE', length: 800, status: 'active' },
    { id: 'P004', name: '干线2-西分支', startNodeId: 'N003', endNodeId: 'N005', diameter: 300, material: 'PE', length: 750, status: 'active' },
    { id: 'P005', name: '干线1-北分支', startNodeId: 'N002', endNodeId: 'N006', diameter: 250, material: 'PE', length: 600, status: 'active' },
    { id: 'P006', name: '干线1-南分支', startNodeId: 'N002', endNodeId: 'N007', diameter: 250, material: 'PE', length: 650, status: 'active' }
  ],
  valves: [
    { id: 'V001', name: '水源出口阀', location: '水源站A出口', longitude: 116.4074, latitude: 39.9042, type: 'main', diameter: 600, networkNodeId: 'N001', status: 'open' },
    { id: 'V002', name: '干线1入口阀', location: '干线1入口处', longitude: 116.4174, latitude: 39.9042, type: 'main', diameter: 500, networkNodeId: 'N002', status: 'open' },
    { id: 'V003', name: '干线2入口阀', location: '干线2入口处', longitude: 116.4274, latitude: 39.9042, type: 'main', diameter: 500, networkNodeId: 'N003', status: 'open' },
    { id: 'V004', name: '东分支控制阀', location: '东分支管段', longitude: 116.4224, latitude: 39.9142, type: 'branch', diameter: 300, networkNodeId: 'N004', status: 'open' },
    { id: 'V005', name: '西分支控制阀', location: '西分支管段', longitude: 116.4224, latitude: 39.8942, type: 'branch', diameter: 300, networkNodeId: 'N005', status: 'open' },
    { id: 'V006', name: '北分支控制阀', location: '北分支管段', longitude: 116.4324, latitude: 39.9142, type: 'branch', diameter: 250, networkNodeId: 'N006', status: 'open' },
    { id: 'V007', name: '南分支控制阀', location: '南分支管段', longitude: 116.4324, latitude: 39.8942, type: 'branch', diameter: 250, networkNodeId: 'N007', status: 'open' }
  ],
  communities: [
    { id: 'C001', name: '阳光花园小区', address: '东区文化路123号', households: 450, population: 1350, networkNodeId: 'N004', waterPressure: 0.35, contactPerson: '张物业', contactPhone: '13800138001' },
    { id: 'C002', name: '幸福里小区', address: '西区建设街88号', households: 320, population: 960, networkNodeId: 'N004', waterPressure: 0.32, contactPerson: '李主任', contactPhone: '13800138002' },
    { id: 'C003', name: '民生家园', address: '北区学府路256号', households: 280, population: 840, networkNodeId: 'N006', waterPressure: 0.34, contactPerson: '王经理', contactPhone: '13800138003' },
    { id: 'C004', name: '河畔新村', address: '南区江滨路168号', households: 560, population: 1680, networkNodeId: 'N007', waterPressure: 0.31, contactPerson: '赵主管', contactPhone: '13800138004' },
    { id: 'C005', name: '安居小区', address: '西区利民路99号', households: 380, population: 1140, networkNodeId: 'N005', waterPressure: 0.33, contactPerson: '孙师傅', contactPhone: '13800138005' },
    { id: 'C006', name: '丽景湾小区', address: '东区滨海路777号', households: 620, population: 1860, networkNodeId: 'N004', waterPressure: 0.30, contactPerson: '周助理', contactPhone: '13800138006' }
  ],
  hospitals: [
    { id: 'H001', name: '市第一人民医院', address: '东区健康路100号', level: 'tertiary', beds: 800, hasIcu: true, networkNodeId: 'N004', backupWater: true, contactPerson: '刘院长', contactPhone: '13900139001' },
    { id: 'H002', name: '社区卫生服务中心', address: '北区幸福街50号', level: 'primary', beds: 50, hasIcu: false, networkNodeId: 'N006', backupWater: false, contactPerson: '陈医生', contactPhone: '13900139002' },
    { id: 'H003', name: '仁爱医院', address: '南区安宁路200号', level: 'secondary', beds: 300, hasIcu: false, networkNodeId: 'N007', backupWater: true, contactPerson: '杨主任', contactPhone: '13900139003' }
  ],
  fireHydrants: [
    { id: 'FH001', location: '文化路与建设路交叉口', longitude: 116.4234, latitude: 39.9132, type: 'ground', networkNodeId: 'N004', status: 'active' },
    { id: 'FH002', location: '东区分局门口', longitude: 116.4214, latitude: 39.9122, type: 'ground', networkNodeId: 'N004', status: 'active' },
    { id: 'FH003', location: '北区公园南门', longitude: 116.4314, latitude: 39.9132, type: 'underground', networkNodeId: 'N006', status: 'active' },
    { id: 'FH004', location: '南区农贸市场', longitude: 116.4314, latitude: 39.8932, type: 'ground', networkNodeId: 'N007', status: 'active' },
    { id: 'FH005', location: '西区小学门口', longitude: 116.4214, latitude: 39.8932, type: 'ground', networkNodeId: 'N005', status: 'active' },
    { id: 'FH006', location: '东区商业街', longitude: 116.4244, latitude: 39.9152, type: 'ground', networkNodeId: 'N004', status: 'active' }
  ],
  priorityUsers: [
    { id: 'PU001', name: '市政务中心', type: 'government', address: '东区行政路1号', priorityLevel: '1', networkNodeId: 'N004', waterDemand: 120, contactPerson: '吴主任', contactPhone: '13700137001' },
    { id: 'PU002', name: '重点中学', type: 'school', address: '北区学府路100号', priorityLevel: '1', networkNodeId: 'N006', waterDemand: 80, contactPerson: '郑校长', contactPhone: '13700137002' },
    { id: 'PU003', name: '化工园区', type: 'industrial', address: '南区工业园区1号', priorityLevel: '2', networkNodeId: 'N007', waterDemand: 500, contactPerson: '孙总', contactPhone: '13700137003' },
    { id: 'PU004', name: '购物中心', type: 'commercial', address: '东区商业圈1号', priorityLevel: '2', networkNodeId: 'N004', waterDemand: 200, contactPerson: '钱经理', contactPhone: '13700137004' },
    { id: 'PU005', name: '敬老院', type: 'senior_center', address: '西区养老街88号', priorityLevel: '1', networkNodeId: 'N005', waterDemand: 60, contactPerson: '冯院长', contactPhone: '13700137005' },
    { id: 'PU006', name: '污水处理厂', type: 'utility', address: '南区环保路50号', priorityLevel: '2', networkNodeId: 'N007', waterDemand: 1000, contactPerson: '胡厂长', contactPhone: '13700137006' }
  ]
};

async function seedDatabase() {
  try {
    console.log('[Database] 开始同步数据库...');
    await sequelize.sync({ force: true });
    console.log('[Database] 数据库表重建完成');

    console.log('[Seed] 开始插入网络节点...');
    await NetworkNode.bulkCreate(sampleData.networkNodes);
    console.log(`[Seed] 已插入 ${sampleData.networkNodes.length} 个网络节点`);

    console.log('[Seed] 开始插入管道...');
    await Pipe.bulkCreate(sampleData.pipes);
    console.log(`[Seed] 已插入 ${sampleData.pipes.length} 条管道`);

    console.log('[Seed] 开始插入阀门...');
    await Valve.bulkCreate(sampleData.valves);
    console.log(`[Seed] 已插入 ${sampleData.valves.length} 个阀门`);

    console.log('[Seed] 开始插入小区...');
    await Community.bulkCreate(sampleData.communities);
    console.log(`[Seed] 已插入 ${sampleData.communities.length} 个小区`);

    console.log('[Seed] 开始插入医院...');
    await Hospital.bulkCreate(sampleData.hospitals);
    console.log(`[Seed] 已插入 ${sampleData.hospitals.length} 家医院`);

    console.log('[Seed] 开始插入消防栓...');
    await FireHydrant.bulkCreate(sampleData.fireHydrants);
    console.log(`[Seed] 已插入 ${sampleData.fireHydrants.length} 个消防栓`);

    console.log('[Seed] 开始插入优先级用户...');
    await PriorityUser.bulkCreate(sampleData.priorityUsers);
    console.log(`[Seed] 已插入 ${sampleData.priorityUsers.length} 个优先级用户`);

    console.log('\n========================================');
    console.log('  数据初始化完成！');
    console.log('========================================\n');
    console.log('网络拓扑说明:');
    console.log('  - 水源站A (N001) -> 干线节点1 (N002) -> 干线节点2 (N003)');
    console.log('  - N002 连接: 北分支(N006)、南分支(N007)');
    console.log('  - N003 连接: 东分支(N004)、西分支(N005)');
    console.log('\n测试场景:');
    console.log('  - 顺利样例: 关闭V007(南分支控制阀) -> 影响N007区域');
    console.log('    (河畔新村C004、仁爱医院H003、消防栓FH004)');
    console.log('  - 待复核样例: 关闭V006(北分支控制阀) -> 影响N006区域');
    console.log('    (民生家园C003、社区卫生服务中心H002、重点中学PU002)');
    console.log('    -> 触发: 一级优先级用户(重点中学) -> 需要人工复核');
    console.log('  - 大影响样例: 关闭V003(干线2入口阀) -> 影响N003、N004、N005');
    console.log('    (阳光花园C001、幸福里C002、丽景湾C006、安居小区C005)');
    console.log('    (市第一人民医院H001、敬老院PU005、市政务中心PU001)');
    console.log('    -> 触发: 一级优先级用户(政务中心、敬老院) -> 需要人工复核');
    console.log('\n========================================\n');

    process.exit(0);
  } catch (error) {
    console.error('[Error] 数据初始化失败:', error);
    process.exit(1);
  }
}

seedDatabase();
