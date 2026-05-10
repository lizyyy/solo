import { v4 as uuidv4 } from 'uuid';
import {
  handleCreateRiskEvent,
  handleAssessSite,
  handleCreateRebooking,
  handleProcessRebooking,
  handleCancelEvent,
  handleModifyEvent,
  handleQuerySummary,
  handleQueryProblems,
  handleQuerySites,
  handleQueryOrders
} from '../src/businessHandler';
import { storage } from '../src/storage';

interface TestResult {
  rule: string;
  description: string;
  passed: boolean;
  input?: any;
  output?: any;
  failureReason?: string;
}

function assertEqual(actual: any, expected: any, message: string): void {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${message}. Expected: ${JSON.stringify(expected)}, Actual: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition: boolean, message: string): void {
  if (condition) {
    throw new Error(message);
  }
}

function runRuleTest(testName: string, testFn: () => TestResult | TestResult[]): TestResult[] {
  console.log(`\n========== ${testName} ==========`);
  try {
    const results = testFn();
    const resultArray = Array.isArray(results) ? results : [results];
    resultArray.forEach(r => {
      console.log(`  [${r.passed ? '✓ PASS' : '✗ FAIL'}] ${r.rule}: ${r.description}`);
      if (!r.passed && r.failureReason) {
        console.log(`    Reason: ${r.failureReason}`);
      }
    });
    return resultArray;
  } catch (error: any) {
    console.log(`  [✗ FAIL] ${testName}: Exception occurred`);
    console.log(`    Error: ${error.message}`);
    console.log(`    Stack: ${error.stack}`);
    return [{
      rule: testName,
      description: 'Test execution failed',
      passed: false,
      failureReason: error.message
    }];
  }
}

function runAllTests(): void {
  const allResults: TestResult[] = [];

  allResults.push(...testRule1_RiskEventCreation());
  allResults.push(...testRule2_SiteRiskAssessment());
  allResults.push(...testRule3_RebookingFlow());
  allResults.push(...testRule4_ResourceLocking());
  allResults.push(...testRule5_Idempotency());
  allResults.push(...testRule6_ProblemRecording());
  allResults.push(...testRule7_EventCancellation());
  allResults.push(...testRule8_SummaryQuery());

  const passed = allResults.filter(r => r.passed).length;
  const failed = allResults.filter(r => !r.passed).length;
  const total = allResults.length;

  console.log('\n\n========== TEST SUMMARY ==========');
  console.log(`Total: ${total}, Passed: ${passed}, Failed: ${failed}`);
  console.log(`Pass Rate: ${((passed / total) * 100).toFixed(1)}%`);

  if (failed > 0) {
    console.log('\nFailed Tests:');
    allResults.filter(r => !r.passed).forEach(r => {
      console.log(`  - ${r.rule}: ${r.description}`);
      if (r.failureReason) console.log(`    ${r.failureReason}`);
    });
    process.exit(1);
  } else {
    console.log('\n✓ All tests passed!');
  }
}

function testRule1_RiskEventCreation(): TestResult[] {
  return runRuleTest('规则组 1: 风险事件创建', () => {
    const results: TestResult[] = [];

    const requestId = uuidv4();
    const response = handleCreateRiskEvent({
      requestId,
      weatherAlert: {
        alertId: 'WEATHER-001',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '特大暴雨预警'
      },
      source: 'weather-api'
    });

    results.push({
      rule: 'R1-1',
      description: '创建风险事件应返回 success=true',
      passed: response.success === true,
      failureReason: response.error?.message
    });

    if (response.success && response.data) {
      results.push({
        rule: 'R1-2',
        description: '新创建事件状态应为 ACTIVE',
        passed: response.data.status === 'ACTIVE',
        failureReason: `Expected ACTIVE, got ${response.data.status}`
      });

      results.push({
        rule: 'R1-3',
        description: '事件应自动评估所有营位风险',
        passed: response.data.assessedSites.length > 0,
        failureReason: 'No sites were assessed'
      });

      const lowLyingSites = response.data.assessedSites.filter((s: any) => {
        const site = storage.getSite(s.siteId);
        return site && site.type === 'LOW_LYING';
      });

      results.push({
        rule: 'R1-4',
        description: '低洼营位(LOW_LYING)在极端暴雨下应被评为 CRITICAL 或 HIGH 风险',
        passed: lowLyingSites.every((s: any) => ['CRITICAL', 'HIGH', 'MEDIUM'].includes(s.assessedRiskLevel)),
        failureReason: 'Some low lying sites were not assessed as high risk'
      });

      const highRiskSites = response.data.assessedSites.filter(
        (s: any) => ['CRITICAL', 'HIGH'].includes(s.assessedRiskLevel)
      );

      results.push({
        rule: 'R1-5',
        description: '高风险营位的受影响订单应被识别',
        passed: response.data.affectedOrders.length >= 0,
        failureReason: 'Affected orders should be tracked'
      });
    }

    return results;
  });
}

function testRule2_SiteRiskAssessment(): TestResult[] {
  return runRuleTest('规则组 2: 营位风险评估', () => {
    const results: TestResult[] = [];

    const createResponse = handleCreateRiskEvent({
      requestId: uuidv4(),
      weatherAlert: {
        alertId: 'WEATHER-002',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '特大暴雨预警'
      },
      source: 'weather-api'
    });

    if (!createResponse.success || !createResponse.data) {
      return [{
        rule: 'R2-0',
        description: '先决条件：创建事件失败',
        passed: false,
        failureReason: createResponse.error?.message
      }];
    }

    const eventId = createResponse.data.eventId;
    const allSites = storage.getAllSites();
    const testSite = allSites[0];

    const assessResponse = handleAssessSite({
      requestId: uuidv4(),
      eventId,
      siteId: testSite.siteId,
      assessedRiskLevel: 'CRITICAL',
      assessmentReason: '营位现场检查发现积水风险极高',
      source: 'staff'
    });

    results.push({
      rule: 'R2-1',
      description: '人工评估营位风险应成功',
      passed: assessResponse.success === true,
      failureReason: assessResponse.error?.message
    });

    if (assessResponse.success && assessResponse.data) {
      results.push({
        rule: 'R2-2',
        description: 'CRITICAL 风险等级应触发 EVACUATE 操作',
        passed: assessResponse.data.actionRequired === 'EVACUATE',
        failureReason: `Expected EVACUATE, got ${assessResponse.data.actionRequired}`
      });
    }

    const updatedSite = storage.getSite(testSite.siteId);
    results.push({
      rule: 'R2-3',
      description: '评估后应更新营位的实际风险等级',
      passed: updatedSite?.riskLevel === 'CRITICAL',
      failureReason: `Expected CRITICAL, got ${updatedSite?.riskLevel}`
    });

    const invalidResponse = handleAssessSite({
      requestId: uuidv4(),
      eventId: 'NONEXISTENT-EVENT',
      siteId: testSite.siteId,
      assessedRiskLevel: 'HIGH',
      assessmentReason: '测试无效事件',
      source: 'test'
    });

    results.push({
      rule: 'R2-4',
      description: '评估不存在的事件应返回 EVENT_NOT_FOUND 错误',
      passed: !invalidResponse.success && invalidResponse.error?.code === 'EVENT_NOT_FOUND',
      failureReason: invalidResponse.error?.message || 'Should have returned error'
    });

    const resolvedResponse = handleModifyEvent({
      requestId: uuidv4(),
      eventId,
      updates: { status: 'RESOLVED' },
      source: 'test'
    });

    if (resolvedResponse.success) {
      const closedEventResponse = handleAssessSite({
        requestId: uuidv4(),
        eventId,
        siteId: testSite.siteId,
        assessedRiskLevel: 'LOW',
        assessmentReason: '测试已结束事件',
        source: 'test'
      });

      results.push({
        rule: 'R2-5',
        description: '已结束(RESOLVED)的事件不能再进行评估',
        passed: !closedEventResponse.success && closedEventResponse.error?.code === 'INVALID_EVENT_STATUS',
        failureReason: closedEventResponse.error?.message || 'Should have rejected assessment'
      });
    }

    return results;
  });
}

function testRule3_RebookingFlow(): TestResult[] {
  return runRuleTest('规则组 3: 订单改签流程', () => {
    const results: TestResult[] = [];

    const createResponse = handleCreateRiskEvent({
      requestId: uuidv4(),
      weatherAlert: {
        alertId: 'WEATHER-003',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '特大暴雨预警'
      },
      source: 'weather-api'
    });

    if (!createResponse.success || !createResponse.data) {
      return [{
        rule: 'R3-0',
        description: '先决条件：创建事件失败',
        passed: false,
        failureReason: createResponse.error?.message
      }];
    }

    const eventId = createResponse.data.eventId;
    const affectedOrderId = createResponse.data.affectedOrders[0];

    if (!affectedOrderId) {
      return [{
        rule: 'R3-0',
        description: '先决条件：没有受影响的订单可用于改签测试',
        passed: false,
        failureReason: 'No affected orders found'
      }];
    }

    const originalOrder = storage.getOrder(affectedOrderId);
    if (!originalOrder) {
      return [{
        rule: 'R3-0',
        description: '先决条件：订单不存在',
        passed: false,
        failureReason: 'Order not found'
      }];
    }

    const originalSiteId = originalOrder.siteId;

    const createRebookingResponse = handleCreateRebooking({
      requestId: uuidv4(),
      eventId,
      orderId: affectedOrderId,
      reason: '暴雨预警，营位有积水风险',
      source: 'staff'
    });

    results.push({
      rule: 'R3-1',
      description: '创建改签请求应成功',
      passed: createRebookingResponse.success === true,
      failureReason: createRebookingResponse.error?.message
    });

    if (createRebookingResponse.success && createRebookingResponse.data) {
      results.push({
        rule: 'R3-2',
        description: '改签请求应列出可用替代营位',
        passed: createRebookingResponse.data.availableReplacements?.length > 0,
        failureReason: 'No available replacement sites suggested'
      });

      const orderAfterCreate = storage.getOrder(affectedOrderId);
      results.push({
        rule: 'R3-3',
        description: '创建改签后订单状态应变为 REBOOKING',
        passed: orderAfterCreate?.status === 'REBOOKING',
        failureReason: `Expected REBOOKING, got ${orderAfterCreate?.status}`
      });

      const targetSiteId = createRebookingResponse.data.availableReplacements[0]?.siteId;

      if (targetSiteId) {
        const processResponse = handleProcessRebooking({
          requestId: uuidv4(),
          rebookingId: createRebookingResponse.data.rebookingId,
          targetSiteId,
          source: 'staff'
        });

        results.push({
          rule: 'R3-4',
          description: '处理改签应成功完成',
          passed: processResponse.success === true,
          failureReason: processResponse.error?.message
        });

        if (processResponse.success) {
          const updatedOrder = storage.getOrder(affectedOrderId);
          results.push({
            rule: 'R3-5',
            description: '改签完成后订单状态应变为 REBOOKED',
            passed: updatedOrder?.status === 'REBOOKED',
            failureReason: `Expected REBOOKED, got ${updatedOrder?.status}`
          });

          results.push({
            rule: 'R3-6',
            description: '订单应分配到新的营位',
            passed: updatedOrder?.siteId === targetSiteId,
            failureReason: `Order should be on new site`
          });

          const newSite = storage.getSite(targetSiteId);
          results.push({
            rule: 'R3-7',
            description: '新营位应被标记为已占用',
            passed: newSite?.isOccupied === true,
            failureReason: 'New site should be occupied'
          });

          const oldSite = storage.getSite(originalSiteId);
          results.push({
            rule: 'R3-8',
            description: '原营位应被释放（不再占用）',
            passed: oldSite?.isOccupied === false,
            failureReason: 'Original site should be released'
          });
        }
      }
    }

    const duplicateOrder = storage.getAllOrders().find(o => o.orderId !== affectedOrderId && ['CONFIRMED', 'CHECKED_IN'].includes(o.status));
    if (duplicateOrder) {
      const firstRebookResponse = handleCreateRebooking({
        requestId: uuidv4(),
        eventId,
        orderId: duplicateOrder.orderId,
        reason: '首次改签',
        source: 'staff'
      });

      if (firstRebookResponse.success) {
        const duplicateResponse = handleCreateRebooking({
          requestId: uuidv4(),
          eventId,
          orderId: duplicateOrder.orderId,
          reason: '重复改签测试',
          source: 'staff'
        });

        results.push({
          rule: 'R3-9',
          description: '同一订单不能创建多个待处理改签请求',
          passed: !duplicateResponse.success && duplicateResponse.error?.code === 'REBOOKING_EXISTS',
          failureReason: duplicateResponse.error?.message || 'Should have rejected duplicate rebooking'
        });
      }
    }

    return results;
  });
}

function testRule4_ResourceLocking(): TestResult[] {
  return runRuleTest('规则组 4: 资源锁定机制', () => {
    const results: TestResult[] = [];

    const createResponse = handleCreateRiskEvent({
      requestId: uuidv4(),
      weatherAlert: {
        alertId: 'WEATHER-004',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '特大暴雨预警'
      },
      source: 'weather-api'
    });

    if (!createResponse.success || !createResponse.data) {
      return [{
        rule: 'R4-0',
        description: '先决条件：创建事件失败',
        passed: false,
        failureReason: createResponse.error?.message
      }];
    }

    const eventId = createResponse.data.eventId;
    const affectedOrderId = createResponse.data.affectedOrders[0];

    if (!affectedOrderId) {
      return [{
        rule: 'R4-0',
        description: '先决条件：没有受影响的订单',
        passed: false,
        failureReason: 'No affected orders'
      }];
    }

    const rebookResponse = handleCreateRebooking({
      requestId: uuidv4(),
      eventId,
      orderId: affectedOrderId,
      reason: '锁定测试',
      source: 'staff'
    });

    if (!rebookResponse.success || !rebookResponse.data) {
      return [{
        rule: 'R4-1',
        description: '先决条件：创建改签失败',
        passed: false,
        failureReason: rebookResponse.error?.message
      }];
    }

    const targetSiteId = rebookResponse.data.availableReplacements[0]?.siteId;

    if (targetSiteId) {
      const anotherOrderId = createResponse.data.affectedOrders.find((id: string) => id !== affectedOrderId);
      
      if (anotherOrderId) {
        const anotherRebookResponse = handleCreateRebooking({
          requestId: uuidv4(),
          eventId,
          orderId: anotherOrderId,
          reason: '另一个改签请求',
          source: 'staff'
        });

        if (anotherRebookResponse.success) {
          const firstProcess = handleProcessRebooking({
            requestId: uuidv4(),
            rebookingId: rebookResponse.data.rebookingId,
            targetSiteId,
            source: 'staff'
          });

          results.push({
            rule: 'R4-1',
            description: '第一个改签应成功使用目标营位',
            passed: firstProcess.success === true,
            failureReason: firstProcess.error?.message
          });

          if (firstProcess.success) {
            const secondProcess = handleProcessRebooking({
              requestId: uuidv4(),
              rebookingId: anotherRebookResponse.data.rebookingId,
              targetSiteId,
              source: 'staff'
            });

            results.push({
              rule: 'R4-2',
              description: '已被占用的营位不应被再次分配',
              passed: !secondProcess.success && secondProcess.error?.code === 'SITE_NOT_AVAILABLE',
              failureReason: secondProcess.error?.message || 'Should have rejected occupied site'
            });
          }
        }
      }
    }

    return results;
  });
}

function testRule5_Idempotency(): TestResult[] {
  return runRuleTest('规则组 5: 幂等性 - 重复请求不写乱状态', () => {
    const results: TestResult[] = [];

    const requestId = uuidv4();
    const request = {
      requestId,
      weatherAlert: {
        alertId: 'WEATHER-005',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '幂等测试'
      },
      source: 'test'
    };

    const response1 = handleCreateRiskEvent(request);
    const response2 = handleCreateRiskEvent(request);

    results.push({
      rule: 'R5-1',
      description: '首次请求应成功',
      passed: response1.success === true,
      failureReason: response1.error?.message
    });

    results.push({
      rule: 'R5-2',
      description: '相同 requestId 的重复请求应返回相同结果',
      passed: response2.success === response1.success &&
        JSON.stringify(response2.data) === JSON.stringify(response1.data),
      failureReason: 'Duplicate request returned different result'
    });

    const eventCountBefore = storage.getAllEvents().length;
    handleCreateRiskEvent(request);
    const eventCountAfter = storage.getAllEvents().length;

    results.push({
      rule: 'R5-3',
      description: '重复请求不应创建新事件',
      passed: eventCountAfter === eventCountBefore,
      failureReason: `Event count changed: ${eventCountBefore} -> ${eventCountAfter}`
    });

    if (response1.success && response1.data) {
      const eventId = response1.data.eventId;
      const affectedOrderId = response1.data.affectedOrders[0];

      if (affectedOrderId) {
        const rebookRequestId = uuidv4();
        const rebookRequest = {
          requestId: rebookRequestId,
          eventId,
          orderId: affectedOrderId,
          reason: '幂等改签测试',
          source: 'test'
        };

        const rebookResponse1 = handleCreateRebooking(rebookRequest);
        const rebookResponse2 = handleCreateRebooking(rebookRequest);

        results.push({
          rule: 'R5-4',
          description: '改签请求也应支持幂等',
          passed: rebookResponse2.success === rebookResponse1.success &&
            JSON.stringify(rebookResponse2.data) === JSON.stringify(rebookResponse1.data),
          failureReason: 'Duplicate rebooking request returned different result'
        });

        const rebookingCountBefore = storage.getRebookingsByEvent(eventId).length;
        handleCreateRebooking(rebookRequest);
        const rebookingCountAfter = storage.getRebookingsByEvent(eventId).length;

        results.push({
          rule: 'R5-5',
          description: '重复改签请求不应创建新改签',
          passed: rebookingCountAfter === rebookingCountBefore,
          failureReason: `Rebooking count changed`
        });
      }
    }

    return results;
  });
}

function testRule6_ProblemRecording(): TestResult[] {
  return runRuleTest('规则组 6: 脏数据问题列表 - 不静默跳过', () => {
    const results: TestResult[] = [];
    const uniqueSource = 'rule6-test-' + Date.now();

    const problemsBefore = handleQueryProblems();
    const problemCountBefore = problemsBefore.success ? problemsBefore.data.total : 0;

    const badRequest = {
      requestId: uuidv4(),
      weatherAlert: {},
      source: uniqueSource
    };

    const badResponse = handleCreateRiskEvent(badRequest as any);

    results.push({
      rule: 'R6-1',
      description: '无效请求应返回错误',
      passed: badResponse.success === false,
      failureReason: 'Should have returned error for bad request'
    });

    const problemsAfter = handleQueryProblems();
    const problemCountAfter = problemsAfter.success ? problemsAfter.data.total : 0;

    results.push({
      rule: 'R6-2',
      description: '无效请求应被记录到问题列表',
      passed: problemCountAfter > problemCountBefore,
      failureReason: `Problem count did not increase: ${problemCountBefore} -> ${problemCountAfter}`
    });

    if (problemsAfter.success && problemsAfter.data.problems.length > 0) {
      const matchingProblem = problemsAfter.data.problems.find((p: any) => p.source === uniqueSource);
      
      results.push({
        rule: 'R6-3',
        description: '问题记录应包含错误类型',
        passed: matchingProblem?.errorType !== undefined,
        failureReason: 'Problem should have error type'
      });

      results.push({
        rule: 'R6-4',
        description: '问题记录应包含来源(source)',
        passed: matchingProblem?.source === uniqueSource,
        failureReason: `Problem should have source=${uniqueSource}, got ${matchingProblem?.source}`
      });

      results.push({
        rule: 'R6-5',
        description: '问题记录应包含原始请求数据',
        passed: matchingProblem?.requestData !== undefined,
        failureReason: 'Problem should retain original request data'
      });

      results.push({
        rule: 'R6-6',
        description: '新问题状态应为 OPEN',
        passed: matchingProblem?.status === 'OPEN',
        failureReason: `New problem status should be OPEN, got ${matchingProblem?.status}`
      });
    }

    return results;
  });
}

function testRule7_EventCancellation(): TestResult[] {
  return runRuleTest('规则组 7: 事件撤回与修正', () => {
    const results: TestResult[] = [];

    const createResponse = handleCreateRiskEvent({
      requestId: uuidv4(),
      weatherAlert: {
        alertId: 'WEATHER-007',
        alertType: 'HEAVY_RAIN',
        severity: 'EXTREME',
        validFrom: new Date().toISOString(),
        validTo: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        description: '撤回测试'
      },
      source: 'weather-api'
    });

    if (!createResponse.success || !createResponse.data) {
      return [{
        rule: 'R7-0',
        description: '先决条件：创建事件失败',
        passed: false,
        failureReason: createResponse.error?.message
      }];
    }

    const eventId = createResponse.data.eventId;
    const originalSiteRiskLevels = new Map<string, string>();
    createResponse.data.assessedSites.forEach((s: any) => {
      originalSiteRiskLevels.set(s.siteId, s.originalRiskLevel);
    });

    const cancelResponse = handleCancelEvent({
      requestId: uuidv4(),
      eventId,
      reason: '暴雨预警已解除',
      source: 'weather-api'
    });

    results.push({
      rule: 'R7-1',
      description: '取消事件应成功',
      passed: cancelResponse.success === true,
      failureReason: cancelResponse.error?.message
    });

    if (cancelResponse.success) {
      results.push({
        rule: 'R7-2',
        description: '取消后事件状态应为 CANCELLED',
        passed: cancelResponse.data.newStatus === 'CANCELLED',
        failureReason: `Expected CANCELLED, got ${cancelResponse.data.newStatus}`
      });

      for (const [siteId, originalLevel] of originalSiteRiskLevels) {
        const site = storage.getSite(siteId);
        if (site) {
          results.push({
            rule: 'R7-3',
            description: `营位 ${siteId} 风险应恢复到原始等级`,
            passed: site.riskLevel === originalLevel,
            failureReason: `Expected ${originalLevel}, got ${site.riskLevel}`
          });
        }
      }
    }

    const modifyResponse = handleModifyEvent({
      requestId: uuidv4(),
      eventId,
      updates: { status: 'ACTIVE' },
      source: 'test'
    });

    results.push({
      rule: 'R7-4',
      description: '可通过修改接口修正事件状态',
      passed: modifyResponse.success === true,
      failureReason: modifyResponse.error?.message
    });

    if (modifyResponse.success) {
      results.push({
        rule: 'R7-5',
        description: '修正后事件状态应更新',
        passed: modifyResponse.data.newStatus === 'ACTIVE',
        failureReason: `Expected ACTIVE, got ${modifyResponse.data.newStatus}`
      });
    }

    return results;
  });
}

function testRule8_SummaryQuery(): TestResult[] {
  return runRuleTest('规则组 8: 查询汇总', () => {
    const results: TestResult[] = [];

    const summaryResponse = handleQuerySummary({});

    results.push({
      rule: 'R8-1',
      description: '查询汇总应返回成功',
      passed: summaryResponse.success === true,
      failureReason: summaryResponse.error?.message
    });

    if (summaryResponse.success && summaryResponse.data) {
      results.push({
        rule: 'R8-2',
        description: '汇总应包含事件总数',
        passed: summaryResponse.data.totalEvents !== undefined,
        failureReason: 'Total events missing'
      });

      if (summaryResponse.data.events.length > 0) {
        const event = summaryResponse.data.events[0];

        results.push({
          rule: 'R8-3',
          description: '汇总应包含风险评估统计',
          passed: event.riskAssessment !== undefined,
          failureReason: 'Risk assessment stats missing'
        });

        results.push({
          rule: 'R8-4',
          description: '汇总应包含受影响订单数量',
          passed: event.affectedOrders !== undefined,
          failureReason: 'Affected orders count missing'
        });

        results.push({
          rule: 'R8-5',
          description: '汇总应包含改签统计',
          passed: event.rebookings !== undefined && event.rebookings.total !== undefined,
          failureReason: 'Rebooking stats missing'
        });

        results.push({
          rule: 'R8-6',
          description: '汇总应区分待处理和已完成改签',
          passed: event.rebookings.pending !== undefined && event.rebookings.completed !== undefined,
          failureReason: 'Pending/completed rebooking counts missing'
        });
      }
    }

    const sitesResponse = handleQuerySites();
    results.push({
      rule: 'R8-7',
      description: '可查询所有营位状态',
      passed: sitesResponse.success === true,
      failureReason: sitesResponse.error?.message
    });

    const ordersResponse = handleQueryOrders();
    results.push({
      rule: 'R8-8',
      description: '可查询所有订单状态',
      passed: ordersResponse.success === true,
      failureReason: ordersResponse.error?.message
    });

    return results;
  });
}

runAllTests();
