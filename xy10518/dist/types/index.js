"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INSPECTION_RULES = exports.DEFECT_LEVEL_WEIGHTS = void 0;
exports.DEFECT_LEVEL_WEIGHTS = {
    CRITICAL: 100,
    MAJOR: 10,
    MINOR: 1,
    NONE: 0
};
exports.INSPECTION_RULES = {
    MAX_DEFECTS: 3,
    REINSPECTION_MULTIPLIER: 2,
    CRITICAL_DEFECT_CONCESSION_ONLY: true,
    MIN_REINSPECTION_SAMPLE_RATIO: 1.0
};
//# sourceMappingURL=index.js.map