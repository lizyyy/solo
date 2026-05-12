"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memberRouter = void 0;
const express_1 = require("express");
const benefitService_1 = require("../services/benefitService");
const uuid_1 = require("uuid");
const router = (0, express_1.Router)();
exports.memberRouter = router;
router.post('/create', (req, res) => {
    const { name, phone } = req.body;
    const requestId = req.headers['x-request-id'] || (0, uuid_1.v4)();
    if (!name || !phone) {
        return res.status(400).json({
            success: false,
            message: '缺少必要参数: name 或 phone',
            requestId
        });
    }
    const result = benefitService_1.benefitService.createMember({
        requestId,
        name,
        phone
    });
    res.json(result);
});
router.get('/:memberId', (req, res) => {
    const { memberId } = req.params;
    const result = benefitService_1.benefitService.getMember({ memberId });
    res.json(result);
});
router.get('/:memberId/benefits', (req, res) => {
    const { memberId } = req.params;
    const result = benefitService_1.benefitService.queryMemberBenefits({ memberId });
    res.json(result);
});
//# sourceMappingURL=memberRoutes.js.map