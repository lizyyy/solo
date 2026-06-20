import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { initDatabase } from "./database";
import routes from "./routes";

const PROJECT_ROOT = path.resolve(__dirname, "..");
const DATA_DIR = path.join(PROJECT_ROOT, "data");
const FRONTEND_DIST = path.resolve(__dirname, "..", "..", "frontend", "dist");

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

initDatabase();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());
app.use("/api", routes);

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    timestamp: Date.now(),
    mode: fs.existsSync(FRONTEND_DIST) ? "production" : "development",
    frontend_served: fs.existsSync(FRONTEND_DIST),
    data_dir: DATA_DIR,
  });
});

if (fs.existsSync(FRONTEND_DIST)) {
  console.log("[生产模式] 检测到前端构建产物，启用静态资源服务:", FRONTEND_DIST);
  app.use(express.static(FRONTEND_DIST));
  app.get(/^\/(?!api).*/, (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, "index.html"));
  });
} else {
  console.log("[开发模式] 未检测到前端构建产物，仅提供API服务");
}

app.listen(PORT, () => {
  console.log("🚀 聊天机器人越权拦截系统已启动");
  console.log("   - 后端API:  http://localhost:" + PORT + "/api");
  if (fs.existsSync(FRONTEND_DIST)) {
    console.log("   - 前端页面: http://localhost:" + PORT + "/");
  } else {
    console.log("   - 前端DEV:  http://localhost:3000/");
  }
});
