import { storage } from '../storage/FileStorage';
import { Teller, ScheduleEntry, RecordStatus } from '../types';
import { v4 as uuidv4 } from 'uuid';

async function initSampleData() {
  console.log('开始初始化样例数据...');

  const tellers: Teller[] = [
    { tellerId: 'T001', name: '张三', cashBoxId: 'CASH-001', branchId: 'B001' },
    { tellerId: 'T002', name: '李四', cashBoxId: 'CASH-002', branchId: 'B001' },
    { tellerId: 'T003', name: '王五', cashBoxId: 'CASH-003', branchId: 'B001' },
    { tellerId: 'T004', name: '赵六', cashBoxId: 'CASH-004', branchId: 'B001' }
  ];
  await storage.saveTellers(tellers);
  console.log(`已保存 ${tellers.length} 条柜员信息`);

  const schedules: ScheduleEntry[] = [
    { tellerId: 'T001', date: '2024-01-15', shift: 'morning', supervisorId: 'S001', supervisorName: '王主管' },
    { tellerId: 'T002', date: '2024-01-15', shift: 'afternoon', supervisorId: 'S001', supervisorName: '王主管' },
    { tellerId: 'T003', date: '2024-01-15', shift: 'full', supervisorId: 'S002', supervisorName: '李主管' },
    { tellerId: 'T001', date: '2024-01-16', shift: 'full', supervisorId: 'S001', supervisorName: '王主管' }
  ];
  await storage.saveSchedules(schedules);
  console.log(`已保存 ${schedules.length} 条排班信息`);

  const now = new Date().toISOString();
  
  const records = [
    {
      id: uuidv4(),
      batchId: 'sample-batch-001',
      tellerId: 'T001',
      tellerName: '张三',
      cashBoxId: 'CASH-001',
      transferDate: '2024-01-15',
      transferTime: '08:30:00',
      previousAmount: 50000.00,
      currentAmount: 50000.00,
      difference: 0.00,
      receivedBy: '张三',
      handedOverBy: '李四',
      firstSignature: 'sign001',
      secondSignature: 'sign002',
      issues: [],
      status: RecordStatus.PENDING,
      processingHistory: [{
        status: RecordStatus.PENDING,
        handledBy: 'system',
        handledAt: now
      }],
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      batchId: 'sample-batch-001',
      tellerId: 'T002',
      tellerName: '李四',
      cashBoxId: 'CASH-002',
      transferDate: '2024-01-15',
      transferTime: '08:35:00',
      previousAmount: 45000.00,
      currentAmount: 44500.00,
      difference: -500.00,
      receivedBy: '李四',
      handedOverBy: '王五',
      firstSignature: '',
      secondSignature: 'sign004',
      issues: [
        {
          type: 'amount_mismatch',
          description: '金额差异 -500.00 元，需要核实',
          detectedAt: now
        },
        {
          type: 'missing_signature',
          description: '缺少双签确认，请补充签名',
          detectedAt: now
        }
      ],
      status: RecordStatus.NEEDS_REVIEW,
      processingHistory: [
        {
          status: RecordStatus.NEEDS_REVIEW,
          handledBy: 'system',
          handledAt: now
        },
        {
          status: RecordStatus.RETURNED,
          handledBy: 'S001',
          handledAt: new Date(Date.now() - 3600000).toISOString(),
          comment: '金额不符，请重新核对现金'
        }
      ],
      createdAt: now,
      updatedAt: now
    },
    {
      id: uuidv4(),
      batchId: 'sample-batch-001',
      tellerId: 'T003',
      tellerName: '王五',
      cashBoxId: 'CASH-003',
      transferDate: '2024-01-14',
      transferTime: '17:00:00',
      previousAmount: 62000.00,
      currentAmount: 62000.00,
      difference: 0.00,
      receivedBy: '王五',
      handedOverBy: '赵六',
      firstSignature: 'sign005',
      secondSignature: 'sign006',
      issues: [
        {
          type: 'cross_day_transfer',
          description: '跨日交接记录，请确认排班信息',
          detectedAt: now
        }
      ],
      status: RecordStatus.PROCESSED,
      processingHistory: [
        {
          status: RecordStatus.NEEDS_REVIEW,
          handledBy: 'system',
          handledAt: now
        },
        {
          status: RecordStatus.PROCESSED,
          handledBy: 'S002',
          handledAt: new Date(Date.now() - 1800000).toISOString(),
          comment: '已确认，特殊情况加班交接'
        }
      ],
      createdAt: now,
      updatedAt: now
    }
  ];

  await storage.saveRecords(records as any);
  console.log(`已保存 ${records.length} 条交接记录`);

  const batch = {
    id: 'sample-batch-001',
    name: '2024年1月15日交接批次',
    description: '日常柜员尾箱交接',
    branchId: 'B001',
    createdBy: 'admin',
    totalRecords: 3,
    processedRecords: 1,
    status: 'active' as const,
    createdAt: now,
    updatedAt: now
  };
  await storage.saveBatch(batch);
  console.log('已保存批次信息');

  console.log('样例数据初始化完成！');
  console.log('');
  console.log('样例说明：');
  console.log('- 柜员张三 (T001) - 尾箱 CASH-001：记录正常，待处理');
  console.log('- 柜员李四 (T002) - 尾箱 CASH-002：金额差异-500元，缺少签名，已退回修改');
  console.log('- 柜员王五 (T003) - 尾箱 CASH-003：跨日交接，主管已确认放行');
}

initSampleData().catch(console.error);
