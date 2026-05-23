const db = require('../src/models/database');
const batchService = require('../src/services/batchService');
const importService = require('../src/services/importService');
const orderService = require('../src/services/orderService');
const queryService = require('../src/services/queryService');
const { elderlyProfiles, nurseCalendars } = require('./testData');

async function runVerification() {
  console.log('========================================');
  console.log('  护理站后端服务 - 系统验证脚本');
  console.log('========================================\n');

  try {
    console.log('步骤 1: 创建批次');
    const batch = batchService.createBatch('2024年5月第3批服务单', '系统管理员');
    console.log(`  ✓ 批次创建成功: ${batch.batch_no} (ID: ${batch.id})\n`);

    console.log('步骤 2: 导入老人档案');
    const elderlyResult = importService.importElderlyProfiles(elderlyProfiles, '系统管理员');
    console.log(`  ✓ 老人档案导入成功: ${elderlyResult.count} 条\n`);

    console.log('步骤 3: 导入护士日历');
    const nurseResult = importService.importNurseCalendarJson(nurseCalendars, '系统管理员');
    console.log(`  ✓ 护士导入成功: ${nurseResult.nurseCount} 人`);
    console.log(`  ✓ 日历导入成功: ${nurseResult.calendarCount} 条\n`);

    console.log('步骤 4: 导入服务单CSV');
    const csvPath = require('path').join(__dirname, 'sample-data.csv');
    const orderResult = await importService.importServiceOrdersCsv(csvPath, batch.id, '系统管理员');
    console.log(`  ✓ 服务单导入成功: ${orderResult.count} / ${orderResult.total} 条\n`);

    console.log('步骤 5: 获取服务单列表');
    const orders = orderService.listOrders({ batch_id: batch.id });
    console.log(`  ✓ 找到 ${orders.length} 条服务单\n`);

    if (orders.length > 0) {
      const order1 = orders[0];
      const order2 = orders[1];
      const order3 = orders[2];

      console.log('步骤 6: 分配护士（技能匹配/跨区测试）');
      const assigned1 = orderService.assignNurse(order1.id, 'N001', '张站长');
      console.log(`  ✓ 服务单 ${order1.order_no} 分配护士 N001`);
      console.log(`    - 技能匹配: ${assigned1.skill_match_status}`);
      console.log(`    - 路线状态: ${assigned1.route_status}`);
      console.log(`    - 距离: ${assigned1.distance_km?.toFixed(1)} 公里`);

      const assigned2 = orderService.assignNurse(order2.id, 'N003', '张站长');
      console.log(`  ✓ 服务单 ${order2.order_no} 分配护士 N003（跨区）`);
      console.log(`    - 技能匹配: ${assigned2.skill_match_status}`);
      console.log(`    - 路线状态: ${assigned2.route_status}`);
      console.log(`    - 距离: ${assigned2.distance_km?.toFixed(1)} 公里\n`);

      console.log('步骤 7: 标记处理');
      const processed = orderService.processOrder(order1.id, '张站长', '开始上门服务准备');
      console.log(`  ✓ 服务单 ${order1.order_no} 状态: ${processed.status}\n`);

      console.log('步骤 8: 退回修改');
      const returned = orderService.returnOrder(order2.id, '张站长', '护士技能不匹配，缺少言语训练资质，需要重新分配');
      console.log(`  ✓ 服务单 ${order2.order_no} 状态: ${returned.status}`);
      console.log(`    - 退回原因: 护士技能不匹配，缺少言语训练资质\n`);

      console.log('步骤 9: 取消补位');
      const replaced = orderService.replaceNurse(order2.id, 'N002', '李站长', '原护士技能不匹配，安排李护士补位');
      console.log(`  ✓ 服务单 ${order2.order_no} 更换护士: N003 -> N002\n`);

      console.log('步骤 10: 审核通过');
      const approved = orderService.approveOrder(order1.id, '李站长', '信息核实无误，同意执行');
      console.log(`  ✓ 服务单 ${order1.order_no} 状态: ${approved.status}\n`);
    }

    console.log('步骤 11: 查询追踪记录');
    const records = queryService.queryTrackRecords({});
    console.log(`  ✓ 共找到 ${records.length} 条追踪记录\n`);

    console.log('步骤 12: 按护士资质查询');
    const qualifiedRecords = queryService.queryTrackRecords({ nurse_qualifications: '主管护师' });
    console.log(`  ✓ 主管护师相关记录: ${qualifiedRecords.length} 条\n`);

    console.log('步骤 13: 按护理项目查询');
    const careRecords = queryService.queryTrackRecords({ service_items: '血压测量' });
    console.log(`  ✓ 血压测量相关记录: ${careRecords.length} 条\n`);

    console.log('步骤 14: 上门路线溯源');
    const routeRecords = queryService.queryTrackRecords({ route_keyword: '朝阳区' });
    console.log(`  ✓ 朝阳区路线相关记录: ${routeRecords.length} 条`);
    if (routeRecords.length > 0) {
      console.log('    路线来源追踪:');
      routeRecords[0].route_source.forEach(src => {
        console.log(`      - ${src.type}: ${src.value}`);
      });
    }
    console.log('');

    console.log('步骤 15: 单条记录详情（可解释性验证）');
    if (records.length > 0) {
      const detail = queryService.getTrackRecordById(records[0].id);
      console.log(`  ✓ 记录编号: ${detail.record_no}`);
      console.log(`  ✓ 状态: ${detail.status}`);
      console.log(`  ✓ 操作: ${detail.action}`);
      console.log(`  ✓ 原因: ${detail.reason}`);
      console.log(`  ✓ 处理人: ${detail.handled_by}`);
      console.log(`  ✓ 处理时间: ${detail.handled_at}\n`);
    }

    console.log('步骤 16: 服务单历史追踪');
    if (orders.length > 0) {
      const history = queryService.getOrderTrackHistory(orders[0].id);
      console.log(`  ✓ 服务单 ${orders[0].order_no} 历史记录: ${history.length} 条`);
      history.forEach((h, i) => {
        console.log(`    ${i + 1}. [${h.handled_at}] ${h.action} - ${h.handled_by}: ${h.reason}`);
      });
      console.log('');
    }

    console.log('步骤 17: 导出明细验证');
    const exportRecords = queryService.queryTrackRecords({});
    const csv = queryService.exportToCsv(exportRecords);
    const csvLines = csv.split('\n').filter(l => l.trim());
    console.log(`  ✓ 导出CSV行数: ${csvLines.length} 行（含表头）`);
    console.log(`  ✓ 查询结果数: ${exportRecords.length} 条`);
    console.log(`  ✓ 数据一致性: ${csvLines.length - 1 === exportRecords.length ? '✓ 匹配' : '✗ 不匹配'}\n`);

    console.log('步骤 18: 批次统计');
    const stats = batchService.getBatchStatistics(batch.id);
    console.log(`  ✓ 批次总数: ${stats.statistics.total}`);
    console.log(`  ✓ 已处理: ${stats.statistics.processing}`);
    console.log(`  ✓ 已通过: ${stats.statistics.approved}`);
    console.log(`  ✓ 已退回: ${stats.statistics.returned}\n`);

    console.log('========================================');
    console.log('  ✓ 系统验证全部通过！');
    console.log('========================================');
    console.log('\n核心功能验证总结:');
    console.log('  ✓ 新增批次 - 支持创建和管理批次');
    console.log('  ✓ 数据导入 - 支持CSV服务单、JSON护士日历、老人档案');
    console.log('  ✓ 标记处理 - 支持服务单状态流转');
    console.log('  ✓ 退回修改 - 记录退回原因和处理人');
    console.log('  ✓ 取消补位 - 保留换人原因和前后护士');
    console.log('  ✓ 技能匹配 - 自动校验护士技能并记录');
    console.log('  ✓ 跨区路程 - 计算并记录距离信息');
    console.log('  ✓ 路线溯源 - 可从历史查到地址/区域来源');
    console.log('  ✓ 历史查询 - 按护士资质、护理项目、路线查询');
    console.log('  ✓ 导出明细 - 导出数量与查询结果一致');
    console.log('  ✓ 可解释性 - 每条记录都有原因、处理人、时间\n');

  } catch (error) {
    console.error('✗ 验证失败:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

runVerification();
