"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const TransferService_1 = require("../services/TransferService");
const router = (0, express_1.Router)();
router.get('/tellers', async (req, res) => {
    try {
        const tellers = await TransferService_1.transferService.getTellers();
        res.status(200).json(tellers);
    }
    catch (error) {
        res.status(500).json({ error: '获取柜员列表失败' });
    }
});
router.post('/tellers', async (req, res) => {
    try {
        const tellers = req.body;
        await TransferService_1.transferService.saveTellers(tellers);
        res.status(200).json({ message: `保存 ${tellers.length} 条柜员信息成功` });
    }
    catch (error) {
        res.status(500).json({ error: '保存柜员信息失败' });
    }
});
router.get('/schedules', async (req, res) => {
    try {
        const schedules = await TransferService_1.transferService.getSchedules();
        res.status(200).json(schedules);
    }
    catch (error) {
        res.status(500).json({ error: '获取排班列表失败' });
    }
});
router.post('/schedules', async (req, res) => {
    try {
        const schedules = req.body;
        await TransferService_1.transferService.saveSchedules(schedules);
        res.status(200).json({ message: `保存 ${schedules.length} 条排班信息成功` });
    }
    catch (error) {
        res.status(500).json({ error: '保存排班信息失败' });
    }
});
exports.default = router;
