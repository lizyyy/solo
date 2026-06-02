"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const database_1 = require("./database");
const seed_1 = require("./seed");
const routes_1 = __importDefault(require("./routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.urlencoded({ extended: true }));
(0, database_1.initDatabase)();
(0, seed_1.seedDatabase)();
app.use('/api', routes_1.default);
app.use('/uploads', express_1.default.static(path_1.default.join(__dirname, '../uploads')));
if (process.env.NODE_ENV === 'production') {
    const clientDist = path_1.default.join(__dirname, '../../client/dist');
    app.use(express_1.default.static(clientDist));
    app.get('*', (req, res) => {
        res.sendFile(path_1.default.join(clientDist, 'index.html'));
    });
}
app.listen(PORT, () => {
    console.log(`🚀 树木修剪排程API服务已启动: http://localhost:${PORT}`);
    console.log(`📊 API文档: http://localhost:${PORT}/api/health`);
});
