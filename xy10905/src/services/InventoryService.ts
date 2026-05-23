import { AppDataSource } from "../config/database";
import { InventoryLog, InventoryOperationType } from "../entities/InventoryLog";

export class InventoryService {
  private inventoryLogRepository = AppDataSource.getRepository(InventoryLog);

  async writeBackStock(
    productId: string,
    productName: string,
    batchId: string,
    quantity: number,
    referenceId: string,
    operatorId: string,
    operatorName: string
  ): Promise<InventoryLog> {
    const lastLog = await this.inventoryLogRepository.findOne({
      where: { productId, batchId },
      order: { createdAt: "DESC" },
    });

    const previousQuantity = lastLog ? lastLog.newQuantity : 0;
    const newQuantity = previousQuantity + quantity;

    const log = new InventoryLog();
    log.productId = productId;
    log.productName = productName;
    log.batchId = batchId;
    log.operationType = "write_back";
    log.quantity = quantity;
    log.previousQuantity = previousQuantity;
    log.newQuantity = newQuantity;
    log.referenceId = referenceId;
    log.remark = "缺货补偿完成后库存回写";
    log.operatorId = operatorId;
    log.operatorName = operatorName;

    return await this.inventoryLogRepository.save(log);
  }

  async getInventoryLogs(productId?: string, batchId?: string): Promise<InventoryLog[]> {
    const where: any = {};
    if (productId) where.productId = productId;
    if (batchId) where.batchId = batchId;

    return await this.inventoryLogRepository.find({
      where,
      order: { createdAt: "DESC" },
    });
  }

  async getCurrentStock(productId: string, batchId: string): Promise<number> {
    const lastLog = await this.inventoryLogRepository.findOne({
      where: { productId, batchId },
      order: { createdAt: "DESC" },
    });

    return lastLog ? lastLog.newQuantity : 0;
  }
}
