import express, { Request, Response } from 'express';
import { TreatmentService } from '../services/treatment';
import { DatabaseService } from '../services/database';
import { TreatmentPhase } from '../types';

export const createPatientRouter = (
  treatmentService: TreatmentService,
  dbService: DatabaseService
) => {
  const router = express.Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      const patients = await treatmentService.getAllPatients();
      res.json({ success: true, data: patients });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const patient = await treatmentService.getPatient(id);
      if (!patient) {
        return res.status(404).json({ success: false, error: 'Patient not found' });
      }
      res.json({ success: true, data: patient });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.post('/', async (req: Request, res: Response) => {
    try {
      const idempotentResult = await dbService.checkIdempotency(req.body);
      if (idempotentResult) {
        return res.json(idempotentResult);
      }

      const { operatorId, operatorName, ...patientData } = req.body;
      const patient = await treatmentService.createPatient(
        patientData,
        operatorId || 'admin',
        operatorName || '管理员'
      );

      const result = { success: true, data: patient };
      await dbService.saveIdempotency(req.body, result);
      res.json(result);
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.post('/batch-import', async (req: Request, res: Response) => {
    try {
      const { patients, operatorId, operatorName } = req.body;
      const results = await treatmentService.batchImportPatients(
        patients,
        operatorId || 'admin',
        operatorName || '管理员'
      );
      res.json({ success: true, data: results });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/timeline', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const timeline = await treatmentService.getPatientTimeline(id);
      res.json({ success: true, data: timeline });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/batches', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const batches = await treatmentService.getPatientBatches(id);
      res.json({ success: true, data: batches });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/appointments', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const appointments = await treatmentService.getPatientAppointments(id);
      res.json({ success: true, data: appointments });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/todos', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const todos = await treatmentService.getPatientTodos(id);
      res.json({ success: true, data: todos });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/exceptions', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const exceptions = await treatmentService.getPatientExceptions(id);
      res.json({ success: true, data: exceptions });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.put('/:id/phase', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newPhase, newAligner, operatorId, operatorName, reason } = req.body;
      const patient = await treatmentService.updatePatientPhase(
        id,
        newPhase as TreatmentPhase,
        newAligner,
        operatorId || 'admin',
        operatorName || '管理员',
        reason
      );
      if (!patient) {
        return res.status(404).json({ success: false, error: 'Patient not found' });
      }
      res.json({ success: true, data: patient });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  router.get('/:id/history/:entityType/:entityId', async (req: Request, res: Response) => {
    try {
      const { entityType, entityId } = req.params;
      const history = await treatmentService.getModificationHistory(entityType, entityId);
      res.json({ success: true, data: history });
    } catch (error) {
      res.status(500).json({ success: false, error: (error as Error).message });
    }
  });

  return router;
};

export default createPatientRouter;
