import { AppDataSource } from "../config/database";
import { OutOfStockItem, OutOfStockStatus } from "../entities/OutOfStockItem";
import { StatusHistory } from "../entities/StatusHistory";
import { StateMachineService } from "./StateMachineService";
import { AllocationService } from "./AllocationService";
import { UserConfirmationService } from "./UserConfirmationService";
import { InventoryService } from "./InventoryService";

export class OutOfStockService {
  private outOfStockRepository = AppDataSource.getRepository(OutOfStockItem);
  private statusHistoryRepository = AppDataSource.getRepository(StatusHistory);
  private stateMachineService = new StateMachineService();
  private allocationService = new AllocationService();
  private userConfirmationService = new UserConfirmationService();
  private inventoryService = new InventoryService();

  async createOutOfStockItem(data: {
    productId: string;
    productName: string;
    orderedQuantity: number;
    availableQuantity: number;
    unitPrice: number;
    batchId: string;
    remark?: string;
  }): Promise<OutOfStockItem> {
    const existing = await this.outOfStockRepository.findOne({
      where: {
        productId: data.productId,
        batchId: data.batchId,
      },
    });

    if (existing) {
      return existing;
    }

    const item = new OutOfStockItem();
    item.productId = data.productId;
    item.productName = data.productName;
    item.orderedQuantity = data.orderedQuantity;
    item.availableQuantity = data.availableQuantity;
    item.outOfStockQuantity = data.orderedQuantity - data.availableQuantity;
    item.unitPrice = data.unitPrice;
    item.outOfStockAmount = item.outOfStockQuantity * data.unitPrice;
    item.batchId = data.batchId;
    item.status = "pending";
    item.remark = data.remark;

    return await this.outOfStockRepository.save(item);
  }

  async startAllocation(outOfStockItemId: string): Promise<OutOfStockItem> {
    let item = await this.stateMachineService.transition(
      outOfStockItemId,
      "allocating",
      "开始缺货分摊"
    );

    await this.allocationService.allocateStock(outOfStockItemId);

    item = await this.stateMachineService.transition(
      outOfStockItemId,
      "user_confirming",
      "缺货分摊完成，等待用户确认"
    );

    const plans = await this.allocationService.getCompensationPlans(outOfStockItemId);
    for (const plan of plans) {
      await this.userConfirmationService.createConfirmation(plan.id);
    }

    return item;
  }

  async getOutOfStockItem(id: string): Promise<OutOfStockItem | null> {
    return await this.outOfStockRepository.findOne({
      where: { id },
      relations: ["compensationPlans", "compensationPlans.userConfirmation", "statusHistories"],
    });
  }

  async getOutOfStockItems(batchId?: string): Promise<OutOfStockItem[]> {
    const where = batchId ? { batchId } : {};
    return await this.outOfStockRepository.find({
      where,
      order: { createdAt: "DESC" },
    });
  }

  async manualUpdate(
    outOfStockItemId: string,
    updates: {
      orderedQuantity?: number;
      availableQuantity?: number;
      unitPrice?: number;
      remark?: string;
    },
    operatorId: string,
    operatorName: string
  ): Promise<OutOfStockItem> {
    const item = await this.outOfStockRepository.findOne({
      where: { id: outOfStockItemId },
    });

    if (!item) {
      throw new Error(`缺货商品 ${outOfStockItemId} 不存在`);
    }

    if (updates.orderedQuantity !== undefined) {
      item.orderedQuantity = updates.orderedQuantity;
    }
    if (updates.availableQuantity !== undefined) {
      item.availableQuantity = updates.availableQuantity;
    }
    if (updates.unitPrice !== undefined) {
      item.unitPrice = updates.unitPrice;
    }
    if (updates.remark !== undefined) {
      item.remark = updates.remark;
    }

    item.outOfStockQuantity = item.orderedQuantity - item.availableQuantity;
    item.outOfStockAmount = item.outOfStockQuantity * item.unitPrice;

    const history = new StatusHistory();
    history.outOfStockItemId = outOfStockItemId;
    history.fromStatus = item.status;
    history.toStatus = item.status;
    history.reason = `人工修改数据: ${operatorName}`;
    history.operatorId = operatorId;
    history.operatorName = operatorName;
    await this.statusHistoryRepository.save(history);

    return await this.outOfStockRepository.save(item);
  }

  async markAsCompleted(
    outOfStockItemId: string,
    operatorId: string,
    operatorName: string
  ): Promise<OutOfStockItem> {
    const item = await this.outOfStockRepository.findOne({
      where: { id: outOfStockItemId },
    });

    if (!item) {
      throw new Error(`缺货商品 ${outOfStockItemId} 不存在`);
    }

    const result = await this.stateMachineService.transition(
      outOfStockItemId,
      "completed",
      `完成处理: ${operatorName}`,
      operatorId,
      operatorName
    );

    await this.inventoryService.writeBackStock(
      item.productId,
      item.productName,
      item.batchId,
      item.availableQuantity,
      outOfStockItemId,
      operatorId,
      operatorName
    );

    return result;
  }

  async cancel(
    outOfStockItemId: string,
    reason: string,
    operatorId: string,
    operatorName: string
  ): Promise<OutOfStockItem> {
    return await this.stateMachineService.transition(
      outOfStockItemId,
      "cancelled",
      reason,
      operatorId,
      operatorName
    );
  }
}
