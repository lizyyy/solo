"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLock_1 = require("./middleware/requestLock");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(requestLock_1.requestLockMiddleware);
app.use('/api', routes_1.default);
app.use(errorHandler_1.errorHandler);
app.listen(PORT, () => {
    console.log(`配置分发一致性台后端服务已启动: http://localhost:${PORT}`);
    console.log(`API文档: http://localhost:${PORT}/api/health`);
});
