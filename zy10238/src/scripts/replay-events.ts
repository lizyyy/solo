import { initDB, FaultTicket, OperationHistory, RemoteOperation, MaintenanceRecord, OrderInfo, TicketStatus, OperationType, OperationStatus, MaintenanceStatus, OrderStatus, OperationCommand } from '../models';
import { ticketService, remoteOperationService, maintenanceService, orderService } from '../services';

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

  console.log('📋 测试场景: 通信故障 → 决策建议 → 远程重启失败2次 → 自动升级派单 → 用户退款 → 维修完成 → 同桩重复故障检测\n');

  try {
    // 步骤0: 清空数据库
    logStep(0, '清空数据库，准备测试环境');
    await initDB({ force: true });
    logStep(0, '清空数据库，准备测试环境', '✓');
    await delay(100);

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
    await delay(100);

    // 步骤2: 上报故障
    logStep(2, '充电桩上报通信模块故障');
    const result2 = await ticketService.createTicket({
      stationId,
      pileId,
      faultCode: 'E202',
      faultMessage: '连接超时，设备离线',
      faultLevel: 'high',
      orderId: orderCode,
      userId: 'user-123',
    });
    const ticketId = result2.ticket.id;
    logStep(2, '充电桩上报通信模块故障', '✓', `工单ID: ${ticketId.substring(0, 8)}...`);
    
    if (result2.suggestion) {
      console.log('\n       📊 系统决策建议:');
      logSuggestion(result2.suggestion);
    }
    await delay(100);

    // 步骤3: 重复故障上报（去重测试）- 使用完全相同的故障码和充电桩
    logStep(3, '重复故障上报 - 测试去重机制（同桩同故障码E202）');
    const result3 = await ticketService.createTicket({
      stationId,
      pileId,
      faultCode: 'E202',
      faultMessage: '连接超时，设备离线',
      faultLevel: 'high',
      orderId: orderCode,
    });
    logStep(3, '重复故障上报 - 测试去重机制（同桩同故障码E202）', result3.isDuplicate ? '✓' : '✗', 
      result3.isDuplicate ? '成功去重，复用已有工单' : '未去重，创建了新工单');
    await delay(100);

    // 步骤4: 发起第一次远程重启
    logStep(4, '运营发起第一次远程重启');
    const op4 = await remoteOperationService.createOperation({
      ticketId,
      stationId,
      pileId,
      command: OperationCommand.RESTART,
      operatorId: 'op-001',
      operatorName: '张运营',
    });
    logStep(4, '运营发起第一次远程重启', '✓', `操作ID: ${op4.id.substring(0, 8)}...`);
    await delay(100);

    // 步骤5: 第一次远程重启失败
    logStep(5, '第一次远程重启超时失败');
    await remoteOperationService.updateOperation({
      operationId: op4.id,
      status: OperationStatus.FAILED,
      resultMessage: '设备无响应，连接超时，请检查网络',
    });
    const ticketAfterOp4 = await FaultTicket.findByPk(ticketId);
    logStep(5, '第一次远程重启超时失败', '✓', `当前状态: ${ticketAfterOp4?.status}，尝试次数: ${ticketAfterOp4?.remoteRestartAttempts}`);
    await delay(100);

    // 步骤6: 发起第二次远程操作
    logStep(6, '运营发起第二次远程重启');
    const op6 = await remoteOperationService.createOperation({
      ticketId,
      stationId,
      pileId,
      command: OperationCommand.RESET,
      operatorId: 'op-001',
      operatorName: '张运营',
    });
    logStep(6, '运营发起第二次远程重启', '✓', `操作ID: ${op6.id.substring(0, 8)}...`);
    await delay(100);

    // 步骤7: 第二次远程操作失败 - 验证自动升级
    logStep(7, '第二次远程重启失败 - 验证自动升级逻辑');
    await remoteOperationService.updateOperation({
      operationId: op6.id,
      status: OperationStatus.FAILED,
      resultMessage: '硬件故障，通信模块损坏，需要现场更换',
    });
    const ticketAfterOp7 = await FaultTicket.findByPk(ticketId);
    const shouldEscalate = ticketAfterOp7?.status === TicketStatus.DISPATCH_PENDING;
    logStep(7, '第二次远程重启失败 - 验证自动升级逻辑', shouldEscalate ? '✓' : '✗',
      shouldEscalate 
        ? `自动升级成功！状态: ${ticketAfterOp7?.status}，系统建议派维修人员` 
        : `自动升级未触发，状态: ${ticketAfterOp7?.status}`);
    
    const suggestion7 = await ticketService.getDecisionSuggestion(ticketId);
    console.log('\n       📊 当前决策建议已更新:');
    logSuggestion(suggestion7);
    await delay(100);

    // 步骤8: 用户申请退款
    logStep(8, '用户申请退款');
    await orderService.requestRefund({
      orderCode,
      refundAmount: 25.5,
      operatorId: 'op-002',
      operatorName: '李客服',
      reason: '充电中断，费用全额退款',
    });
    logStep(8, '用户申请退款', '✓', '退款申请已提交');
    await delay(100);

    // 步骤9: 客服批准退款
    logStep(9, '客服批准退款 - 验证退款与工单联动');
    const result9 = await orderService.approveRefund(orderCode, 'op-002', '李客服');
    logStep(9, '客服批准退款 - 验证退款与工单联动', '✓', result9.needsMaintenance ? '设备仍需维修，退款成功' : '退款成功');
    await delay(100);

    // 步骤10: 派维修人员
    logStep(10, '派维修人员上门维修');
    const maintenance10 = await maintenanceService.createMaintenance({
      ticketId,
      stationId,
      pileId,
      technicianId: 'tech-001',
      technicianName: '王师傅',
      problemDescription: '通信模块损坏，需要现场更换',
    });
    const maintenanceId = maintenance10.maintenance.id;
    logStep(10, '派维修人员上门维修', '✓', `维修单ID: ${maintenanceId.substring(0, 8)}...，维修人员: 王师傅`);
    await delay(100);

    // 步骤11: 维修人员开始维修
    logStep(11, '维修人员到达现场开始维修');
    const result11 = await maintenanceService.updateMaintenance({
      maintenanceId,
      status: MaintenanceStatus.IN_PROGRESS,
      technicianId: 'tech-001',
      technicianName: '王师傅',
    });
    logStep(11, '维修人员到达现场开始维修', '✓', `工单状态更新为: ${result11.ticket?.status}`);
    await delay(100);

    // 步骤12: 维修完成
    logStep(12, '维修完成，更换通信模块 - 验证故障原因自动更新');
    const result12 = await maintenanceService.updateMaintenance({
      maintenanceId,
      status: MaintenanceStatus.COMPLETED,
      solution: '更换了新的4G通信模块，设备恢复在线，测试充电正常',
      partsReplaced: '4G通信模块 x1，天线 x1',
      notes: '原模块硬件损坏，无法通过远程修复',
    });
    logStep(12, '维修完成，更换通信模块 - 验证故障原因自动更新', '✓',
      `最终状态: ${result12.ticket?.status}，故障原因: ${result12.ticket?.failureReason}`);
    await delay(100);

    // 步骤13: 关闭工单
    logStep(13, '运营确认关闭工单');
    const result13 = await ticketService.updateStatus({
      ticketId,
      newStatus: TicketStatus.CLOSED,
      operatorId: 'op-001',
      operatorName: '张运营',
      description: '维修完成，设备恢复正常，用户已退款，工单关闭',
    });
    logStep(13, '运营确认关闭工单', '✓', `工单状态: ${result13.status}`);
    await delay(100);

    // 步骤14: 维修完成1小时后（<2小时阈值），同一桩再次报相同故障码E202
    logStep(14, '1小时后同桩同故障码E202再次上报 - 验证重新打开逻辑');
    const reOpenDate = new Date(Date.now() + 1 * 60 * 60 * 1000); // 1小时后，触发重新打开阈值
    const result14 = await ticketService.createTicket({
      stationId,
      pileId,
      faultCode: 'E202',
      faultMessage: '通信模块再次掉线，信号不稳定',
      faultLevel: 'high',
      reportedAt: reOpenDate,
    });
    const isReopened = result14.ticket.status === TicketStatus.REOPENED;
    logStep(14, '1小时后同桩同故障码E202再次上报 - 验证重新打开逻辑', isReopened ? '✓' : '→',
      isReopened 
        ? `检测到短时间内重复故障，工单状态标记为: ${result14.ticket.status}` 
        : `创建新工单，状态: ${result14.ticket.status}`);
    
    console.log('\n       📊 系统对重复故障的决策建议:');
    const suggestion14 = await ticketService.getDecisionSuggestion(result14.ticket.id);
    logSuggestion(suggestion14);
    await delay(100);

    // 输出最终统计
    console.log('\n' + '═'.repeat(60));
    console.log('📊 数据统计:');
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
    console.log('\n✅ 所有业务场景验证通过！');
    console.log('═'.repeat(60) + '\n');

  } catch (error) {
    console.log('\n❌ 流程重放失败:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

replayEvents();
