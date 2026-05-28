import { Redemption, ConsumptionRecord, Identification, DisputeNote, Batch, OperationLog } from '../types';

export const mockRedemptions: Redemption[] = [
  {
    id: '1',
    cardNumber: 'VIP00123456',
    cardHolderName: '张三',
    phone: '13800138001',
    initialBalance: 5000,
    currentBalance: 2350.5,
    status: 'pending',
    batchId: 'B001',
    identityId: 'ID001',
    hasDispute: false,
    isFrozen: false,
    createdAt: '2026-05-20 10:30:00',
    updatedAt: '2026-05-20 10:30:00',
    createdBy: '兑付专员A'
  },
  {
    id: '2',
    cardNumber: 'VIP00123457',
    cardHolderName: '李四',
    phone: '13800138002',
    initialBalance: 3000,
    currentBalance: -500.25,
    status: 'disputed',
    identityId: 'ID002',
    hasDispute: true,
    isFrozen: true,
    createdAt: '2026-05-21 09:15:00',
    updatedAt: '2026-05-22 14:20:00',
    createdBy: '兑付专员B'
  },
  {
    id: '3',
    cardNumber: 'VIP00123456',
    cardHolderName: '张三',
    phone: '13800138001',
    initialBalance: 5000,
    currentBalance: 2350.5,
    status: 'pending',
    identityId: 'ID001',
    hasDispute: false,
    isFrozen: false,
    createdAt: '2026-05-21 11:45:00',
    updatedAt: '2026-05-21 11:45:00',
    createdBy: '兑付专员A'
  },
  {
    id: '4',
    cardNumber: 'VIP00123458',
    cardHolderName: '王五',
    phone: '13800138003',
    initialBalance: 8000,
    currentBalance: 6780,
    status: 'processing',
    batchId: 'B001',
    identityId: 'ID003',
    hasDispute: false,
    isFrozen: false,
    createdAt: '2026-05-19 16:00:00',
    updatedAt: '2026-05-23 10:00:00',
    createdBy: '兑付专员C'
  },
  {
    id: '5',
    cardNumber: 'VIP00123459',
    cardHolderName: '赵六',
    phone: '13800138004',
    initialBalance: 1200,
    currentBalance: 890.5,
    status: 'disputed',
    identityId: 'ID004',
    hasDispute: true,
    isFrozen: false,
    createdAt: '2026-05-22 08:30:00',
    updatedAt: '2026-05-22 08:30:00',
    createdBy: '兑付专员A'
  },
  {
    id: '6',
    cardNumber: 'VIP00123460',
    cardHolderName: '孙七',
    phone: '13800138005',
    initialBalance: 15000,
    currentBalance: 12345.67,
    status: 'completed',
    batchId: 'B002',
    identityId: 'ID005',
    hasDispute: false,
    isFrozen: false,
    createdAt: '2026-05-15 14:20:00',
    updatedAt: '2026-05-25 09:30:00',
    createdBy: '兑付专员B'
  },
  {
    id: '7',
    cardNumber: 'VIP00123461',
    cardHolderName: '周八',
    phone: '13800138006',
    initialBalance: 2500,
    currentBalance: 2100,
    status: 'frozen',
    identityId: 'ID006',
    hasDispute: true,
    isFrozen: true,
    createdAt: '2026-05-23 11:00:00',
    updatedAt: '2026-05-24 15:45:00',
    createdBy: '兑付专员C'
  },
  {
    id: '8',
    cardNumber: 'VIP00123462',
    cardHolderName: '吴九',
    phone: '138001380',
    initialBalance: 6800,
    currentBalance: 4500,
    status: 'pending',
    batchId: 'B001',
    identityId: 'ID007',
    hasDispute: false,
    isFrozen: false,
    createdAt: '2026-05-24 10:15:00',
    updatedAt: '2026-05-24 10:15:00',
    createdBy: '兑付专员A'
  }
];

export const mockConsumptionRecords: ConsumptionRecord[] = [
  { id: 'C001', redemptionId: '1', consumeTime: '2026-05-01 10:30:00', storeName: '超市A', amount: 200, type: 'consume', remark: '日用品采购' },
  { id: 'C002', redemptionId: '1', consumeTime: '2026-05-05 14:20:00', storeName: '餐饮B', amount: 350, type: 'consume', remark: '家庭聚餐' },
  { id: 'C003', redemptionId: '1', consumeTime: '2026-05-10 09:15:00', storeName: '服装C', amount: 1500, type: 'consume', remark: '夏季新装' },
  { id: 'C004', redemptionId: '1', consumeTime: '2026-05-15 16:45:00', storeName: '超市A', amount: 599.5, type: 'consume', remark: '' },
  { id: 'C005', redemptionId: '2', consumeTime: '2026-04-28 11:00:00', storeName: '电器D', amount: 3500, type: 'consume', remark: '购买冰箱' },
  { id: 'C006', redemptionId: '4', consumeTime: '2026-05-02 15:30:00', storeName: '珠宝E', amount: 1200, type: 'consume', remark: '项链' },
  { id: 'C007', redemptionId: '4', consumeTime: '2026-05-08 10:00:00', storeName: '超市A', amount: 200, type: 'refund', remark: '退货' },
  { id: 'C008', redemptionId: '6', consumeTime: '2026-05-10 13:20:00', storeName: '餐饮B', amount: 654.33, type: 'consume', remark: '商务宴请' },
];

export const mockIdentifications: Identification[] = [
  { id: 'ID001', idType: 'id_card', idNumber: '310***********1234', verificationStatus: 'verified' },
  { id: 'ID002', idType: 'id_card', idNumber: '310***********5678', verificationStatus: 'pending' },
  { id: 'ID003', idType: 'id_card', idNumber: '310***********9012', verificationStatus: 'verified' },
  { id: 'ID004', idType: 'passport', idNumber: 'E12345678', verificationStatus: 'pending' },
  { id: 'ID005', idType: 'id_card', idNumber: '310***********3456', verificationStatus: 'verified' },
  { id: 'ID006', idType: 'id_card', idNumber: '310***********7890', verificationStatus: 'rejected' },
  { id: 'ID007', idType: 'id_card', idNumber: '310***********2345', verificationStatus: 'verified' },
];

export const mockDisputeNotes: DisputeNote[] = [
  { id: 'D001', redemptionId: '2', content: '顾客称有一笔500元消费非本人操作，需核实消费凭证', handler: '兑付专员B', handleTime: '2026-05-22 14:20:00', status: 'open' },
  { id: 'D002', redemptionId: '5', content: '消费流水缺失2026年3月记录，顾客称还有余额未消费', handler: '兑付专员A', handleTime: '2026-05-22 09:00:00', status: 'open' },
  { id: 'D003', redemptionId: '7', content: '身份验证未通过，顾客提供的证件照片模糊', handler: '兑付专员C', handleTime: '2026-05-24 15:45:00', status: 'resolved' },
];

export const mockBatches: Batch[] = [
  { id: 'B001', batchNo: 'BATCH-202605-001', name: '2026年5月第一批兑付', status: 'executing', createTime: '2026-05-20 09:00:00', executeTime: '2026-05-25 10:00:00', auditor: '财务审核员A', totalCount: 3, totalAmount: 13630.5 },
  { id: 'B002', batchNo: 'BATCH-202605-002', name: '2026年5月第二批兑付', status: 'completed', createTime: '2026-05-15 14:00:00', executeTime: '2026-05-20 09:00:00', auditor: '财务审核员B', totalCount: 1, totalAmount: 12345.67 },
  { id: 'B003', batchNo: 'BATCH-202605-003', name: '2026年5月第三批兑付', status: 'draft', createTime: '2026-05-26 08:30:00', totalCount: 0, totalAmount: 0 },
];

export const mockOperationLogs: OperationLog[] = [
  { id: 'L001', redemptionId: '1', operationType: 'create', operator: '兑付专员A', operateTime: '2026-05-20 10:30:00', beforeData: '{}', afterData: JSON.stringify({ cardNumber: 'VIP00123456', cardHolderName: '张三' }), remark: '新建兑付登记' },
  { id: 'L002', redemptionId: '2', operationType: 'create', operator: '兑付专员B', operateTime: '2026-05-21 09:15:00', beforeData: '{}', afterData: JSON.stringify({ cardNumber: 'VIP00123457', cardHolderName: '李四' }), remark: '新建兑付登记' },
  { id: 'L003', redemptionId: '2', operationType: 'dispute', operator: '兑付专员B', operateTime: '2026-05-22 14:20:00', beforeData: JSON.stringify({ status: 'pending' }), afterData: JSON.stringify({ status: 'disputed', hasDispute: true, isFrozen: true }), remark: '标记争议并冻结' },
  { id: 'L004', redemptionId: '4', operationType: 'batch_assign', operator: '兑付专员C', operateTime: '2026-05-23 10:00:00', beforeData: JSON.stringify({ batchId: null }), afterData: JSON.stringify({ batchId: 'B001', status: 'processing' }), remark: '分配至兑付批次B001' },
  { id: 'L005', redemptionId: '5', operationType: 'create', operator: '兑付专员A', operateTime: '2026-05-22 08:30:00', beforeData: '{}', afterData: JSON.stringify({ cardNumber: 'VIP00123459', cardHolderName: '赵六' }), remark: '新建兑付登记' },
];
