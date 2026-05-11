const { GiftLockService, LOCK_STATES } = require('../src/services/giftLockService');
const dataStore = require('../src/models/dataStore');

class TestRunner {
  constructor() {
    this.service = new GiftLockService();
    this.results = [];
  }

  reset() {
    dataStore.reset();
    dataStore.initializeDefaultData('default');
  }

  runScenario(name, description, steps) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`场景: ${name}`);
    console.log(`描述: ${description}`);
    console.log(`${'='.repeat(60)}\n`);

    const scenarioResult = {
      name,
      description,
      steps: [],
      overallStatus: null
    };

    let stepPassed = true;

    for (const step of steps) {
      if (!stepPassed && step.requiresSuccess) {
        console.log(`\n⏭️  跳过步骤: ${step.name} (依赖步骤失败)`);
        scenarioResult.steps.push({
          name: step.name,
          status: 'SKIPPED',
          reason: '前置步骤失败'
        });
        continue;
      }

      console.log(`\n--- 步骤: ${step.name} ---`);
      console.log(`期望结果: ${step.expected}`);

      const result = step.execute();

      if (step.expected === 'NORMAL' && result.resultType === 'NORMAL' && result.success) {
        console.log(`✅ 正常处理 - ${result.message || '操作成功'}`);
        if (result.details) {
          console.log(`   详情: ${JSON.stringify(result.details, null, 2)}`);
        }
        scenarioResult.steps.push({ name: step.name, status: 'PASSED', resultType: 'NORMAL', result });
      } else if (step.expected === 'FAILURE' && !result.success) {
        console.log(`❌ 失败原因: ${result.errorMessage}`);
        console.log(`   错误码: ${result.errorCode}`);
        console.log(`   处理建议: ${result.actionRequired}`);
        scenarioResult.steps.push({ name: step.name, status: 'PASSED', resultType: 'FAILURE', result });
      } else if (step.expected === 'CORRECTED' && result.resultType === 'CORRECTED') {
        console.log(`🔧 修正成功 - ${result.message || '人工修正已应用'}`);
        if (result.details) {
          console.log(`   详情: ${JSON.stringify(result.details, null, 2)}`);
        }
        scenarioResult.steps.push({ name: step.name, status: 'PASSED', resultType: 'CORRECTED', result });
      } else {
        console.log(`⚠️  结果与预期不符`);
        console.log(`   预期: ${step.expected}`);
        console.log(`   实际: ${result.resultType || (result.success ? 'SUCCESS' : 'FAILURE')}`);
        console.log(`   完整响应: ${JSON.stringify(result, null, 2)}`);
        stepPassed = false;
        scenarioResult.steps.push({ name: step.name, status: 'FAILED', expected: step.expected, actual: result });
      }

      if (step.requiresSuccess && !stepPassed) {
        break;
      }
    }

    const allPassed = scenarioResult.steps.every(s => s.status === 'PASSED');
    scenarioResult.overallStatus = allPassed ? 'PASSED' : 'FAILED';

    console.log(`\n${allPassed ? '✅' : '❌'} 场景 "${name}" ${allPassed ? '通过' : '失败'}`);
    this.results.push(scenarioResult);

    return allPassed;
  }

  printSummary() {
    console.log(`\n\n${'#'.repeat(60)}`);
    console.log(`测试总结`);
    console.log(`${'#'.repeat(60)}\n`);

    const passed = this.results.filter(r => r.overallStatus === 'PASSED').length;
    const failed = this.results.filter(r => r.overallStatus === 'FAILED').length;

    console.log(`总场景数: ${this.results.length}`);
    console.log(`通过: ${passed}`);
    console.log(`失败: ${failed}\n`);

    this.results.forEach((result, index) => {
      console.log(`${index + 1}. [${result.overallStatus === 'PASSED' ? '✅' : '❌'}] ${result.name}`);
      result.steps.forEach((step, stepIndex) => {
        const statusIcon = step.status === 'PASSED' ? '   ├─ ✅' :
                          step.status === 'FAILED' ? '   ├─ ❌' : '   ├─ ⏭️';
        console.log(`${statusIcon} ${step.name} [${step.resultType || step.status}]`);
      });
    });

    console.log(`\n输出标志说明:`);
    console.log(`  ✅ NORMAL - 正常处理（验收通过标志）`);
    console.log(`  ❌ FAILURE - 失败原因（需要处理的标志）`);
    console.log(`  🔧 CORRECTED - 修正后重跑（人工修正标志）`);
    console.log(`  ⏭️ SKIPPED - 跳过（前置失败）`);
  }
}

const scenarios = {
  '正常流程：锁定-释放': {
    description: '验证正常的赠品锁定和释放流程',
    steps: [
      {
        name: '用户资格预校验',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          return {
            success: true,
            resultType: 'NORMAL',
            ...new GiftLockService().verifyQualification({
              userId: 'USER001',
              activityId: 'default',
              orderAmount: 600
            })
          };
        }
      },
      {
        name: '锁定赠品库存',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          const service = new GiftLockService();
          const result = service.lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_TEST_001',
            orderAmount: 600
          });
          if (result.success) {
            global.testLockRecordId = result.lockRecordId;
          }
          return result;
        }
      },
      {
        name: '查询锁定状态',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const status = new GiftLockService().getLockStatus(global.testLockRecordId);
          return {
            success: status.found && status.state === LOCK_STATES.LOCKED,
            resultType: status.found ? 'NORMAL' : 'FAILURE',
            ...status
          };
        }
      },
      {
        name: '取消订单，释放赠品',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          return new GiftLockService().releaseGift({
            lockRecordId: global.testLockRecordId,
            reason: '用户取消订单'
          });
        }
      },
      {
        name: '验证释放后状态',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const status = new GiftLockService().getLockStatus(global.testLockRecordId);
          return {
            success: status.found && status.state === LOCK_STATES.RELEASED,
            resultType: status.found && status.state === LOCK_STATES.RELEASED ? 'NORMAL' : 'FAILURE',
            ...status
          };
        }
      }
    ]
  },

  '缺字段场景': {
    description: '验证缺少必要字段时的错误处理',
    steps: [
      {
        name: '缺少 activityId',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().lockGift({
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_TEST_002',
            orderAmount: 600
          });
        }
      },
      {
        name: '缺少 giftId 和 userId',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().lockGift({
            activityId: 'default',
            orderId: 'ORDER_TEST_003',
            orderAmount: 600
          });
        }
      },
      {
        name: '释放时缺少 lockRecordId',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().releaseGift({});
        }
      }
    ]
  },

  '重复提交场景': {
    description: '验证同一订单不能重复锁定同一赠品',
    steps: [
      {
        name: '首次锁定',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          const service = new GiftLockService();
          return service.lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_DUP_TEST',
            orderAmount: 600
          });
        }
      },
      {
        name: '使用相同订单号再次锁定（应该失败）',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_DUP_TEST',
            orderAmount: 600
          });
        }
      }
    ]
  },

  '用户资格校验场景': {
    description: '验证资格校验与原始数据对得上',
    steps: [
      {
        name: '非VIP用户（USER002）资格校验',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER002',
            orderId: 'ORDER_QUAL_001',
            orderAmount: 600
          });
        }
      },
      {
        name: '订单金额未达门槛（400元，门槛500元）',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_QUAL_002',
            orderAmount: 400
          });
        }
      },
      {
        name: '验证资格校验输出与原始数据对比',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const verification = new GiftLockService().verifyQualification({
            userId: 'USER001',
            activityId: 'default',
            orderAmount: 600
          });

          const userQual = dataStore.userQualifications.get('USER001');
          const activity = dataStore.activities.get('default');

          const matchesOriginal =
            verification.verification.userQualification.userId === userQual.userId &&
            verification.verification.userQualification.userLevel === userQual.userLevel &&
            verification.verification.activityRules.requiredUserLevel === activity.rules.requiredUserLevel &&
            verification.verification.activityRules.minOrderAmount === activity.rules.minOrderAmount;

          return {
            success: matchesOriginal && verification.verification.qualified,
            resultType: matchesOriginal && verification.verification.qualified ? 'NORMAL' : 'FAILURE',
            message: matchesOriginal ? '资格校验结果与原始数据一致' : '资格校验结果与原始数据不一致',
            originalData: {
              userLevel: userQual.userLevel,
              requiredLevel: activity.rules.requiredUserLevel,
              orderAmount: 600,
              minOrderAmount: activity.rules.minOrderAmount
            },
            verificationResult: verification.verification
          };
        }
      }
    ]
  },

  '非法流转场景': {
    description: '验证状态流转的合法性，特别是释放环节的异常',
    steps: [
      {
        name: '先锁定赠品',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          const result = new GiftLockService().lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_FLOW_001',
            orderAmount: 600
          });
          if (result.success) {
            global.flowLockId = result.lockRecordId;
          }
          return result;
        }
      },
      {
        name: '第一次释放（正常）',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          return new GiftLockService().releaseGift({
            lockRecordId: global.flowLockId,
            reason: '订单取消'
          });
        }
      },
      {
        name: '重复释放已释放的记录（非法流转）',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().releaseGift({
            lockRecordId: global.flowLockId,
            reason: '重复取消'
          });
        }
      },
      {
        name: '释放不存在的锁定记录',
        expected: 'FAILURE',
        execute: () => {
          return new GiftLockService().releaseGift({
            lockRecordId: 'LOCK_NONEXISTENT',
            reason: '测试'
          });
        }
      }
    ]
  },

  '人工修正场景（含修正后重跑）': {
    description: '验证人工修正接口和修正后重跑流程',
    steps: [
      {
        name: '创建锁定记录',
        expected: 'NORMAL',
        requiresSuccess: true,
        execute: () => {
          const result = new GiftLockService().lockGift({
            activityId: 'default',
            giftId: 'GIFT001',
            userId: 'USER001',
            orderId: 'ORDER_CORR_001',
            orderAmount: 600
          });
          if (result.success) {
            global.corrLockId = result.lockRecordId;
          }
          return result;
        }
      },
      {
        name: '模拟库存不一致（手动设置 locked = 0）',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const inventory = dataStore.inventory.get('GIFT001');
          inventory.locked = 0;
          return {
            success: true,
            resultType: 'NORMAL',
            message: '已模拟库存数据不一致',
            inventoryState: { available: inventory.available, locked: inventory.locked }
          };
        }
      },
      {
        name: '尝试释放（应失败，触发人工修正需求）',
        expected: 'FAILURE',
        requiresSuccess: true,
        execute: () => {
          return new GiftLockService().releaseGift({
            lockRecordId: global.corrLockId,
            reason: '订单取消'
          });
        }
      },
      {
        name: '验证记录处于需要人工修正状态',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const status = new GiftLockService().getLockStatus(global.corrLockId);
          return {
            success: status.needsManualCorrection,
            resultType: status.needsManualCorrection ? 'NORMAL' : 'FAILURE',
            message: status.needsManualCorrection ? '记录正确标记为需要人工修正' : '记录未正确标记',
            ...status
          };
        }
      },
      {
        name: '执行人工修正：FORCE_RELEASE',
        expected: 'CORRECTED',
        requiresSuccess: true,
        execute: () => {
          return new GiftLockService().manualCorrect({
            lockRecordId: global.corrLockId,
            correctionType: 'FORCE_RELEASE',
            operatorId: 'ADMIN_001',
            correctionReason: '库存数据不一致，人工强制释放'
          });
        }
      },
      {
        name: '验证修正后状态',
        expected: 'NORMAL',
        requiresSuccess: false,
        execute: () => {
          const status = new GiftLockService().getLockStatus(global.corrLockId);
          const released = status.state === LOCK_STATES.RELEASED;
          return {
            success: released,
            resultType: released ? 'NORMAL' : 'FAILURE',
            message: released ? '修正后状态正确' : '修正后状态异常',
            ...status
          };
        }
      }
    ]
  }
};

module.exports = {
  TestRunner,
  scenarios
};
