const express = require('express');
const router = express.Router();

const segmentPoolRoutes = require('./segmentPoolRoutes');
const assignmentRoutes = require('./assignmentRoutes');
const voidRoutes = require('./voidRoutes');
const recoverRoutes = require('./recoverRoutes');
const reprintRoutes = require('./reprintRoutes');
const gapRoutes = require('./gapRoutes');
const reportRoutes = require('./reportRoutes');
const compensationRoutes = require('./compensationRoutes');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '统一收据号段API服务运行正常',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

router.use('/segment-pools', segmentPoolRoutes);
router.use('/assignments', assignmentRoutes);
router.use('/voids', voidRoutes);
router.use('/recovers', recoverRoutes);
router.use('/reprints', reprintRoutes);
router.use('/gaps', gapRoutes);
router.use('/reports', reportRoutes);
router.use('/compensations', compensationRoutes);

module.exports = router;
