"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const group_service_1 = require("../services/group-service");
const router = (0, express_1.Router)();
router.post('/', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'anonymous';
        const clientId = req.headers['x-client-id'] || 'unknown';
        const group = await group_service_1.groupService.createGroup(req.body, userId, clientId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.status(201).json(group);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const expectedVersion = parseInt(req.headers['if-match'] || '0', 10);
        const userId = req.headers['x-user-id'] || 'anonymous';
        const clientId = req.headers['x-client-id'] || 'unknown';
        const group = await group_service_1.groupService.updateGroup(req.params.id, req.body, userId, clientId, expectedVersion, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.json(group);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/user/:userId', async (req, res) => {
    try {
        const groups = group_service_1.groupService.getGroupsForUser(req.params.userId);
        res.json(groups);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const group = group_service_1.groupService.getGroupById(req.params.id);
        if (!group) {
            return res.status(404).json({ error: 'Group not found' });
        }
        res.json(group);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
