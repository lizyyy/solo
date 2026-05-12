import { Router } from 'express';
import {
  ticketController,
  remoteOperationController,
  orderController,
  maintenanceController,
} from './controllers';

const router = Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '充电桩故障工单API运行正常' });
});

router.post('/tickets', ticketController.createTicket);
router.get('/tickets/:id', ticketController.getTicket);
router.get('/tickets/:id/suggestion', ticketController.getDecisionSuggestion);
router.put('/tickets/:id/status', ticketController.updateStatus);
router.put('/tickets/:id/close', ticketController.closeTicket);
router.get('/tickets/timeline', ticketController.getTicketTimeline);

router.post('/remote-operations', remoteOperationController.createOperation);
router.put('/remote-operations/:id', remoteOperationController.updateOperation);
router.get('/tickets/:ticketId/remote-operations', remoteOperationController.getOperationsByTicket);

router.post('/orders', orderController.createOrUpdateOrder);
router.get('/orders/:orderCode', orderController.getOrder);
router.post('/refunds/request', orderController.requestRefund);
router.post('/refunds/:orderCode/approve', orderController.approveRefund);
router.post('/refunds/:orderCode/reject', orderController.rejectRefund);

router.post('/maintenances', maintenanceController.createMaintenance);
router.put('/maintenances/:id', maintenanceController.updateMaintenance);
router.get('/tickets/:ticketId/maintenances', maintenanceController.getMaintenanceByTicket);

export default router;
