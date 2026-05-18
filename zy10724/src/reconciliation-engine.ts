import {
  ReturnOrder,
  InventoryItem,
  InspectionResult,
  ReconciliationRecord,
  ReconciliationResult,
  ReconciliationStatus,
} from './types';

export class ReconciliationEngine {
  private returnOrders: ReturnOrder[];
  private inventory: Map<string, InventoryItem>;
  private inspectionResults: Map<string, InspectionResult>;
  private detailedLogs: string[];

  constructor(
    returnOrders: ReturnOrder[],
    inventoryItems: InventoryItem[],
    inspectionResults: InspectionResult[]
  ) {
    this.returnOrders = returnOrders;
    this.inventory = new Map(
      inventoryItems.map((item) => [item.partCode, item])
    );
    this.inspectionResults = new Map(
      inspectionResults.map((result) => [result.returnOrderNo, result])
    );
    this.detailedLogs = [];
  }

  reconcile(): ReconciliationResult {
    this.log('========== 备件返厂记录维修件状态对账开始 ==========');
    this.log(`返厂单总数: ${this.returnOrders.length}`);
    this.log(`库存记录数: ${this.inventory.size}`);
    this.log(`检测结果数: ${this.inspectionResults.size}`);
    this.log('');

    const records: ReconciliationRecord[] = [];

    for (const returnOrder of this.returnOrders) {
      const record = this.processReturnOrder(returnOrder);
      records.push(record);
    }

    const summary = this.generateSummary(records);

    this.log('');
    this.log('========== 备件返厂记录维修件状态对账完成 ==========');
    this.log(`总计: ${summary.totalRecords} 条记录`);
    this.log(`正常: ${summary.normalCount} 条`);
    this.log(`异常: ${summary.abnormalCount} 条`);
    this.log('异常分类:');
    this.log(`  - 拆件维修: ${summary.breakdown.dismantleRepair} 条`);
    this.log(`  - 检测驳回: ${summary.breakdown.inspectionRejected} 条`);
    this.log(`  - 承运商丢件: ${summary.breakdown.carrierLost} 条`);
    this.log(`  - 状态不一致: ${summary.breakdown.statusMismatch} 条`);
    this.log(`  - 库存缺失: ${summary.breakdown.inventoryMissing} 条`);
    this.log(`  - 检测缺失: ${summary.breakdown.inspectionMissing} 条`);

    return {
      records,
      summary,
      detailedLogs: this.detailedLogs,
    };
  }

  private processReturnOrder(returnOrder: ReturnOrder): ReconciliationRecord {
    this.log(`--- 处理返厂单: ${returnOrder.returnOrderNo} ---`);
    this.log(`备件编码: ${returnOrder.partCode}, 备件名称: ${returnOrder.partName}`);
    this.log(`返厂状态: ${returnOrder.returnStatus}, 返厂日期: ${returnOrder.returnDate}`);

    const inventoryItem = this.inventory.get(returnOrder.partCode);
    const inspectionResult = this.inspectionResults.get(returnOrder.returnOrderNo);

    let reconciliationStatus: ReconciliationStatus;
    let remarks: string;
    let isAbnormal: boolean;

    if (!inventoryItem) {
      reconciliationStatus = '库存缺失';
      remarks = `备件 ${returnOrder.partCode} 在库存表中未找到记录`;
      isAbnormal = true;
      this.log(`❌ 异常: ${remarks}`);
    } else if (!inspectionResult) {
      reconciliationStatus = '检测缺失';
      remarks = `返厂单 ${returnOrder.returnOrderNo} 未找到检测结果`;
      isAbnormal = true;
      this.log(`❌ 异常: ${remarks}`);
    } else {
      const result = this.determineStatus(
        returnOrder,
        inventoryItem,
        inspectionResult
      );
      reconciliationStatus = result.status;
      remarks = result.remarks;
      isAbnormal = result.isAbnormal;

      if (isAbnormal) {
        this.log(`❌ 异常: ${remarks}`);
      } else {
        this.log(`✅ 正常: ${remarks}`);
      }
    }

    this.log('');

    return {
      returnOrderNo: returnOrder.returnOrderNo,
      partCode: returnOrder.partCode,
      partName: returnOrder.partName,
      returnDate: returnOrder.returnDate,
      returnStatus: returnOrder.returnStatus,
      inventoryStatus: inventoryItem?.status || '无库存记录',
      inspectionResult: inspectionResult?.inspectionResult || '无检测记录',
      repairStatus: inspectionResult?.repairStatus || '无维修状态',
      reconciliationStatus,
      remarks,
      isAbnormal,
    };
  }

  private determineStatus(
    returnOrder: ReturnOrder,
    inventoryItem: InventoryItem,
    inspectionResult: InspectionResult
  ): { status: ReconciliationStatus; remarks: string; isAbnormal: boolean } {
    if (returnOrder.returnStatus.includes('拆件') || inspectionResult.repairStatus.includes('拆件')) {
      return {
        status: '拆件维修',
        remarks: `备件 ${returnOrder.partCode} 执行拆件维修，返厂状态: ${returnOrder.returnStatus}，维修状态: ${inspectionResult.repairStatus}`,
        isAbnormal: true,
      };
    }

    if (inspectionResult.inspectionResult.includes('驳回') || inspectionResult.inspectionConclusion.includes('不合格')) {
      return {
        status: '检测驳回',
        remarks: `返厂单 ${returnOrder.returnOrderNo} 检测驳回，检测结果: ${inspectionResult.inspectionResult}，检测结论: ${inspectionResult.inspectionConclusion}`,
        isAbnormal: true,
      };
    }

    if (returnOrder.returnStatus.includes('丢件') || returnOrder.returnReason.includes('丢件')) {
      return {
        status: '承运商丢件',
        remarks: `返厂单 ${returnOrder.returnOrderNo} 承运商丢件，承运商: ${returnOrder.carrier}，运单号: ${returnOrder.trackingNo}`,
        isAbnormal: true,
      };
    }

    const returnStatusNormal = returnOrder.returnStatus.includes('完成') || returnOrder.returnStatus.includes('正常');
    const inventoryStatusNormal = inventoryItem.status.includes('正常') || inventoryItem.status.includes('可用');
    const inspectionNormal = inspectionResult.inspectionResult.includes('通过') || inspectionResult.inspectionResult.includes('合格');

    if (returnStatusNormal && inventoryStatusNormal && inspectionNormal) {
      return {
        status: '正常',
        remarks: `状态一致，返厂状态: ${returnOrder.returnStatus}，库存状态: ${inventoryItem.status}，检测结果: ${inspectionResult.inspectionResult}`,
        isAbnormal: false,
      };
    }

    return {
      status: '状态不一致',
      remarks: `状态不一致，返厂状态: ${returnOrder.returnStatus}，库存状态: ${inventoryItem.status}，检测结果: ${inspectionResult.inspectionResult}`,
      isAbnormal: true,
    };
  }

  private generateSummary(records: ReconciliationRecord[]) {
    const breakdown = {
      normal: 0,
      dismantleRepair: 0,
      inspectionRejected: 0,
      carrierLost: 0,
      statusMismatch: 0,
      inventoryMissing: 0,
      inspectionMissing: 0,
    };

    for (const record of records) {
      switch (record.reconciliationStatus) {
        case '正常':
          breakdown.normal++;
          break;
        case '拆件维修':
          breakdown.dismantleRepair++;
          break;
        case '检测驳回':
          breakdown.inspectionRejected++;
          break;
        case '承运商丢件':
          breakdown.carrierLost++;
          break;
        case '状态不一致':
          breakdown.statusMismatch++;
          break;
        case '库存缺失':
          breakdown.inventoryMissing++;
          break;
        case '检测缺失':
          breakdown.inspectionMissing++;
          break;
      }
    }

    return {
      totalRecords: records.length,
      normalCount: breakdown.normal,
      abnormalCount: records.length - breakdown.normal,
      breakdown,
    };
  }

  private log(message: string): void {
    this.detailedLogs.push(message);
  }

  getDetailedLogs(): string[] {
    return this.detailedLogs;
  }
}
