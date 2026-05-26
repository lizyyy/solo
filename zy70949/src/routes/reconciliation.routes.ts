import { Router } from 'express';
import multer = require('multer');
import { ReconciliationController } from '../controllers/reconciliation.controller';
import * as path from 'path';
import * as fs from 'fs';

const router = Router();
const controller = new ReconciliationController();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (file.fieldname === 'addItems') {
      if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
        cb(null, true);
      } else {
        cb(new Error('加项文件仅支持 CSV 格式'));
      }
    } else if (file.fieldname === 'packages' || file.fieldname === 'unitAgreements' || file.fieldname === 'coupons') {
      if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
        cb(null, true);
      } else {
        cb(new Error('配置文件仅支持 JSON 格式'));
      }
    } else {
      cb(null, true);
    }
  },
});

router.get('/health', (req, res) => controller.getHealthCheck(req, res));
router.get('/rules', (req, res) => controller.getRules(req, res));

router.post(
  '/upload',
  upload.fields([
    { name: 'addItems', maxCount: 1 },
    { name: 'packages', maxCount: 1 },
    { name: 'unitAgreements', maxCount: 1 },
    { name: 'coupons', maxCount: 1 },
  ]),
  (req, res) => controller.processFiles(req, res)
);

router.post('/process', (req, res) => controller.processInlineData(req, res));

export default router;
