const express = require('express');
const router = express.Router();
const { checkIdempotency } = require('../middleware/idempotency');

const consignorController = require('../controllers/consignorController');
const bookController = require('../controllers/bookController');
const saleController = require('../controllers/saleController');
const settlementController = require('../controllers/settlementController');

router.get('/consignors', consignorController.getConsignors);
router.get('/consignors/:id', consignorController.getConsignorById);
router.post('/consignors', checkIdempotency, consignorController.createConsignor);
router.put('/consignors/:id', consignorController.updateConsignor);
router.post('/consignors/batch', consignorController.batchImportConsignors);

router.get('/books', bookController.getBooks);
router.get('/books/:id', bookController.getBookById);
router.post('/books', checkIdempotency, bookController.createBook);
router.post('/books/evaluate', bookController.evaluateBook);
router.post('/books/price-reduction', bookController.requestPriceReduction);
router.post('/books/price-reduction/approve', bookController.approvePriceReduction);
router.post('/books/for-sale', bookController.markAsForSale);

router.get('/sales', saleController.getSales);
router.post('/sales', checkIdempotency, saleController.createSale);
router.post('/sales/exception', saleController.handleSaleException);
router.post('/returns', checkIdempotency, saleController.createReturn);
router.post('/returns/inspect', saleController.inspectReturn);

router.get('/settlements', settlementController.getSettlements);
router.get('/settlements/:id', settlementController.getSettlementById);
router.post('/settlements', settlementController.generateSettlement);
router.post('/settlements/:id/paid', settlementController.markSettlementPaid);
router.get('/settlements/:id/export', settlementController.exportSettlement);

module.exports = router;
