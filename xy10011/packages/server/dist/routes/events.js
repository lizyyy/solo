"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const event_store_1 = require("../event-store");
const conflict_service_1 = require("../services/conflict-service");
const sync_service_1 = require("../services/sync-service");
const router = (0, express_1.Router)();
router.get('/aggregate/:id', async (req, res) => {
    try {
        const events = event_store_1.eventStore.getEventsByAggregate(req.params.id);
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/user/:userId', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100', 10);
        const events = event_store_1.eventStore.getEventsByUser(req.params.userId, limit);
        res.json(events);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/sync', async (req, res) => {
    try {
        const clientId = req.headers['x-client-id'] || 'unknown';
        const result = await sync_service_1.syncService.sync(clientId, req.body.localEvents || [], req.body.lastKnownServerVersion || 0);
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/sync/state', async (req, res) => {
    try {
        const state = sync_service_1.syncService.getSyncState();
        res.json(state);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/replay/:aggregateId', async (req, res) => {
    try {
        const targetVersion = parseInt(req.body.targetVersion, 10);
        const success = await sync_service_1.syncService.replayEvents(req.params.aggregateId, targetVersion);
        res.json({ success, targetVersion });
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.get('/conflicts', async (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100', 10);
        const conflicts = conflict_service_1.conflictService.getPendingConflicts(limit);
        res.json(conflicts);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
router.post('/conflicts/:id/resolve', async (req, res) => {
    try {
        const userId = req.headers['x-user-id'] || 'anonymous';
        const conflict = await conflict_service_1.conflictService.resolveConflict(req.params.id, req.body.resolution, userId);
        res.json(conflict);
    }
    catch (error) {
        res.status(500).json({ error: error.message });
    }
});
exports.default = router;
