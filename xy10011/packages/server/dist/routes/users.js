"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const user_service_1 = require("../services/user-service");
const router = (0, express_1.Router)();
router.post('/get-or-create', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || req.body.userId;
        const clientId = req.headers['x-client-id'] || 'unknown';
        if (!userId) {
            return res.status(400).json({ error: 'User ID is required' });
        }
        const user = await user_service_1.userService.getOrCreateUser(userId, {
            name: req.body.name,
            avatar: req.body.avatar,
        }, clientId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/', async (req, res) => {
    try {
        const clientId = req.headers['x-client-id'] || 'unknown';
        const user = await user_service_1.userService.createUser(req.body, clientId, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.status(201).json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const expectedVersion = parseInt(req.headers['if-match'] || '0', 10);
        const clientId = req.headers['x-client-id'] || 'unknown';
        const user = await user_service_1.userService.updateUser(req.params.id, req.body, clientId, expectedVersion, {
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            correlationId: req.headers['x-correlation-id'],
        });
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const user = user_service_1.userService.getUserById(req.params.id);
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
        res.json(user);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/', async (_req, res) => {
    try {
        const users = user_service_1.userService.getAllUsers();
        res.json(users);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
