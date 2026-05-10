import './database';

import menuVersionService from './services/menuVersionService';
import inventoryService from './services/inventoryService';
import channelStatusService from './services/channelStatusService';
import recoveryTaskService from './services/recoveryTaskService';
import reconciliationService from './services/reconciliationService';
import historyService from './services/historyService';

import { OfflineReason } from './types';

const separator = '═'.repeat(60);

const printSection = (title: string) => {
  console.log(`\n${separator}`);
  console.log(`  ${title}`);
  console.log(separator);
};

const printResult = (label: string, result: any) => {
  console.log(`\n【${label}】`);
  console.log(`  成功: ${result.success ? '✓' : '✗'}`);
  console.log(`  消息: ${result.message}`);
  if (result.data) {
    console.log(`  详情:`);
    console.log(JSON.stringify(result.data, null, 4).split('\n').map(l => '    ' + l).join('\n'));
  }
};

async function runDemo() {
  console.log('\n');
  console.log('╔════════════════════════════════════════════════════════════════╗');
  console.log('║     门店菜单渠道上下架管理系统 - 业务流程演示                   ║');
  console.log('╚════════════════════════════════════════════════════════════════╝');

  printSection('一、初始化菜单版本');
  
  let result = menuVersionService.createVersion(
    'V2026.05.10-夏季新品',
    '5月10日夏季新品上线，新增香辣鸡腿堡',
    ['item-001', 'item-002', 'item-003', 'item-004'],
    '运营部-李经理'
  );
  printResult('创建菜单版本', result);

  printSection('二、设置门店库存（触发自动上架）');
  
  result = inventoryService.setInventory('st-001', 'item-001', 50, 10, '仓储部-王库管');
  printResult('朝阳门店 - 香辣鸡腿堡库存50件（阈值10）', result);

  result = inventoryService.setInventory('st-001', 'item-002', 100, 20, '仓储部-王库管');
  printResult('朝阳门店 - 薯条库存100件（阈值20）', result);

  result = inventoryService.setInventory('st-001', 'item-003', 200, 50, '仓储部-王库管');
  printResult('朝阳门店 - 可乐库存200件（阈值50）', result);

  printSection('三、人工上架（美团渠道先上架）');
  
  result = channelStatusService.manualOnline('st-001', 'item-001', 'ch-001', '运营-张三');
  printResult('朝阳门店-香辣鸡腿堡-美团人工上架', result);

  result = channelStatusService.manualOnline('st-001', 'item-001', 'ch-002', '运营-张三');
  printResult('朝阳门店-香辣鸡腿堡-饿了么人工上架', result);

  printSection('四、查看当前渠道状态');
  
  const statuses = channelStatusService.getAllStatuses('st-001', 'item-001');
  console.log(`  香辣鸡腿堡当前在${statuses.length}个渠道有状态记录:`);
  statuses.forEach(s => {
    const channelName = s.channelId === 'ch-001' ? '美团' : s.channelId === 'ch-002' ? '饿了么' : s.channelId;
    console.log(`    - ${channelName}: ${s.status === 'ONLINE' ? '✓上架中' : '✗已下架'}`);
  });

  printSection('五、库存不足触发自动下架（核心痛点演示）');
  
  result = inventoryService.setInventory('st-001', 'item-001', 5, 10, '系统-POS自动扣减');
  printResult('库存降至5件（低于阈值10）', result);

  console.log('\n  检查各渠道状态变化：');
  const afterStockout = channelStatusService.getAllStatuses('st-001', 'item-001');
  afterStockout.forEach(s => {
    const channelName = s.channelId === 'ch-001' ? '美团' : s.channelId === 'ch-002' ? '饿了么' : 
                       s.channelId === 'ch-003' ? '抖音' : s.channelId === 'ch-004' ? '微信' : s.channelId;
    const statusText = s.status === 'ONLINE' ? '上架中' : s.status === 'OFFLINE' ? '已下架' : '临时停售';
    const sourceText = s.lastChangeSource === 'AUTO' ? '（系统自动）' : '（人工操作）';
    console.log(`    - ${channelName}: ${statusText} ${sourceText}`);
  });

  printSection('六、人工修正（在美团渠道手动上架，忽略缺货）');
  
  result = channelStatusService.manualOnline('st-001', 'item-001', 'ch-001', '店长-李四', '店长确认可用库存，紧急上架');
  printResult('店长手动在美团上架（忽略缺货状态）', result);

  printSection('七、创建恢复任务（备货完成后自动恢复）');
  
  const futureTime = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  result = recoveryTaskService.createTask(
    'st-001', 'item-001', ['ch-002', 'ch-003'],
    futureTime,
    '预计1小时后补货完成，自动恢复上架',
    '运营-张三'
  );
  printResult('创建恢复任务', result);

  printSection('八、发布对账（发现状态不一致）');
  
  result = reconciliationService.runReconciliation('st-001', undefined, false, '对账员-王五');
  printResult('执行对账检查（不自动修复）', result);

  console.log('\n  关键点说明：');
  console.log('  • 美团渠道：店长人工上架，库存不足但仍保持上架（人工操作优先级高）');
  console.log('  • 饿了么渠道：系统自动下架（库存不足）');
  console.log('  • 对账报告：清晰标记哪些是人工修正的状态');

  printSection('九、查看历史记录（人工修正不影响历史追溯）');
  
  const historyResult = historyService.queryHistory('st-001', 'item-001');
  console.log(`\n  历史记录汇总：`);
  console.log(`    总记录数: ${historyResult.summary.total}`);
  console.log(`    系统自动操作: ${historyResult.summary.autoChanges}次`);
  console.log(`    人工操作: ${historyResult.summary.manualChanges}次`);
  console.log(`    上架操作: ${historyResult.summary.onlineCount}次`);
  console.log(`    下架/停售: ${historyResult.summary.offlineCount}次`);

  console.log(`\n  变更历史明细（按时间倒序）：`);
  historyResult.records.forEach((r, idx) => {
    const channelName = r.channelId === 'ch-001' ? '美团' : r.channelId === 'ch-002' ? '饿了么' : 
                       r.channelId === 'ch-003' ? '抖音' : r.channelId === 'ch-004' ? '微信' : r.channelId;
    const sourceText = r.source === 'AUTO' ? '系统自动' : '人工操作';
    const prevText = r.previousStatus === 'ONLINE' ? '上架中' : r.previousStatus === 'OFFLINE' ? '已下架' : '临时停售';
    const newText = r.newStatus === 'ONLINE' ? '上架中' : r.newStatus === 'OFFLINE' ? '已下架' : '临时停售';
    const time = new Date(r.timestamp).toLocaleString('zh-CN');
    
    console.log(`  ${idx + 1}. [${time}] ${channelName} - ${sourceText}`);
    console.log(`     ${prevText || '无记录'} → ${newText}`);
    console.log(`     操作人: ${r.operator}`);
    if (r.remark) console.log(`     备注: ${r.remark}`);
    console.log();
  });

  printSection('十、对账历史（可追溯）');
  
  result = reconciliationService.getJobHistory(10);
  printResult('最近对账任务', result);

  printSection('演示总结');
  
  console.log(`
  业务流程闭环已完整演示：

  1. 菜单版本管理 ✓
     - 创建版本 V2026.05.10
     - 商品清单快照

  2. 库存联动 ✓
     - 设置库存和预警阈值
     - 缺货自动触发各渠道下架
     - 各渠道独立状态

  3. 人工修正 ✓
     - 店长可忽略缺货状态手动上架
     - 记录操作人和备注

  4. 历史追溯 ✓
     - 人工修正不覆盖自动下架记录
     - 每条变更都有时间、来源、操作人
     - 可统计自动vs人工操作次数

  5. 恢复任务 ✓
     - 可创建定时恢复任务
     - 支持取消
     - 执行时会二次检查库存

  6. 发布对账 ✓
     - 检查库存与渠道状态一致性
     - 支持自动修复
     - 完整对账历史记录

  ⚠️ 关键设计：
  - 状态是"最终一致"，历史记录完整保留
  - 人工操作和系统操作分来源记录
  - 对账可以发现不一致，但不强制覆盖人工决策
  - SQLite本地文件存储，重启后历史数据完整
  `);

  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║     演示完成！如需启动API服务，请运行: npm run dev              ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
}

runDemo().catch(console.error);
