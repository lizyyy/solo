const express = require('express');
const ProductService = require('../services/productService');
const BatchService = require('../services/batchService');
const authMiddleware = require('../middleware/auth');
const logger = require('../utils/logger');

const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  try {
    const products = await ProductService.getAllProducts(req.query);
    
    res.status(200).json({
      products,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting products:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/categories', authMiddleware, async (req, res) => {
  try {
    const categories = await ProductService.getProductCategories();
    
    res.status(200).json({
      categories,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting categories:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.get('/:productId', authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const product = await ProductService.getProductById(productId);
    
    if (!product) {
      return res.status(404).json({
        error: 'Product not found',
        requestId: req.requestId
      });
    }
    
    res.status(200).json({
      product,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error getting product:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const productData = req.body;
    
    const newProduct = await ProductService.createProduct(
      productData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(201).json({
      product: newProduct,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error creating product:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

router.put('/:productId', authMiddleware, async (req, res) => {
  try {
    const { productId } = req.params;
    const updateData = req.body;
    
    const updatedProduct = await ProductService.updateProduct(
      productId,
      updateData,
      req.userId,
      req.clientId,
      req.requestId,
      req.ip,
      req.get('User-Agent')
    );
    
    res.status(200).json({
      product: updatedProduct,
      requestId: req.requestId
    });
  } catch (error) {
    logger.error('Error updating product:', error);
    res.status(500).json({
      error: error.message,
      requestId: req.requestId
    });
  }
});

module.exports = router;
