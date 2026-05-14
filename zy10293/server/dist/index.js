"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const database_1 = require("./database");
const routes_1 = __importDefault(require("./routes"));
(0, database_1.initDatabase)();
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api', routes_1.default);
app.listen(PORT, () => {
    console.log(`茶叶拼配试饮台服务已启动: http://localhost:${PORT}`);
});
