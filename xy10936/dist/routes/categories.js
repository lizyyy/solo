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
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const categoryDao = __importStar(require("../dao/categoryDao"));
const priceDao = __importStar(require("../dao/priceDao"));
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { name, code, description } = req.body;
        if (!name || !code) {
            return res.status(400).json({ error: '品类名称和代码不能为空' });
        }
        const id = await categoryDao.createCategory({ name, code, description });
        res.status(201).json({ id, name, code, description });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const categories = await categoryDao.getAllCategories();
        res.json(categories);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const category = await categoryDao.getCategoryById(id);
        if (!category) {
            return res.status(404).json({ error: '品类不存在' });
        }
        res.json(category);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/prices', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { price, effective_date, created_by } = req.body;
        if (!price || !effective_date) {
            return res.status(400).json({ error: '价格和生效日期不能为空' });
        }
        const id = await priceDao.createPriceVersion({
            category_id: categoryId,
            price,
            effective_date,
            created_by
        });
        res.status(201).json({ id, success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id/prices', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const prices = await priceDao.getPriceVersionsByCategory(categoryId);
        res.json(prices);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/:id/deductions', async (req, res) => {
    try {
        const categoryId = parseInt(req.params.id);
        const { ratio, description } = req.body;
        if (ratio === undefined) {
            return res.status(400).json({ error: '扣杂比例不能为空' });
        }
        const id = await priceDao.createDeductionRatio({
            category_id: categoryId,
            ratio,
            description
        });
        res.status(201).json({ id, success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/deductions/all', async (req, res) => {
    try {
        const deductions = await priceDao.getAllDeductionRatios();
        res.json(deductions);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
