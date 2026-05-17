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
const controller = __importStar(require("../controllers/recycleController"));
const validation_1 = require("../middleware/validation");
const router = (0, express_1.Router)();
router.post('/', validation_1.validateCreateRecycle, controller.createRecycle);
router.get('/export', controller.exportRecycle);
router.get('/:id', controller.getRecycleById);
router.get('/', validation_1.validateQueryRecycle, controller.queryRecycle);
router.patch('/:id/status', validation_1.validateStatusTransition, controller.transitionStatus);
router.patch('/:id/exceptions/:exceptionId/handle', validation_1.validateExceptionHandle, controller.handleException);
router.patch('/:id/manual-correction', validation_1.validateManualCorrection, controller.manualCorrection);
router.patch('/:id/hit-tenants', controller.updateHitTenants);
router.post('/check-expirations', controller.triggerExpirationCheck);
router.post('/send-reminders', controller.triggerReminders);
exports.default = router;
