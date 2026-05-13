"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middlewares/auth");
const errorHandler_1 = require("../middlewares/errorHandler");
const reviewService_1 = require("../services/reviewService");
const router = (0, express_1.Router)();
router.use(auth_1.authenticateToken);
router.post('/', auth_1.requireReviewer, (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const review = await (0, reviewService_1.createReview)({
        ...req.body,
        reviewerId: req.user.id,
    });
    res.status(201).json(review);
}));
router.get('/', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const result = await (0, reviewService_1.getReviewRecords)({
        page: Number(req.query.page),
        limit: Number(req.query.limit),
        batchId: req.query.batchId,
        experimentId: req.query.experimentId,
        reviewerId: req.query.reviewerId,
        decision: req.query.decision,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
    });
    res.json(result);
}));
router.get('/:id', (0, errorHandler_1.asyncHandler)(async (req, res) => {
    const review = await (0, reviewService_1.getReviewById)(req.params.id);
    if (!review) {
        return res.status(404).json({ error: '复核记录不存在' });
    }
    res.json(review);
}));
exports.default = router;
//# sourceMappingURL=reviews.js.map