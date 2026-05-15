"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const helmet_1 = __importDefault(require("helmet"));
const routes_1 = __importDefault(require("./routes"));
const PORT = process.env.PORT || 3000;
const app = (0, express_1.default)();
app.use((0, helmet_1.default)());
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
app.use('/api', routes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ success: false, error: '服务器内部错误' });
});
app.listen(PORT, () => {
    console.log(`\n============================================================`);
    console.log(`  依赖器合约服务已启动`);
    console.log(`  服务地址: http://localhost:${PORT}`);
    console.log(`  API 前缀: http://localhost:${PORT}/api`);
    console.log(`  健康检查: http://localhost:${PORT}/api/health`);
    console.log(`============================================================\n`);
});
exports.default = app;
//# sourceMappingURL=index.js.map