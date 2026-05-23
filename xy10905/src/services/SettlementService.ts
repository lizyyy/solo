import { AppDataSource } from "../config/database";
import { SettlementReport } from "../entities/SettlementReport";
import { OutOfStockItem } from "../entities/OutOfStockItem";
import { CompensationPlan } from "../entities/CompensationPlan";
import { UserConfirmation } from "../entities/UserConfirmation";
import { GroupBuyBatch } from "../entities/GroupBuyBatch";
import * as createCsvWriter from "csv-writer";
import * as path from "path";
import * as fs from "fs";

export class SettlementService {
  private settlementRepository = AppDataSource.getRepository(SettlementReport);
  private outOfStockRepository = AppDataSource.getRepository(OutOfStockItem);
  private compensationPlanRepository = AppDataSource.getRepository(CompensationPlan);
  private confirmationRepository = AppDataSource.getRepository(UserConfirmation);
  private batchRepository = AppDataSource.getRepository(GroupBuyBatch);

  async generateReport(batchId: string, generatedBy: string): Promise<SettlementReport> {
    const batch = await this.batchRepository.findOne({
      where: { id: batchId },
    });

    if (!batch) {
      throw new Error(`批次 ${batchId} 不存在`);
    }

    const outOfStockItems = await this.outOfStockRepository.find({
      where: { batchId },
    });

    const compensationPlans = await this.compensationPlanRepository
      .createQueryBuilder("plan")
      .leftJoinAndSelect("plan.userConfirmation", "confirmation")
      .where("plan.outOfStockItemId IN (:...ids)", {
        ids: outOfStockItems.map((i) => i.id),
      })
      .getMany();

    const totalRefundAmount = compensationPlans
      .filter((p) => p.compensationType === "refund")
      .reduce((sum, p) => sum + (p.refundAmount || 0), 0);

    const totalPointsAmount = compensationPlans
      .filter((p) => p.compensationType === "points")
      .reduce((sum, p) => sum + (p.pointsAmount || 0), 0);

    const totalExchangeItems = compensationPlans.filter(
      (p) => p.compensationType === "exchange"
    ).length;

    const confirmations = compensationPlans.map((p) => p.userConfirmation).filter(Boolean);
    const confirmedCount = confirmations.filter((c) => c.status === "confirmed").length;
    const pendingCount = confirmations.filter((c) => c.status === "pending").length;
    const rejectedCount = confirmations.filter((c) => c.status === "rejected").length;

    const reportNo = `RPT-${batch.batchNo}-${Date.now()}`;

    const report = new SettlementReport();
    report.batchId = batchId;
    report.batchNo = batch.batchNo;
    report.reportNo = reportNo;
    report.totalOutOfStockItems = outOfStockItems.length;
    report.totalCompensatedItems = compensationPlans.length;
    report.totalRefundAmount = totalRefundAmount;
    report.totalPointsAmount = totalPointsAmount;
    report.totalExchangeItems = totalExchangeItems;
    report.confirmedCount = confirmedCount;
    report.pendingCount = pendingCount;
    report.rejectedCount = rejectedCount;
    report.generatedBy = generatedBy;

    const filePath = await this.exportToCsv(batchId, reportNo, compensationPlans);
    report.filePath = filePath;

    return await this.settlementRepository.save(report);
  }

  private async exportToCsv(
    batchId: string,
    reportNo: string,
    plans: CompensationPlan[]
  ): Promise<string> {
    const exportDir = path.resolve(__dirname, "../../data/exports");
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    const filePath = path.join(exportDir, `${reportNo}.csv`);

    const csvWriter = createCsvWriter.createObjectCsvWriter({
      path: filePath,
      header: [
        { id: "orderNo", title: "订单号" },
        { id: "userId", title: "用户ID" },
        { id: "userName", title: "用户姓名" },
        { id: "outOfStockQuantity", title: "缺货数量" },
        { id: "outOfStockAmount", title: "缺货金额" },
        { id: "compensationType", title: "补偿方式" },
        { id: "refundAmount", title: "退款金额" },
        { id: "exchangeProductName", title: "换货商品" },
        { id: "pointsAmount", title: "积分数量" },
        { id: "confirmationStatus", title: "确认状态" },
      ],
    });

    const records = plans.map((plan) => ({
      orderNo: plan.orderNo,
      userId: plan.userId,
      userName: plan.userName,
      outOfStockQuantity: plan.outOfStockQuantity,
      outOfStockAmount: plan.outOfStockAmount,
      compensationType: this.getCompensationTypeName(plan.compensationType),
      refundAmount: plan.refundAmount || "",
      exchangeProductName: plan.exchangeProductName || "",
      pointsAmount: plan.pointsAmount || "",
      confirmationStatus: plan.userConfirmation?.status || "待创建",
    }));

    await csvWriter.writeRecords(records);
    return filePath;
  }

  private getCompensationTypeName(type: string): string {
    const names: Record<string, string> = {
      refund: "退款",
      exchange: "换货",
      points: "积分补偿",
    };
    return names[type] || type;
  }

  async getReport(id: string): Promise<SettlementReport | null> {
    return await this.settlementRepository.findOne({
      where: { id },
    });
  }

  async getReports(batchId?: string): Promise<SettlementReport[]> {
    const where = batchId ? { batchId } : {};
    return await this.settlementRepository.find({
      where,
      order: { createdAt: "DESC" },
    });
  }
}
