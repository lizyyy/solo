"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const recycleRoutes_1 = __importDefault(require("./routes/recycleRoutes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});
app.use('/api/recycle', recycleRoutes_1.default);
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});
if (require.main === module) {
    app.listen(PORT, () => {
        console.log(`Gray Config Recycle API running on port ${PORT}`);
        console.log(`Health check: http://localhost:${PORT}/health`);
    });
}
exports.default = app;
