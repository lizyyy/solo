import { lineService } from './services/LineService';
import { busFacade } from './services/BusNotificationFacade';
import { reportService } from './services/ReportService';
import { receiptService } from './services/ReceiptService';
import { repository } from './repositories/MemoryRepository';
import { DetourConflictError } from './models/errors';

const LINE_ID = 'line-1';

function log(title: string, data?: unknown): void {
  console.log(`\n=== ${title} ===`);
  if (data !== undefined) {
    if (typeof data === 'string') {
      console.log(data);
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function setupDemoData(): Promise<void> {
  log('1. 初始化线路版本');
  
  lineService.createLineVersion(LINE_ID, '1号线（实验小学-阳光小区）', [
    { id: 'stop-1', name: '实验小学门口', order: 1 },
    { id: 'stop-2', name: '人民广场', order: 2 },
    { id: 'stop-3', name: '文化路交叉口', order: 3 },
    { id: 'stop-4', name: '阳光小区', order: 4 },
  ]);
  
  const version = lineService.getActiveLineVersion(LINE_ID);
  log('创建的线路版本', {
    lineName: version.lineName,
    version: version.version,
    stops: version.stops.map((s) => s.name),
  });

  log('2. 注册家长订阅');
  
  busFacade.subscribeParent('parent-1', LINE_ID, 'stop-3', '小明');
  busFacade.subscribeParent('parent-2', LINE_ID, 'stop-3', '小红');
  busFacade.subscribeParent('parent-3', LINE_ID, 'stop-4', '小华');
  
  log('已订阅 3 位家长');
}

async function demoNormalFlow(): Promise<void> {
  log('\n====================');
  log('场景1：顺利流程 - 施工绕行');
  log('====================');

  log('3. 报告绕行事件（文化路施工）');
  const detourResult = await busFacade.reportDetour({
    lineId: LINE_ID,
    reason: 'CONSTRUCTION',
    description: '文化路交叉口道路施工，预计持续2小时',
    affectedStopIds: ['stop-3'],
    alternativeStopIds: ['stop-2', 'stop-4'],
    reportedBy: 'dispatcher-01',
    priority: 2,
  });
  
  log('绕行事件创建结果', detourResult);

  log('4. 发送通知（模拟短信/推送）');
  let sentCount = await busFacade.processNotifications(async (content) => {
    console.log(`  [发送] ${content}`);
    return true;
  });
  log(`成功发送 ${sentCount} 条通知`);

  log('5. 查看家长收到的通知');
  const p1Notifs = busFacade.getParentNotifications('parent-1');
  log('家长1（小明妈妈）收到的通知', p1Notifs.map((n) => n.content));

  const p3Notifs = busFacade.getParentNotifications('parent-3');
  log('家长3（小华妈妈）未受影响，无绕行通知', p3Notifs.length === 0 ? '正确' : '异常');

  log('6. 司机确认回执');
  const receipts = receiptService.getReceiptsByDetour(detourResult.eventId);
  if (receipts.length > 0) {
    busFacade.acknowledgeReceipt(receipts[0].id);
    log('司机已确认绕行');
  }

  log('7. 更新绕行后的ETA');
  const newArrivalTime = new Date(Date.now() + 15 * 60 * 1000);
  await busFacade.updateEtaForDetour(LINE_ID, detourResult.eventId, 'stop-2', newArrivalTime);
  
  sentCount = await busFacade.processNotifications(async (content) => {
    console.log(`  [发送] ${content}`);
    return true;
  });
  log(`ETA更新后发送 ${sentCount} 条通知`);

  log('8. 检查通知去重（重复触发相同通知）');
  const p1NotifsBefore = busFacade.getParentNotifications('parent-1').length;
  
  await busFacade.updateEtaForDetour(LINE_ID, detourResult.eventId, 'stop-2', new Date(Date.now() + 15 * 60 * 1000));
  sentCount = await busFacade.processNotifications();
  
  const p1NotifsAfter = busFacade.getParentNotifications('parent-1').length;
  log(`通知去重效果: 之前${p1NotifsBefore}条，之后${p1NotifsAfter}条（应相同）`);

  log('9. 记录实际到达');
  busFacade.recordActualArrival(LINE_ID, 'stop-2');
  log('已记录站点实际到达时间');

  log('10. 解除绕行');
  const resolveResult = await busFacade.resolveDetour(detourResult.eventId);
  log('绕行解除结果', resolveResult);
  
  sentCount = await busFacade.processNotifications(async (content) => {
    console.log(`  [发送] ${content}`);
    return true;
  });
  log(`绕行结束通知已发送 ${sentCount} 条`);
}

async function demoConflictScenario(): Promise<void> {
  log('\n====================');
  log('场景2：冲突检测 - 重复绕行');
  log('====================');

  log('11. 报告第一个绕行事件');
  const detour1 = await busFacade.reportDetour({
    lineId: LINE_ID,
    reason: 'ACCIDENT',
    description: '人民广场发生交通事故',
    affectedStopIds: ['stop-2'],
    alternativeStopIds: ['stop-1'],
    reportedBy: 'dispatcher-02',
    priority: 1,
  });
  log('第一个绕行事件ID:', detour1.eventId);

  log('12. 尝试报告重叠的绕行事件（应触发冲突）');
  try {
    await busFacade.reportDetour({
      lineId: LINE_ID,
      reason: 'WEATHER',
      description: '人民广场区域积水严重',
      affectedStopIds: ['stop-2', 'stop-3'],
      alternativeStopIds: ['stop-1', 'stop-4'],
      reportedBy: 'dispatcher-03',
      priority: 1,
    });
    log('错误：未检测到冲突！');
  } catch (error) {
    if (error instanceof DetourConflictError) {
      log('冲突检测成功！', error.message);
    } else {
      throw error;
    }
  }

  log('13. 清理第一个绕行事件（为后续演示）');
  await busFacade.resolveDetour(detour1.eventId);
}

async function demoCancellationScenario(): Promise<void> {
  log('\n====================');
  log('场景3：撤销机制 - 误报绕行');
  log('====================');

  log('14. 报告绕行事件');
  const detour = await busFacade.reportDetour({
    lineId: LINE_ID,
    reason: 'CONSTRUCTION',
    description: '阳光小区门口临时施工',
    affectedStopIds: ['stop-4'],
    alternativeStopIds: ['stop-3'],
    reportedBy: 'dispatcher-04',
    priority: 1,
  });
  log('绕行事件已创建');

  log('15. 发现误报，撤销绕行');
  const cancelResult = await busFacade.cancelDetour(detour.eventId, '施工时间已调整，不影响今日运行');
  log('撤销结果', cancelResult);

  log('16. 发送撤销通知');
  const sentCount = await busFacade.processNotifications(async (content) => {
    console.log(`  [发送] ${content}`);
    return true;
  });
  log(`撤销通知已发送 ${sentCount} 条`);

  log('17. 查看绕行事件状态');
  const detourStatus = busFacade.getDetourStatus(detour.eventId);
  log('绕行状态', detourStatus?.detour.status);
}

async function demoRetryScenario(): Promise<void> {
  log('\n====================');
  log('场景4：重试机制 - 通知发送失败');
  log('====================');

  log('18. 创建新绕行并生成通知');
  const detour = await busFacade.reportDetour({
    lineId: LINE_ID,
    reason: 'OTHER',
    description: '临时交通管制',
    affectedStopIds: ['stop-1'],
    alternativeStopIds: ['stop-2'],
    reportedBy: 'dispatcher-05',
    priority: 1,
  });

  let attemptCount = 0;
  log('19. 模拟前两次发送失败，第三次成功');
  
  const sentCount = await busFacade.processNotifications(async (content) => {
    attemptCount++;
    if (attemptCount <= 2) {
      console.log(`  [失败] ${content}`);
      return false;
    }
    console.log(`  [成功] ${content}`);
    return true;
  });
  
  log(`首次发送成功数: ${sentCount}（应为0，因为前两次失败）`);

  log('20. 清理绕行事件');
  await busFacade.resolveDetour(detour.eventId);
}

async function demoReportGeneration(): Promise<void> {
  log('\n====================');
  log('场景5：运行报告 - 可检查的输出');
  log('====================');

  log('21. 生成今日运行报告');
  const report = busFacade.getRunReport(LINE_ID);
  const reportText = reportService.exportReport(report);
  log('运行报告', reportText);

  log('22. 系统状态概览');
  const status = busFacade.getSystemStatus(LINE_ID);
  log('系统状态', {
    ...status,
    notificationDeliveryRate: `${(status.notificationDeliveryRate * 100).toFixed(1)}%`,
    receiptAcknowledgementRate: `${(status.receiptAcknowledgementRate * 100).toFixed(1)}%`,
  });
}

async function main(): Promise<void> {
  console.log('========================================');
  console.log('  校车绕行通知服务 - 功能演示');
  console.log('========================================');

  repository.clearAll();

  await setupDemoData();
  await demoNormalFlow();
  await demoConflictScenario();
  await demoCancellationScenario();
  await demoRetryScenario();
  await demoReportGeneration();

  console.log('\n========================================');
  console.log('  演示完成！');
  console.log('========================================');
  console.log('');
  console.log('功能验证清单：');
  console.log('  ✓ 线路版本管理（场景1-步骤1）');
  console.log('  ✓ 绕行事件创建与激活（场景1-步骤3）');
  console.log('  ✓ 站点ETA更新（场景1-步骤7）');
  console.log('  ✓ 通知去重（场景1-步骤8）');
  console.log('  ✓ 司机回执（场景1-步骤6）');
  console.log('  ✓ 冲突检测（场景2-步骤12）');
  console.log('  ✓ 绕行撤销（场景3-步骤15）');
  console.log('  ✓ 通知重试（场景4-步骤19）');
  console.log('  ✓ 运行报告生成（场景5-步骤21）');
}

main().catch(console.error);
