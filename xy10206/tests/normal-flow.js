const client = require('./httpClient');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const printHeader = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
};

const printSuccess = (message) => {
  console.log(`✓ ${message}`);
};

const printInfo = (message) => {
  console.log(`  ${message}`);
};

const runNormalFlow = async () => {
  console.log('\n🎭 舞台灯光预设回滚 API - 正常流程测试');
  console.log('场景：《天鹅湖》第二幕 - 月夜湖畔');
  console.log('剧情：彩排过程中灯光师多次调整，导演审批后冻结，演出前发现问题回滚到确认版本\n');

  try {
    await sleep(500);
    
    printHeader('Step 1: 查询当前场景状态');
    const sceneRes = await client.get('/api/scenes/scene-001');
    printSuccess(`获取场景成功: ${sceneRes.body.data.name}`);
    printInfo(`当前状态: ${sceneRes.body.data.status}`);
    printInfo(`当前激活预设: ${sceneRes.body.data.activePreset?.version || '无'}`);

    printHeader('Step 2: 灯光师小张创建新版本 v3.0.0（浪漫紫调）');
    const newPresetRes = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v3.0.0',
      name: '浪漫紫调升级版',
      description: '导演要求增加浪漫氛围，调整主光为紫色调',
      lightPositions: {
        '主光-左': { intensity: 75, color: '#7C3AED', pan: 0, tilt: -15 },
        '主光-右': { intensity: 75, color: '#7C3AED', pan: 0, tilt: -15 },
        '面光-1': { intensity: 45, color: '#EDE9FE', pan: 0, tilt: 0 },
        '面光-2': { intensity: 45, color: '#EDE9FE', pan: 0, tilt: 0 },
        '追光-1': { intensity: 100, color: '#FFFFFF', pan: 0, tilt: -30 },
        '环境光': { intensity: 30, color: '#C4B5FD', pan: 0, tilt: 0 }
      },
      createdBy: '灯光师-小张'
    });
    printSuccess(`创建预设成功: ${newPresetRes.body.data.version} - ${newPresetRes.body.data.name}`);
    printInfo(`预设状态: ${newPresetRes.body.data.status}`);
    const presetV3Id = newPresetRes.body.data.id;

    printHeader('Step 3: 小张继续微调灯位参数');
    const updateRes = await client.put(`/api/presets/${presetV3Id}`, {
      name: '浪漫紫调升级版（微调）',
      description: '增加环境光亮度，调整追光角度',
      lightPositions: {
        '主光-左': { intensity: 72, color: '#6D28D9', pan: 0, tilt: -15 },
        '主光-右': { intensity: 72, color: '#6D28D9', pan: 0, tilt: -15 },
        '面光-1': { intensity: 48, color: '#EDE9FE', pan: 0, tilt: 0 },
        '面光-2': { intensity: 48, color: '#EDE9FE', pan: 0, tilt: 0 },
        '追光-1': { intensity: 100, color: '#FFFFFF', pan: 5, tilt: -25 },
        '环境光': { intensity: 35, color: '#C4B5FD', pan: 0, tilt: 0 }
      }
    });
    printSuccess(`更新预设成功: ${updateRes.body.data.name}`);
    printInfo(`最后更新: ${updateRes.body.data.updatedAt}`);

    printHeader('Step 4: 小张提交版本 v3.0.0 申请审批');
    const submitRes = await client.post('/api/approvals/submit', {
      presetId: presetV3Id,
      requestedBy: '灯光师-小张',
      reason: '根据导演意见调整紫调氛围，已完成三次彩排测试'
    });
    printSuccess(`提交审批成功`);
    printInfo(`审批ID: ${submitRes.body.data.approval.id}`);
    printInfo(`预设状态变更为: ${submitRes.body.data.preset.status}`);
    const approvalId = submitRes.body.data.approval.id;

    printHeader('Step 5: 导演王导审批通过');
    const approveRes = await client.post('/api/approvals/decide', {
      approvalId: approvalId,
      approvedBy: '导演-王导',
      decision: 'APPROVE',
      reason: '紫调效果很好，符合月夜浪漫氛围，可以冻结'
    });
    printSuccess(`审批通过: ${approveRes.body.message}`);
    printInfo(`审批人: ${approveRes.body.data.approval.decidedBy}`);
    printInfo(`预设状态: ${approveRes.body.data.preset.status}`);

    printHeader('Step 6: 技术主管冻结版本 v3.0.0（演出前确认）');
    const freezeRes = await client.post('/api/presets/freeze', {
      presetId: presetV3Id,
      operator: '技术主管-李工'
    });
    printSuccess(`版本冻结成功: ${freezeRes.body.message}`);
    printInfo(`冻结人: ${freezeRes.body.data.frozenBy}`);
    printInfo(`冻结时间: ${freezeRes.body.data.frozenAt}`);

    printHeader('Step 7: 激活版本 v3.0.0 为当前演出版本');
    const activateRes = await client.post('/api/presets/activate', {
      presetId: presetV3Id,
      operator: '灯光师-小张'
    });
    printSuccess(`版本激活成功: ${activateRes.body.message}`);
    printInfo(`激活版本: ${activateRes.body.data.preset.version}`);
    printInfo(`激活人: ${activateRes.body.data.preset.activatedBy}`);

    printHeader('Step 8: 彩排中发现问题 - 需要回滚到 v1.0.0 确认版');
    printInfo('问题描述：紫调在实际舞台上与演员服装颜色冲突');
    const rollbackRes = await client.post('/api/presets/rollback', {
      sceneId: 'scene-001',
      targetPresetId: 'preset-001-v1',
      rolledBackBy: '技术主管-李工',
      reason: '紫调与白天鹅服装颜色冲突，紧急回滚至原始确认版本 v1.0.0'
    });
    printSuccess(`回滚成功: ${rollbackRes.body.message}`);
    printInfo(`回滚记录ID: ${rollbackRes.body.data.rollback.id}`);
    printInfo(`从版本: ${rollbackRes.body.data.rollback.fromVersion}`);
    printInfo(`回滚至: ${rollbackRes.body.data.rollback.toVersion}`);
    printInfo(`回滚原因: ${rollbackRes.body.data.rollback.reason}`);

    printHeader('Step 9: 验证当前激活版本');
    const finalSceneRes = await client.get('/api/scenes/scene-001');
    printSuccess(`场景当前激活版本: ${finalSceneRes.body.data.activePreset.version}`);
    printInfo(`版本名称: ${finalSceneRes.body.data.activePreset.name}`);
    printInfo(`版本状态: ${finalSceneRes.body.data.activePreset.status}`);

    printHeader('Step 10: 演出前锁定场景，防止误修改');
    const lockRes = await client.post('/api/scenes/lock', {
      sceneId: 'scene-001',
      lockedBy: '技术主管-李工',
      reason: '演出前1小时，锁定场景防止误操作'
    });
    printSuccess(`场景锁定成功: ${lockRes.body.message}`);
    printInfo(`锁定人: ${lockRes.body.data.lockedBy}`);
    printInfo(`锁定时间: ${lockRes.body.data.lockedAt}`);

    console.log('\n🎉 正常流程测试全部通过！');
    console.log('\n📋 总结：');
    console.log('  1. 灯光师创建并多次调整预设版本');
    console.log('  2. 导演审批通过后技术主管冻结版本');
    console.log('  3. 彩排发现问题后快速回滚到确认版本');
    console.log('  4. 演出前锁定场景防止误修改');
    return true;

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
};

module.exports = runNormalFlow;

if (require.main === module) {
  runNormalFlow().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}
