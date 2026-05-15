import { Batch, ChangeRecord, RiskType, ProcessingStatus, ApprovalNode, SmsRecord } from '../types';
import { ChangeIndexDB } from '../db';
import crypto from 'crypto';

function generateId(): string {
  return crypto.randomUUID();
}

function generateInvoiceNumber(): string {
  const prefix = 'FP';
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.floor(Math.random() * 1000000).toString().padStart(6, '0');
  return `${prefix}${date}${random}`;
}

function generateSmsRecords(count: number): SmsRecord[] {
  const phones = ['13800138001', '13900139002', '13700137003', '13600136004', '13500135005'];
  const records: SmsRecord[] = [];
  
  for (let i = 0; i < count; i++) {
    records.push({
      id: generateId(),
      phone: phones[i % phones.length],
      content: `【税务系统】您的发票红冲申请已提交，发票号：${generateInvoiceNumber()}`,
      sendTime: new Date(Date.now() - Math.random() * 86400000).toISOString(),
      status: i % 3 === 0 ? 'failed' : i % 3 === 1 ? 'pending' : 'sent'
    });
  }
  
  return records;
}

export async function loadSampleData(db: ChangeIndexDB): Promise<void> {
  const batchId1 = generateId();
  const batchId2 = generateId();

  const batches: Batch[] = [
    {
      id: batchId1,
      name: '202401-高峰发票红冲批次-001',
      totalRecords: 5,
      successCount: 3,
      failedCount: 2,
      operator: '张三',
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      completedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: batchId2,
      name: '202401-高峰发票红冲批次-002',
      totalRecords: 4,
      successCount: 2,
      failedCount: 2,
      operator: '李四',
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      completedAt: new Date(Date.now() - 86400000).toISOString()
    }
  ];

  const records: ChangeRecord[] = [
    {
      id: generateId(),
      batchId: batchId1,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 10500.00,
      redFlushAmount: 10500.00,
      archivePath: '/data/archives/202401/normal_file_001.zip',
      operator: '张三',
      riskType: RiskType.PATH_ERROR,
      status: ProcessingStatus.FAILED,
      currentApprovalNode: ApprovalNode.DATA_EXTRACTION,
      failureReason: '压缩包路径异常：文件路径包含非法字符，系统无法定位归档文件 /data/archives/202401/normal_file_001.zip',
      materialSummary: '增值税专用发票红冲申请材料，包含原始发票扫描件、红冲说明、审批表',
      smsRecords: generateSmsRecords(2),
      createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 3).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId1,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 28600.50,
      redFlushAmount: 28600.50,
      archivePath: '/data/archives/202401/../invalid_path.zip',
      operator: '张三',
      riskType: RiskType.PATH_ERROR,
      status: ProcessingStatus.FAILED,
      currentApprovalNode: ApprovalNode.PRE_CHECK,
      failureReason: '压缩包路径异常：检测到路径遍历攻击风险 /data/archives/202401/../invalid_path.zip，已自动拦截',
      materialSummary: '大额发票红冲材料，附购销合同复印件、红字信息表',
      smsRecords: generateSmsRecords(3),
      createdAt: new Date(Date.now() - 86400000 * 2.9).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2.9).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId1,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 5200.00,
      redFlushAmount: 5200.00,
      archivePath: '/data/archives/202401/success_001.zip',
      operator: '张三',
      riskType: RiskType.MANUAL_REVIEW,
      status: ProcessingStatus.SUCCESS,
      currentApprovalNode: ApprovalNode.COMPLETED,
      materialSummary: '普通发票红冲，材料完整合规',
      smsRecords: generateSmsRecords(1),
      createdAt: new Date(Date.now() - 86400000 * 2.8).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2.8).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId1,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 18000.00,
      redFlushAmount: 18000.00,
      archivePath: '/data/archives/202401/success_002.zip',
      operator: '张三',
      riskType: RiskType.MANUAL_REVIEW,
      status: ProcessingStatus.SUCCESS,
      currentApprovalNode: ApprovalNode.COMPLETED,
      materialSummary: '电子发票红冲申请，核验通过',
      smsRecords: generateSmsRecords(2),
      createdAt: new Date(Date.now() - 86400000 * 2.7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2.7).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId1,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 9500.00,
      redFlushAmount: 9500.00,
      archivePath: '/data/archives/202401/success_003.zip',
      operator: '张三',
      riskType: RiskType.MANUAL_REVIEW,
      status: ProcessingStatus.SUCCESS,
      currentApprovalNode: ApprovalNode.COMPLETED,
      materialSummary: '纸质发票红冲，已回收原票',
      smsRecords: generateSmsRecords(1),
      createdAt: new Date(Date.now() - 86400000 * 2.6).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2.6).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId2,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 35000.00,
      redFlushAmount: 35000.00,
      archivePath: '/data/temp/未命名文件夹 1.zip',
      operator: '李四',
      riskType: RiskType.PATH_ERROR,
      status: ProcessingStatus.FAILED,
      currentApprovalNode: ApprovalNode.UPLOAD,
      failureReason: '压缩包路径异常：路径包含中文空格和特殊字符，系统无法正确解析 "/data/temp/未命名文件夹 1.zip"',
      materialSummary: '跨年发票红冲申请，需主管税务机关审批',
      smsRecords: generateSmsRecords(3),
      createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 2).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId2,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 22000.00,
      redFlushAmount: 22000.00,
      archivePath: '/data/archives/202401/missing_file.zip',
      operator: '李四',
      riskType: RiskType.PATH_ERROR,
      status: ProcessingStatus.FAILED,
      currentApprovalNode: ApprovalNode.RISK_ASSESSMENT,
      failureReason: '压缩包路径异常：文件不存在或已被移动 /data/archives/202401/missing_file.zip',
      materialSummary: '红字专用发票开具材料',
      smsRecords: generateSmsRecords(2),
      createdAt: new Date(Date.now() - 86400000 * 1.9).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1.9).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId2,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 7800.00,
      redFlushAmount: 7800.00,
      archivePath: '/data/archives/202401/batch2_success_001.zip',
      operator: '李四',
      riskType: RiskType.MANUAL_REVIEW,
      status: ProcessingStatus.SUCCESS,
      currentApprovalNode: ApprovalNode.COMPLETED,
      materialSummary: '红冲金额较小，自动审核通过',
      smsRecords: generateSmsRecords(1),
      createdAt: new Date(Date.now() - 86400000 * 1.8).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1.8).toISOString()
    },
    {
      id: generateId(),
      batchId: batchId2,
      invoiceNumber: generateInvoiceNumber(),
      originalAmount: 41000.00,
      redFlushAmount: 41000.00,
      archivePath: '/data/archives/202401/batch2_success_002.zip',
      operator: '李四',
      riskType: RiskType.DATA_INCONSISTENCY,
      status: ProcessingStatus.SUCCESS,
      currentApprovalNode: ApprovalNode.COMPLETED,
      materialSummary: '数据不一致已人工核实修正',
      smsRecords: generateSmsRecords(2),
      createdAt: new Date(Date.now() - 86400000 * 1.7).toISOString(),
      updatedAt: new Date(Date.now() - 86400000 * 1.7).toISOString()
    }
  ];

  for (const batch of batches) {
    await db.insertBatch(batch);
  }
  for (const record of records) {
    await db.insertRecord(record);
  }

  console.log(`已导入 ${batches.length} 个批次，${records.length} 条记录`);
  console.log('失败路径已自然嵌入样例数据中，包括：');
  console.log('  - 非法字符路径');
  console.log('  - 路径遍历攻击风险');
  console.log('  - 中文空格路径');
  console.log('  - 文件不存在路径');
}
