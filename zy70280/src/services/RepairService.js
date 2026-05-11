const { RepairOrder, Valve, ImpactAnalysis, Pipe } = require('../models');
const ImpactService = require('./ImpactService');

class RepairService {
  static async createOrder(data) {
    const order = await RepairOrder.create({
      id: `WO${Date.now().toString().slice(-10)}`,
      ...data,
      status: 'pending'
    });
    
    return order;
  }
  
  static async assignOrder(orderId, assignedTo) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    if (order.status !== 'pending') {
      throw new Error('只有待处理工单才能指派');
    }
    
    await order.update({
      status: 'assigned',
      assignedTo,
      assignedTime: new Date()
    });
    
    return order;
  }
  
  static async startRepair(orderId, estimatedEndTime) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    if (order.status !== 'assigned') {
      throw new Error('只有已指派工单才能开始');
    }
    
    if (!order.impactAnalysisId) {
      throw new Error('请先完成影响分析并关闭阀门');
    }
    
    await order.update({
      status: 'in_progress',
      startTime: new Date(),
      estimatedEndTime: estimatedEndTime || null
    });
    
    return order;
  }
  
  static async submitForReview(orderId, repairNotes) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    if (order.status !== 'in_progress') {
      throw new Error('只有进行中的工单才能提交复核');
    }
    
    await order.update({
      status: 'waiting_review',
      repairNotes: repairNotes || null
    });
    
    return order;
  }
  
  static async completeOrder(orderId, reviewNotes, reviewedBy) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    if (order.status !== 'waiting_review') {
      throw new Error('只有待复核工单才能完成');
    }
    
    if (order.closedValveIds) {
      const valveIds = JSON.parse(order.closedValveIds || '[]');
      for (const valveId of valveIds) {
        const valve = await Valve.findByPk(valveId);
        if (valve) {
          await valve.update({ status: 'open' });
        }
      }
    }
    
    await order.update({
      status: 'completed',
      actualEndTime: new Date(),
      reviewNotes: reviewNotes || null,
      reviewedBy,
      reviewedTime: new Date()
    });
    
    return order;
  }
  
  static async cancelOrder(orderId, cancelReason) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) {
      throw new Error('抢修工单不存在');
    }
    
    if (['completed', 'cancelled'].includes(order.status)) {
      throw new Error('已完成或已取消的工单不能再次取消');
    }
    
    if (order.closedValveIds) {
      const valveIds = JSON.parse(order.closedValveIds || '[]');
      for (const valveId of valveIds) {
        const valve = await Valve.findByPk(valveId);
        if (valve && valve.status === 'closed') {
          await valve.update({ status: 'open' });
        }
      }
    }
    
    await order.update({
      status: 'cancelled',
      reviewNotes: cancelReason || null
    });
    
    return order;
  }
  
  static async getAllOrders(options = {}) {
    const where = {};
    if (options.status) {
      where.status = options.status;
    }
    if (options.priority) {
      where.priority = options.priority;
    }
    
    return await RepairOrder.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });
  }
  
  static async getOrderById(orderId) {
    return await RepairOrder.findByPk(orderId);
  }
  
  static async getOrderWithDetails(orderId) {
    const order = await RepairOrder.findByPk(orderId);
    if (!order) return null;
    
    const analysis = order.impactAnalysisId 
      ? await ImpactAnalysis.findByPk(order.impactAnalysisId)
      : null;
    
    const pipe = order.affectedPipeId
      ? await Pipe.findByPk(order.affectedPipeId)
      : null;
    
    return {
      order,
      analysis,
      pipe
    };
  }
}

module.exports = RepairService;