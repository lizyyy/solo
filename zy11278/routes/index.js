const express = require('express');
const router = express.Router();

const tradingDayController = require('../controllers/TradingDayController');
const tradingController = require('../controllers/TradingController');
const importController = require('../controllers/ImportController');
const exportController = require('../controllers/ExportController');
const positionController = require('../controllers/PositionController');
const riskController = require('../controllers/RiskController');
const reviewNoteController = require('../controllers/ReviewNoteController');
const watchlistController = require('../controllers/WatchlistController');

const multer = require('multer');
const upload = multer({ dest: 'uploads/' });

router.get('/', (req, res) => {
  res.json({
    success: true,
    message: '股票模拟交易复盘和风控预警台 API',
    version: '1.0.0'
  });
});

router.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'API 入口',
    endpoints: [
      '/api/trading-day - 交易日管理',
      '/api/trading - 交易执行',
      '/api/import - 数据导入',
      '/api/export - 报告导出',
      '/api/position - 持仓管理',
      '/api/risk - 风险预警',
      '/api/review-note - 复盘笔记',
      '/api/watchlist - 自选股管理'
    ]
  });
});

router.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

router.get('/api/trading-day/current', tradingDayController.getCurrent);
router.get('/api/trading-day/active', tradingDayController.getActive);
router.get('/api/trading-day/:id', tradingDayController.getById);
router.get('/api/trading-day', tradingDayController.list);
router.post('/api/trading-day', tradingDayController.create);
router.post('/api/trading-day/:id/open', tradingDayController.open);
router.post('/api/trading-day/:id/close', tradingDayController.close);
router.post('/api/trading-day/:id/review', tradingDayController.review);
router.get('/api/trading-day/:id/portfolio-summary', tradingDayController.getPortfolioSummary);

router.post('/api/trading/buy', tradingController.executeBuy);
router.post('/api/trading/sell', tradingController.executeSell);
router.post('/api/trading/order/:id/cancel', tradingController.cancelOrder);
router.post('/api/trading/order/:id/partial-fill', tradingController.executePartialFill);
router.get('/api/trading/orders', tradingController.getOrders);
router.get('/api/trading/orders/:id', tradingController.getOrderById);
router.get('/api/trading/history', tradingController.getTradeHistory);
router.get('/api/trading/statistics', tradingController.getTradeStatistics);

router.post('/api/import/quotes', upload.single('file'), importController.importQuotesCSV);
router.post('/api/import/trade-plan', importController.importTradePlanJSON);
router.post('/api/import/trade-plan/file', upload.single('file'), importController.importTradePlanFromFile);
router.get('/api/import/quotes', importController.getQuotes);
router.get('/api/import/quotes/:trading_day_id/:symbol', importController.getQuoteBySymbol);
router.get('/api/import/trade-plans', importController.getTradePlans);
router.post('/api/import/trade-plan', importController.createTradePlan);
router.put('/api/import/trade-plan/:id', importController.updateTradePlan);

router.get('/api/export/report/:trading_day_id/preview', exportController.getReportPreview);
router.get('/api/export/report/:trading_day_id/markdown', exportController.exportToMarkdown);
router.get('/api/export/report/:trading_day_id/html', exportController.exportToHTML);
router.get('/api/export/report/:trading_day_id/csv', exportController.exportToCSV);

router.get('/api/position', positionController.getPositions);
router.get('/api/position/all', positionController.getAllPositions);
router.get('/api/position/metrics', positionController.getPortfolioMetrics);
router.post('/api/position/metrics/:trading_day_id/update', positionController.updateTradingDayMetrics);
router.get('/api/position/cash', positionController.getCashAccount);

router.get('/api/risk/alerts', riskController.getAlerts);
router.get('/api/risk/alerts/:id', riskController.getAlertById);
router.post('/api/risk/alerts/:id/acknowledge', riskController.acknowledgeAlert);
router.post('/api/risk/alerts/:id/resolve', riskController.resolveAlert);
router.post('/api/risk/check/:trading_day_id', riskController.runChecks);

router.get('/api/review-note', reviewNoteController.getNotes);
router.get('/api/review-note/:id', reviewNoteController.getNoteById);
router.post('/api/review-note', reviewNoteController.createNote);
router.put('/api/review-note/:id', reviewNoteController.updateNote);
router.delete('/api/review-note/:id', reviewNoteController.deleteNote);

router.get('/api/watchlist', watchlistController.getWatchlist);
router.post('/api/watchlist', watchlistController.addToWatchlist);
router.put('/api/watchlist/:id', watchlistController.updateWatchlistItem);
router.delete('/api/watchlist/:id', watchlistController.removeFromWatchlist);
router.post('/api/watchlist/bulk-import', watchlistController.bulkImport);

module.exports = router;
