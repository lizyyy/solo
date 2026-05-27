"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.importDepositRules = exports.importRepairRecords = exports.importRentalOrders = void 0;
const importService_1 = require("../services/importService");
const importRentalOrders = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: '请上传CSV文件' });
        }
        const result = await importService_1.importService.importRentalOrdersFromCSVBuffer(req.file.buffer);
        res.json({
            message: '租赁订单导入完成',
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.importRentalOrders = importRentalOrders;
const importRepairRecords = async (req, res) => {
    try {
        const { content } = req.body;
        if (!content) {
            return res.status(400).json({ error: '请提供JSON内容' });
        }
        const result = await importService_1.importService.importRepairRecordsFromJSONContent(content);
        res.json({
            message: '维修记录导入完成',
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.importRepairRecords = importRepairRecords;
const importDepositRules = async (req, res) => {
    try {
        const { rules } = req.body;
        if (!rules || !Array.isArray(rules)) {
            return res.status(400).json({ error: '请提供规则数组' });
        }
        const result = await importService_1.importService.importDepositRules(rules);
        res.json({
            message: '押金规则导入完成',
            ...result,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
};
exports.importDepositRules = importDepositRules;
