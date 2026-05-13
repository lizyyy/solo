"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const referenceService_1 = require("../services/referenceService");
const router = (0, express_1.Router)();
router.get('/departments', (req, res) => {
    try {
        const departments = referenceService_1.referenceService.getAllDepartments();
        res.json({
            success: true,
            data: departments
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '获取部门列表失败'
        });
    }
});
router.get('/roles', (req, res) => {
    try {
        const roles = referenceService_1.referenceService.getAllRoles();
        res.json({
            success: true,
            data: roles
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            error: error?.message || '获取角色列表失败'
        });
    }
});
exports.default = router;
