import { AppDataSource } from "../config/database";
import { OutOfStockItem } from "../entities/OutOfStockItem";
import { OrderItem } from "../entities/OrderItem";
import { CompensationPlan, CompensationType } from "../entities/CompensationPlan";

export class AllocationService {
  private outOfStockRepository = AppDataSource.getRepository(OutOfStockItem);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);
  private compensationPlanRepository = AppDataSource.getRepository(CompensationPlan);

  async allocateStock(
    outOfStockItemId: string,
    defaultCompensationType: CompensationType = "refund"
  ): Promise<CompensationPlan[]> {
    const outOfStockItem = await this.outOfStockRepository.findOne({
      where: { id: outOfStockItemId },
    });

    if (!outOfStockItem) {
      throw new Error(`缺货商品 ${outOfStockItemId} 不存在`);
    }

    const existingPlans = await this.compensationPlanRepository.find({
      where: { outOfStockItemId },
    });

    if (existingPlans.length > 0) {
      return existingPlans;
    }

    const orderItems = await this.orderItemRepository.find({
      where: {
        batchId: outOfStockItem.batchId,
        productId: outOfStockItem.productId,
      },
    });

    if (orderItems.length === 0) {
      throw new Error("没有找到相关订单");
    }

    const totalOrdered = orderItems.reduce((sum, item) => sum + item.quantity, 0);
    const availableQty = outOfStockItem.availableQuantity;
    const outOfStockQty = outOfStockItem.outOfStockQuantity;

    const compensationPlans: CompensationPlan[] = [];

    for (const orderItem of orderItems) {
      const ratio = orderItem.quantity / totalOrdered;
      const allocatedQty = Math.floor(availableQty * ratio);
      const outOfStockForUser = orderItem.quantity - allocatedQty;

      if (outOfStockForUser > 0) {
        const plan = new CompensationPlan();
        plan.orderItemId = orderItem.id;
        plan.orderNo = orderItem.orderNo;
        plan.userId = orderItem.userId;
        plan.userName = orderItem.userName;
        plan.outOfStockQuantity = outOfStockForUser;
        plan.outOfStockAmount = outOfStockForUser * outOfStockItem.unitPrice;
        plan.compensationType = defaultCompensationType;
        plan.outOfStockItemId = outOfStockItemId;
        plan.isAllocated = true;

        if (defaultCompensationType === "refund") {
          plan.refundAmount = plan.outOfStockAmount;
        } else if (defaultCompensationType === "points") {
          plan.pointsAmount = Math.floor(plan.outOfStockAmount * 10);
        }

        compensationPlans.push(plan);
      }
    }

    await this.compensationPlanRepository.save(compensationPlans);
    return compensationPlans;
  }

  async updateCompensationType(
    planId: string,
    compensationType: CompensationType,
    exchangeDetails?: {
      productId: string;
      productName: string;
      quantity: number;
      price: number;
    },
    pointsAmount?: number
  ): Promise<CompensationPlan> {
    const plan = await this.compensationPlanRepository.findOne({
      where: { id: planId },
    });

    if (!plan) {
      throw new Error(`补偿方案 ${planId} 不存在`);
    }

    plan.compensationType = compensationType;

    if (compensationType === "refund") {
      plan.refundAmount = plan.outOfStockAmount;
      plan.exchangeProductId = null;
      plan.exchangeProductName = null;
      plan.exchangeQuantity = null;
      plan.exchangePrice = null;
      plan.pointsAmount = null;
    } else if (compensationType === "exchange" && exchangeDetails) {
      plan.refundAmount = null;
      plan.exchangeProductId = exchangeDetails.productId;
      plan.exchangeProductName = exchangeDetails.productName;
      plan.exchangeQuantity = exchangeDetails.quantity;
      plan.exchangePrice = exchangeDetails.price;
      plan.pointsAmount = null;
    } else if (compensationType === "points") {
      plan.refundAmount = null;
      plan.exchangeProductId = null;
      plan.exchangeProductName = null;
      plan.exchangeQuantity = null;
      plan.exchangePrice = null;
      plan.pointsAmount = pointsAmount || Math.floor(plan.outOfStockAmount * 10);
    }

    return await this.compensationPlanRepository.save(plan);
  }

  async getCompensationPlans(outOfStockItemId: string): Promise<CompensationPlan[]> {
    return await this.compensationPlanRepository.find({
      where: { outOfStockItemId },
      relations: ["userConfirmation"],
    });
  }
}
