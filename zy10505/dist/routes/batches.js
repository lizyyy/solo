"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const DataStore_1 = require("../store/DataStore");
const VerificationService_1 = require("../services/VerificationService");
const types_1 = require("../types");
const router = (0, express_1.Router)();
router.post('/', (req, res) => {
    try {
        const { batchNo, name, description, customer, version, createdBy } = req.body;
        if (!batchNo || !name || !customer || !version || !createdBy) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['batchNo', 'name', 'customer', 'version', 'createdBy']
            });
        }
        const batch = DataStore_1.dataStore.createBatch(batchNo, name, description || '', customer, version, createdBy);
        res.status(201).json(batch);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/', (req, res) => {
    const batches = DataStore_1.dataStore.getAllBatches();
    res.json(batches.map(batch => ({
        id: batch.id,
        batchNo: batch.batchNo,
        name: batch.name,
        customer: batch.customer,
        version: batch.version,
        status: batch.status,
        createdAt: batch.createdAt,
        updatedAt: batch.updatedAt,
        packageCount: batch.packages.length
    })));
});
router.get('/:batchId', (req, res) => {
    const batch = DataStore_1.dataStore.getBatchById(req.params.batchId);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
});
router.get('/no/:batchNo', (req, res) => {
    const batch = DataStore_1.dataStore.getBatchByNo(req.params.batchNo);
    if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
    }
    res.json(batch);
});
router.post('/:batchId/packages', (req, res) => {
    try {
        const { batchId } = req.params;
        const { name, version, size, md5, sha256 } = req.body;
        if (!name || !version || !md5) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['name', 'version', 'md5']
            });
        }
        const pkg = DataStore_1.dataStore.addPackage(batchId, {
            name,
            version,
            size: size || 0,
            md5,
            sha256: sha256 || '',
            verificationStatus: types_1.VerificationStatus.PENDING
        });
        const batch = DataStore_1.dataStore.getBatchById(batchId);
        if (batch && batch.status === types_1.DeliveryBatchStatus.CREATED) {
            DataStore_1.dataStore.updateBatchStatus(batchId, types_1.DeliveryBatchStatus.PACKAGES_UPLOADED);
        }
        res.status(201).json(pkg);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/manifest', (req, res) => {
    try {
        const { batchId } = req.params;
        const { fileName, content } = req.body;
        if (!fileName || !content) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['fileName', 'content']
            });
        }
        const manifest = DataStore_1.dataStore.setManifest(batchId, {
            fileName,
            content,
            verificationStatus: types_1.VerificationStatus.PENDING,
            expectedPackages: [],
            missingPackages: [],
            extraPackages: []
        });
        res.status(201).json(manifest);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/manifest/verify', (req, res) => {
    try {
        const { batchId } = req.params;
        const result = VerificationService_1.verificationService.verifyManifest(batchId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/signatures', (req, res) => {
    try {
        const { batchId } = req.params;
        const { packageId, packageName, signature, publicKey } = req.body;
        if (!packageName || !signature || !publicKey) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['packageName', 'signature', 'publicKey']
            });
        }
        const result = DataStore_1.dataStore.addSignature(batchId, {
            packageId: packageId || '',
            packageName,
            signature,
            publicKey,
            verificationStatus: types_1.VerificationStatus.PENDING
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/signatures/verify', (req, res) => {
    try {
        const { batchId } = req.params;
        const result = VerificationService_1.verificationService.verifySignatures(batchId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/patch-order', (req, res) => {
    try {
        const { batchId } = req.params;
        const { order, dependencies } = req.body;
        if (!order || !Array.isArray(order)) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['order']
            });
        }
        const result = DataStore_1.dataStore.setPatchOrder(batchId, {
            order,
            dependencies: dependencies || {},
            verificationStatus: types_1.VerificationStatus.PENDING,
            circularDependencies: [],
            missingDependencies: []
        });
        res.status(201).json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/patch-order/verify', (req, res) => {
    try {
        const { batchId } = req.params;
        const result = VerificationService_1.verificationService.verifyPatchOrder(batchId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/reports', (req, res) => {
    try {
        const { batchId } = req.params;
        const { generatedBy } = req.body;
        if (!generatedBy) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['generatedBy']
            });
        }
        const report = VerificationService_1.verificationService.generateReport(batchId, generatedBy);
        res.status(201).json(report);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.get('/:batchId/reports/:reportId/export', (req, res) => {
    try {
        const { batchId, reportId } = req.params;
        const content = VerificationService_1.verificationService.exportReport(batchId, reportId);
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="verification-report-${reportId}.txt"`);
        res.send(content);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/errors/:errorId/resolve', (req, res) => {
    try {
        const { batchId, errorId } = req.params;
        const { resolvedBy, resolutionNote } = req.body;
        if (!resolvedBy) {
            return res.status(400).json({
                error: '缺少必要参数',
                required: ['resolvedBy']
            });
        }
        const result = DataStore_1.dataStore.resolveError(batchId, errorId, resolvedBy, resolutionNote || '');
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
router.post('/:batchId/packages/:packageId/manual-fix', (req, res) => {
    try {
        const { batchId, packageId } = req.params;
        const result = DataStore_1.dataStore.manualFixPackage(batchId, packageId);
        res.json(result);
    }
    catch (error) {
        res.status(400).json({ error: error.message });
    }
});
exports.default = router;
