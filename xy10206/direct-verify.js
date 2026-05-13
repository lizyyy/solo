const { initSampleData, database } = require('./models/database');
const { PresetStatus, SceneStatus } = require('./models/types');
const { createBusinessError } = require('./services/errors');

const presetService = require('./services/presetService');
const sceneService = require('./services/sceneService');
const approvalService = require('./services/approvalService');

initSampleData();

const printHeader = (title) => {
  console.log('\n' + '='.repeat(70));
  console.log(`  ${title}`);
  console.log('='.repeat(70));
};

const printSuccess = (message) => {
  console.log(`✅ ${message}`);
};

const printInfo = (message) => {
  console.log(`   ${message}`);
};

const printError = (message) => {
  console.log(`❌ ${message}`);
};

const assertEqual = (actual, expected, message) => {
  if (actual !== expected) {
    throw new Error(`${message}: 期望 ${expected}，实际 ${actual}`);
  }
};

const runVerification = async () => {
  console.log('🎭 舞台灯光预设回滚 API - 服务层直接验证');
  console.log('场景：《天鹅湖》第二幕 - 月夜湖畔\n');

  try {
    printHeader('Step 1: 验证初始数据加载');
    
    const scenes = sceneService.getAllScenes();
    assertEqual(scenes.length, 1, '场景数量');
    assertEqual(scenes[0].id, 'scene-001', '场景ID');
    printSuccess('初始场景数据正确');
    
    const presets = presetService.getAllPresets('scene-001');
    assertEqual(presets.length, 2, '预设数量');
    printSuccess('初始预设数据正确');
    
    const scene = sceneService.getSceneById('scene-001');
    assertEqual(scene.status, SceneStatus.UNLOCKED, '场景状态');
    printInfo(`场景名称: ${scene.name}`);
    printInfo(`当前激活版本: ${scene.activePreset?.version || '无'}`);

    printHeader('Step 2: 灯光师创建新版本 v3.0.0（浪漫紫调）');
    
    const newPresetResult = presetService.createPreset({
      sceneId: 'scene-001',
      version: 'v3.0.0',
      name: '浪漫紫调升级版',
      description: '导演要求增加浪漫氛围，调整主光为紫色调',
      lightPositions: {
        '主光-左': { intensity: 75, color: '#7C3AED', pan: 0, tilt: -15 },
        '主光-右': { intensity: 75, color: '#7C3AED', pan: 0, tilt: -15 },
        '面光-1': { intensity: 45, color: '#EDE9FE', pan: 0, tilt: 0 },
        '追光-1': { intensity: 100, color: '#FFFFFF', pan: 0, tilt: -30 }
      },
      createdBy: '灯光师-小张'
    });
    assertEqual(newPresetResult.preset.version, 'v3.0.0', '预设版本');
    assertEqual(newPresetResult.preset.status, PresetStatus.DRAFT, '预设状态');
    printSuccess(`创建预设成功: ${newPresetResult.preset.version} - ${newPresetResult.preset.name}`);
    const presetV3Id = newPresetResult.preset.id;

    printHeader('Step 3: 小张继续微调灯位参数');
    
    const updateResult = presetService.updatePreset(presetV3Id, {
      name: '浪漫紫调升级版（微调）',
      description: '增加环境光亮度，调整追光角度',
      lightPositions: {
        '主光-左': { intensity: 72, color: '#6D28D9', pan: 0, tilt: -15 },
        '主光-右': { intensity: 72, color: '#6D28D9', pan: 0, tilt: -15 },
        '追光-1': { intensity: 100, color: '#FFFFFF', pan: 5, tilt: -25 }
      }
    });
    assertEqual(updateResult.preset.name, '浪漫紫调升级版（微调）', '预设名称');
    printSuccess(`更新预设成功: ${updateResult.preset.name}`);

    printHeader('Step 4: 小张提交版本 v3.0.0 申请审批');
    
    const submitResult = approvalService.submitForApproval({
      presetId: presetV3Id,
      requestedBy: '灯光师-小张',
      reason: '根据导演意见调整紫调氛围，已完成三次彩排测试'
    });
    assertEqual(submitResult.preset.status, PresetStatus.PENDING, '预设状态变更为待审批');
    printSuccess(`提交审批成功`);
    printInfo(`预设状态: ${submitResult.preset.status}`);
    const approvalId = submitResult.approval.id;

    printHeader('Step 5: 导演王导审批通过');
    
    const approveResult = approvalService.makeApprovalDecision({
      approvalId: approvalId,
      approvedBy: '导演-王导',
      decision: 'APPROVE',
      reason: '紫调效果很好，符合月夜浪漫氛围，可以冻结'
    });
    assertEqual(approveResult.preset.status, PresetStatus.APPROVED, '预设状态变更为已批准');
    assertEqual(approveResult.preset.approvedBy, '导演-王导', '审批人');
    printSuccess(`审批通过`);
    printInfo(`审批人: ${approveResult.preset.approvedBy}`);

    printHeader('Step 6: 技术主管冻结版本 v3.0.0（演出前确认）');
    
    const freezeResult = presetService.freezePreset(presetV3Id, '技术主管-李工');
    assertEqual(freezeResult.preset.status, PresetStatus.FROZEN, '预设状态变更为已冻结');
    assertEqual(freezeResult.preset.frozenBy, '技术主管-李工', '冻结人');
    printSuccess(`版本冻结成功`);
    printInfo(`冻结人: ${freezeResult.preset.frozenBy}`);

    printHeader('Step 7: 激活版本 v3.0.0 为当前演出版本');
    
    const activateResult = presetService.activatePreset(presetV3Id, '灯光师-小张');
    assertEqual(activateResult.preset.status, PresetStatus.ACTIVE, '预设状态变更为激活');
    assertEqual(activateResult.scene.activePresetId, presetV3Id, '场景激活版本');
    printSuccess(`版本激活成功`);
    printInfo(`激活版本: ${activateResult.preset.version}`);

    printHeader('Step 8: 彩排中发现问题 - 需要回滚到 v1.0.0 确认版');
    printInfo('问题描述：紫调在实际舞台上与演员服装颜色冲突');
    
    const rollbackResult = presetService.rollbackPreset({
      sceneId: 'scene-001',
      targetPresetId: 'preset-001-v1',
      rolledBackBy: '技术主管-李工',
      reason: '紫调与白天鹅服装颜色冲突，紧急回滚至原始确认版本 v1.0.0'
    });
    assertEqual(rollbackResult.preset.version, 'v1.0.0', '回滚到目标版本');
    assertEqual(rollbackResult.preset.status, PresetStatus.ACTIVE, '目标版本状态为激活');
    printSuccess(`回滚成功: ${rollbackResult.message}`);
    printInfo(`从版本: ${rollbackResult.rollback.fromVersion}`);
    printInfo(`回滚至: ${rollbackResult.rollback.toVersion}`);

    printHeader('Step 9: 演出前锁定场景，防止误修改');
    
    const lockResult = sceneService.lockScene({
      sceneId: 'scene-001',
      lockedBy: '技术主管-李工',
      reason: '演出前1小时，锁定场景防止误操作'
    });
    assertEqual(lockResult.scene.status, SceneStatus.LOCKED, '场景状态为已锁定');
    assertEqual(lockResult.scene.lockedBy, '技术主管-李工', '锁定人');
    printSuccess(`场景锁定成功`);
    printInfo(`锁定人: ${lockResult.scene.lockedBy}`);
    printInfo(`锁定原因: ${lockResult.scene.lockReason}`);

    printHeader('Step 10: 验证场景锁定保护（关键缺陷修复验证）');
    printInfo('尝试在场景锁定后执行各种操作...');
    
    let caughtError = null;
    
    try {
      presetService.createPreset({
        sceneId: 'scene-001',
        version: 'v9.9.9',
        name: '锁定后创建测试',
        lightPositions: { '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 } },
        createdBy: '测试员'
      });
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'SCENE_LOCKED') {
      printSuccess('✅ 场景锁定后禁止创建预设');
    } else {
      printError('❌ 场景锁定后仍可创建预设！这是一个严重缺陷');
      throw new Error('场景锁定保护失效：创建预设');
    }
    
    caughtError = null;
    try {
      presetService.freezePreset('preset-001-v2', '测试员');
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'SCENE_LOCKED') {
      printSuccess('✅ 场景锁定后禁止冻结预设');
    } else {
      printError('❌ 场景锁定后仍可冻结预设！这是一个严重缺陷');
      throw new Error('场景锁定保护失效：冻结预设');
    }
    
    caughtError = null;
    try {
      presetService.activatePreset('preset-001-v2', '测试员');
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'SCENE_LOCKED') {
      printSuccess('✅ 场景锁定后禁止激活预设');
    } else {
      printError('❌ 场景锁定后仍可激活预设！这是一个严重缺陷');
      throw new Error('场景锁定保护失效：激活预设');
    }
    
    caughtError = null;
    try {
      presetService.rollbackPreset({
        sceneId: 'scene-001',
        targetPresetId: 'preset-001-v2',
        rolledBackBy: '测试员',
        reason: '测试回滚'
      });
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'SCENE_LOCKED') {
      printSuccess('✅ 场景锁定后禁止回滚预设');
    } else {
      printError('❌ 场景锁定后仍可回滚预设！这是一个严重缺陷');
      throw new Error('场景锁定保护失效：回滚预设');
    }

    printHeader('Step 11: 解锁场景，恢复编辑能力');
    
    const unlockResult = sceneService.unlockScene({
      sceneId: 'scene-001',
      unlockedBy: '技术主管-李工',
      reason: '演出结束，解锁场景'
    });
    assertEqual(unlockResult.scene.status, SceneStatus.UNLOCKED, '场景状态为已解锁');
    printSuccess(`场景解锁成功`);

    printHeader('Step 12: 异常测试 - 验证参数校验');
    printInfo('测试各种错误输入...');
    
    caughtError = null;
    try {
      presetService.createPreset({
        sceneId: 'scene-001',
        version: 'v1.0.0',
        name: '重复版本测试',
        lightPositions: { '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 } },
        createdBy: '测试员'
      });
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'PRESET_ALREADY_EXISTS') {
      printSuccess('✅ 正确拦截重复版本号');
    } else {
      printError('❌ 未能拦截重复版本号');
      throw new Error('参数校验失效：重复版本号');
    }
    
    caughtError = null;
    try {
      presetService.createPreset({
        sceneId: 'scene-001',
        version: 'v9.9.8',
        name: '缺少灯位参数',
        createdBy: '测试员'
      });
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'MISSING_REQUIRED_FIELDS') {
      printSuccess('✅ 正确检测缺少必要字段');
    } else {
      printError('❌ 未能检测缺少必要字段');
      throw new Error('参数校验失效：缺少字段');
    }
    
    caughtError = null;
    try {
      presetService.createPreset({
        sceneId: 'scene-001',
        version: 'v9.9.7',
        name: '无效亮度',
        lightPositions: { '主光-左': { intensity: 150, color: '#FFFFFF', pan: 0, tilt: 0 } },
        createdBy: '测试员'
      });
    } catch (err) {
      caughtError = err;
    }
    if (caughtError && caughtError.code === 'INVALID_LIGHT_POSITION') {
      printSuccess('✅ 正确检测亮度参数错误');
    } else {
      printError('❌ 未能检测亮度参数错误');
      throw new Error('参数校验失效：亮度参数');
    }

    console.log('\n' + '='.repeat(70));
    console.log('  🎉 所有验证通过！');
    console.log('='.repeat(70));
    console.log('\n📋 验证总结：');
    console.log('  ✅ 核心业务流程：创建 → 审批 → 冻结 → 激活 → 回滚 → 锁定');
    console.log('  ✅ 场景锁定保护：锁定后禁止创建、冻结、激活、回滚');
    console.log('  ✅ 参数校验：重复版本号、缺少字段、无效参数');
    console.log('  ✅ 业务缺陷修复：场景锁定状态检查已添加到所有关键操作');
    console.log('\n💡 此验证直接调用服务层，不依赖 HTTP 端口');
    console.log('   即使所有网络端口都被阻止，核心业务逻辑仍可验证');
    
    return true;

  } catch (error) {
    console.error('\n❌ 验证失败:', error.message);
    if (error.code) {
      console.error(`   错误码: ${error.code}`);
    }
    if (error.stack) {
      console.error(error.stack);
    }
    return false;
  }
};

runVerification().then(passed => {
  process.exit(passed ? 0 : 1);
});
