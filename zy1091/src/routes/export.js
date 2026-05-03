const express = require('express');
const router = express.Router();
const { ExportController } = require('../controllers');

// JSON 导出
router.get('/json', ExportController.exportJSON);

// Markdown 导出
router.get('/markdown', ExportController.exportMarkdown);

// 余额汇总 - JSON
router.get('/balance/json', ExportController.getBalanceSummaryJSON);

// 余额汇总 - Markdown
router.get('/balance/markdown', ExportController.getBalanceSummaryMarkdown);

// 室友对账单 - JSON
router.get('/statement/:flatmate_id/json', ExportController.getFlatmateStatementJSON);

// 室友对账单 - Markdown
router.get('/statement/:flatmate_id/markdown', ExportController.getFlatmateStatementMarkdown);

module.exports = router;
