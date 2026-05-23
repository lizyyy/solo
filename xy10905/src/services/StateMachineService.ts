import { AppDataSource } from "../config/database";
import { OutOfStockItem, OutOfStockStatus } from "../entities/OutOfStockItem";
import { StatusHistory } from "../entities/StatusHistory";

export class StateMachineService {
  private outOfStockRepository = AppDataSource.getRepository(OutOfStockItem);
  private statusHistoryRepository = AppDataSource.getRepository(StatusHistory);

  private validTransitions: Map<OutOfStockStatus, OutOfStockStatus[]> = new Map([
    ["pending", ["allocating", "cancelled"]],
    ["allocating", ["user_confirming", "cancelled"]],
    ["user_confirming", ["confirmed", "allocating", "cancelled"]],
    ["confirmed", ["completed", "cancelled"]],
    ["completed", []],
    ["cancelled", []],
  ]);

  canTransition(from: OutOfStockStatus, to: OutOfStockStatus): boolean {
    const allowed = this.validTransitions.get(from) || [];
    return allowed.includes(to);
  }

  async transition(
    outOfStockItemId: string,
    toStatus: OutOfStockStatus,
    reason: string,
    operatorId?: string,
    operatorName?: string
  ): Promise<OutOfStockItem> {
    const item = await this.outOfStockRepository.findOne({
      where: { id: outOfStockItemId },
    });

    if (!item) {
      throw new Error(`缺货商品 ${outOfStockItemId} 不存在`);
    }

    if (!this.canTransition(item.status, toStatus)) {
      throw new Error(`无法从 ${item.status} 状态转换到 ${toStatus} 状态`);
    }

    const fromStatus = item.status;
    item.status = toStatus;

    const history = new StatusHistory();
    history.outOfStockItemId = outOfStockItemId;
    history.fromStatus = fromStatus;
    history.toStatus = toStatus;
    history.reason = reason;
    history.operatorId = operatorId;
    history.operatorName = operatorName;

    await this.statusHistoryRepository.save(history);
    return await this.outOfStockRepository.save(item);
  }

  async getStatusHistory(outOfStockItemId: string): Promise<StatusHistory[]> {
    return await this.statusHistoryRepository.find({
      where: { outOfStockItemId },
      order: { changedAt: "DESC" },
    });
  }
}
