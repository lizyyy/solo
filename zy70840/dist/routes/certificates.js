"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const CertificateService_1 = __importDefault(require("../services/CertificateService"));
const dayjs_1 = __importDefault(require("dayjs"));
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const { applicationId, certificateNo, type, version, issueDate, expiryDate, attachmentUrl } = req.body;
        if (!applicationId || !certificateNo || !type || !version || !issueDate || !expiryDate) {
            return res.status(400).json({ error: '必填字段不能为空' });
        }
        const certificate = await CertificateService_1.default.addCertificate(applicationId, certificateNo, type, version, (0, dayjs_1.default)(issueDate).toDate(), (0, dayjs_1.default)(expiryDate).toDate(), attachmentUrl);
        res.json(certificate);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/application/:applicationId', async (req, res) => {
    try {
        const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
        const certificates = await CertificateService_1.default.getCertificatesByApplication(parseInt(applicationIdParam));
        res.json(certificates);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.post('/application/:applicationId/check', async (req, res) => {
    try {
        const { operator } = req.body;
        const applicationIdParam = Array.isArray(req.params.applicationId) ? req.params.applicationId[0] : req.params.applicationId;
        const result = await CertificateService_1.default.checkCertificates(parseInt(applicationIdParam), operator || 'system');
        res.json(result);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
router.get('/version/:version', async (req, res) => {
    try {
        const versionParam = Array.isArray(req.params.version) ? req.params.version[0] : req.params.version;
        const certificates = await CertificateService_1.default.getCertificatesByVersion(versionParam);
        res.json(certificates);
    }
    catch (err) {
        res.status(500).json({ error: err.message });
    }
});
exports.default = router;
