import "reflect-metadata";
import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import { AppDataSource } from "./config/database";
import { errorHandler } from "./middleware/errorHandler";
import outOfStockRoutes from "./routes/outOfStockRoutes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.use("/api/out-of-stock", outOfStockRoutes);

app.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "社区团购缺货补偿 API 运行正常",
    timestamp: new Date().toISOString(),
  });
});

app.use(errorHandler);

AppDataSource.initialize()
  .then(async () => {
    console.log("数据库连接成功");

    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
      console.log("API 文档:");
      console.log("  GET  /health - 健康检查");
      console.log("  POST /api/out-of-stock/items - 创建缺货商品");
      console.log("  GET  /api/out-of-stock/items - 获取缺货商品列表");
      console.log("  GET  /api/out-of-stock/items/:id - 获取缺货商品详情");
      console.log("  POST /api/out-of-stock/items/:id/allocate - 开始缺货分摊");
      console.log("  PUT  /api/out-of-stock/items/:id/manual - 人工修改");
      console.log("  POST /api/out-of-stock/items/:id/complete - 标记完成");
      console.log("  POST /api/out-of-stock/items/:id/cancel - 取消");
      console.log("  POST /api/out-of-stock/settlement - 生成结算报告");
    });
  })
  .catch((error) => {
    console.error("数据库初始化失败:", error);
    process.exit(1);
  });

export default app;
