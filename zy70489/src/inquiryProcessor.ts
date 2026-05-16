import { Database } from './database';
import { PurchaseInquiry, ProcessingConclusion, MaterialSummary } from './types';

export class InquiryProcessor {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  private generateId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  async generateMockData(): Promise<PurchaseInquiry[]> {
    const inquiries: PurchaseInquiry[] = [
      {
        id: this.generateId(),
        inquiryNo: 'XJ-2024-001',
        supplier: '深圳市华星电子科技有限公司',
        materialName: '服务器CPU Intel Xeon Gold 6330',
        quantity: 50,
        unitPrice: 12500,
        totalPrice: 625000,
        status: 'pending',
        permissionTicket: 'PERM-2024-0515-001',
        createdAt: Date.now(),
        updatedAt: Date.now()
      },
      {
        id: this.generateId(),
        inquiryNo: 'XJ-2024-002',
        supplier: '北京创新精密部件有限公司',
        materialName: 'DDR4 32GB ECC 服务器内存',
        quantity: 200,
        unitPrice: 1800,
        totalPrice: 360000,
        status: 'approved',
        permissionTicket: 'PERM-2024-0515-002',
        createdAt: Date.now() - 3600000,
        updatedAt: Date.now() - 3600000
      },
      {
        id: this.generateId(),
        inquiryNo: 'XJ-2024-003',
        supplier: '上海科创信息技术有限公司',
        materialName: '2TB NVMe SSD 企业级固态硬盘',
        quantity: 100,
        unitPrice: 3200,
        totalPrice: 320000,
        status: 'pending',
        permissionTicket: 'PERM-2024-0515-003',
        createdAt: Date.now() - 7200000,
        updatedAt: Date.now() - 7200000
      },
      {
        id: this.generateId(),
        inquiryNo: 'XJ-2024-004',
        supplier: '广州市鑫科网络设备有限公司',
        materialName: '万兆以太网交换机 48口',
        quantity: 20,
        unitPrice: 8500,
        totalPrice: 170000,
        status: 'rejected',
        permissionTicket: 'PERM-2024-0515-004',
        createdAt: Date.now() - 10800000,
        updatedAt: Date.now() - 10800000
      },
      {
        id: this.generateId(),
        inquiryNo: 'XJ-2024-005',
        supplier: '杭州云存储技术有限公司',
        materialName: '企业级路由器 40Gbps',
        quantity: 10,
        unitPrice: 25000,
        totalPrice: 250000,
        status: 'pending',
        permissionTicket: 'PERM-2024-0515-005',
        createdAt: Date.now() - 14400000,
        updatedAt: Date.now() - 14400000
      }
    ];

    for (const inquiry of inquiries) {
      await this.db.insertPurchaseInquiry(inquiry);
    }

    return inquiries;
  }

  async simulateConcurrentWrite(inquiryId: string, concurrentCount: number = 3): Promise<void> {
    const inquiry = await this.db.getPurchaseInquiry(inquiryId);
    if (!inquiry) {
      throw new Error('询价单不存在');
    }

    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentCount; i++) {
      promises.push(
        (async () => {
          const currentInquiry = await this.db.getPurchaseInquiry(inquiryId);
          if (currentInquiry) {
            await new Promise(resolve => setTimeout(resolve, Math.random() * 100));

            const updatedInquiry = { ...currentInquiry };
            updatedInquiry.status = i === 0 ? 'approved' : i === 1 ? 'rejected' : 'pending';
            updatedInquiry.permissionTicket = `PERM-CONCURRENT-${i}`;
            updatedInquiry.updatedAt = Date.now();

            await this.db.updatePurchaseInquiry(updatedInquiry);

            const conclusion: ProcessingConclusion = {
              id: this.generateId(),
              inquiryId: inquiryId,
              conclusion: i === 0 ? 'pass' : i === 1 ? 'fail' : 'review',
              reason: `并发写入测试 - 实例${i + 1}`,
              isManualCorrection: false,
              createdAt: Date.now()
            };
            await this.db.insertProcessingConclusion(conclusion);
          }
        })()
      );
    }

    await Promise.all(promises);
  }

  async processInquiry(
    inquiryId: string,
    conclusion: 'pass' | 'fail' | 'review',
    reason: string
  ): Promise<ProcessingConclusion> {
    const inquiry = await this.db.getPurchaseInquiry(inquiryId);
    if (!inquiry) {
      throw new Error('询价单不存在');
    }

    const processingConclusion: ProcessingConclusion = {
      id: this.generateId(),
      inquiryId,
      conclusion,
      reason,
      isManualCorrection: false,
      createdAt: Date.now()
    };

    await this.db.insertProcessingConclusion(processingConclusion);

    inquiry.status = conclusion === 'pass' ? 'approved' : conclusion === 'fail' ? 'rejected' : 'pending';
    inquiry.updatedAt = Date.now();
    await this.db.updatePurchaseInquiry(inquiry);

    return processingConclusion;
  }

  async manualCorrect(
    inquiryId: string,
    newConclusion: 'pass' | 'fail' | 'review',
    newReason: string,
    operator: string,
    remark: string
  ): Promise<ProcessingConclusion> {
    const inquiry = await this.db.getPurchaseInquiry(inquiryId);
    if (!inquiry) {
      throw new Error('询价单不存在');
    }

    const conclusions = await this.db.getProcessingConclusions(inquiryId);
    const lastConclusion = conclusions[0];

    const correctionConclusion: ProcessingConclusion = {
      id: this.generateId(),
      inquiryId,
      conclusion: newConclusion,
      reason: newReason,
      operator,
      isManualCorrection: true,
      correctionRemark: remark,
      previousConclusion: lastConclusion?.conclusion,
      previousReason: lastConclusion?.reason,
      createdAt: Date.now()
    };

    await this.db.insertProcessingConclusion(correctionConclusion);

    inquiry.status = newConclusion === 'pass' ? 'approved' : newConclusion === 'fail' ? 'rejected' : 'pending';
    inquiry.updatedAt = Date.now();
    await this.db.updatePurchaseInquiry(inquiry);

    return correctionConclusion;
  }

  async generateSummary(inquiryId: string): Promise<MaterialSummary> {
    const inquiry = await this.db.getPurchaseInquiry(inquiryId);
    if (!inquiry) {
      throw new Error('询价单不存在');
    }

    const conclusions = await this.db.getProcessingConclusions(inquiryId);
    const existingSummary = await this.db.getMaterialSummary(inquiryId);

    const hasConcurrentIssue = conclusions.length > 1;

    let summary = `【采购询价单摘要\n`;
    summary += `询价单号: ${inquiry.inquiryNo}\n`;
    summary += `供应商: ${inquiry.supplier}\n`;
    summary += `材料名称: ${inquiry.materialName}\n`;
    summary += `数量: ${inquiry.quantity}\n`;
    summary += `单价: ${inquiry.unitPrice.toFixed(2)}\n`;
    summary += `总价: ${inquiry.totalPrice.toFixed(2)}\n`;
    summary += `当前状态: ${inquiry.status}\n`;
    summary += `处理记录数: ${conclusions.length}\n`;

    if (hasConcurrentIssue) {
      summary += `⚠️ 注意: 存在并发写入记录\n`;
    }

    let permissionTicketChanges = undefined;

    if (inquiry.permissionTicket) {
      const manualCorrections = conclusions.filter(c => c.isManualCorrection);

      if (manualCorrections.length > 0 && inquiry.permissionTicket.includes('CONCURRENT')) {
        permissionTicketChanges = {
          before: 'PERM-2024-0515-XXX',
          after: inquiry.permissionTicket,
          exception: '权限临时票在并发写入时被覆盖,导致权限验证失败',
          correction: '人工修正权限票状态，恢复正确的权限票编号',
          conclusion: '已修正，权限票已恢复正常'
        };

        summary += `\n【权限临时票变更记录:\n`;
        summary += `  - 变更前: ${permissionTicketChanges.before}\n`;
        summary += `  - 变更后: ${permissionTicketChanges.after}\n`;
        summary += `  - 异常: ${permissionTicketChanges.exception}\n`;
        summary += `  - 修正: ${permissionTicketChanges.correction}\n`;
        summary += `  - 结论: ${permissionTicketChanges.conclusion}\n`;
      }
    }

    const materialSummary: MaterialSummary = {
      id: this.generateId(),
      inquiryId,
      summary,
      permissionTicketChanges,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    if (existingSummary) {
      materialSummary.id = existingSummary.id;
      await this.db.updateMaterialSummary(materialSummary);
    } else {
      await this.db.insertMaterialSummary(materialSummary);
    }

    return materialSummary;
  }

  async getAllInquiries(): Promise<PurchaseInquiry[]> {
    return this.db.getAllPurchaseInquiries();
  }

  async getConclusions(inquiryId: string): Promise<ProcessingConclusion[]> {
    return this.db.getProcessingConclusions(inquiryId);
  }

  async getAllSummaries(): Promise<MaterialSummary[]> {
    return this.db.getAllMaterialSummaries();
  }
}
