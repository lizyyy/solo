"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const certificateService_1 = require("../services/certificateService");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    const cert = (0, certificateService_1.createCertificate)(req.body);
    res.status(201).json(cert);
});
router.get('/', (req, res) => {
    const certificates = (0, certificateService_1.listCertificates)();
    res.json(certificates);
});
router.get('/:id', (req, res) => {
    const cert = (0, certificateService_1.getCertificate)(String(req.params.id));
    if (!cert) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: '证书不存在', suggestion: 'fix_data' } });
        return;
    }
    res.json(cert);
});
router.patch('/:id', (req, res) => {
    const cert = (0, certificateService_1.updateCertificate)(String(req.params.id), req.body);
    res.json(cert);
});
router.get('/:id/history', (req, res) => {
    const history = (0, certificateService_1.getCertificateHistory)(String(req.params.id));
    res.json(history);
});
router.post('/import', (req, res) => {
    const { data, operator } = req.body;
    const result = (0, certificateService_1.importCertificates)(data, operator);
    res.json(result);
});
router.get('/export/csv', (req, res) => {
    const csv = (0, certificateService_1.exportCertificates)();
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="certificates.csv"');
    res.send('\uFEFF' + csv);
});
exports.default = router;
