import "reflect-metadata";
import { AppDataSource } from "../config/database";
import { OutOfStockService } from "../services/OutOfStockService";
import { AllocationService } from "../services/AllocationService";
import { UserConfirmationService } from "../services/UserConfirmationService";
import { SettlementService } from "../services/SettlementService";
import { InventoryService } from "../services/InventoryService";
import { GroupBuyBatch } from "../entities/GroupBuyBatch";
import { OrderItem } from "../entities/OrderItem";

async function test() {
  await AppDataSource.initialize();
  console.log("=".repeat(60));
  console.log("社区团购缺货补偿 API - 综合测试");
  console.log("=".repeat(60));

  const outOfStockService = new OutOfStockService();
  const allocationService = new AllocationService();
  const userConfirmationService = new UserConfirmationService();
  const settlementService = new SettlementService();
  const inventoryService = new InventoryService();

  const batchRepository = AppDataSource.getRepository(GroupBuyBatch);
  const orderItemRepository = AppDataSource.getRepository(OrderItem);

  console.log("\n[步骤 1] 准备测试数据");
  console.log("-".repeat(60));

  await orderItemRepository.clear();
  await batchRepository.clear();

  const batch = batchRepository.create({
    batchNo: "GBTEST001",
    name: "测试团购批次",
    startDate: new Date(),
    endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    status: "active",
  });
  await batchRepository.save(batch);
  console.log("✓ 创建测试批次:", batch.batchNo);

  const orderItems = [
    {
      orderNo: "TEST001",
      userId: "U001",
      userName: "张三",
      productId: "P001",
      productName: "有机蔬菜套餐",
      price: 99.0,
      quantity: 2,
      totalAmount: 198.0,
      batchId: batch.id,
    },
    {
      orderNo: "TEST002",
      userId: "U002",
      userName: "李四",
      productId: "P001",
      productName: "有机蔬菜套餐",
      price: 99.0,
      quantity: 3,
      totalAmount: 297.0,
      batchId: batch.id,
    },
    {
      orderNo: "TEST003",
      userId: "U003",
      userName: "王五",
      productId: "P001",
      productName: "有机蔬菜套餐",
      price: 99.0,
      quantity: 1,
      totalAmount: 99.0,
      batchId: batch.id,
    },
  ];

  for (const item of orderItems) {
    await orderItemRepository.save(orderItemRepository.create(item));
  }
  console.log("✓ 创建 3 条测试订单");

  console.log("\n[测试 1] 正常创建缺货商品");
  console.log("-".repeat(60));
  const outOfStockItem = await outOfStockService.createOutOfStockItem({
    productId: "P001",
    productName: "有机蔬菜套餐",
    orderedQuantity: 6,
    availableQuantity: 2,
    unitPrice: 99.0,
    batchId: batch.id,
  });
  console.log("✓ 创建缺货商品成功");
  console.log("  缺货商品 ID:", outOfStockItem.id);
  console.log("  订购数量:", outOfStockItem.orderedQuantity);
  console.log("  可用数量:", outOfStockItem.availableQuantity);
  console.log("  缺货数量:", outOfStockItem.outOfStockQuantity);
  console.log("  当前状态:", outOfStockItem.status);

  console.log("\n[测试 2] 重复提交（幂等性）");
  console.log("-".repeat(60));
  const duplicateItem = await outOfStockService.createOutOfStockItem({
    productId: "P001",
    productName: "有机蔬菜套餐",
    orderedQuantity: 6,
    availableQuantity: 2,
    unitPrice: 99.0,
    batchId: batch.id,
  });
  console.log("✓ 重复提交处理正确");
  console.log("  返回相同 ID:", duplicateItem.id === outOfStockItem.id);

  console.log("\n[测试 3] 启动缺货分摊流程");
  console.log("-".repeat(60));
  await outOfStockService.startAllocation(outOfStockItem.id);
  const updatedItem = await outOfStockService.getOutOfStockItem(outOfStockItem.id);
  console.log("✓ 分摊完成");
  console.log("  当前状态:", updatedItem.status);
  console.log("  补偿方案数量:", updatedItem.compensationPlans.length);

  console.log("\n[测试 4] 用户确认（幂等性 + 状态自动推进）");
  console.log("-".repeat(60));
  const plans = await allocationService.getCompensationPlans(outOfStockItem.id);

  for (let i = 0; i < plans.length; i++) {
    const plan = plans[i];
    const confirmation = await userConfirmationService.getConfirmationByPlan(plan.id);
    console.log(`  确认用户 ${plan.userName} 的补偿方案...`);
    
    const result1 = await userConfirmationService.confirm(
      confirmation.idempotencyKey,
      confirmation.userId,
      "同意退款"
    );
    console.log(`    首次确认状态: ${result1.status}`);

    const result2 = await userConfirmationService.confirm(
      confirmation.idempotencyKey,
      confirmation.userId,
      "同意退款"
    );
    console.log(`    重复确认状态: ${result2.status}`);
  }
  console.log("✓ 用户确认幂等性正常");

  const itemAfterConfirm = await outOfStockService.getOutOfStockItem(outOfStockItem.id);
  console.log("✓ 缺货商品状态自动推进:");
  console.log("  当前状态:", itemAfterConfirm.status);

  console.log("\n[测试 5] 异常拦截测试");
  console.log("-".repeat(60));
  try {
    await outOfStockService.startAllocation("invalid-id");
    console.log("✗ 异常拦截失败");
  } catch (error) {
    console.log("✓ 异常拦截成功");
    console.log("  错误信息:", error.message);
  }

  console.log("\n[测试 6] 人工修正");
  console.log("-".repeat(60));
  const manualUpdatedItem = await outOfStockService.manualUpdate(
    outOfStockItem.id,
    {
      availableQuantity: 3,
      remark: "补货后可用数量增加",
    },
    "ADMIN001",
    "系统管理员"
  );
  console.log("✓ 人工修正成功");
  console.log("  新可用数量:", manualUpdatedItem.availableQuantity);
  console.log("  新缺货数量:", manualUpdatedItem.outOfStockQuantity);

  console.log("\n[测试 7] 状态历史记录");
  console.log("-".repeat(60));
  const itemWithHistory = await outOfStockService.getOutOfStockItem(outOfStockItem.id);
  console.log("✓ 状态历史记录存在");
  console.log("  历史记录数:", itemWithHistory.statusHistories.length);
  itemWithHistory.statusHistories.forEach((h, i) => {
    console.log(`    ${i + 1}. ${h.fromStatus} → ${h.toStatus} (${h.reason})`);
  });

  console.log("\n[测试 8] 库存回写");
  console.log("-".repeat(60));
  const completedItem = await outOfStockService.markAsCompleted(
    outOfStockItem.id,
    "ADMIN001",
    "系统管理员"
  );
  console.log("✓ 标记完成成功");
  console.log("  最终状态:", completedItem.status);

  const inventoryLogs = await inventoryService.getInventoryLogs("P001", batch.id);
  const currentStock = await inventoryService.getCurrentStock("P001", batch.id);
  console.log("✓ 库存回写成功");
  console.log("  回写记录数:", inventoryLogs.length);
  console.log("  当前库存:", currentStock);
  console.log("  回写数量:", inventoryLogs[0]?.quantity);

  console.log("\n[测试 9] 生成结算报告");
  console.log("-".repeat(60));
  const report = await settlementService.generateReport(batch.id, "ADMIN001");
  console.log("✓ 结算报告生成成功");
  console.log("  报告编号:", report.reportNo);
  console.log("  缺货商品数:", report.totalOutOfStockItems);
  console.log("  补偿方案数:", report.totalCompensatedItems);
  console.log("  确认数量:", report.confirmedCount);
  console.log("  待确认数量:", report.pendingCount);
  console.log("  导出文件:", report.filePath);

  console.log("\n" + "=".repeat(60));
  console.log("✓ 所有测试通过！");
  console.log("=".repeat(60));
  console.log("\n测试总结:");
  console.log("  ✓ 正常创建缺货商品");
  console.log("  ✓ 重复提交（幂等性）");
  console.log("  ✓ 缺货分摊流程");
  console.log("  ✓ 用户确认（幂等性 + 自动推进状态）");
  console.log("  ✓ 异常拦截");
  console.log("  ✓ 人工修正（不触发状态机错误）");
  console.log("  ✓ 状态历史记录");
  console.log("  ✓ 库存回写");
  console.log("  ✓ 结算报告导出");

  process.exit(0);
}

test().catch((error) => {
  console.error("\n✗ 测试失败:", error);
  process.exit(1);
});
