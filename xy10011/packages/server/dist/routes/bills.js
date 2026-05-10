"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const bill_service_1 = require("../services/bill-service");
const event_store_1 = require("../event-store");
const conflict_service_1 = require("../services/conflict-service");
const router = (0, express_1.Router)();
const validateBill = (body) => {
    const errors = [];
    if (!body.groupId)
        errors.push('groupId is required');
    if (!body.title)
        errors.push('title is required');
    if (!body.amount || body.amount <= 0)
        errors.push('amount must be a positive number');
    if (!body.participants || body.participants.length === 0) {
        errors.push('at least one participant is required');
    }
    else {
        const totalShare = body.participants.reduce((sum, p) => sum + (p.adjustedShare !== undefined ? p.adjustedShare : p.share), 0);
        const totalPaid = body.participants.reduce((sum, p) => sum + p.paid, 0);
        if (Math.abs(totalShare - body.amount) > 0.01) {
            errors.push(`total share (${totalShare}) does not match bill amount (${body.amount})`);
        }
        if (Math.abs(totalPaid - body.amount) > 0.01) {
            errors.push(`total paid (${totalPaid}) does not match bill amount (${body.amount})`);
        }
    }
    return { valid: errors.length === 0, errors };
};
router.post('/', async (req, res) => {
    try {
        const { valid, errors } = validateBill(req.body);
        if (!valid) {
            return res.status(400).json({ error: 'Invalid bill data', details: errors });
        }
        const userId = req.headers['x-user-id'] || 'anonymous';
        const clientId = req.headers['x-client-id'] || 'unknown';
        const bill = await bill_service_1.billService.createBill(req.body, userId, clientId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.status(201).json(bill);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const billId = req.params.id;
        const expectedVersion = parseInt(req.headers['if-match'] || '0', 10);
        const userId = req.headers['x-user-id'] || 'anonymous';
        const clientId = req.headers['x-client-id'] || 'unknown';
        const bill = await bill_service_1.billService.updateBill(billId, req.body, userId, clientId, expectedVersion, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.json(bill);
    }
    catch (error) {
        if (error instanceof event_store_1.VersionConflictError) {
            const pendingConflicts = conflict_service_1.conflictService.getPendingConflicts(10);
            res.status(409).json({
                error: 'Version conflict',
                expectedVersion: error.expectedVersion,
                actualVersion: error.actualVersion,
                conflicts: pendingConflicts,
            });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const billId = req.params.id;
        const expectedVersion = parseInt(req.headers['if-match'] || '0', 10);
        const userId = req.headers['x-user-id'] || 'anonymous';
        const clientId = req.headers['x-client-id'] || 'unknown';
        await bill_service_1.billService.deleteBill(billId, userId, clientId, expectedVersion, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.status(204).send();
    }
    catch (error) {
        if (error instanceof event_store_1.VersionConflictError) {
            res.status(409).json({
                error: 'Version conflict',
                expectedVersion: error.expectedVersion,
                actualVersion: error.actualVersion,
            });
        }
        else {
            res.status(500).json({ error: error.message });
        }
    }
});
router.get('/group/:groupId', async (req, res) => {
    try {
        const bills = bill_service_1.billService.getBillsByGroup(req.params.groupId);
        res.json(bills);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const bill = bill_service_1.billService.getBillById(req.params.id);
        if (!bill) {
            return res.status(404).json({ error: 'Bill not found' });
        }
        res.json(bill);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/group/:groupId/balances', async (req, res) => {
    try {
        const balances = bill_service_1.billService.calculateBalances(req.params.groupId);
        const suggestions = bill_service_1.billService.calculateSettlementSuggestions(balances);
        res.json({
            balances: Object.fromEntries(balances),
            settlementSuggestions: suggestions,
        });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
