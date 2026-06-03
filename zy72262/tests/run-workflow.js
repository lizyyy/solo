const fs = require('fs');
const path = require('path');
const { ObstacleService } = require('../src/service');

console.log('========================================');
console.log('医院物流机器人避障系统 - 完整工作流测试');
console.log('========================================\n');

function step(num, title) {
  console.log(`\n【步骤 ${num}】${title}`);
  console.log('─'.repeat(50));
}

async function runWorkflow() {
  try {
    step(1, '导入障碍物备注（告警标签被遮挡）');
    const obstacleData = JSON.parse(
      fs.readFileSync(path.join(__dirname, '..', 'examples', 'obstacle-blocked-tag.json'), 'utf8')
    );
    const { obstacle: obs1, report: r1 } = ObstacleService.importObstacle(obstacleData);
    console.log('✓ 障碍物导入成功，ID:', obs1.id);
    console.log('  告警标签状态:', obs1.alarmTagBlocked ? '❌ 被遮挡' : '✅ 正常');
    console.log('  当前状态:', obs1.status);
    console.log('  负责人:', obs1.assignedTo);
    console.log('  下一步:', obs1.nextAction);
    console.log('  安全距离报告已生成:', r1.id);

    const details1 = ObstacleService.getObstacleWithDetails(obs1.id);
    console.log('\n  证据摘要:');
    console.log('    - 障碍物备注:', details1.evidenceSummary.obstacleRemark);
    console.log('    - 楼层剖面草图:', details1.evidenceSummary.floorPlanSketch || '(未关联)');
    console.log('    - 告警标签:', details1.evidenceSummary.alarmTagBlocked ? '被遮挡' : '正常');

    step(2, '施工经理复核（告警标签遮挡）');
    const { obstacle: obs2, report: r2 } = ObstacleService.reviewByManager(obs1.id, {
      approved: true,
      remark: '已现场复核，告警标签确实被手遮挡，但障碍物位置描述准确'
    });
    console.log('✓ 施工经理复核完成');
    console.log('  施工经理已复核:', obs2.reviewedByManager ? '是' : '否');
    console.log('  当前状态:', obs2.status);
    console.log('  负责人:', obs2.assignedTo);
    console.log('  下一步:', obs2.nextAction);
    console.log('  安全距离报告已更新:', r2.id);

    step(3, '创建楼层剖面草图');
    const fp = ObstacleService.createFloorPlan({
      floor: 'B1',
      name: 'B1层西侧走廊剖面',
      description: '包含消防栓位置、走廊宽度等详细信息'
    });
    console.log('✓ 楼层剖面草图创建成功');
    console.log('  草图ID:', fp.id);
    console.log('  楼层:', fp.floor);
    console.log('  名称:', fp.name);

    step(4, '关联障碍物与楼层剖面草图');
    const { obstacle: obs3, floorPlan, report: r3 } = ObstacleService.attachFloorPlan(obs2.id, fp.id);
    console.log('✓ 楼层剖面草图关联成功');
    console.log('  关联草图:', floorPlan.name);
    console.log('  当前状态:', obs3.status);
    console.log('  负责人:', obs3.assignedTo);
    console.log('  下一步:', obs3.nextAction);
    console.log('  安全距离报告已更新:', r3.id);

    step(5, '园区运维小陶补看并复核');
    const { obstacle: obs4, report: r4 } = ObstacleService.reviewByTao(obs3.id, {
      approved: true
    });
    console.log('✓ 园区运维小陶复核完成');
    console.log('  当前状态:', obs4.status);
    console.log('  负责人:', obs4.assignedTo);
    console.log('  下一步:', obs4.nextAction);
    console.log('  安全距离报告已最终更新:', r4.id);

    const details2 = ObstacleService.getObstacleWithDetails(obs4.id);
    console.log('\n  最终证据摘要:');
    console.log('    - 障碍物备注:', details2.evidenceSummary.obstacleRemark);
    console.log('    - 楼层剖面草图:', details2.evidenceSummary.floorPlanSketch);
    console.log('    - 告警标签:', details2.evidenceSummary.alarmTagBlocked ? '被遮挡' : '正常');

    step(6, '查看最终安全距离报告');
    console.log(r4.content);

    step(7, '查看统计数据');
    const stats = ObstacleService.getStatistics();
    console.log('  障碍物总数:', stats.totalObstacles);
    console.log('  告警标签遮挡:', stats.blockedTags);
    console.log('  待施工经理复核:', stats.pendingManagerReview);
    console.log('  待补楼层剖面:', stats.pendingFloorPlan);
    console.log('  已完成:', stats.completed);

    console.log('\n========================================');
    console.log('✓ 完整工作流测试通过！');
    console.log('========================================');
    console.log('\n数据文件保存在 data/ 目录下');

  } catch (e) {
    console.error('\n❌ 测试失败:', e.message);
    console.error(e.stack);
    process.exit(1);
  }
}

runWorkflow();
