import { Injectable } from '@nestjs/common';
import { InvoiceService } from '../version-management/invoice.service';
import { PackingListService } from '../version-management/packing-list.service';
import { HsCodeVersionService } from '../version-management/hs-code-version.service';
import { MissingComponentType, TaskPriority } from '../../entities/compliance-task.entity';

export interface MissingItem {
  componentType: MissingComponentType;
  lineNumber?: number;
  hsCode?: string;
  productName?: string;
  issue: string;
  priority: TaskPriority;
}

export interface MissingComponentResult {
  batchId: string;
  isBlocked: boolean;
  hasCriticalMissing: boolean;
  totalMissingCount: number;
  criticalMissingCount: number;
  documentLevelMissing: {
    missingInvoice: boolean;
    missingPackingList: boolean;
    missingHsCodes: boolean;
  };
  itemLevelMissing: MissingItem[];
  blockingIssues: string[];
  warnings: string[];
}

@Injectable()
export class MissingComponentService {
  constructor(
    private readonly invoiceService: InvoiceService,
    private readonly packingListService: PackingListService,
    private readonly hsCodeService: HsCodeVersionService,
  ) {}

  private getPriorityOrder(priority: TaskPriority): number {
    const order: Record<TaskPriority, number> = {
      [TaskPriority.LOW]: 1,
      [TaskPriority.MEDIUM]: 2,
      [TaskPriority.HIGH]: 3,
      [TaskPriority.CRITICAL]: 4,
    };
    return order[priority] || 0;
  }

  private maxPriority(a: TaskPriority, b: TaskPriority): TaskPriority {
    return this.getPriorityOrder(a) >= this.getPriorityOrder(b) ? a : b;
  }

  async detectMissingComponents(batchId: string): Promise<MissingComponentResult> {
    const [invoice, packingList, hsCodes] = await Promise.all([
      this.invoiceService.findLatestByBatch(batchId),
      this.packingListService.findLatestByBatch(batchId),
      this.hsCodeService.findActiveByBatch(batchId),
    ]);

    const result: MissingComponentResult = {
      batchId,
      isBlocked: false,
      hasCriticalMissing: false,
      totalMissingCount: 0,
      criticalMissingCount: 0,
      documentLevelMissing: {
        missingInvoice: !invoice,
        missingPackingList: !packingList,
        missingHsCodes: hsCodes.length === 0,
      },
      itemLevelMissing: [],
      blockingIssues: [],
      warnings: [],
    };

    const blockingIssues: string[] = [];
    const warnings: string[] = [];
    const itemLevelMissing: MissingItem[] = [];

    if (!invoice) {
      blockingIssues.push('缺少发票');
    }
    if (!packingList) {
      blockingIssues.push('缺少箱单');
    }
    if (hsCodes.length === 0) {
      warnings.push('缺少HS编码');
    }

    if (invoice) {
      invoice.items?.forEach((item, index) => {
        const issues: string[] = [];
        let priority = TaskPriority.LOW;

        if (!item.hsCode || item.hsCode.trim() === '') {
          issues.push('缺少HS编码');
          priority = TaskPriority.HIGH;
        }

        if (!item.productName || item.productName.trim() === '') {
          issues.push('缺少商品名称');
          priority = this.maxPriority(priority, TaskPriority.MEDIUM);
        }

        if (!item.quantity || item.quantity <= 0) {
          issues.push('缺少或无效数量');
          priority = TaskPriority.CRITICAL;
        }

        if (!item.unit || item.unit.trim() === '') {
          issues.push('缺少计量单位');
          priority = this.maxPriority(priority, TaskPriority.MEDIUM);
        }

        if (!item.unitPrice || item.unitPrice <= 0) {
          issues.push('缺少或无效单价');
          priority = this.maxPriority(priority, TaskPriority.HIGH);
        }

        if (!item.totalAmount || item.totalAmount <= 0) {
          issues.push('缺少或无效金额');
          priority = this.maxPriority(priority, TaskPriority.HIGH);
        }

        if (issues.length > 0) {
          itemLevelMissing.push({
            componentType: MissingComponentType.INVOICE,
            lineNumber: item.lineNumber || index + 1,
            hsCode: item.hsCode,
            productName: item.productName,
            issue: issues.join('; '),
            priority,
          });
        }
      });
    }

    if (packingList) {
      packingList.items?.forEach((item, index) => {
        const issues: string[] = [];
        let priority = TaskPriority.LOW;

        if (!item.hsCode || item.hsCode.trim() === '') {
          issues.push('缺少HS编码');
          priority = TaskPriority.HIGH;
        }

        if (!item.productName || item.productName.trim() === '') {
          issues.push('缺少商品名称');
          priority = this.maxPriority(priority, TaskPriority.MEDIUM);
        }

        if (!item.quantity || item.quantity <= 0) {
          issues.push('缺少或无效数量');
          priority = TaskPriority.CRITICAL;
        }

        if (!item.grossWeight || item.grossWeight <= 0) {
          issues.push('缺少毛重');
          priority = this.maxPriority(priority, TaskPriority.MEDIUM);
        }

        if (!item.netWeight || item.netWeight <= 0) {
          issues.push('缺少净重');
          priority = this.maxPriority(priority, TaskPriority.MEDIUM);
        }

        if (item.netWeight && item.grossWeight && item.netWeight > item.grossWeight) {
          issues.push('净重不能大于毛重');
          priority = this.maxPriority(priority, TaskPriority.HIGH);
        }

        if (issues.length > 0) {
          itemLevelMissing.push({
            componentType: MissingComponentType.PACKING_LIST,
            lineNumber: item.lineNumber || index + 1,
            hsCode: item.hsCode,
            productName: item.productName,
            issue: issues.join('; '),
            priority,
          });
        }
      });
    }

    result.itemLevelMissing = itemLevelMissing;
    result.totalMissingCount = itemLevelMissing.length;
    result.criticalMissingCount = itemLevelMissing.filter(
      m => m.priority === TaskPriority.CRITICAL || m.priority === TaskPriority.HIGH,
    ).length;
    result.hasCriticalMissing = result.criticalMissingCount > 0;
    result.isBlocked = blockingIssues.length > 0 || result.hasCriticalMissing;
    result.blockingIssues = blockingIssues;
    result.warnings = warnings;

    return result;
  }
}
