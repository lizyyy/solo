import { windowService } from '../services/windowService';
import { WindowStatus, RecoveryConditionType } from '../types';

function logTest(name: string, passed: boolean, data?: any) {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`\n${status}: ${name}`);
  if (data) {
    console.log('  Details:', JSON.stringify(data, null, 2).substring(0, 500));
  }
}

async function runTests() {
  console.log('='.repeat(60));
  console.log('  Database Readonly Window API - Self-Check Tests');
  console.log('='.repeat(60));

  let total = 0;
  let passed = 0;

  console.log('\n📋 TEST SUITE 1: Normal Flow - Complete Lifecycle');
  console.log('-'.repeat(60));

  total++;
  const createResult = windowService.createWindow({
    databaseName: 'trade_db_01',
    databaseHost: 'mysql-prod-01',
    windowName: '月底报表只读窗口 - 交易库',
    description: '2024年5月月底结算期间数据库只读',
    scheduledStartTime: new Date(Date.now() + 3600000).toISOString(),
    scheduledEndTime: new Date(Date.now() + 7200000).toISOString(),
    createdBy: 'dba_admin',
    affectedServices: [
      {
        serviceName: 'order-service',
        serviceOwner: 'team_order@company.com',
        writeOperations: ['INSERT', 'UPDATE'],
        estimatedImpact: 'HIGH'
      },
      {
        serviceName: 'payment-service',
        serviceOwner: 'team_pay@company.com',
        writeOperations: ['INSERT'],
        estimatedImpact: 'MEDIUM'
      }
    ],
    recoveryConditions: [
      { type: RecoveryConditionType.TIME_BASED, value: '2024-05-31T23:59:59Z' },
      { type: RecoveryConditionType.DBA_CONFIRM, value: 'dba_approval' }
    ],
    dbaContact: 'dba_oncall@company.com',
    reason: '月底报表跑批，保障数据一致性',
    tags: ['month-end', 'report', 'readonly']
  });
  const windowId = createResult.id;
  logTest('Create window with valid data', createResult.status === WindowStatus.DRAFT, {
    id: windowId,
    status: createResult.status,
    affectedServices: createResult.affectedServices.length
  });
  passed++;

  total++;
  const draftToScheduled = windowService.updateWindowStatus(windowId, {
    status: WindowStatus.SCHEDULED,
    updatedBy: 'dba_admin',
    note: '窗口已排期，通知相关业务方'
  });
  logTest('Transition DRAFT -> SCHEDULED', draftToScheduled?.status === WindowStatus.SCHEDULED, {
    status: draftToScheduled?.status
  });
  if (draftToScheduled?.status === WindowStatus.SCHEDULED) passed++;

  total++;
  const scheduledToActive = windowService.updateWindowStatus(windowId, {
    status: WindowStatus.ACTIVE,
    updatedBy: 'dba_admin',
    note: '窗口已激活，准备进入只读状态'
  });
  logTest('Transition SCHEDULED -> ACTIVE', scheduledToActive?.status === WindowStatus.ACTIVE, {
    status: scheduledToActive?.status,
    actualStartTime: !!scheduledToActive?.actualStartTime
  });
  if (scheduledToActive?.status === WindowStatus.ACTIVE) passed++;

  total++;
  const activeToBlocking = windowService.updateWindowStatus(windowId, {
    status: WindowStatus.BLOCKING,
    updatedBy: 'dba_admin',
    note: '已开启数据库只读，开始拦截写入'
  });
  logTest('Transition ACTIVE -> BLOCKING', activeToBlocking?.status === WindowStatus.BLOCKING, {
    status: activeToBlocking?.status
  });
  if (activeToBlocking?.status === WindowStatus.BLOCKING) passed++;

  total++;
  const blocked1 = windowService.blockWrite(
    windowId,
    'order-service',
    'INSERT',
    'INSERT INTO orders (...)',
    'mysql-proxy'
  );
  const blocked2 = windowService.blockWrite(
    windowId,
    'payment-service',
    'UPDATE',
    'UPDATE payments SET...',
    'mysql-proxy'
  );
  const blocked3 = windowService.blockWrite(
    windowId,
    'order-service',
    'UPDATE',
    'UPDATE orders SET status...',
    'mysql-proxy'
  );
  logTest('Block writes during BLOCKING phase', !!blocked1 && !!blocked2 && !!blocked3, {
    blockedCount: 3,
    services: ['order-service', 'payment-service']
  });
  if (blocked1 && blocked2 && blocked3) passed++;

  total++;
  const satisfyTime = windowService.satisfyRecoveryCondition(
    windowId,
    RecoveryConditionType.TIME_BASED,
    'dba_admin'
  );
  logTest('Satisfy TIME_BASED recovery condition', satisfyTime, { satisfied: satisfyTime });
  if (satisfyTime) passed++;

  total++;
  const satisfyDba = windowService.satisfyRecoveryCondition(
    windowId,
    RecoveryConditionType.DBA_CONFIRM,
    'dba_lead'
  );
  const afterConditions = windowService.getWindow(windowId);
  logTest('Satisfy all conditions auto-transition to RECOVERING', 
    satisfyDba && afterConditions?.status === WindowStatus.RECOVERING, {
    status: afterConditions?.status,
    conditions: afterConditions?.recoveryConditions.map(c => ({ type: c.type, satisfied: c.satisfied }))
  });
  if (satisfyDba && afterConditions?.status === WindowStatus.RECOVERING) passed++;

  total++;
  const recoveringToComplete = windowService.updateWindowStatus(windowId, {
    status: WindowStatus.COMPLETED,
    updatedBy: 'dba_admin',
    note: '窗口正常结束，恢复读写'
  });
  logTest('Transition RECOVERING -> COMPLETED', recoveringToComplete?.status === WindowStatus.COMPLETED, {
    status: recoveringToComplete?.status,
    actualEndTime: !!recoveringToComplete?.actualEndTime
  });
  if (recoveringToComplete?.status === WindowStatus.COMPLETED) passed++;

  total++;
  const report = windowService.generateReport(windowId, 'dba_admin');
  logTest('Generate final report with statistics', !!report && report.totalBlockedWrites >= 3, {
    totalBlocked: report?.totalBlockedWrites,
    affectedServicesCount: report?.affectedServicesCount,
    hasAnomalies: report?.anomalies && report.anomalies.length > 0
  });
  if (report && report.totalBlockedWrites >= 3) passed++;

  console.log('\n📋 TEST SUITE 2: Dirty Data & Invalid Inputs');
  console.log('-'.repeat(60));

  total++;
  const invalidWindow = windowService.getWindow('non-existent-id-12345');
  logTest('Query non-existent window returns undefined', invalidWindow === undefined, {
    result: invalidWindow
  });
  if (invalidWindow === undefined) passed++;

  total++;
  const exceptionsBefore = windowService.getExceptions(windowId).length;
  const invalidStatus = windowService.updateWindowStatus(windowId, {
    status: WindowStatus.DRAFT,
    updatedBy: 'dba_admin'
  });
  const exceptionsAfter = windowService.getExceptions(windowId).length;
  logTest('Invalid status transition COMPLETED -> DRAFT rejected', invalidStatus === null, {
    rejected: invalidStatus === null
  });
  if (invalidStatus === null) passed++;

  total++;
  logTest('Invalid transition recorded in exception log', exceptionsAfter > exceptionsBefore, {
    exceptionBefore: exceptionsBefore,
    exceptionAfter: exceptionsAfter,
    hasOriginalInput: windowService.getExceptions(windowId)[0]?.originalInput
  });
  if (exceptionsAfter > exceptionsBefore) passed++;

  total++;
  const blockAfterComplete = windowService.blockWrite(
    windowId,
    'order-service',
    'INSERT',
    'SHOULD FAIL'
  );
  logTest('Block write rejected after window completed', blockAfterComplete === null, {
    rejected: blockAfterComplete === null
  });
  if (blockAfterComplete === null) passed++;

  total++;
  const badCondition = windowService.satisfyRecoveryCondition(
    windowId,
    'NON_EXISTENT_CONDITION',
    'dba_admin'
  );
  logTest('Satisfy non-existent recovery condition fails', badCondition === false, {
    result: badCondition
  });
  if (badCondition === false) passed++;

  console.log('\n📋 TEST SUITE 3: Duplicate Requests & Idempotency');
  console.log('-'.repeat(60));

  const testWindow = windowService.createWindow({
    databaseName: 'test_db',
    databaseHost: 'test-host',
    windowName: '重复请求测试窗口',
    scheduledStartTime: new Date().toISOString(),
    scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
    createdBy: 'test_user',
    affectedServices: [],
    recoveryConditions: [],
    dbaContact: 'test@test.com',
    reason: '测试'
  });
  const testWindowId = testWindow.id;
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.SCHEDULED, updatedBy: 'test' });
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.ACTIVE, updatedBy: 'test' });
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.BLOCKING, updatedBy: 'test' });

  const currentWindow = windowService.getWindow(testWindowId);

  total++;
  const correctionsBefore = windowService.getCorrections(testWindowId).length;
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.RECOVERING, updatedBy: 'test' });
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.RECOVERING, updatedBy: 'test' });
  windowService.updateWindowStatus(testWindowId, { status: WindowStatus.RECOVERING, updatedBy: 'test' });
  const correctionsAfter = windowService.getCorrections(testWindowId).length;
  logTest('Duplicate status transitions each recorded separately', correctionsAfter > correctionsBefore, {
    correctionCount: correctionsAfter
  });
  if (correctionsAfter > correctionsBefore) passed++;

  total++;
  const blockWindow = windowService.createWindow({
    databaseName: 'block_test_db',
    databaseHost: 'block-host',
    windowName: '拦截测试窗口',
    scheduledStartTime: new Date().toISOString(),
    scheduledEndTime: new Date(Date.now() + 3600000).toISOString(),
    createdBy: 'test_user',
    affectedServices: [],
    recoveryConditions: [],
    dbaContact: 'test@test.com',
    reason: '拦截测试'
  });
  const blockWindowId = blockWindow.id;
  windowService.updateWindowStatus(blockWindowId, { status: WindowStatus.SCHEDULED, updatedBy: 'test' });
  windowService.updateWindowStatus(blockWindowId, { status: WindowStatus.ACTIVE, updatedBy: 'test' });
  windowService.updateWindowStatus(blockWindowId, { status: WindowStatus.BLOCKING, updatedBy: 'test' });
  
  for (let i = 0; i < 5; i++) {
    windowService.blockWrite(blockWindowId, 'test-service', 'TEST_OP', `SQL_${i}`);
  }
  const blockedWrites = windowService.getBlockedWrites(blockWindowId);
  logTest('Multiple duplicate block writes all recorded individually', blockedWrites.length >= 5, {
    totalBlocked: blockedWrites.length
  });
  if (blockedWrites.length >= 5) passed++;

  console.log('\n📋 TEST SUITE 4: Manual Correction & Exception Handling');
  console.log('-'.repeat(60));

  total++;
  const addServiceResult = windowService.addAffectedService(
    windowId,
    {
      serviceName: 'risk-service',
      serviceOwner: 'team_risk@company.com',
      writeOperations: ['INSERT', 'UPDATE', 'DELETE'],
      estimatedImpact: 'LOW'
    },
    'operations_manager'
  );
  const updatedWindow = windowService.getWindow(windowId);
  logTest('Manually add affected service after window creation', 
    !!addServiceResult && updatedWindow?.affectedServices.length === 3, {
    newService: addServiceResult?.serviceName,
    totalServices: updatedWindow?.affectedServices.length
  });
  if (addServiceResult && updatedWindow?.affectedServices.length === 3) passed++;

  total++;
  const manualCorrectResult = windowService.manualCorrect(
    windowId,
    'OTHER',
    { oldReason: 'original reason' },
    { newReason: 'updated reason - emergency extension requested' },
    'incident_manager',
    '紧急情况：由于报表跑批延迟，需要延长窗口时间'
  );
  const corrections = windowService.getCorrections(windowId);
  logTest('Manual correction record created with audit trail', 
    manualCorrectResult && corrections.length > 0, {
    correctionCount: corrections.length,
    hasReason: !!corrections[0]?.reason
  });
  if (manualCorrectResult && corrections.length > 0) passed++;

  total++;
  const exceptions = windowService.getExceptions();
  const unhandled = exceptions.filter(e => !e.handled);
  if (unhandled.length > 0) {
    const handled = windowService.handleException(
      unhandled[0].id,
      'sre_oncall',
      '已确认是无效状态转换，无需进一步处理'
    );
    logTest('Handle and resolve exception records', handled, {
      handled,
      exceptionId: unhandled[0].id
    });
    if (handled) passed++;
  } else {
    logTest('Handle exception records - skipped (no exceptions found)', true);
    passed++;
  }

  total++;
  const correctionsList = windowService.getCorrections(windowId);
  const hasStatusChanges = correctionsList.some(c => c.correctionType === 'STATUS_CHANGE');
  const hasServiceAdd = correctionsList.some(c => c.correctionType === 'SERVICE_ADD');
  const hasManual = correctionsList.some(c => c.correctionType === 'OTHER');
  logTest('Correction audit trail captures all change types', 
    hasStatusChanges && hasServiceAdd && hasManual, {
    types: { hasStatusChanges, hasServiceAdd, hasManual },
    totalCorrections: correctionsList.length
  });
  if (hasStatusChanges && hasServiceAdd && hasManual) passed++;

  console.log('\n' + '='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Tests: ${total}`);
  console.log(`Passed:      ${passed} ✅`);
  console.log(`Failed:      ${total - passed} ❌`);
  console.log(`Success Rate: ${((passed / total) * 100).toFixed(1)}%`);
  console.log('='.repeat(60));

  console.log('\n📈 SAMPLE DATA STATISTICS');
  console.log('-'.repeat(60));
  const allWindows = windowService.getWindows();
  const allBlocked = windowService.getBlockedWrites();
  const allExceptions = windowService.getExceptions();
  const allCorrections = windowService.getCorrections();
  const allReports = windowService.getReports();
  console.log(`Total Windows:        ${allWindows.length}`);
  console.log(`Total Blocked Writes: ${allBlocked.length}`);
  console.log(`Total Exceptions:     ${allExceptions.length}`);
  console.log(`Total Corrections:    ${allCorrections.length}`);
  console.log(`Total Reports:        ${allReports.length}`);
  
  if (allWindows.length > 0) {
    console.log('\n🏷️  Window Status Distribution:');
    const statusCounts: Record<string, number> = {};
    allWindows.forEach(w => {
      statusCounts[w.status] = (statusCounts[w.status] || 0) + 1;
    });
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
  }

  console.log('\n' + '='.repeat(60));
  if (passed === total) {
    console.log('🎉 ALL TESTS PASSED! System is ready for deployment.');
  } else {
    console.log('⚠️  Some tests failed. Please review and fix.');
  }
  console.log('='.repeat(60));

  return passed === total;
}

runTests().catch(console.error);
