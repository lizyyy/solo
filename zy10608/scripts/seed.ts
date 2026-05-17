import { initDatabase, closeDatabase } from '../src/models/database';
import { supplementService } from '../src/services/supplementService';
import { SupplementStatus } from '../src/models/types';

async function seed() {
  console.log('开始生成测试数据...\n');
  
  await initDatabase();

  const carriers = ['顺丰速运', '中通快递', '圆通速递', '韵达快递', '京东物流'];
  const sources = ['人工补传', 'API导入', 'Excel导入', '系统自动'];
  const handlers = ['张三', '李四', '王五', '赵六'];
  const businessObjects = ['华东大区', '华南大区', '华北大区', '西部大区'];
  const nodeTypes = ['揽收', '派送', '签收', '中转'];

  console.log('=== 1. 创建完整流转记录 ===');
  const fullFlowRecord = await supplementService.create({
    waybill_no: 'SF1234567890',
    carrier: '顺丰速运',
    node_time: '2024-01-15 10:30:00',
    node_type: '签收',
    supplement_source: '人工补传',
    status: SupplementStatus.PENDING,
    handler: '张三',
    business_object: '华东大区',
    remark: '客户反馈未收到，需要补传'
  }, '系统管理员');
  console.log('创建记录:', fullFlowRecord.id, fullFlowRecord.waybill_no, fullFlowRecord.status);

  await supplementService.updateStatus(fullFlowRecord.id!, SupplementStatus.RECEIVED, '张三', '已接收，核实无误');
  console.log('状态更新:', 'PENDING -> RECEIVED');

  await supplementService.updateStatus(fullFlowRecord.id!, SupplementStatus.ARCHIVED, '李四', '已归档，流程完成');
  console.log('状态更新:', 'RECEIVED -> ARCHIVED');
  console.log('完整流转记录创建完成\n');

  console.log('=== 2. 创建冲突记录 ===');
  const conflictRecord1 = await supplementService.create({
    waybill_no: 'ZT9876543210',
    carrier: '中通快递',
    node_time: '2024-01-16 14:20:00',
    node_type: '派送',
    supplement_source: 'API导入',
    status: SupplementStatus.PENDING,
    handler: '王五',
    business_object: '华南大区'
  }, '系统管理员');
  console.log('创建承运商A记录:', conflictRecord1.id, conflictRecord1.carrier, conflictRecord1.node_time);

  const conflictRecord2 = await supplementService.create({
    waybill_no: 'ZT9876543210',
    carrier: '圆通速递',
    node_time: '2024-01-16 15:45:00',
    node_type: '派送',
    supplement_source: 'Excel导入',
    status: SupplementStatus.PENDING,
    handler: '赵六',
    business_object: '华南大区'
  }, '系统管理员');
  console.log('创建承运商B记录:', conflictRecord2.id, conflictRecord2.carrier, conflictRecord2.node_time);
  console.log('冲突记录创建完成，状态应为 CONFLICT\n');

  console.log('=== 3. 准备批量导入坏行数据 ===');
  const batchRecords = [
    {
      waybill_no: 'YD1111111111',
      carrier: '韵达快递',
      node_time: '2024-01-17 09:00:00',
      node_type: '揽收',
      supplement_source: 'Excel导入',
      status: SupplementStatus.PENDING,
      handler: '张三',
      business_object: '华北大区'
    },
    {
      waybill_no: '',
      carrier: '京东物流',
      node_time: '2024-01-17 10:00:00',
      node_type: '中转',
      supplement_source: 'Excel导入',
      status: SupplementStatus.PENDING,
      handler: '李四'
    },
    {
      waybill_no: 'YD1111111111',
      carrier: '韵达快递',
      node_time: '2024-01-17 09:00:00',
      node_type: '揽收',
      supplement_source: 'Excel导入',
      status: SupplementStatus.PENDING,
      handler: '张三',
      business_object: '华北大区'
    }
  ];

  const batchResult = await supplementService.batchCreate(batchRecords, '批量导入用户');
  console.log('批量导入结果:');
  console.log('  成功:', batchResult.success.length, '条');
  console.log('  失败:', batchResult.failed.length, '条');
  batchResult.failed.forEach((f, i) => {
    console.log(`    坏行${i + 1}:`, f.record.waybill_no || '(空运单号)', '-', f.error);
  });
  console.log();

  console.log('=== 4. 创建随机测试数据 ===');
  for (let i = 0; i < 10; i++) {
    const randomStatus = [SupplementStatus.PENDING, SupplementStatus.RECEIVED, SupplementStatus.CONFLICT][Math.floor(Math.random() * 3)];
    await supplementService.create({
      waybill_no: `TEST${String(10000 + i).padStart(5, '0')}`,
      carrier: carriers[Math.floor(Math.random() * carriers.length)],
      node_time: `2024-01-${String(15 + Math.floor(Math.random() * 10)).padStart(2, '0')} ${String(Math.floor(Math.random() * 24)).padStart(2, '0')}:${String(Math.floor(Math.random() * 60)).padStart(2, '0')}:00`,
      node_type: nodeTypes[Math.floor(Math.random() * nodeTypes.length)],
      supplement_source: sources[Math.floor(Math.random() * sources.length)],
      status: randomStatus,
      handler: handlers[Math.floor(Math.random() * handlers.length)],
      business_object: businessObjects[Math.floor(Math.random() * businessObjects.length)]
    }, '造数脚本');
  }
  console.log('随机测试数据创建完成\n');

  console.log('=== 数据生成汇总 ===');
  const allRecords = await supplementService.query({ page: 1, pageSize: 100 });
  console.log('总记录数:', allRecords.total);
  
  const statusCounts = await Promise.all(
    Object.values(SupplementStatus).map(async (status) => {
      const result = await supplementService.query({ status, page: 1, pageSize: 1 });
      return { status, count: result.total };
    })
  );
  console.log('各状态统计:');
  statusCounts.forEach(s => console.log(`  ${s.status}: ${s.count}`));

  await closeDatabase();
  console.log('\n造数完成!');
}

seed().catch(console.error);
