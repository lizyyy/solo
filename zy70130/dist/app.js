"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const users_1 = __importDefault(require("./routes/users"));
const collections_1 = __importDefault(require("./routes/collections"));
const transfers_1 = __importDefault(require("./routes/transfers"));
const admin_1 = __importDefault(require("./routes/admin"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: Date.now() });
});
app.use('/users', users_1.default);
app.use('/collections', collections_1.default);
app.use('/transfers', transfers_1.default);
app.use('/admin', admin_1.default);
exports.default = app;
//# sourceMappingURL=app.js.map