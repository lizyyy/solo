const fs = require('fs');
const path = require('path');
const RescueSystem = require('../src/core/RescueSystem');

console.log('🧪 ========================================');
console.log('🧪 山地步道救援系统核心测试');
console.log('🧪 ========================================\n');

let passedTests = 0;
let failedTests = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✅ PASS: ${message}`);
    passedTests++;
  } else {
    console.log(`❌ FAIL: ${message}`);
    failedTests++;
  }
}

const sampleDataPath = path.join(__dirname, '../data/sample-data.json');
const sampleData = JSON.parse(fs.readFileSync(sampleDataPath, 'utf8'));

console.log('📦 测试数据加载...');
assert(sampleData.nodes.length === 10, '样例数据包含10个节点');
assert(sampleData.connections.length === 11, '样例数据包含11条连接');
assert(sampleData.teams.length === 3, '样例数据包含3支队伍');
assert(sampleData.alarms.length === 2, '样例数据包含2个报警');
console.log();

console.log('🔧 测试 1: 系统初始化');
const rescueSystem = new RescueSystem();
rescueSystem.initialize(sampleData);
const status = rescueSystem.getSystemStatus();
assert(status.totalNodes === 10, '系统初始化后节点数量正确');
assert(status.totalTeams === 3, '系统初始化后队伍数量正确');
assert(status.standbyTeams === 3, '所有队伍初始状态为待命');
assert(status.pendingAlarms === 2, '所有报警初始状态为待处理');
console.log();

console.log('🔧 测试 2: 高差计算');
const pathManager = rescueSystem.pathManager;
const testPath1 = ['N6', 'N5', 'N4', 'N3'];
const elevationGain = pathManager.calculateTotalElevationGain(testPath1);
const elevationLoss = pathManager.calculateTotalElevationLoss(testPath1);
const distance = pathManager.calculateTotalDistance(testPath1);

console.log(`   📊 路径: N6 → N5 → N4 → N3`);
console.log(`   📊 爬升: ${elevationGain}m (预期: 0m, 持续下降)`);
console.log(`   📊 下降: ${elevationLoss}m (预期: ~720m)`);
console.log(`   📊 距离: ${distance.toFixed(1)} 单位`);

assert(elevationGain === 0, '持续下降路径爬升为0');
assert(elevationLoss > 700, '下降高度计算正确 (>700m)');
assert(distance > 250, '距离计算正确 (>250单位)');

const testPath2 = ['N1', 'N2', 'N3', 'N4', 'N5', 'N6'];
const gain2 = pathManager.calculateTotalElevationGain(testPath2);
const loss2 = pathManager.calculateTotalElevationLoss(testPath2);
console.log(`   📊 路径2: N1 → N2 → N3 → N4 → N5 → N6`);
console.log(`   📊 爬升: ${gain2}m (预期: ~970m)`);
console.log(`   📊 下降: ${loss2}m (预期: ~70m)`);

assert(gain2 > 800, '主要爬升路径计算正确 (>800m)');
assert(loss2 > 0, '路径包含部分下降');
console.log();

console.log('🔧 测试 3: 路径查找');
const shortestPath = pathManager.findShortestPath('N1', 'N6', false);
const elevationAwarePath = pathManager.findShortestPath('N1', 'N6', true);

console.log(`   🛤️  最短路径: ${shortestPath ? shortestPath.join(' → ') : 'null'}`);
console.log(`   ⛰️  高差优先路径: ${elevationAwarePath ? elevationAwarePath.join(' → ') : 'null'}`);

assert(shortestPath !== null, '能找到最短路径');
assert(elevationAwarePath !== null, '能找到高差优先路径');
assert(shortestPath.length > 1, '路径包含至少2个节点');
console.log();

console.log('🔧 测试 4: 预计到达时间计算');
const etaResult = rescueSystem.calculateETA('TEAM_A', 'N6');

console.log(`   ⏱️  队伍 TEAM_A 到 N6 的 ETA:`);
console.log(`   ⏱️  总时间: ${etaResult ? etaResult.formattedETA : 'null'}`);
console.log(`   ⏱️  基础时间: ${etaResult ? etaResult.baseTime.toFixed(1) : 'null'} 分钟`);
console.log(`   ⏱️  高差惩罚: +${etaResult ? etaResult.elevationPenalty.toFixed(1) : 'null'} 分钟`);
console.log(`   ⏱️  风险惩罚: +${etaResult ? etaResult.riskPenalty.toFixed(1) : 'null'} 分钟`);

assert(etaResult !== null, '能计算 ETA');
assert(etaResult.totalTime > etaResult.baseTime, '总时间 > 基础时间（包含惩罚）');
assert(etaResult.elevationPenalty > 0, '存在高差惩罚');
console.log();

console.log('🔧 测试 5: 风险评估');
const pathWithRisk = ['N1', 'N3', 'N5', 'N8'];
const riskResult = rescueSystem.calculateRouteRisk(pathWithRisk);

console.log(`   ⚠️  路径风险评估:`);
console.log(`   ⚠️  平均风险: ${riskResult.averageRisk.toFixed(1)}`);
console.log(`   ⚠️  最高风险: ${riskResult.maxRisk}`);
console.log(`   ⚠️  综合风险: ${riskResult.overallRisk.toFixed(1)}`);

assert(riskResult.maxRisk >= 3, '路径包含高风险节点');
assert(riskResult.averageRisk > 0, '平均风险 > 0');
console.log();

console.log('🔧 测试 6: 自动分配队伍');
const initialPending = rescueSystem.getSystemStatus().pendingAlarms;
const assignResult = rescueSystem.assignBestTeam('ALARM_001');

console.log(`   🚁  分配结果:`);
console.log(`   🚁  分配队伍: ${assignResult ? assignResult.team.name : 'null'}`);
console.log(`   🚁  预计到达: ${assignResult ? assignResult.eta.formattedETA : 'null'}`);

const newStatus = rescueSystem.getSystemStatus();
assert(assignResult !== null, '成功分配队伍');
assert(newStatus.assignedAlarms === 1, '有1个报警已分配');
assert(newStatus.movingTeams === 1, '有1支队伍在移动');
console.log();

console.log('🔧 测试 7: 路线报告生成');
const report = rescueSystem.generateRouteReport('ALARM_001');

console.log(`   📄 报告生成:`);
console.log(`   📄 报告ID: ${report ? report.alarmId : 'null'}`);
console.log(`   📄 执行队伍: ${report ? report.teamName : 'null'}`);
console.log(`   📄 建议数量: ${report ? report.recommendations.length : 'null'}`);

assert(report !== null, '能生成路线报告');
assert(report.elevationProfile.length > 1, '报告包含海拔剖面图');
assert(report.eta !== null, '报告包含 ETA 信息');
console.log();

console.log('🔧 测试 8: 风险标记更新');
const originalRisk = pathManager.getNode('N5').riskLevel;
rescueSystem.markNodeRisk('N5', 5);
const updatedRisk = pathManager.getNode('N5').riskLevel;

assert(updatedRisk === 5, `风险等级从 ${originalRisk} 更新为 5`);

rescueSystem.markNodeRisk('N5', 0);
const resetRisk = pathManager.getNode('N5').riskLevel;
assert(resetRisk === 0, `风险等级重置为 0`);
console.log();

console.log('🔧 测试 9: 队伍速度更新');
const teamBefore = rescueSystem.teams.get('TEAM_A');
rescueSystem.updateTeamSpeed('TEAM_A', 15.0);
const teamAfter = rescueSystem.teams.get('TEAM_A');

assert(teamAfter.speed === 15.0, `队伍速度从 ${teamBefore.speed} 更新为 15.0`);
console.log();

console.log('🔧 测试 10: 异常情况处理');
console.log('   🧪 测试无效节点 ETA 计算...');
const invalidNodeEta = rescueSystem.calculateETA('TEAM_A', 'INVALID_NODE');
assert(invalidNodeEta === null, '无效目标节点返回 null');

console.log('   🧪 测试无路径情况...');
const noPath = pathManager.findShortestPath('N1', 'INVALID_NODE');
assert(noPath === null, '无效路径查找返回 null');

console.log('   🧪 测试无待命队伍时分配...');
rescueSystem.teams.forEach(t => t.status = 'moving');
const noTeamsResult = rescueSystem.assignBestTeam('ALARM_002');
assert(noTeamsResult === null, '无待命队伍时返回 null');

rescueSystem.teams.get('TEAM_B').status = 'standby';
rescueSystem.teams.get('TEAM_C').status = 'standby';
console.log();

console.log('🧪 ========================================');
console.log('🧪 测试完成');
console.log(`🧪 通过: ${passedTests} | 失败: ${failedTests}`);
console.log('🧪 ========================================');

process.exit(failedTests > 0 ? 1 : 0);
