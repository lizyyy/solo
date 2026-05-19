const express = require('express');
const router = express.Router();

const collectionRoutes = require('./collections');
const environmentRoutes = require('./environments');
const stepRoutes = require('./steps');
const batchRoutes = require('./batches');
const executionRoutes = require('./executions');
const exportRoutes = require('./exports');

router.use('/collections', collectionRoutes);
router.use('/environments', environmentRoutes);
router.use('/steps', stepRoutes);
router.use('/batches', batchRoutes);
router.use('/executions', executionRoutes);
router.use('/exports', exportRoutes);

module.exports = router;
