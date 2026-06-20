"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const routes_1 = __importDefault(require("./routes"));
const PROJECT_ROOT = path_1.default.resolve(__dirname, "..");
const DATA_DIR = path_1.default.join(PROJECT_ROOT, "data");
const FRONTEND_DIST = path_1.default.resolve(__dirname, "..", "..", "frontend", "dist");
if (!fs_1.default.existsSync(DATA_DIR)) {
    fs_1.default.mkdirSync(DATA_DIR, { recursive: true });
}
(0, database_1.initDatabase)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use("/api", routes_1.default);
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        timestamp: Date.now(),
        mode: fs_1.default.existsSync(FRONTEND_DIST) ? "production" : "development",
        frontend_served: fs_1.default.existsSync(FRONTEND_DIST),
        data_dir: DATA_DIR,
    });
});
if (fs_1.default.existsSync(FRONTEND_DIST)) {
    console.log("[生产模式] 检测到前端构建产物，启用静态资源服务:", FRONTEND_DIST);
    app.use(express_1.default.static(FRONTEND_DIST));
    app.get(/^\/(?!api).*/, (req, res) => {
        res.sendFile(path_1.default.join(FRONTEND_DIST, "index.html"));
    });
}
else {
    console.log("[开发模式] 未检测到前端构建产物，仅提供API服务");
}
app.listen(PORT, () => {
    console.log("🚀 聊天机器人越权拦截系统已启动");
    console.log("   - 后端API:  http://localhost:" + PORT + "/api");
    if (fs_1.default.existsSync(FRONTEND_DIST)) {
        console.log("   - 前端页面: http://localhost:" + PORT + "/");
    }
    else {
        console.log("   - 前端DEV:  http://localhost:3000/");
    }
});
