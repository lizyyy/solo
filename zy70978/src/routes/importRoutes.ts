import { Router } from 'express';
import multer from 'multer';
import * as importController from '../controllers/importController';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post('/rental-orders', upload.single('file'), importController.importRentalOrders);
router.post('/repair-records', importController.importRepairRecords);
router.post('/deposit-rules', importController.importDepositRules);

export default router;
