const notificationService = require('../src/services/notificationService');

const store = require('../src/storage/memoryStore');
function resetStore() {
  store.services.clear();
  store.tenantRules.clear();
  store.notificationGroups.clear();
  store.notifications.clear();
  store.sendHistory = [];
  store.suppressedCounts.clear();
  store.tenantFailureCounts.clear();
}

function assertEqual(actual, expected, message) {
  const actualStr = JSON.stringify(actual);
  const expectedStr = JSON.stringify(expected);
  if (actualStr !== expectedStr) {
    throw new Error(`${message}: 期望 ${expectedStr}, 实际 ${actualStr}`);
  }
}

function assertTrue(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertFalse(condition, message) {
  if (condition) {
    throw new Error(message);
  }
}

function runTest(name, testFn) {
  try {
    resetStore();
    testFn();
    console.log(`  ✓ ${name}`);
    return true;
  } catch (err) {
    console.log(`  ✗ ${name}`);
    console.log(`    错误: ${err.message}`);
    return false;
  }
}

console.log('开始运行测试...\n');

const passed = [];
const failed = [];

console.log('测试 1: 普通重复通知合并');
if (runTest('首次通知发送成功', () => {
  const result1 = notificationService.processIncomingNotification({
    serviceId: 'order-service',
    serviceName: '订单服务',
    tenantId: 'tenant-001',
    severity: 'warning',
    messageKey: 'db_connection_timeout',
    title: '数据库连接超时',
    message: '连接超时 5000ms'
  });
  assertTrue(result1.sent, '首次通知应该被发送');
  assertEqual(result1.sendType, 'initial', 'sendType 应为 initial');
  assertTrue(result1.isNewGroup, '应为新组');
})) passed.push('test1a'); else failed.push('test1a');

if (runTest('静默窗口内重复通知被压制', () => {
  notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-001',
    severity: 'warning',
    messageKey: 'db_connection_timeout',
    title: '数据库连接超时',
    message: '连接超时 5000ms'
  });
  const result2 = notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-001',
    severity: 'warning',
    messageKey: 'db_connection_timeout',
    title: '数据库连接超时',
    message: '连接超时 5000ms'
  });
  assertTrue(result2.suppressed, '静默窗口内的通知应该被压制');
  assertFalse(result2.sent, '静默窗口内的通知不应该被发送');
  assertFalse(result2.isNewGroup, '不应创建新组');
})) passed.push('test1b'); else failed.push('test1b');

console.log('\n测试 2: 严重通知立即发送（绕过静默）');
if (runTest('error 级别绕过静默窗口', () => {
  notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-002',
    severity: 'warning',
    messageKey: 'test-key',
    title: '测试警告'
  });
  const result = notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-002',
    severity: 'error',
    messageKey: 'payment_failed',
    title: '支付失败',
    message: '订单支付失败'
  });
  assertTrue(result.sent, 'error 级别通知应该被发送');
  assertEqual(result.sendType, 'initial', '首次 error 通知应为 initial');
})) passed.push('test2a'); else failed.push('test2a');

if (runTest('critical 级别绕过静默窗口', () => {
  notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-003',
    severity: 'warning',
    messageKey: 'test-key',
    title: '测试警告'
  });
  const result = notificationService.processIncomingNotification({
    serviceId: 'order-service',
    tenantId: 'tenant-003',
    severity: 'critical',
    messageKey: 'service_down',
    title: '服务不可用'
  });
  assertTrue(result.sent, 'critical 级别通知应该被发送');
  assertEqual(result.effectiveSeverity, 'critical', '级别应为 critical');
})) passed.push('test2b'); else failed.push('test2b');

console.log('\n测试 3: 租户连续失败升级');
if (runTest('达到阈值后升级严重级别', () => {
  notificationService.setTenantRule({
    serviceId: 'payment-service',
    tenantId: 'tenant-004',
    upgradeThreshold: 3,
    upgradeToSeverity: 'critical'
  });

  const r1 = notificationService.processIncomingNotification({
    serviceId: 'payment-service',
    tenantId: 'tenant-004',
    severity: 'warning',
    messageKey: 'retry_failed',
    title: '重试失败'
  });
  assertFalse(r1.upgraded, '第一次不应该升级');

  const r2 = notificationService.processIncomingNotification({
    serviceId: 'payment-service',
    tenantId: 'tenant-004',
    severity: 'warning',
    messageKey: 'retry_failed',
    title: '重试失败'
  });
  assertFalse(r2.upgraded, '第二次不应该升级');

  const r3 = notificationService.processIncomingNotification({
    serviceId: 'payment-service',
    tenantId: 'tenant-004',
    severity: 'warning',
    messageKey: 'retry_failed',
    title: '重试失败'
  });
  assertTrue(r3.upgraded, '第三次应该升级');
  assertEqual(r3.effectiveSeverity, 'critical', '应升级到 critical');
  assertEqual(r3.sendType, 'upgrade', 'sendType 应为 upgrade');
})) passed.push('test3a'); else failed.push('test3a');

console.log('\n测试 4: 确认后复发（新证据恢复通知）');
if (runTest('确认后带新证据的通知被发送', () => {
  const result1 = notificationService.processIncomingNotification({
    serviceId: 'user-service',
    tenantId: 'tenant-005',
    severity: 'warning',
    messageKey: 'login_rate_limit',
    title: '登录速率限制'
  });
  const groupId = result1.groupId;

  notificationService.confirmNotification(groupId, 'operator-alice');

  const result2 = notificationService.processIncomingNotification({
    serviceId: 'user-service',
    tenantId: 'tenant-005',
    severity: 'warning',
    messageKey: 'login_rate_limit',
    title: '登录速率限制',
    evidence: {
      suspiciousIPs: ['192.168.1.100', '10.0.0.50'],
      attackType: 'brute-force'
    }
  });

  assertTrue(result2.sent, '带新证据的复发通知应该被发送');
  assertEqual(result2.sendType, 'recurrence_with_evidence', 'sendType 应为 recurrence_with_evidence');
})) passed.push('test4a'); else failed.push('test4a');

console.log('\n测试 5: 降噪报告');
if (runTest('报告包含统计和被压制样本', () => {
  notificationService.setTenantRule({
    serviceId: 'report-service',
    tenantId: 'tenant-report',
    silenceWindowMinutes: 30,
    upgradeThreshold: 100
  });

  notificationService.processIncomingNotification({
    serviceId: 'report-service',
    tenantId: 'tenant-report',
    severity: 'warning',
    messageKey: 'warn-1',
    title: '警告1'
  });

  for (let i = 0; i < 5; i++) {
    notificationService.processIncomingNotification({
      serviceId: 'report-service',
      tenantId: 'tenant-report',
      severity: 'warning',
      messageKey: 'warn-1',
      title: '警告1'
    });
  }

  notificationService.processIncomingNotification({
    serviceId: 'report-service',
    tenantId: 'tenant-report',
    severity: 'error',
    messageKey: 'err-1',
    title: '错误1'
  });

  notificationService.processIncomingNotification({
    serviceId: 'report-service',
    tenantId: 'tenant-report',
    severity: 'error',
    messageKey: 'err-2',
    title: '错误2（绕过静默）'
  });

  const report = notificationService.generateNoiseReductionReport(1440);

  assertTrue(report.summary.totalNotificationsProcessed >= 8, '至少处理 8 条通知');
  assertTrue(report.summary.totalSuppressed >= 5, '至少压制 5 条');
  assertTrue(report.summary.highSeverityNotificationsSent >= 2, '高级别通知应发送');
  assertTrue(report.suppressedSamples.length > 0, '应包含被压制样本');
})) passed.push('test5a'); else failed.push('test5a');

console.log('\n测试 6: 确认和关闭');
if (runTest('确认通知组', () => {
  const result = notificationService.processIncomingNotification({
    serviceId: 'test-service',
    tenantId: 'tenant-confirm',
    severity: 'warning',
    messageKey: 'test-key',
    title: '测试通知'
  });

  const confirmed = notificationService.confirmNotification(result.groupId, 'test-user');
  assertTrue(confirmed.confirmed, '应被标记为已确认');
  assertEqual(confirmed.confirmedBy, 'test-user', '确认人应正确');
  assertTrue(confirmed.confirmedAt !== null, '应有确认时间');
})) passed.push('test6a'); else failed.push('test6a');

if (runTest('关闭通知组重置失败计数', () => {
  const result = notificationService.processIncomingNotification({
    serviceId: 'test-service',
    tenantId: 'tenant-close',
    severity: 'warning',
    messageKey: 'test-key',
    title: '测试通知'
  });

  store.incrementTenantFailure('test-service', 'tenant-close');
  store.incrementTenantFailure('test-service', 'tenant-close');

  notificationService.closeNotification(result.groupId, 'test-user');

  const group = store.getNotificationGroup(result.groupId);
  assertEqual(group.status, 'closed', '状态应为 closed');
  const failureCount = store.getTenantFailureCount('test-service', 'tenant-close');
  assertEqual(failureCount, 0, '关闭后失败计数应重置为 0');
})) passed.push('test6b'); else failed.push('test6b');

console.log('\n' + '='.repeat(50));
console.log(`测试结果: 通过 ${passed.length}, 失败 ${failed.length}`);
console.log('='.repeat(50));

if (failed.length > 0) {
  process.exit(1);
}
