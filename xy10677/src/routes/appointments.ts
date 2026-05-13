import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { DatabaseService } from '../services/database';
import { AppointmentStatus } from '../types';

export const createAppointmentRouter = (
  treatmentService: TreatmentService,
  dbService: DatabaseService
) => {
  const router = express.Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const idempotentResult = await dbService.checkIdempotency(req.body);
      if (idempotentResult) {
        return res.json(idempotentResult);
      }

      const { operatorId, operatorName, ...appointmentData } = req.body;
      const appointment = await treatmentService.createAppointment(
        appointmentData,
        operatorId || 'admin',
        operatorName || '管理员'
      );

      const result = { success: true, data: appointment };
      await dbService.saveIdempotency(req.body, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.put('/:id/status', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newStatus, actualDate, operatorId, operatorName, reason } = req.body;
      const appointment = await treatmentService.updateAppointmentStatus(
        id,
        newStatus as AppointmentStatus,
        actualDate,
        operatorId || 'admin',
        operatorName || '管理员',
        reason
      );
      if (!appointment) {
        return res.status(404).json({ success: false, error: 'Appointment not found' });
      }
      res.json({ success: true, data: appointment });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createAppointmentRouter;
