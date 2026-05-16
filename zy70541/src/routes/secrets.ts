import { Router } from 'express';
import secretController from '../controllers/SecretController';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  CreateSecretSchema,
  UpdateSecretStatusSchema,
  CreateReferenceSchema,
  RecordAccessSchema,
  CreateReplacementSchema,
  ApproveReplacementSchema,
  CreateCorrectionSchema,
  QuerySecretsSchema,
} from '../utils/validation';

const router = Router();

// Secret CRUD
router.post('/', validateBody(CreateSecretSchema), secretController.createSecret);
router.get('/', validateQuery(QuerySecretsSchema), secretController.querySecrets);
router.get('/reports/all', secretController.getAllReports);
router.get('/:name', secretController.getSecret);
router.put('/:name/status', validateBody(UpdateSecretStatusSchema), secretController.updateSecretStatus);
router.delete('/:name', secretController.deleteSecret);

// References
router.post('/:name/references', validateBody(CreateReferenceSchema), secretController.createReference);
router.get('/:name/references', secretController.getReferences);
router.post('/:name/access', validateBody(RecordAccessSchema), secretController.recordAccess);

// Replacement plans
router.post('/:name/replacements', validateBody(CreateReplacementSchema), secretController.createReplacement);
router.put('/replacements/:id/approve', validateBody(ApproveReplacementSchema), secretController.approveReplacement);
router.put('/replacements/:id/reject', validateBody(ApproveReplacementSchema), secretController.rejectReplacement);

// Corrections
router.post('/:name/corrections', validateBody(CreateCorrectionSchema), secretController.createCorrection);

// Reports
router.get('/:name/report', secretController.getLineageReport);
router.get('/:name/report/export', secretController.exportReportCSV);

export default router;
