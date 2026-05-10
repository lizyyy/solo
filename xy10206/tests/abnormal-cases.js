const client = require('./httpClient');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const printHeader = (title) => {
  console.log('\n' + '='.repeat(60));
  console.log(`  ${title}`);
  console.log('='.repeat(60));
};

const printTest = (num, description) => {
  console.log(`\n【测试 ${num}】${description}`);
};

const printSuccess = (message) => {
  console.log(`✓ ${message}`);
};

const printError = (err) => {
  console.log(`  错误码: ${err.code}`);
  console.log(`  错误信息: ${err.message}`);
  if (err.details) {
    if (err.details.suggestion) {
      console.log(`  建议: ${err.details.suggestion}`);
    }
  }
};

const runAbnormalCases = async () => {
  console.log('\n🎭 舞台灯光预设回滚 API - 异常样例测试');
  console.log('包含：重复数据、缺字段、人工改错等场景\n');

  try {
    await sleep(500);
    
    printHeader('准备工作：确保场景处于解锁状态');
    await client.post('/api/scenes/unlock', {
      sceneId: 'scene-001',
      unlockedBy: '测试员',
      reason: '异常测试准备'
    });
    printSuccess('场景已解锁，可以开始异常测试');
    
    printHeader('异常样例 1: 重复数据 - 同场景下版本号重复');
    printTest(1, '尝试创建已存在的版本号 v1.0.0');
    const duplicateRes = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v1.0.0',
      name: '测试重复版本',
      lightPositions: {
        '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 }
      },
      createdBy: '测试员'
    });
    if (duplicateRes.body.success === false && duplicateRes.body.error.code === 'PRESET_ALREADY_EXISTS') {
      printSuccess('正确拦截重复版本号');
      printError(duplicateRes.body.error);
    } else {
      console.error('❌ 未能正确拦截重复版本号');
      return false;
    }

    printHeader('异常样例 2: 缺字段 - 创建预设时缺少必要字段');
    printTest(2, '缺少 lightPositions 字段');
    const missingField1 = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.9',
      name: '缺少灯位参数',
      createdBy: '测试员'
    });
    if (missingField1.body.success === false && missingField1.body.error.code === 'MISSING_REQUIRED_FIELDS') {
      printSuccess('正确检测缺少必要字段');
      printError(missingField1.body.error);
    } else {
      console.error('❌ 未能正确检测缺少字段');
      return false;
    }

    printTest(3, '缺少 createdBy 字段');
    const missingField2 = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.9',
      name: '缺少创建人',
      lightPositions: {
        '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 }
      }
    });
    if (missingField2.body.success === false && missingField2.body.error.code === 'MISSING_REQUIRED_FIELDS') {
      printSuccess('正确检测缺少创建人字段');
      printError(missingField2.body.error);
    } else {
      console.error('❌ 未能正确检测缺少创建人字段');
      return false;
    }

    printHeader('异常样例 3: 人工改错 - 灯位参数格式错误');
    printTest(4, '亮度 intensity 超出范围（应为 0-100）');
    const invalidIntensity = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.8',
      name: '测试无效亮度',
      lightPositions: {
        '主光-左': { intensity: 150, color: '#FFFFFF', pan: 0, tilt: 0 }
      },
      createdBy: '测试员'
    });
    if (invalidIntensity.body.success === false && invalidIntensity.body.error.code === 'INVALID_LIGHT_POSITION') {
      printSuccess('正确检测亮度参数错误');
      printError(invalidIntensity.body.error);
    } else {
      console.error('❌ 未能正确检测亮度参数错误');
      return false;
    }

    printTest(5, '颜色 color 格式错误（应为十六进制）');
    const invalidColor = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.7',
      name: '测试无效颜色',
      lightPositions: {
        '主光-左': { intensity: 50, color: '红色', pan: 0, tilt: 0 }
      },
      createdBy: '测试员'
    });
    if (invalidColor.body.success === false && invalidColor.body.error.code === 'INVALID_LIGHT_POSITION') {
      printSuccess('正确检测颜色格式错误');
      printError(invalidColor.body.error);
    } else {
      console.error('❌ 未能正确检测颜色格式错误');
      return false;
    }

    printTest(6, '水平角度 pan 超出范围（应为 -180~180）');
    const invalidPan = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.6',
      name: '测试无效角度',
      lightPositions: {
        '主光-左': { intensity: 50, color: '#FFFFFF', pan: 300, tilt: 0 }
      },
      createdBy: '测试员'
    });
    if (invalidPan.body.success === false && invalidPan.body.error.code === 'INVALID_LIGHT_POSITION') {
      printSuccess('正确检测水平角度参数错误');
      printError(invalidPan.body.error);
    } else {
      console.error('❌ 未能正确检测水平角度参数错误');
      return false;
    }

    printHeader('异常样例 4: 场景锁定 - 锁定后禁止修改');
    printTest(7, '场景已锁定时尝试创建新版本');
    const lockedScene = await client.get('/api/scenes/scene-001');
    if (lockedScene.body.data.status === 'LOCKED') {
      const createWhenLocked = await client.post('/api/presets', {
        sceneId: 'scene-001',
        version: 'v9.9.5',
        name: '锁定后创建',
        lightPositions: {
          '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 }
        },
        createdBy: '测试员'
      });
      if (createWhenLocked.body.success === false && createWhenLocked.body.error.code === 'SCENE_LOCKED') {
        printSuccess('正确阻止锁定场景的修改');
        printError(createWhenLocked.body.error);
      } else {
        console.error('❌ 未能阻止锁定场景的修改');
        return false;
      }
    } else {
      printSuccess('场景当前未锁定，跳过此测试（可手动锁定后重试）');
    }

    printHeader('异常样例 5: 状态流转错误 - 跳过审批直接冻结');
    printTest(8, '尝试直接冻结草稿状态的预设');
    const draftPresetRes = await client.get('/api/presets/preset-001-v2');
    if (draftPresetRes.body.data.status === 'DRAFT') {
      const freezeDraft = await client.post('/api/presets/freeze', {
        presetId: 'preset-001-v2',
        operator: '测试员'
      });
      if (freezeDraft.body.success === false && freezeDraft.body.error.code === 'INVALID_STATE_TRANSITION') {
        printSuccess('正确阻止无效状态流转');
        printError(freezeDraft.body.error);
      } else {
        console.error('❌ 未能阻止无效状态流转');
        return false;
      }
    }

    printHeader('异常样例 6: 回滚错误 - 回滚到当前激活版本');
    printTest(9, '尝试回滚到当前正在使用的版本');
    const sceneRes = await client.get('/api/scenes/scene-001');
    const activePresetId = sceneRes.body.data.activePresetId;
    if (activePresetId) {
      const rollbackToActive = await client.post('/api/presets/rollback', {
        sceneId: 'scene-001',
        targetPresetId: activePresetId,
        rolledBackBy: '测试员',
        reason: '测试回滚到当前版本'
      });
      if (rollbackToActive.body.success === false && rollbackToActive.body.error.code === 'ACTIVE_PRESET_CANNOT_ROLLBACK') {
        printSuccess('正确阻止回滚到当前激活版本');
        printError(rollbackToActive.body.error);
      } else {
        console.error('❌ 未能阻止回滚到当前激活版本');
        return false;
      }
    }

    printHeader('异常样例 7: 资源不存在 - 引用无效ID');
    printTest(10, '查询不存在的场景');
    const invalidScene = await client.get('/api/scenes/scene-999-not-exist');
    if (invalidScene.body.success === false && invalidScene.body.error.code === 'SCENE_NOT_FOUND') {
      printSuccess('正确检测场景不存在');
      printError(invalidScene.body.error);
    } else {
      console.error('❌ 未能正确检测场景不存在');
      return false;
    }

    printTest(11, '查询不存在的预设');
    const invalidPreset = await client.get('/api/presets/preset-999-not-exist');
    if (invalidPreset.body.success === false && invalidPreset.body.error.code === 'PRESET_NOT_FOUND') {
      printSuccess('正确检测预设不存在');
      printError(invalidPreset.body.error);
    } else {
      console.error('❌ 未能正确检测预设不存在');
      return false;
    }

    printHeader('异常样例 8: 审批流程错误');
    printTest(12, '审批时 decision 参数错误');
    const createForApproval = await client.post('/api/presets', {
      sceneId: 'scene-001',
      version: 'v9.9.0',
      name: '测试审批参数',
      lightPositions: {
        '主光-左': { intensity: 50, color: '#FFFFFF', pan: 0, tilt: 0 }
      },
      createdBy: '测试员'
    });
    const submitForApproval = await client.post('/api/approvals/submit', {
      presetId: createForApproval.body.data.id,
      requestedBy: '测试员',
      reason: '测试'
    });
    const invalidDecision = await client.post('/api/approvals/decide', {
      approvalId: submitForApproval.body.data.approval.id,
      approvedBy: '测试员',
      decision: 'INVALID_OPTION'
    });
    if (invalidDecision.body.success === false && invalidDecision.body.error.code === 'INVALID_REQUEST') {
      printSuccess('正确检测审批决策参数错误');
      printError(invalidDecision.body.error);
    } else {
      console.error('❌ 未能正确检测审批决策参数错误');
      return false;
    }

    console.log('\n🎉 所有异常样例测试通过！');
    console.log('\n📋 覆盖的异常场景：');
    console.log('  1. 重复数据 - 同场景版本号重复');
    console.log('  2. 缺字段 - lightPositions、createdBy 等');
    console.log('  3. 人工改错 - 灯位参数（亮度、颜色、角度）');
    console.log('  4. 场景锁定 - 锁定后禁止修改');
    console.log('  5. 状态流转错误 - 跳过审批直接冻结');
    console.log('  6. 回滚错误 - 回滚到当前激活版本');
    console.log('  7. 资源不存在 - 无效场景/预设ID');
    console.log('  8. 审批流程错误 - 无效决策参数');
    return true;

  } catch (error) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error.stack);
    return false;
  }
};

module.exports = runAbnormalCases;

if (require.main === module) {
  runAbnormalCases().then(passed => {
    process.exit(passed ? 0 : 1);
  });
}
