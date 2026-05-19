#!/usr/bin/env node

import { TicketService, ExportService, FaultType, TicketStatus } from '../src';
import { TicketRepository, CabinetRepository, AuditLogRepository, MaintenanceRecordRepository } from '../src/storage/repositories';
import { createRuleEngine } from '../src/rules/ruleEngine';

async function main() {
  const ticketRepo = new TicketRepository();
  const cabinetRepo = new CabinetRepository();
  const auditLogRepo = new AuditLogRepository();
  const maintenanceRepo = new MaintenanceRecordRepository();
  const ruleEngine = createRuleEngine(ticketRepo, cabinetRepo, maintenanceRepo);
  const ticketService = new TicketService(ticketRepo, auditLogRepo, maintenanceRepo, ruleEngine);
  const exportService = new ExportService();

  console.log('=== 换电运营值班员工单系统演示 ===\n');

  console.log('1. 添加测试柜机...');
  await cabinetRepo.create({
    id: 'CAB-001',
    name: '朝阳区国贸站A柜',
    location: '北京市朝阳区国贸',
    isOnline: true,
    lastHeartbeat: new Date()
  });
  await cabinetRepo.create({
    id: 'CAB-002',
    name: '海淀区中关村站B柜',
    location: '北京市海淀区中关村',
    isOnline: false,
    lastHeartbeat: new Date()
  });
  console.log('   柜机已添加\n');

  console.log('2. 接收第一个工单（柜门打不开）...');
  const result1 = await ticketService.receiveTicket(
    'EXT-001',
    'CAB-001',
    '朝阳区国贸站A柜',
    FaultType.CABINET_DOOR_FAILURE,
    '用户反馈3号柜门无法打开',
    false,
    'demo-user'
  );
  console.log(`   工单ID: ${result1.ticket.id}`);
  console.log(`   状态: ${result1.ticket.status}`);
  console.log(`   执行动作: ${result1.action}\n`);

  console.log('3. 接收第二个工单（相同柜机相同故障 - 应被合并）...');
  const result2 = await ticketService.receiveTicket(
    'EXT-002',
    'CAB-001',
    '朝阳区国贸站A柜',
    FaultType.CABINET_DOOR_FAILURE,
    '又一用户反馈3号柜门无法打开',
    false,
    'demo-user'
  );
  console.log(`   工单ID: ${result2.ticket.id}`);
  console.log(`   状态: ${result2.ticket.status}`);
  console.log(`   执行动作: ${result2.action}`);
  console.log(`   合并至: ${result2.mergedInto}\n`);

  console.log('4. 接收第三个工单（离线柜机 - 应被阻止）...');
  const result3 = await ticketService.receiveTicket(
    'EXT-003',
    'CAB-002',
    '海淀区中关村站B柜',
    FaultType.SCAN_FAILURE,
    '扫码无反应',
    true,
    'demo-user'
  );
  console.log(`   工单ID: ${result3.ticket.id}`);
  console.log(`   状态: ${result3.ticket.status}`);
  console.log(`   执行动作: ${result3.action}\n`);

  console.log('5. 接收第四个工单（扫码失败）...');
  const result4 = await ticketService.receiveTicket(
    'EXT-004',
    'CAB-001',
    '朝阳区国贸站A柜',
    FaultType.SCAN_FAILURE,
    '扫码成功但不开门',
    false,
    'demo-user'
  );
  console.log(`   工单ID: ${result4.ticket.id}`);
  console.log(`   状态: ${result4.ticket.status}\n`);

  console.log('6. 对第一个工单执行归因分析...');
  await ticketService.analyzeTicket(result1.ticket.id, '门锁机械故障，需要更换', 'operator-001');
  console.log('   归因完成\n');

  console.log('7. 派修...');
  await ticketService.dispatchTicket(
    result1.ticket.id,
    'tech-001',
    new Date(),
    'operator-001'
  );
  console.log('   派修完成\n');

  console.log('8. 复核...');
  await ticketService.reviewTicket(
    result1.ticket.id,
    '已更换门锁，测试正常',
    'NORMAL',
    'operator-002'
  );
  console.log('   复核完成\n');

  console.log('9. 结案...');
  await ticketService.resolveTicket(result1.ticket.id, 'operator-002');
  console.log('   结案完成\n');

  console.log('10. 查询所有工单...');
  const allTickets = await ticketService.listTickets();
  allTickets.forEach(t => {
    console.log(`   - [${t.status}] ${t.externalId} - ${t.cabinetName} - ${t.faultType}`);
  });
  console.log();

  console.log('11. 查看第一个工单的规则执行结果...');
  const history = await ticketService.getTicketHistory(result1.ticket.id);
  if (history) {
    history.ruleResults.forEach(r => {
      console.log(`   - [${r.action}] ${r.ruleName}: ${r.reason}`);
    });
  }
  console.log();

  console.log('12. 生成月度报告...');
  const now = new Date();
  const report = await ticketService.generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
  console.log(`   周期: ${report.period}`);
  console.log(`   总工单数: ${report.totalTickets}`);
  console.log(`   已合并: ${report.mergedTickets}`);
  console.log(`   离线排除: ${report.offlineExcluded}`);
  console.log(`   已派修: ${report.dispatchedCount}`);
  console.log();

  console.log('13. 导出工单数据...');
  const exportedPath = await exportService.exportTicketsToCSV(allTickets);
  console.log(`   导出文件: ${exportedPath}`);
  console.log();

  console.log('=== 演示完成 ===');
  console.log('\n提示: 使用 npm run cli -- help 查看所有可用命令');
  console.log('      数据库文件位置: ./data/battery_swap.db');
}

main().catch(console.error);