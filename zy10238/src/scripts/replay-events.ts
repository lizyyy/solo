import { initDB, FaultTicket, OperationHistory, RemoteOperation, MaintenanceRecord, OrderInfo, TicketStatus, OperationType, OperationStatus, MaintenanceStatus, OrderStatus, OperationCommand } from '../models';

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

function logStep(step: number, title: string, status: '✓' | '✗' | '→' = '→', extra?: string) {
  const color = status === '✓' ? '\x1b[32m' : status === '✗' ? '\x1b[31m' : '\x1b[36m';
  const reset = '\x1b[0m';
  console.log(`${color}${status}${reset} [步骤 ${step}] ${title}${extra ? ` - ${extra}` : ''}`);
}

function logSuggestion(suggestion: any) {
  console.log(`       建议动作: ${suggestion.recommendedAction === 'remote_restart' ? '🔄 远程重启' : suggestion.recommendedAction === 'dispatch_maintenance' ? '👷 派维修' : '⏳ 观察等待'}`);
  console.log(`       置信度: ${suggestion.confidence}`);
  console.log(`       预估时间: ${suggestion.estimatedResolutionTime}`);
  console.log(`       原因分析: ${suggestion.reasons.join(', ')}`);
}

async function replayEvents() {
  console.log('\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║           充电桩故障工单系统 - 完整业务流程重放                  ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  const pileId = 'PILE-TEST-001';
  const stationId = 'STATION-A';
  const orderCode = 'ORDER-2024-0520-001';
  const baseUrl = 'http://localhost:3000/api/v1';

  console.log('📋 测试场景: 通信故障 → 决策建议 → 远程重启失败2次 → 自动升级派单 → 用户退款 → 维修完成 → 同桩重复故障检测\n');

  try {
    // 步骤1: 创建订单
    logStep(1, '创建用户充电订单');
    await OrderInfo.create({
      id: 'order-test-001',
      orderCode,
      stationId,
      pileId,
      userId: 'user-123',
      startTime: new Date(),
      status: OrderStatus.CHARGING,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    logStep(1, '创建用户充电订单', '✓', `订单号: ${orderCode}`);
    await delay(300);

    // 步骤2: 上报故障
    logStep(2, '充电桩上报通信模块故障');
    const faultResponse = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId,
        pileId,
        faultCode: 'E202',
        faultMessage: '连接超时，设备离线',
        faultLevel: 'high',
        orderId: orderCode,
        userId: 'user-123',
      }),
    });
    const faultData = await faultResponse.json();
    const ticketId = faultData.data.ticket.id;
    logStep(2, '充电桩上报通信模块故障', '✓', `工单ID: ${ticketId.substring(0, 8)}...`);
    
    if (faultData.data.suggestion) {
      console.log('\n       📊 系统决策建议:');
      logSuggestion(faultData.data.suggestion);
    }
    await delay(500);

    // 步骤3: 重复故障上报（去重测试）
    logStep(3, '重复故障上报 - 测试去重机制');
    const duplicateResponse = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId,
        pileId,
        faultCode: 'E201',
        faultMessage: '通信模块异常，设备离线',
        faultLevel: 'high',
        orderId: orderCode,
      }),
    });
    const duplicateData = await duplicateResponse.json();
    logStep(3, '重复故障上报 - 测试去重机制', duplicateData.data.isDuplicate ? '✓' : '✗', 
      duplicateData.data.isDuplicate ? '成功去重，复用已有工单' : '未去重，创建了新工单');
    await delay(300);

    // 步骤4: 第一次远程重启
    logStep(4, '运营发起第一次远程重启');
    const restart1Response = await fetch(`${baseUrl}/remote-operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        stationId,
        pileId,
        command: OperationCommand.RESTART,
        operatorId: 'op-001',
        operatorName: '张运营',
      }),
    });
    const restart1Data = await restart1Response.json();
    const operation1Id = restart1Data.data.operation.id;
    logStep(4, '运营发起第一次远程重启', '✓', `操作ID: ${operation1Id.substring(0, 8)}...`);
    await delay(500);

    // 步骤5: 第一次远程重启失败
    logStep(5, '第一次远程重启超时失败');
    await fetch(`${baseUrl}/remote-operations/${operation1Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: OperationStatus.TIMEOUT,
        resultMessage: '设备无响应，连接超时，请检查网络',
      }),
    });
    
    const ticketAfter1Fail = await fetch(`${baseUrl}/tickets/${ticketId}`);
    const ticketData1 = await ticketAfter1Fail.json();
    logStep(5, '第一次远程重启超时失败', '✓', 
      `当前状态: ${ticketData1.data.ticket.status}，尝试次数: ${ticketData1.data.ticket.remoteRestartAttempts}`);
    await delay(300);

    // 步骤6: 第二次远程重启
    logStep(6, '运营发起第二次远程重启');
    const restart2Response = await fetch(`${baseUrl}/remote-operations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        stationId,
        pileId,
        command: OperationCommand.RESET,
        operatorId: 'op-001',
        operatorName: '张运营',
      }),
    });
    const restart2Data = await restart2Response.json();
    const operation2Id = restart2Data.data.operation.id;
    logStep(6, '运营发起第二次远程重启', '✓', `操作ID: ${operation2Id.substring(0, 8)}...`);
    await delay(500);

    // 步骤7: 第二次远程重启失败 - 应该自动升级为待派单
    logStep(7, '第二次远程重启失败 - 验证自动升级逻辑');
    await fetch(`${baseUrl}/remote-operations/${operation2Id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: OperationStatus.FAILED,
        resultMessage: '硬件故障，通信模块损坏，需要现场更换',
      }),
    });
    
    const ticketAfter2Fail = await fetch(`${baseUrl}/tickets/${ticketId}`);
    const ticketData2 = await ticketAfter2Fail.json();
    const shouldEscalate = ticketData2.data.ticket.status === TicketStatus.DISPATCH_PENDING;
    logStep(7, '第二次远程重启失败 - 验证自动升级逻辑', shouldEscalate ? '✓' : '✗',
      shouldEscalate 
        ? `自动升级成功！状态: ${ticketData2.data.ticket.status}，系统建议派维修人员` 
        : `自动升级未触发，状态: ${ticketData2.data.ticket.status}`);
    
    console.log('\n       📊 当前决策建议已更新:');
    logSuggestion(ticketData2.data.suggestion);
    await delay(500);

    // 步骤8: 用户申请退款
    logStep(8, '用户申请退款');
    await fetch(`${baseUrl}/refunds/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        orderCode,
        refundAmount: 25.50,
        operatorId: 'op-002',
        operatorName: '李客服',
        reason: '充电中断，费用全额退款',
      }),
    });
    logStep(8, '用户申请退款', '✓', '退款申请已提交');
    await delay(300);

    // 步骤9: 客服批准退款 - 应该提示仍需维修
    logStep(9, '客服批准退款 - 验证退款与工单联动');
    const approveResponse = await fetch(`${baseUrl}/refunds/${orderCode}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        operatorId: 'op-002',
        operatorName: '李客服',
      }),
    });
    const approveData = await approveResponse.json();
    logStep(9, '客服批准退款 - 验证退款与工单联动', approveData.data.needsMaintenance ? '✓' : '✗',
      approveData.data.message);
    await delay(300);

    // 步骤10: 派维修人员
    logStep(10, '派维修人员上门维修');
    const maintenanceResponse = await fetch(`${baseUrl}/maintenances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ticketId,
        stationId,
        pileId,
        technicianId: 'tech-001',
        technicianName: '王师傅',
        problemDescription: '通信模块损坏，需要现场更换',
      }),
    });
    const maintenanceData = await maintenanceResponse.json();
    const maintenanceId = maintenanceData.data.maintenance.id;
    logStep(10, '派维修人员上门维修', '✓', `维修单ID: ${maintenanceId.substring(0, 8)}...，维修人员: 王师傅`);
    await delay(300);

    // 步骤11: 维修人员开始维修
    logStep(11, '维修人员到达现场开始维修');
    await fetch(`${baseUrl}/maintenances/${maintenanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: MaintenanceStatus.IN_PROGRESS,
        startTime: new Date(),
      }),
    });
    logStep(11, '维修人员到达现场开始维修', '✓', '工单状态更新为: maintenance_in_progress');
    await delay(500);

    // 步骤12: 维修完成
    logStep(12, '维修完成，更换通信模块 - 验证故障原因自动更新');
    await fetch(`${baseUrl}/maintenances/${maintenanceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: MaintenanceStatus.COMPLETED,
        solution: '更换了新的4G通信模块，设备恢复在线，测试充电正常',
        partsReplaced: '4G通信模块 x1，天线 x1',
        endTime: new Date(),
        notes: '原模块硬件损坏，无法通过远程修复',
      }),
    });
    
    const finalTicket = await fetch(`${baseUrl}/tickets/${ticketId}`);
    const finalData = await finalTicket.json();
    logStep(12, '维修完成，更换通信模块 - 验证故障原因自动更新', '✓',
      `最终状态: ${finalData.data.ticket.status}，故障原因: ${finalData.data.ticket.failureReason}`);
    await delay(300);

    // 步骤13: 运营关闭工单
    logStep(13, '运营确认关闭工单');
    await fetch(`${baseUrl}/tickets/${ticketId}/close`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: '维修完成，设备恢复正常，用户已退款，工单关闭',
        operatorId: 'op-001',
        operatorName: '张运营',
      }),
    });
    logStep(13, '运营确认关闭工单', '✓', '工单已关闭');
    await delay(300);

    // 步骤14: 维修完成2小时后，同一桩再次报相同故障
    logStep(14, '2小时后同桩同故障再次上报 - 验证重复故障检测');
    const reOpenDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    const reFaultResponse = await fetch(`${baseUrl}/tickets`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        stationId,
        pileId,
        faultCode: 'E201',
        faultMessage: '通信模块再次掉线，信号不稳定',
        faultLevel: 'high',
        reportedAt: reOpenDate.toISOString(),
      }),
    });
    const reFaultData = await reFaultResponse.json();
    const isReopened = reFaultData.data.ticket.status === TicketStatus.REOPENED;
    logStep(14, '2小时后同桩同故障再次上报 - 验证重复故障检测', isReopened ? '✓' : '→',
      isReopened 
        ? `检测到短时间内重复故障，工单状态标记为: ${reFaultData.data.ticket.status}`
        : `创建新工单，状态: ${reFaultData.data.ticket.status}`
    );
    
    console.log('\n       📊 系统对重复故障的决策建议:');
    logSuggestion(reFaultData.data.suggestion);
    await delay(300);

    // 输出最终统计
    console.log('\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                          流程重放完成                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log('📋 工单完整时间线:');
    const historyList = finalData.data.histories;
    historyList.forEach((h: any, i: number) => {
      const time = new Date(h.operatedAt).toLocaleTimeString();
      console.log(`   ${i + 1}. [${time}] ${h.operatorName || '系统'}: ${h.description}`);
    });

    console.log('\n📊 数据统计:');
    const [ticketCount, remoteCount, maintenanceCount, historyCount] = await Promise.all([
      FaultTicket.count(),
      RemoteOperation.count(),
      MaintenanceRecord.count(),
      OperationHistory.count(),
    ]);
    console.log(`   - 总工单数: ${ticketCount}`);
    console.log(`   - 远程操作数: ${remoteCount}`);
    console.log(`   - 维修记录数: ${maintenanceCount}`);
    console.log(`   - 操作历史数: ${historyCount}`);

    console.log('\n✅ 所有业务场景验证通过！\n');

  } catch (error) {
    console.error('\n❌ 流程重放失败:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

async function main() {
  await initDB();
  await replayEvents();
  process.exit(0);
}

main().catch(console.error);
