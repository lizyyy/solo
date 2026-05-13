"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const reagentService_1 = require("../services/reagentService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const reagent = await (0, reagentService_1.createReagent)({
        ...req.body,
        createdBy: req.user.id,
    });
    res.status(201).json(reagent);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, reagentService_1.getReagents)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        search: req.query.search,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const reagent = await (0, reagentService_1.getReagentById)(req.params.id);
    if (!reagent) {
        return res.status(404).json({ error: '试剂不存在' });
    }
    res.json(reagent);
}));
router.put('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const reagent = await (0, reagentService_1.updateReagent)(req.params.id, req.body, req.user.id);
    res.json(reagent);
}));
exports.default = router;
//# sourceMappingURL=reagents.js.map