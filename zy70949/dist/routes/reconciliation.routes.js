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
const multer = require("multer");
const reconciliation_controller_1 = require("../controllers/reconciliation.controller");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
const router = (0, express_1.Router)();
const controller = new reconciliation_controller_1.ReconciliationController();
const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    },
});
const upload = multer({
    storage,
    limits: {
        fileSize: 50 * 1024 * 1024,
    },
    fileFilter: (req, file, cb) => {
        if (file.fieldname === 'addItems') {
            if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
                cb(null, true);
            }
            else {
                cb(new Error('加项文件仅支持 CSV 格式'));
            }
        }
        else if (file.fieldname === 'packages' || file.fieldname === 'unitAgreements' || file.fieldname === 'coupons') {
            if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
                cb(null, true);
            }
            else {
                cb(new Error('配置文件仅支持 JSON 格式'));
            }
        }
        else {
            cb(null, true);
        }
    },
});
router.get('/health', (req, res) => controller.getHealthCheck(req, res));
router.get('/rules', (req, res) => controller.getRules(req, res));
router.post('/upload', upload.fields([
    { name: 'addItems', maxCount: 1 },
    { name: 'packages', maxCount: 1 },
    { name: 'unitAgreements', maxCount: 1 },
    { name: 'coupons', maxCount: 1 },
]), (req, res) => controller.processFiles(req, res));
router.post('/process', (req, res) => controller.processInlineData(req, res));
exports.default = router;
