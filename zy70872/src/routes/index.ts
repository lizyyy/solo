import { Router } from 'express';
import multer from 'multer';
import { BatchController } from '../controllers/BatchController';
import { QueryController } from '../controllers/QueryController';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

const batchController = new BatchController();
const queryController = new QueryController();

// 批次管理
router.post('/batches', (req, res) => batchController.createBatch(req, res));
router.get('/batches', (req, res) => batchController.listBatches(req, res));
router.get('/batches/:batchId', (req, res) => batchController.getBatch(req, res));

// 文件上传
router.post('/batches/:batchId/showtimes', upload.single('file'), (req, res) => 
  batchController.uploadShowtimes(req, res));
router.post('/batches/:batchId/boxoffice', upload.single('file'), (req, res) => 
  batchController.uploadBoxOffice(req, res));

// 记录处理
router.post('/records/:recordId/approve', (req, res) => batchController.approveRecord(req, res));
router.post('/records/:recordId/return', (req, res) => batchController.returnRecord(req, res));
router.post('/batches/:batchId/approve', (req, res) => batchController.approveBatch(req, res));

// 查询功能
router.get('/records', (req, res) => queryController.queryRecords(req, res));
router.get('/records/:recordId', (req, res) => queryController.getRecordDetail(req, res));

// 导出功能
router.get('/export', (req, res) => queryController.exportRecords(req, res));

// 合同管理
router.post('/contracts', (req, res) => queryController.createContract(req, res));
router.get('/contracts', (req, res) => queryController.listContracts(req, res));

// 统计信息
router.get('/statistics/boundary', (req, res) => queryController.getBoundaryStatistics(req, res));

export default router;
