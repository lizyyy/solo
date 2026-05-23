const express = require('express');
const router = express.Router();
const { Parser } = require('json2csv');
const moment = require('moment');
const { 
  StoreDAO, 
  ProductDAO, 
  PriceVersionDAO, 
  PromotionWindowDAO, 
  DiscrepancyReportDAO, 
  ConfirmationDAO,
  ManualCorrectionDAO
} = require('../database/dao');
const { successResponse } = require('../utils/response');
const { logException } = require('../middleware/exceptionHandler');

const storeDAO = new StoreDAO();
const productDAO = new ProductDAO();
const priceVersionDAO = new PriceVersionDAO();
const promotionWindowDAO = new PromotionWindowDAO();
const discrepancyReportDAO = new DiscrepancyReportDAO();
const confirmationDAO = new ConfirmationDAO();
const manualCorrectionDAO = new ManualCorrectionDAO();

function exportAsCsv(res, data, fields, filename) {
  const json2csvParser = new Parser({ fields });
  const csv = json2csvParser.parse(data);
  
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Pragma', 'no-cache');
  
  res.status(200).send('\uFEFF' + csv);
}

router.get('/stores', async (req, res, next) => {
  try {
    const stores = await storeDAO.findAll();
    const fields = ['id', 'store_code', 'store_name', 'address', 'manager', 'phone', 'status', 'created_at'];
    const filename = `stores_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, stores, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_stores_failed');
    next(err);
  }
});

router.get('/products', async (req, res, next) => {
  try {
    const products = await productDAO.findAll();
    const fields = ['id', 'barcode', 'product_name', 'category', 'base_price', 'unit', 'created_at'];
    const filename = `products_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, products, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_products_failed');
    next(err);
  }
});

router.get('/price-versions', async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    let params = [];
    if (status) {
      where = 'status = ?';
      params.push(status);
    }
    
    const priceVersions = await priceVersionDAO.findAll(where, params);
    const fields = ['id', 'version_code', 'version_name', 'barcode', 'price', 'price_type', 'status', 'effective_start', 'effective_end', 'created_by', 'created_at'];
    const filename = `price_versions_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, priceVersions, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_price_versions_failed');
    next(err);
  }
});

router.get('/promotions', async (req, res, next) => {
  try {
    const { status } = req.query;
    let where = '';
    let params = [];
    if (status) {
      where = 'status = ?';
      params.push(status);
    }
    
    const promotions = await promotionWindowDAO.findAll(where, params);
    const fields = ['id', 'promotion_code', 'promotion_name', 'price_version_id', 'start_time', 'end_time', 'store_codes', 'status', 'created_by', 'created_at'];
    const filename = `promotions_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, promotions, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_promotions_failed');
    next(err);
  }
});

router.get('/discrepancies', async (req, res, next) => {
  try {
    const { status, store_code } = req.query;
    let where = '';
    let params = [];
    
    if (status) {
      where += 'status = ?';
      params.push(status);
    }
    if (store_code) {
      where += where ? ' AND ' : '';
      where += 'store_code = ?';
      params.push(store_code);
    }
    
    const discrepancies = await discrepancyReportDAO.findAll(where, params);
    const fields = ['id', 'report_code', 'store_code', 'barcode', 'price_version_id', 'expected_price', 'actual_price', 'discrepancy_type', 'status', 'reported_by', 'reviewed_by', 'review_time', 'resolution', 'remarks', 'created_at'];
    const filename = `discrepancies_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, discrepancies, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_discrepancies_failed');
    next(err);
  }
});

router.get('/confirmations', async (req, res, next) => {
  try {
    const confirmations = await confirmationDAO.findAll();
    const fields = ['id', 'confirmation_code', 'store_code', 'price_version_id', 'confirmer', 'confirmation_time', 'status', 'remarks', 'created_at'];
    const filename = `confirmations_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, confirmations, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_confirmations_failed');
    next(err);
  }
});

router.get('/corrections', async (req, res, next) => {
  try {
    const corrections = await manualCorrectionDAO.findAll();
    const fields = ['id', 'correction_code', 'discrepancy_id', 'store_code', 'barcode', 'old_price', 'new_price', 'corrected_by', 'correction_time', 'reason', 'status', 'created_at'];
    const filename = `corrections_${moment().format('YYYYMMDDHHmmss')}.csv`;
    exportAsCsv(res, corrections, fields, filename);
  } catch (err) {
    await logException(req, err, 'export_corrections_failed');
    next(err);
  }
});

router.get('/report/summary', async (req, res, next) => {
  try {
    const { start_date, end_date, store_code } = req.query;
    
    const [stores, products, priceVersions, promotions, discrepancies, confirmations, corrections] = await Promise.all([
      storeDAO.findAll(),
      productDAO.findAll(),
      priceVersionDAO.findAll(),
      promotionWindowDAO.findAll(),
      discrepancyReportDAO.findAll(),
      confirmationDAO.findAll(),
      manualCorrectionDAO.findAll()
    ]);

    const summary = {
      total_stores: stores.length,
      total_products: products.length,
      total_price_versions: priceVersions.length,
      active_price_versions: priceVersions.filter(p => p.status === 'active').length,
      total_promotions: promotions.length,
      active_promotions: promotions.filter(p => p.status === 'active').length,
      expired_promotions: promotions.filter(p => p.status === 'expired').length,
      total_discrepancies: discrepancies.length,
      pending_discrepancies: discrepancies.filter(d => d.status === 'pending_review').length,
      reviewed_discrepancies: discrepancies.filter(d => d.status === 'reviewed').length,
      compensated_discrepancies: discrepancies.filter(d => d.status === 'compensated').length,
      rejected_discrepancies: discrepancies.filter(d => d.status === 'rejected').length,
      total_confirmations: confirmations.length,
      total_corrections: corrections.length
    };

    return successResponse(res, summary, '汇总报告生成成功');
  } catch (err) {
    await logException(req, err, 'export_summary_failed');
    next(err);
  }
});

module.exports = router;
