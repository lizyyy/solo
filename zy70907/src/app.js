const express = require("express");
const path = require("path");
const fs = require("fs");
const initDatabase = require("./database/init");

const dataDir = path.join(__dirname, "../data");
if (!fs.existsSync(dataDir)) { fs.mkdirSync(dataDir, { recursive: true }); }

const batchRoutes = require("./routes/batches");
const pointRoutes = require("./routes/points");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => { console.log(req.method + " " + req.path); next(); });

app.use("/api/batches", batchRoutes);
app.use("/api/points", pointRoutes);

app.get("/health", (req, res) => { res.json({ status: "ok", timestamp: new Date().toISOString() }); });

app.use((err, req, res, next) => { console.error(err.stack); res.status(500).json({ success: false, error: "服务器内部错误" }); });

app.use((req, res) => { res.status(404).json({ success: false, error: "接口不存在" }); });

initDatabase().then(() => {
  app.listen(PORT, () => {
    console.log("母婴门店会员积分补录API服务启动成功!");
    console.log("端口: " + PORT);
    console.log("健康检查: http://localhost:" + PORT + "/health");
  });
}).catch(err => { console.error("数据库初始化失败:", err); process.exit(1); });
