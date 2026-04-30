const express = require('express');
const router = express.Router();
const { 
  canTransition, 
  getNextStatuses, 
  getStatusColor, 
  generateTicketNumber,
  getAllTickets,
  getTicketById,
  createTicket,
  updateTicket,
  changeTicketStatus,
  getStatistics
} = require('../database');

function validateTicket(data, isUpdate = false) {
  const errors = [];
  
  if (!isUpdate || data.customer_name !== undefined) {
    if (!data.customer_name || data.customer_name.trim() === '') {
      errors.push('客户姓名不能为空');
    }
  }
  
  if (!isUpdate || data.customer_phone !== undefined) {
    if (!data.customer_phone || data.customer_phone.trim() === '') {
      errors.push('手机号不能为空');
    } else if (!/^1[3-9]\d{9}$/.test(data.customer_phone.trim())) {
      errors.push('请输入有效的手机号');
    }
  }
  
  if (!isUpdate || data.device_model !== undefined) {
    if (!data.device_model || data.device_model.trim() === '') {
      errors.push('设备型号不能为空');
    }
  }
  
  if (!isUpdate || data.fault_description !== undefined) {
    if (!data.fault_description || data.fault_description.trim() === '') {
      errors.push('故障描述不能为空');
    }
  }
  
  if (data.quote_amount !== undefined) {
    if (data.quote_amount < 0) {
      errors.push('报价金额不能为负数');
    }
  }
  
  return errors;
}

router.get('/', (req, res) => {
  try {
    const { status, search, start_date, end_date } = req.query;
    
    const options = {};
    if (status && status !== '') options.status = status;
    if (search && search.trim() !== '') options.search = search;
    if (start_date) options.start_date = start_date;
    if (end_date) options.end_date = end_date;
    
    const tickets = getAllTickets(options);
    
    res.json({
      success: true,
      data: tickets
    });
  } catch (err) {
    console.error('获取工单列表失败:', err);
    res.status(500).json({
      success: false,
      error: '获取工单列表失败',
      message: err.message
    });
  }
});

router.get('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const ticket = getTicketById(id);
    
    if (!ticket) {
      return res.status(404).json({
        success: false,
        error: '工单不存在',
        message: `未找到 ID 为 ${id} 的工单`
      });
    }
    
    res.json({
      success: true,
      data: ticket
    });
  } catch (err) {
    console.error('获取工单详情失败:', err);
    res.status(500).json({
      success: false,
      error: '获取工单详情失败',
      message: err.message
    });
  }
});

router.post('/', (req, res) => {
  try {
    const errors = validateTicket(req.body);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '数据验证失败',
        messages: errors
      });
    }
    
    const newTicket = createTicket(req.body);
    
    res.status(201).json({
      success: true,
      data: newTicket,
      message: '工单创建成功'
    });
  } catch (err) {
    console.error('创建工单失败:', err);
    res.status(500).json({
      success: false,
      error: '创建工单失败',
      message: err.message
    });
  }
});

router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    
    const existingTicket = getTicketById(id);
    
    if (!existingTicket) {
      return res.status(404).json({
        success: false,
        error: '工单不存在',
        message: `未找到 ID 为 ${id} 的工单`
      });
    }
    
    const errors = validateTicket(req.body, true);
    
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        error: '数据验证失败',
        messages: errors
      });
    }
    
    const updatedTicket = updateTicket(id, req.body);
    
    res.json({
      success: true,
      data: updatedTicket,
      message: '工单更新成功'
    });
  } catch (err) {
    console.error('更新工单失败:', err);
    res.status(500).json({
      success: false,
      error: '更新工单失败',
      message: err.message
    });
  }
});

router.post('/:id/status', (req, res) => {
  try {
    const { id } = req.params;
    const { new_status, reason } = req.body;
    
    if (!new_status) {
      return res.status(400).json({
        success: false,
        error: '请指定目标状态'
      });
    }
    
    const result = changeTicketStatus(id, new_status, reason);
    
    if (result.success) {
      res.json({
        success: true,
        data: result.data,
        message: `状态已变更为"${new_status}"`
      });
    } else {
      res.status(400).json(result);
    }
  } catch (err) {
    console.error('更新状态失败:', err);
    res.status(500).json({
      success: false,
      error: '更新状态失败',
      message: err.message
    });
  }
});

router.get('/statistics/summary', (req, res) => {
  try {
    const summary = getStatistics();
    
    res.json({
      success: true,
      data: summary
    });
  } catch (err) {
    console.error('获取统计信息失败:', err);
    res.status(500).json({
      success: false,
      error: '获取统计信息失败',
      message: err.message
    });
  }
});

module.exports = router;
