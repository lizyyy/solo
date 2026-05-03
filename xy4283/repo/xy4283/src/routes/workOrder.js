const express = require('express');
const router = express.Router();
const models = require('../models');
const services = require('../services');

/**
 * 派工单相关API路由
 */

// 获取所有派工单
router.get('/', async (req, res, next) => {
  try {
    const { status, priority } = req.query;
    
    let workOrders;
    
    if (status) {
      workOrders = await models.workOrder.getWorkOrdersByStatus(status);
    } else if (priority) {
      workOrders = await models.workOrder.getWorkOrdersByPriority(priority);
    } else {
      workOrders = await models.workOrder.getAllWorkOrders();
    }
    
    res.json({
      success: true,
      data: workOrders,
      count: workOrders.length
    });
  } catch (error) {
    next(error);
  }
});

// 根据ID获取派工单
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const workOrder = await models.workOrder.getWorkOrderById(id);
    
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: '派工单不存在'
      });
    }
    
    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    next(error);
  }
});

// 根据派工单号获取派工单
router.get('/code/:code', async (req, res, next) => {
  try {
    const { code } = req.params;
    const workOrder = await models.workOrder.getWorkOrderByCode(code);
    
    if (!workOrder) {
      return res.status(404).json({
        success: false,
        error: '派工单不存在'
      });
    }
    
    res.json({
      success: true,
      data: workOrder
    });
  } catch (error) {
    next(error);
  }
});

// 创建派工单
router.post('/', async (req, res, next) => {
  try {
    const workOrderData = req.body;
    
    // 校验必填字段
    const orderCode = workOrderData.order_code || workOrderData.work_order_code;
    
    if (!workOrderData.recall_match_id) {
      return res.status(400).json({
        success: false,
        error: '召回匹配ID不能为空'
      });
    }
    
    if (!workOrderData.deadline_date) {
      return res.status(400).json({
        success: false,
        error: '整改期限不能为空'
      });
    }
    
    // 检查召回匹配是否存在
    const recallMatch = await models.recallMatch.getRecallMatchById(workOrderData.recall_match_id);
    if (!recallMatch) {
      return res.status(404).json({
        success: false,
        error: '召回匹配记录不存在'
      });
    }
    
    // 检查器材是否已报废
    const equipment = await models.equipment.getEquipmentById(recallMatch.equipment_id);
    if (equipment && equipment.is_scrapped) {
      return res.status(400).json({
        success: false,
        error: '器材已报废，无法创建派工单'
      });
    }
    
    // 准备创建数据
    const createData = {
      recall_match_id: workOrderData.recall_match_id,
      order_code: orderCode,
      assigned_to: workOrderData.assigned_to,
      assigned_date: workOrderData.assigned_date,
      deadline_date: workOrderData.deadline_date,
      status: workOrderData.status,
      notes: workOrderData.notes || workOrderData.description
    };
    
    const workOrder = await models.workOrder.createWorkOrder(createData);
    
    res.status(201).json({
      success: true,
      data: workOrder,
      message: '派工单创建成功'
    });
  } catch (error) {
    next(error);
  }
});

// 更新派工单
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    // 检查派工单是否存在
    const existing = await models.workOrder.getWorkOrderById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '派工单不存在'
      });
    }
    
    const workOrder = await models.workOrder.updateWorkOrder(id, updateData);
    
    res.json({
      success: true,
      data: workOrder,
      message: '派工单更新成功'
    });
  } catch (error) {
    next(error);
  }
});

// 分配派工单
router.post('/:id/assign', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { assigned_to } = req.body;
    
    if (!assigned_to || !assigned_to.trim()) {
      return res.status(400).json({
        success: false,
        error: '分配人不能为空'
      });
    }
    
    const result = await services.stateMachine.assignWorkOrder(id, assigned_to);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.workOrder,
      message: '派工单分配成功'
    });
  } catch (error) {
    next(error);
  }
});

// 开始派工单
router.post('/:id/start', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    const result = await services.stateMachine.startWorkOrder(id);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.workOrder,
      message: '派工单开始成功'
    });
  } catch (error) {
    next(error);
  }
});

// 完成派工单
router.post('/:id/complete', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { completion_note } = req.body;
    
    const result = await services.stateMachine.completeWorkOrder(id, completion_note);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.workOrder,
      message: '派工单完成成功'
    });
  } catch (error) {
    next(error);
  }
});

// 取消派工单
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    
    const result = await services.stateMachine.cancelWorkOrder(id, cancel_reason);
    
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error
      });
    }
    
    res.json({
      success: true,
      data: result.workOrder,
      message: '派工单取消成功'
    });
  } catch (error) {
    next(error);
  }
});

// 获取派工单的状态历史
router.get('/:id/history', async (req, res, next) => {
  try {
    const { id } = req.params;
    
    // 检查派工单是否存在
    const existing = await models.workOrder.getWorkOrderById(id);
    if (!existing) {
      return res.status(404).json({
        success: false,
        error: '派工单不存在'
      });
    }
    
    const history = await models.statusHistory.getStatusHistoryByEntity('work_order', id);
    
    res.json({
      success: true,
      data: history,
      count: history.length
    });
  } catch (error) {
    next(error);
  }
});

// 获取派工单统计
router.get('/stats/summary', async (req, res, next) => {
  try {
    const stats = await models.workOrder.getWorkOrderStats();
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
