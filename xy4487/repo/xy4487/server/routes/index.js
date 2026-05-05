const express = require('express');
const router = express.Router();

const plotsRouter = require('./plots');
const machinesRouter = require('./machines');
const operatorsRouter = require('./operators');
const reservationsRouter = require('./reservations');
const subsidiesRouter = require('./subsidies');
const importRouter = require('./import');
const exportRouter = require('./export');
const validationRouter = require('./validation');

router.use('/plots', plotsRouter);
router.use('/machines', machinesRouter);
router.use('/operators', operatorsRouter);
router.use('/reservations', reservationsRouter);
router.use('/subsidies', subsidiesRouter);
router.use('/import', importRouter);
router.use('/export', exportRouter);
router.use('/validation', validationRouter);

router.get('/health', (req, res) => {
  res.json({ status: 'ok', message: '农机合作社管理工具 API 运行正常' });
});

module.exports = router;
