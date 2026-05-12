"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path = __importStar(require("path"));
const storage_1 = require("./storage");
const service_1 = require("./service");
const app = (0, express_1.default)();
const PORT = 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use(express_1.default.static(path.join(process.cwd(), 'public')));
(0, storage_1.loadData)();
app.get('/api/orders', (req, res) => {
    try {
        const orders = (0, service_1.getAllOrders)();
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: '获取订单列表失败' });
    }
});
app.get('/api/orders/active', (req, res) => {
    try {
        const orders = (0, service_1.getActiveOrdersList)();
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: '获取活跃订单失败' });
    }
});
app.get('/api/orders/queue', (req, res) => {
    try {
        const orders = (0, service_1.getQueueOrdersList)();
        res.json({ success: true, data: orders });
    }
    catch (error) {
        res.status(500).json({ success: false, error: '获取队列订单失败' });
    }
});
app.get('/api/orders/:id', (req, res) => {
    try {
        const order = (0, service_1.getOrder)(req.params.id);
        if (!order) {
            return res.status(404).json({ success: false, error: '订单不存在' });
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({ success: false, error: '获取订单失败' });
    }
});
app.post('/api/orders', (req, res) => {
    try {
        const order = (0, service_1.createOrder)(req.body);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '创建订单失败'
        });
    }
});
app.put('/api/orders/:id', (req, res) => {
    try {
        const order = (0, service_1.updateOrderInfo)(req.params.id, req.body);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '更新订单失败'
        });
    }
});
app.post('/api/orders/:id/call', (req, res) => {
    try {
        const order = (0, service_1.callOrder)(req.params.id);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '叫号失败'
        });
    }
});
app.post('/api/orders/call-next', (req, res) => {
    try {
        const order = (0, service_1.callNextOrder)();
        if (!order) {
            return res.json({ success: true, data: null, message: '当前没有待叫号的订单' });
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '叫号失败'
        });
    }
});
app.post('/api/orders/:id/topup', (req, res) => {
    try {
        const { amount } = req.body;
        const order = (0, service_1.topupOrder)(req.params.id, amount);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '补差失败'
        });
    }
});
app.post('/api/orders/:id/refund', (req, res) => {
    try {
        const order = (0, service_1.refundOrder)(req.params.id);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '退款失败'
        });
    }
});
app.post('/api/orders/:id/complete', (req, res) => {
    try {
        const order = (0, service_1.completeOrder)(req.params.id);
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(400).json({
            success: false,
            error: error instanceof Error ? error.message : '完成订单失败'
        });
    }
});
app.get('/', (req, res) => {
    res.sendFile(path.join(process.cwd(), 'public', 'index.html'));
});
app.listen(PORT, () => {
    console.log(`校园打印店预付队列台已启动: http://localhost:${PORT}`);
});
