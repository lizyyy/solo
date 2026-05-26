"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const database_1 = require("./database");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
(0, database_1.initDatabase)();
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.listen(PORT, () => {
    console.log(`药店购药追踪系统已启动，端口: ${PORT}`);
    console.log(`健康检查: GET http://localhost:${PORT}/api/health`);
});
