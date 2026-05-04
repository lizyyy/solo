const express = require('express');
const router = express.Router();
const { Exception, Order, OrderItem, Product, InventoryBatch } = require('../models');
const { Op } = require('sequelize');
const exceptionService = require('../services/exceptionService');

router.get('/', async (req, res) => {
  try {
    const { status, type, order_id } = req.query;
    const filters = {};

    if (status) filters.status = status;
    if (type) filters.type = type;
    if (order_id) filters.orderId = order_id;

    const exceptions = await exceptionService.getExceptions(filters);

    res.json({
      success: true,
      data: exceptions
    });
  } catch (error) {
    console.error('获取异常列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取异常列表失败',
      error: error.message
    });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const stats = await exceptionService.getExceptionStatistics();

    res.json({
      success: true,
      ...stats
    });
  } catch (error) {
    console.error('获取异常统计失败:', error);
    res.status(500).json({
      success: false,
      message: '获取异常统计失败',
      error: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const exception = await Exception.findByPk(req.params.id, {
      include: [
        { 
          model: Order, 
          attributes: ['id', 'order_no', 'customer_name', 'customer_phone', 'status'] 
        },
        { 
          model: Product, 
          attributes: ['id', 'name', 'sku', 'unit', 'price'] 
        }
      ]
    });
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        message: '异常记录不存在'
      });
    }

    res.json({
      success: true,
      data: exception
    });
  } catch (error) {
    console.error('获取异常详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取异常详情失败',
      error: error.message
    });
  }
});

router.get('/:id/suggestions', async (req, res) => {
  try {
    const exception = await Exception.findByPk(req.params.id);
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        message: '异常记录不存在'
      });
    }

    const suggestions = [];

    if (exception.type === 'shortage' || exception.type === 'quality') {
      const refundSuggestion = await exceptionService.processRefundSuggestion(req.params.id);
      if (refundSuggestion.success) {
        suggestions.push(refundSuggestion.suggestion);
      }
    }

    if (exception.type === 'shortage') {
      const transferSuggestion = await exceptionService.processTransferSuggestion(req.params.id);
      if (transferSuggestion.success) {
        suggestions.push(transferSuggestion.suggestion);
      }
    }

    res.json({
      success: true,
      data: {
        exception: exception,
        suggestions: suggestions,
        count: suggestions.length
      }
    });
  } catch (error) {
    console.error('获取处理建议失败:', error);
    res.status(500).json({
      success: false,
      message: '获取处理建议失败',
      error: error.message
    });
  }
});

router.post('/', async (req, res) => {
  try {
    const { order_id, type, product_id, affected_quantity, description } = req.body;

    if (!order_id || !type) {
      return res.status(400).json({
        success: false,
        message: '订单ID和异常类型为必填项'
      });
    }

    const validTypes = ['shortage', 'expiry', 'quality', 'other'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        success: false,
        message: '无效的异常类型'
      });
    }

    const exception = await Exception.create({
      order_id,
      type,
      product_id,
      affected_quantity,
      description,
      action: 'pending',
      status: 'open'
    });

    res.status(201).json({
      success: true,
      message: '异常记录创建成功',
      data: exception
    });
  } catch (error) {
    console.error('创建异常记录失败:', error);
    res.status(500).json({
      success: false,
      message: '创建异常记录失败',
      error: error.message
    });
  }
});

router.put('/:id/resolve', async (req, res) => {
  try {
    const { action, action_detail } = req.body;

    if (!action) {
      return res.status(400).json({
        success: false,
        message: '处理方式为必填项'
      });
    }

    const validActions = ['transfer', 'refund', 'exchange', 'resolved'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        success: false,
        message: '无效的处理方式'
      });
    }

    const result = await exceptionService.resolveException(req.params.id, action, action_detail);

    if (!result.success) {
      return res.status(404).json(result);
    }

    res.json(result);
  } catch (error) {
    console.error('解决异常失败:', error);
    res.status(500).json({
      success: false,
      message: '解决异常失败',
      error: error.message
    });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const exception = await Exception.findByPk(req.params.id);
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        message: '异常记录不存在'
      });
    }

    const { status } = req.body;
    const validStatuses = ['open', 'processing', 'resolved', 'closed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: '无效的状态值'
      });
    }

    await exception.update({ status });

    res.json({
      success: true,
      message: `异常状态已更新为: ${status}`,
      data: exception
    });
  } catch (error) {
    console.error('更新异常状态失败:', error);
    res.status(500).json({
      success: false,
      message: '更新异常状态失败',
      error: error.message
    });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const exception = await Exception.findByPk(req.params.id);
    
    if (!exception) {
      return res.status(404).json({
        success: false,
        message: '异常记录不存在'
      });
    }

    if (exception.status !== 'resolved' && exception.status !== 'closed') {
      return res.status(400).json({
        success: false,
        message: '只有已解决或已关闭的异常记录可以删除'
      });
    }

    await exception.destroy();

    res.json({
      success: true,
      message: '异常记录已删除'
    });
  } catch (error) {
    console.error('删除异常记录失败:', error);
    res.status(500).json({
      success: false,
      message: '删除异常记录失败',
      error: error.message
    });
  }
});

module.exports = router;
