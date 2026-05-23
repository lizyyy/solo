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
const customerDao = __importStar(require("../dao/customerDao"));
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { name, phone, address } = req.body;
        if (!name) {
            return res.status(400).json({ error: '客户名称不能为空' });
        }
        const id = await customerDao.createCustomer({ name, phone, address });
        res.status(201).json({ id, name, phone, address });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/', async (req, res) => {
    try {
        const customers = await customerDao.getAllCustomers();
        res.json(customers);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const customer = await customerDao.getCustomerById(id);
        if (!customer) {
            return res.status(404).json({ error: '客户不存在' });
        }
        res.json(customer);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { name, phone, address } = req.body;
        await customerDao.updateCustomer(id, { name, phone, address });
        res.json({ success: true });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
