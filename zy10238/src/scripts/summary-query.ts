import { initDB, FaultTicket, OperationHistory, RemoteOperation, MaintenanceRecord, OrderInfo, TicketStatus, FailureReason } from '../models';
import { Op, Sequelize } from 'sequelize';

function printHeader(title: string) {
  console.log('\n' + '═'.repeat(60));
  console.log(`  ${title}`);
  console.log('═'.repeat(60));
}

function printSection(title: string) {
  console.log(`\n  \x1b[36m📌 ${title}\x1b[0m`);
  console.log('  ─' + '─'.repeat(56));
}

async function queryOverallStats() {
  printSection('整体统计概览');

  const [
    totalTickets,
    openTickets,
    remoteSuccessCount,
    maintenanceCompleted,
    refundedCount,
    totalOperations,
    totalMaintenances,
  ] = await Promise.all([
    FaultTicket.count(),
    FaultTicket.count({ where: { status: { [Op.notIn]: [TicketStatus.CLOSED, TicketStatus.MAINTENANCE_COMPLETED] } } }),
    RemoteOperation.count({ where: { status: 'success' } }),
    MaintenanceRecord.count({ where: { status: 'completed' } }),
    FaultTicket.count({ where: { status: TicketStatus.REFUNDED } }),
    RemoteOperation.count(),
    MaintenanceRecord.count(),
  ]);

  const remoteSuccessRate = totalOperations > 0 ? ((remoteSuccessCount / totalOperations) * 100).toFixed(1) : '0.0';
  const closeRate = totalTickets > 0 ? (((totalTickets - openTickets) / totalTickets) * 100).toFixed(1) : '0.0';

  console.log(`    总工单数:       ${totalTickets}`);
  console.log(`    待处理工单:     ${openTickets}`);
  console.log(`    已关闭工单:     ${totalTickets - openTickets} (${closeRate}%)`);
  console.log(`    远程修复成功:   ${remoteSuccessCount} / ${totalOperations} (${remoteSuccessRate}%)`);
  console.log(`    现场维修完成:   ${maintenanceCompleted}`);
  console.log(`    退款完成:       ${refundedCount}`);
}

async function queryFailureReasonStats() {
  printSection('故障原因分析');

  const reasonStats = await FaultTicket.findAll({
    attributes: [
      'failureReason',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    group: ['failureReason'],
    order: [[Sequelize.literal('count'), 'DESC']],
    raw: true,
  });

  const reasonLabels: Record<string, string> = {
    [FailureReason.COMMUNICATION_ERROR]: '📡 通信错误',
    [FailureReason.HARDWARE_FAILURE]: '🔧 硬件故障',
    [FailureReason.SOFTWARE_BUG]: '💻 软件问题',
    [FailureReason.OVERHEAT]: '🌡️  过热',
    [FailureReason.GUN_LOCK_FAILURE]: '🔒 枪锁故障',
    [FailureReason.PAYMENT_FAILURE]: '💰 支付问题',
    [FailureReason.UNKNOWN]: '❓ 未知原因',
  };

  reasonStats.forEach((stat: any, i: number) => {
    const label = reasonLabels[stat.failureReason] || stat.failureReason;
    console.log(`    ${i + 1}. ${label}: ${stat.count}次`);
  });
}

async function queryFaultCodeRanking() {
  printSection('故障码 TOP 排行');

  const faultTop = await FaultTicket.findAll({
    attributes: [
      'faultCode',
      'faultMessage',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    group: ['faultCode', 'faultMessage'],
    order: [[Sequelize.literal('count'), 'DESC']],
    limit: 5,
    raw: true,
  });

  faultTop.forEach((f: any, i: number) => {
    console.log(`    ${i + 1}. ${f.faultCode} - ${f.faultMessage} (${f.count}次)`);
  });
}

async function queryStationStats() {
  printSection('充电站故障统计');

  const stationStats = await FaultTicket.findAll({
    attributes: [
      'stationId',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    group: ['stationId'],
    order: [[Sequelize.literal('count'), 'DESC']],
    raw: true,
  });

  stationStats.forEach((s: any) => {
    console.log(`    ${s.stationId}: ${s.count}次故障`);
  });
}

async function queryPileStats() {
  printSection('充电桩故障排行 (TOP 5)');

  const pileStats = await FaultTicket.findAll({
    attributes: [
      'pileId',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    group: ['pileId'],
    order: [[Sequelize.literal('count'), 'DESC']],
    limit: 5,
    raw: true,
  });

  pileStats.forEach((p: any, i: number) => {
    console.log(`    ${i + 1}. ${p.pileId}: ${p.count}次故障`);
  });
}

async function queryProcessingEfficiency() {
  printSection('工单处理效率分析');

  const completedTickets = await FaultTicket.findAll({
    where: {
      status: { [Op.in]: [TicketStatus.CLOSED, TicketStatus.MAINTENANCE_COMPLETED, TicketStatus.REMOTE_RESTART_SUCCESS] },
    },
    include: [
      { model: OperationHistory, as: 'histories', order: [['operatedAt', 'ASC']] },
    ],
    raw: false,
  });

  if (completedTickets.length > 0) {
    let totalDuration = 0;
    let count = 0;

    for (const ticket of completedTickets as any[]) {
      const reportedAt = new Date(ticket.reportedAt);
      const closedAt = ticket.closedAt ? new Date(ticket.closedAt) : null;
      
      if (closedAt) {
        const durationMinutes = (closedAt.getTime() - reportedAt.getTime()) / (1000 * 60);
        totalDuration += durationMinutes;
        count++;
        
        let statusIcon = '';
        switch (ticket.status) {
          case TicketStatus.REMOTE_RESTART_SUCCESS: statusIcon = '🔄'; break;
          case TicketStatus.MAINTENANCE_COMPLETED: statusIcon = '👷'; break;
          default: statusIcon = '✅';
        }
        
        console.log(`    ${statusIcon} ${ticket.ticketCode}: ${ticket.faultCode}`);
        console.log(`       处理时长: ${durationMinutes.toFixed(1)}分钟 | ${ticket.failureReason}`);
      }
    }

    if (count > 0) {
      console.log(`\n    📊 平均处理时长: ${(totalDuration / count).toFixed(1)}分钟 (${count}个工单)`);
    }
  } else {
    console.log('    暂无已完成工单数据');
  }
}

async function queryRecentTrend() {
  printSection('24小时故障趋势');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recentTickets = await FaultTicket.findAll({
    where: { reportedAt: { [Op.gte]: oneDayAgo } },
    order: [['reportedAt', 'ASC']],
    raw: true,
  });

  console.log(`    24小时内故障总数: ${recentTickets.length}`);
  
  const hourlyStats: Record<number, number> = {};
  recentTickets.forEach((t: any) => {
    const hour = new Date(t.reportedAt).getHours();
    hourlyStats[hour] = (hourlyStats[hour] || 0) + 1;
  });

  console.log('\n    时段分布:');
  Object.entries(hourlyStats).forEach(([hour, count]) => {
    const bar = '█'.repeat(count);
    const isMidnight = parseInt(hour) >= 0 && parseInt(hour) < 6;
    console.log(`    ${isMidnight ? '🌙' : '☀️'} ${hour.padStart(2, '0')}时: ${bar} (${count})`);
  });
}

async function queryRepeatFaults() {
  printSection('⚠️  重复故障预警 (24小时内2次以上)');

  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const duplicatePiles = await FaultTicket.findAll({
    attributes: [
      'pileId',
      [Sequelize.fn('COUNT', Sequelize.col('id')), 'count'],
    ],
    where: { reportedAt: { [Op.gte]: oneDayAgo } },
    group: ['pileId'],
    having: Sequelize.literal('count >= 2'),
    order: [[Sequelize.literal('count'), 'DESC']],
    raw: true,
  });

  if (duplicatePiles.length > 0) {
    duplicatePiles.forEach((p: any, i: number) => {
      const level = p.count >= 5 ? '🔴 高风险' : p.count >= 3 ? '🟡 中风险' : '🟢 关注';
      console.log(`    ${i + 1}. ${level} - ${p.pileId}: ${p.count}次故障`);
    });
  } else {
    console.log('    ✅ 无重复故障桩，运行良好');
  }
}

async function queryTicketDetail(ticketId: string) {
  printSection(`工单完整链路 - ${ticketId.substring(0, 8)}...`);

  const ticket = await FaultTicket.findByPk(ticketId, {
    include: [
      { model: OperationHistory, as: 'histories', order: [['operatedAt', 'ASC']] },
      { model: RemoteOperation, as: 'remoteOperations', order: [['requestedAt', 'ASC']] },
      { model: MaintenanceRecord, as: 'maintenanceRecords', order: [['createdAt', 'ASC']] },
    ],
  });

  if (!ticket) {
    console.log('    工单不存在');
    return;
  }

  const data = ticket.toJSON();
  
  const statusIcons: Record<string, string> = {
    [TicketStatus.NEW]: '🆕',
    [TicketStatus.REMOTE_RESTART_PENDING]: '⏳',
    [TicketStatus.REMOTE_RESTART_SUCCESS]: '✅',
    [TicketStatus.REMOTE_RESTART_FAILED]: '❌',
    [TicketStatus.DISPATCH_PENDING]: '📋',
    [TicketStatus.MAINTENANCE_IN_PROGRESS]: '👷',
    [TicketStatus.MAINTENANCE_COMPLETED]: '✅',
    [TicketStatus.REFUNDED]: '💰',
    [TicketStatus.CLOSED]: '📕',
    [TicketStatus.REOPENED]: '🔄',
  };

  console.log(`    📝 工单号: ${data.ticketCode}`);
  console.log(`    📍 充电桩: ${data.pileId}`);
  console.log(`    ❌ 故障码: ${data.faultCode} - ${data.faultMessage}`);
  console.log(`    📊 当前状态: ${statusIcons[data.status] || ''} ${data.status}`);
  console.log(`    🔍 故障原因: ${data.failureReason}`);
  console.log(`    🔄 远程尝试: ${data.remoteRestartAttempts}/${data.maxRemoteRestarts}`);
  console.log(`    🕐 上报时间: ${new Date(data.reportedAt).toLocaleString()}`);
  if (data.closedAt) {
    console.log(`    📕 关闭时间: ${new Date(data.closedAt).toLocaleString()}`);
  }

  console.log('\n    📜 完整时间线:');
  const allEvents = [
    ...(data.histories || []).map((h: any) => ({
      time: new Date(h.operatedAt),
      type: 'history',
      data: h,
    })),
    ...(data.remoteOperations || []).map((r: any) => ({
      time: new Date(r.requestedAt),
      type: 'remote',
      data: r,
    })),
    ...(data.maintenanceRecords || []).map((m: any) => ({
      time: new Date(m.createdAt),
      type: 'maintenance',
      data: m,
    })),
  ].sort((a, b) => a.time.getTime() - b.time.getTime());

  allEvents.forEach((event: any, i: number) => {
    const time = event.time.toLocaleTimeString();
    if (event.type === 'history') {
      const h = event.data;
      console.log(`       ${i + 1}. [${time}] ${h.operatorName || '系统'}: ${h.description}`);
    } else if (event.type === 'remote') {
      const r = event.data;
      const statusIcon = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⏳';
      console.log(`       ${i + 1}. [${time}] 远程操作 ${statusIcon}: ${r.command} - ${r.resultMessage || r.status}`);
    } else if (event.type === 'maintenance') {
      const m = event.data;
      console.log(`       ${i + 1}. [${time}] 维修 ${m.technicianName || '待分配'}: ${m.status} - ${m.solution || m.problemDescription || ''}`);
    }
  });
}

async function main() {
  printHeader('充电桩故障工单系统 - 汇总分析报告');
  console.log(`  📅 生成时间: ${new Date().toLocaleString()}\n`);

  await initDB();
  
  await queryOverallStats();
  await queryFailureReasonStats();
  await queryFaultCodeRanking();
  await queryStationStats();
  await queryPileStats();
  await queryProcessingEfficiency();
  await queryRecentTrend();
  await queryRepeatFaults();

  // 展示第一个工单的详细链路
  const firstTicket = await FaultTicket.findOne({ order: [['createdAt', 'DESC']] });
  if (firstTicket) {
    await queryTicketDetail(firstTicket.id);
  }

  console.log('\n' + '═'.repeat(60));
  console.log('  📊 报告生成完毕');
  console.log('═'.repeat(60) + '\n');

  process.exit(0);
}

main().catch(console.error);
