"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const StateMachineService_1 = require("../services/StateMachineService");
const router = express_1.default.Router();
const stateMachineService = new StateMachineService_1.StateMachineService();
router.get('/stats', async (req, res) => {
    try {
        const stats = await stateMachineService.getStatistics();
        res.json(stats);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/failed-releases', async (req, res) => {
    try {
        const failedReleases = await stateMachineService.getFailedReleases();
        res.json(failedReleases);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/release-records', async (req, res) => {
    try {
        const { reservationId, limit = 100 } = req.query;
        const records = await stateMachineService.getReleaseRecords(reservationId, Number(limit));
        res.json(records);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.get('/compensation-actions', async (req, res) => {
    try {
        const { status, limit = 100 } = req.query;
        const actions = await stateMachineService.getCompensationActions(status, Number(limit));
        res.json(actions);
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
router.post('/process-timeouts', async (req, res) => {
    try {
        const processed = await stateMachineService.processTimeoutTasks();
        res.json({ processed });
    }
    catch (error) {
        res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
    }
});
exports.default = router;
