import express from 'express';
import ExportService from '../services/ExportService';
import { WorkOrderStatus } from '../models/WorkOrder';

const router = express.Router();

router.post('/work-orders', async (req, res) => {
  try {
    const { startDate, endDate, responsiblePersonId, status, operatorId, operatorName } = req.body;

    const filePath = await ExportService.exportWorkOrders({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      responsiblePersonId,
      status: status as WorkOrderStatus,
      operatorId,
      operatorName
    });

    res.download(filePath);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
