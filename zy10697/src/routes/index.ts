import { Router } from 'express';
import { SkipApplicationController, WorkflowController, ExportController } from '../controllers';

const router = Router();

router.post('/skip-applications', SkipApplicationController.create);
router.get('/skip-applications', SkipApplicationController.getAll);
router.get('/skip-applications/:id', SkipApplicationController.getById);
router.post('/skip-applications/approve', SkipApplicationController.approve);

router.post('/workflow/execute', WorkflowController.executeTask);
router.post('/workflow/downstream-exception', WorkflowController.reportDownstreamException);
router.get('/workflow/records', WorkflowController.getWorkflowRecords);
router.get('/workflow/can-close/:workflow_id', WorkflowController.checkCanClose);

router.post('/rerun', WorkflowController.createRerun);
router.post('/rerun/:rerun_id/start', WorkflowController.startRerun);
router.post('/rerun/:rerun_id/complete', WorkflowController.completeRerun);
router.get('/rerun', WorkflowController.getRerunRecords);

router.post('/export/skip-records', ExportController.exportSkipRecords);

export default router;