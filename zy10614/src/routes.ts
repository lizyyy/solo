import express from 'express';
import multer from 'multer';
import { candidateController } from './controllers/candidate.controller';

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/candidates', candidateController.create.bind(candidateController));
router.get('/candidates', candidateController.list.bind(candidateController));
router.get('/candidates/:id', candidateController.get.bind(candidateController));
router.put('/candidates/:id', candidateController.update.bind(candidateController));

router.post('/candidates/review', candidateController.review.bind(candidateController));

router.get('/candidates/:id/history', candidateController.getHistory.bind(candidateController));
router.get('/merge-history', candidateController.getAllHistory.bind(candidateController));

router.post('/import', upload.single('file'), candidateController.importCsv.bind(candidateController));
router.get('/import', candidateController.getImportRecords.bind(candidateController));
router.get('/import/:id', candidateController.getImportRecord.bind(candidateController));

router.get('/export/csv', candidateController.exportCsv.bind(candidateController));
router.get('/export/json', candidateController.exportJson.bind(candidateController));

export default router;
