import { AppDataSource } from "../config/database";
import { UserConfirmation, ConfirmationStatus } from "../entities/UserConfirmation";
import { CompensationPlan } from "../entities/CompensationPlan";
import { OutOfStockItem } from "../entities/OutOfStockItem";
import { StateMachineService } from "./StateMachineService";

export class UserConfirmationService {
  private confirmationRepository = AppDataSource.getRepository(UserConfirmation);
  private compensationPlanRepository = AppDataSource.getRepository(CompensationPlan);
  private outOfStockRepository = AppDataSource.getRepository(OutOfStockItem);
  private stateMachineService = new StateMachineService();

  async createConfirmation(compensationPlanId: string): Promise<UserConfirmation> {
    const plan = await this.compensationPlanRepository.findOne({
      where: { id: compensationPlanId },
    });

    if (!plan) {
      throw new Error(`补偿方案 ${compensationPlanId} 不存在`);
    }

    const existingConfirmation = await this.confirmationRepository.findOne({
      where: { compensationPlanId },
    });

    if (existingConfirmation) {
      return existingConfirmation;
    }

    const idempotencyKey = `${plan.userId}-${compensationPlanId}-${Date.now()}`;

    const confirmation = new UserConfirmation();
    confirmation.idempotencyKey = idempotencyKey;
    confirmation.userId = plan.userId;
    confirmation.userName = plan.userName;
    confirmation.compensationPlanId = compensationPlanId;
    confirmation.status = "pending";

    return await this.confirmationRepository.save(confirmation);
  }

  async confirm(
    idempotencyKey: string,
    userId: string,
    userRemark?: string
  ): Promise<UserConfirmation> {
    const existingConfirmation = await this.confirmationRepository.findOne({
      where: { idempotencyKey },
    });

    if (existingConfirmation && existingConfirmation.status !== "pending") {
      return existingConfirmation;
    }

    if (!existingConfirmation) {
      throw new Error("确认记录不存在");
    }

    if (existingConfirmation.userId !== userId) {
      throw new Error("无权确认此补偿方案");
    }

    existingConfirmation.status = "confirmed";
    existingConfirmation.confirmedAt = new Date();
    existingConfirmation.userRemark = userRemark;

    const result = await this.confirmationRepository.save(existingConfirmation);
    await this.checkAndUpdateOutOfStockStatus(existingConfirmation.compensationPlanId);
    return result;
  }

  async reject(
    idempotencyKey: string,
    userId: string,
    userRemark?: string
  ): Promise<UserConfirmation> {
    const existingConfirmation = await this.confirmationRepository.findOne({
      where: { idempotencyKey },
    });

    if (existingConfirmation && existingConfirmation.status !== "pending") {
      return existingConfirmation;
    }

    if (!existingConfirmation) {
      throw new Error("确认记录不存在");
    }

    if (existingConfirmation.userId !== userId) {
      throw new Error("无权拒绝此补偿方案");
    }

    existingConfirmation.status = "rejected";
    existingConfirmation.confirmedAt = new Date();
    existingConfirmation.userRemark = userRemark;

    const result = await this.confirmationRepository.save(existingConfirmation);
    await this.checkAndUpdateOutOfStockStatus(existingConfirmation.compensationPlanId);
    return result;
  }

  private async checkAndUpdateOutOfStockStatus(compensationPlanId: string): Promise<void> {
    const plan = await this.compensationPlanRepository.findOne({
      where: { id: compensationPlanId },
    });

    if (!plan) return;

    const outOfStockItem = await this.outOfStockRepository.findOne({
      where: { id: plan.outOfStockItemId },
    });

    if (!outOfStockItem || outOfStockItem.status !== "user_confirming") return;

    const allPlans = await this.compensationPlanRepository.find({
      where: { outOfStockItemId: plan.outOfStockItemId },
      relations: ["userConfirmation"],
    });

    const allConfirmed = allPlans.every(
      (p) => p.userConfirmation && p.userConfirmation.status !== "pending"
    );

    if (allConfirmed) {
      await this.stateMachineService.transition(
        plan.outOfStockItemId,
        "confirmed",
        "所有用户已确认补偿方案"
      );
    }
  }

  async getConfirmationByPlan(compensationPlanId: string): Promise<UserConfirmation | null> {
    return await this.confirmationRepository.findOne({
      where: { compensationPlanId },
    });
  }

  async getConfirmationsByUser(userId: string): Promise<UserConfirmation[]> {
    return await this.confirmationRepository.find({
      where: { userId },
      relations: ["compensationPlan"],
    });
  }

  async manualOverride(
    confirmationId: string,
    newStatus: ConfirmationStatus,
    operatorId: string,
    operatorName: string,
    remark?: string
  ): Promise<UserConfirmation> {
    const confirmation = await this.confirmationRepository.findOne({
      where: { id: confirmationId },
    });

    if (!confirmation) {
      throw new Error(`确认记录 ${confirmationId} 不存在`);
    }

    confirmation.status = newStatus;
    confirmation.operatorRemark = `人工操作: ${operatorName} (${operatorId}) - ${remark || "无备注"}`;
    confirmation.confirmedAt = new Date();

    return await this.confirmationRepository.save(confirmation);
  }
}
