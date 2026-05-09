"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const routes_1 = __importDefault(require("./api/routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.listen(PORT, () => {
    console.log(`产线换班产量结算 API 服务已启动，监听端口 ${PORT}`);
    console.log('服务地址: http://localhost:3000');
    console.log('健康检查: http://localhost:3000/health');
    console.log('API 前缀: http://localhost:3000/api/');
});
//# sourceMappingURL=index.js.map