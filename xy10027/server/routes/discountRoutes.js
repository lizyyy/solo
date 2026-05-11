const express = require('express');
const DiscountService = require('../services/discountService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const filters = {
      storeId: req.query.storeId,
      status: req.query.status,
      active: req.query.active === 'true'
    };
    
    const sales = await DiscountService.getDiscountSales(filters);
    
    res.status(200).json({
      sales,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting discount sales:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/store/:storeId/active', authMiddleware, async (req, res) => {
  try {
    const { storeId } = req.params;
    
    const sales = await DiscountService.getActiveDiscounts(storeId);
    
    res.status(200).json({
      sales,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting active discounts:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:saleId', authMiddleware, async (req, res) => {
  try {
    const { saleId } = req.params;
    const sale = await DiscountService.getDiscountSaleById(saleId);
    
    if (!sale) {
      return res.status(404).json({
        error: 'Discount sale not found',
        requestId: req.requestId
      });
    }
    
    const items = await DiscountService.getDiscountSaleItems(saleId);
    
    res.status(200).json({
      sale,
      items,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting discount sale:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const saleData = req.body;
    
    const newSale = await DiscountService.createDiscountSale(
      saleData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      sale: newSale,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating discount sale:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:saleId/activate', authMiddleware, async (req, res) => {
  try {
    const { saleId } = req.params;
    
    const updatedSale = await DiscountService.activateDiscountSale(
      saleId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      sale: updatedSale,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error activating discount sale:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/:saleId/deactivate', authMiddleware, async (req, res) => {
  try {
    const { saleId } = req.params;
    
    const updatedSale = await DiscountService.deactivateDiscountSale(
      saleId,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      sale: updatedSale,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error deactivating discount sale:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
