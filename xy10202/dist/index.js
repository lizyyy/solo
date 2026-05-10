"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const businessHandler_1 = require("./businessHandler");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use(express_1.default.json());
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    next();
});
app.post('/api/events', (req, res) => {
    const request = req.body;
    const response = (0, businessHandler_1.handleCreateRiskEvent)(request);
    res.status(response.success ? 201 : 400).json(response);
});
app.post('/api/events/:eventId/assess', (req, res) => {
    const request = {
        ...req.body,
        eventId: req.params.eventId
    };
    const response = (0, businessHandler_1.handleAssessSite)(request);
    res.status(response.success ? 200 : 400).json(response);
});
app.post('/api/rebookings', (req, res) => {
    const request = req.body;
    const response = (0, businessHandler_1.handleCreateRebooking)(request);
    res.status(response.success ? 201 : 400).json(response);
});
app.post('/api/rebookings/:rebookingId/process', (req, res) => {
    const request = {
        ...req.body,
        rebookingId: req.params.rebookingId
    };
    const response = (0, businessHandler_1.handleProcessRebooking)(request);
    res.status(response.success ? 200 : 400).json(response);
});
app.post('/api/events/:eventId/cancel', (req, res) => {
    const request = {
        ...req.body,
        eventId: req.params.eventId
    };
    const response = (0, businessHandler_1.handleCancelEvent)(request);
    res.status(response.success ? 200 : 400).json(response);
});
app.patch('/api/events/:eventId', (req, res) => {
    const request = {
        ...req.body,
        eventId: req.params.eventId
    };
    const response = (0, businessHandler_1.handleModifyEvent)(request);
    res.status(response.success ? 200 : 400).json(response);
});
app.get('/api/summary', (req, res) => {
    const request = {
        eventId: req.query.eventId,
        status: req.query.status
    };
    const response = (0, businessHandler_1.handleQuerySummary)(request);
    res.status(response.success ? 200 : 400).json(response);
});
app.get('/api/problems', (req, res) => {
    const response = (0, businessHandler_1.handleQueryProblems)();
    res.status(response.success ? 200 : 400).json(response);
});
app.get('/api/sites', (req, res) => {
    const response = (0, businessHandler_1.handleQuerySites)();
    res.status(response.success ? 200 : 400).json(response);
});
app.get('/api/orders', (req, res) => {
    const response = (0, businessHandler_1.handleQueryOrders)();
    res.status(response.success ? 200 : 400).json(response);
});
app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        timestamp: new Date().toISOString(),
        service: 'Rain Risk Campground API'
    });
});
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        error: {
            code: 'INTERNAL_ERROR',
            message: err.message || 'An unexpected error occurred'
        },
        requestId: 'server-' + Date.now(),
        timestamp: new Date().toISOString()
    });
});
app.listen(PORT, () => {
    console.log(`Rain Risk Campground API running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/health`);
    console.log(`API endpoints:`);
    console.log(`  POST /api/events          - Create risk event`);
    console.log(`  POST /api/events/:id/assess - Assess site risk`);
    console.log(`  POST /api/rebookings      - Create rebooking request`);
    console.log(`  POST /api/rebookings/:id/process - Process rebooking`);
    console.log(`  POST /api/events/:id/cancel - Cancel risk event`);
    console.log(`  PATCH /api/events/:id     - Modify event (withdraw/revise)`);
    console.log(`  GET /api/summary          - Query summary`);
    console.log(`  GET /api/problems         - Query problem list`);
    console.log(`  GET /api/sites            - List all sites`);
    console.log(`  GET /api/orders           - List all orders`);
});
exports.default = app;
//# sourceMappingURL=index.js.map