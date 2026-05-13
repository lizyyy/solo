import express from 'express';
import {
  handleCreateRiskEvent,
  handleAssessSite,
  handleCreateRebooking,
  handleProcessRebooking,
  handleCancelEvent,
  handleModifyEvent,
  handleQuerySummary,
  handleQueryProblems,
  handleQuerySites,
  handleQueryOrders,
  handleCreateNotification,
  handleSendNotification,
  handleAcknowledgeNotification,
  handleRetryNotification,
  handleQueryNotifications
} from './businessHandler';
import {
  CreateRiskEventRequest,
  AssessSiteRequest,
  CreateRebookingRequest,
  ProcessRebookingRequest,
  CancelEventRequest,
  ModifyEventRequest,
  QuerySummaryRequest,
  CreateNotificationRequest,
  SendNotificationRequest,
  AcknowledgeNotificationRequest,
  RetryNotificationRequest,
  QueryNotificationsRequest
} from './types';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

app.post('/api/events', (req, res) => {
  const request: CreateRiskEventRequest = req.body;
  const response = handleCreateRiskEvent(request);
  res.status(response.success ? 201 : 400).json(response);
});

app.post('/api/events/:eventId/assess', (req, res) => {
  const request: AssessSiteRequest = {
    ...req.body,
    eventId: req.params.eventId
  };
  const response = handleAssessSite(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.post('/api/rebookings', (req, res) => {
  const request: CreateRebookingRequest = req.body;
  const response = handleCreateRebooking(request);
  res.status(response.success ? 201 : 400).json(response);
});

app.post('/api/rebookings/:rebookingId/process', (req, res) => {
  const request: ProcessRebookingRequest = {
    ...req.body,
    rebookingId: req.params.rebookingId
  };
  const response = handleProcessRebooking(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.post('/api/events/:eventId/cancel', (req, res) => {
  const request: CancelEventRequest = {
    ...req.body,
    eventId: req.params.eventId
  };
  const response = handleCancelEvent(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.patch('/api/events/:eventId', (req, res) => {
  const request: ModifyEventRequest = {
    ...req.body,
    eventId: req.params.eventId
  };
  const response = handleModifyEvent(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/api/summary', (req, res) => {
  const request: QuerySummaryRequest = {
    eventId: req.query.eventId as string | undefined,
    status: req.query.status as any
  };
  const response = handleQuerySummary(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/api/problems', (req, res) => {
  const response = handleQueryProblems();
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/api/sites', (req, res) => {
  const response = handleQuerySites();
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/api/orders', (req, res) => {
  const response = handleQueryOrders();
  res.status(response.success ? 200 : 400).json(response);
});

app.post('/api/notifications', (req, res) => {
  const request: CreateNotificationRequest = req.body;
  const response = handleCreateNotification(request);
  res.status(response.success ? 201 : 400).json(response);
});

app.post('/api/notifications/:notificationId/send', (req, res) => {
  const request: SendNotificationRequest = {
    ...req.body,
    notificationId: req.params.notificationId
  };
  const response = handleSendNotification(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.post('/api/notifications/:notificationId/acknowledge', (req, res) => {
  const request: AcknowledgeNotificationRequest = {
    ...req.body,
    notificationId: req.params.notificationId
  };
  const response = handleAcknowledgeNotification(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.post('/api/notifications/:notificationId/retry', (req, res) => {
  const request: RetryNotificationRequest = {
    ...req.body,
    notificationId: req.params.notificationId
  };
  const response = handleRetryNotification(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/api/notifications', (req, res) => {
  const request: QueryNotificationsRequest = {
    eventId: req.query.eventId as string | undefined,
    status: req.query.status as any,
    recipientType: req.query.recipientType as any,
    type: req.query.type as any
  };
  const response = handleQueryNotifications(request);
  res.status(response.success ? 200 : 400).json(response);
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'Rain Risk Campground API'
  });
});

app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
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
  console.log(`  POST /api/events                 - Create risk event`);
  console.log(`  POST /api/events/:id/assess       - Assess site risk`);
  console.log(`  POST /api/rebookings            - Create rebooking request`);
  console.log(`  POST /api/rebookings/:id/process - Process rebooking`);
  console.log(`  POST /api/events/:id/cancel      - Cancel risk event`);
  console.log(`  PATCH /api/events/:id            - Modify event (withdraw/revise)`);
  console.log(`  GET /api/summary               - Query summary`);
  console.log(`  GET /api/problems                - Query problem list`);
  console.log(`  GET /api/sites                   - List all sites`);
  console.log(`  GET /api/orders                  - List all orders`);
  console.log(`  POST /api/notifications          - Create and send notification`);
  console.log(`  POST /api/notifications/:id/send    - Send existing notification`);
  console.log(`  POST /api/notifications/:id/acknowledge - Acknowledge notification`);
  console.log(`  POST /api/notifications/:id/retry   - Retry failed notification`);
  console.log(`  GET /api/notifications             - Query notifications`);
});

export default app;
