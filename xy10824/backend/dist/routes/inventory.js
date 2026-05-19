"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const StateMachineService_1 = require("../services/StateMachineService");
const router = express_1.default.Router();
const stateMachineService = new StateMachineService_1.StateMachineService();
router.post('/pool', async (req, res) => {
    try {
        const { poolName, initialQuantity = 0 } = req.body;
        if (!poolName) {
            return res.status(400).json({ error: 'poolName is required' });
        }
        const pool = await stateMachineService.createInventoryPool(poolName, initialQuantity);
        res.json(pool);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/pool', async (req, res) => {
    try {
        const pools = await stateMachineService.listInventoryPools();
        res.json(pools);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/pool/:poolId', async (req, res) => {
    try {
        const { poolId } = req.params;
        const pool = await stateMachineService.getInventoryPool(poolId);
        if (!pool) {
            return res.status(404).json({ error: 'Inventory pool not found' });
        }
        res.json(pool);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/logs', async (req, res) => {
    try {
        const { poolId, orderId, limit = 100 } = req.query;
        const logs = await stateMachineService.getInventoryLogs(poolId, orderId, Number(limit));
        res.json(logs);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
exports.default = router;
