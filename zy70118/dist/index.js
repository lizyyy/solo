"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const infrastructure_1 = require("./infrastructure");
const domain_1 = require("./domain");
const services_1 = require("./services");
const routes_1 = require("./api/routes");
const middleware_1 = require("./api/middleware");
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
function createApp() {
    const app = (0, express_1.default)();
    const repository = new infrastructure_1.InMemoryBatchRepository();
    const ruleEngine = new domain_1.RuleEngine();
    const service = new services_1.InspectionService(repository, ruleEngine);
    app.use(middleware_1.jsonBodyParser);
    app.get('/health', (req, res) => {
        res.json({
            status: 'ok',
            service: 'food-batch-inspection-service',
            version: '1.0.0',
            timestamp: new Date().toISOString()
        });
    });
    app.use('/api/v1', (0, routes_1.createRouter)(service));
    app.use(middleware_1.notFoundHandler);
    app.use(middleware_1.errorHandler);
    return app;
}
if (require.main === module) {
    const app = createApp();
    app.listen(PORT, () => {
        console.log(`食品批次验收服务已启动，端口: ${PORT}`);
        console.log(`健康检查: http://localhost:${PORT}/health`);
        console.log(`API基础路径: http://localhost:${PORT}/api/v1`);
    });
}
//# sourceMappingURL=index.js.map