import "reflect-metadata";
import express from "express";
import { AppDataSource } from "./config/database";
import routes from "./routes";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use("/api", routes);

AppDataSource.initialize()
  .then(() => {
    console.log("数据库连接成功");
    app.listen(PORT, () => {
      console.log(`服务器运行在 http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("数据库连接失败:", error);
  });

export default app;
