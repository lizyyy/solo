import "reflect-metadata";
import { AppDataSource } from "../config/database";
import { GroupBuyBatch } from "../entities/GroupBuyBatch";
import { OrderItem } from "../entities/OrderItem";

async function seed() {
  await AppDataSource.initialize();
  console.log("数据库连接成功");

  const batchRepository = AppDataSource.getRepository(GroupBuyBatch);
  const orderItemRepository = AppDataSource.getRepository(OrderItem);

  console.log("清理现有数据...");
  await orderItemRepository.clear();
  await batchRepository.clear();

  console.log("创建团购批次...");
  const batch = batchRepository.create({
    batchNo: "GB20240101001",
    name: "2024年1月第1团",
    startDate: new Date("2024-01-01"),
    endDate: new Date("2024-01-07"),
    status: "active",
    description: "生鲜食品团购",
  });
  await batchRepository.save(batch);
  console.log("批次 ID:", batch.id);

  console.log("创建订单明细...");
  const orderItems = [
    {
      orderNo: "ORD001",
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
      orderNo: "ORD002",
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
      orderNo: "ORD003",
      userId: "U003",
      userName: "王五",
      productId: "P001",
      productName: "有机蔬菜套餐",
      price: 99.0,
      quantity: 1,
      totalAmount: 99.0,
      batchId: batch.id,
    },
    {
      orderNo: "ORD004",
      userId: "U001",
      userName: "张三",
      productId: "P002",
      productName: "进口水果礼盒",
      price: 199.0,
      quantity: 1,
      totalAmount: 199.0,
      batchId: batch.id,
    },
    {
      orderNo: "ORD005",
      userId: "U002",
      userName: "李四",
      productId: "P002",
      productName: "进口水果礼盒",
      price: 199.0,
      quantity: 2,
      totalAmount: 398.0,
      batchId: batch.id,
    },
  ];

  for (const item of orderItems) {
    const orderItem = orderItemRepository.create(item);
    await orderItemRepository.save(orderItem);
    console.log("创建订单:", orderItem.orderNo, orderItem.productName);
  }

  console.log("");
  console.log("数据初始化完成!");
  console.log("批次 ID:", batch.id);
  console.log("");
  console.log("测试数据说明:");
  console.log("  商品 P001 (有机蔬菜套餐): 总订购 6 份");
  console.log("  商品 P002 (进口水果礼盒): 总订购 3 份");
  console.log("");
  console.log("您可以使用以下数据创建缺货商品:");
  console.log("  P001: orderedQuantity=6, availableQuantity=2, unitPrice=99");
  console.log("  P002: orderedQuantity=3, availableQuantity=1, unitPrice=199");

  process.exit(0);
}

seed().catch((error) => {
  console.error("数据初始化失败:", error);
  process.exit(1);
});
