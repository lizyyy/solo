const { db } = require('../database/db');
const Agreement = require('../models/Agreement');
const Project = require('../models/Project');
const Order = require('../models/Order');
const AmountRecord = require('../models/AmountRecord');

class OrderService {
  static reserveForProject(projectId, amount) {
    const project = Project.findById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }
    
    if (project.status !== 'active') {
      throw new Error('项目状态无效');
    }
    
    const agreement = Agreement.findById(project.agreement_id);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    if (agreement.status !== 'active') {
      throw new Error('协议状态无效');
    }
    
    if (amount <= 0) {
      throw new Error('预留金额必须大于0');
    }
    
    const transaction = db.transaction(() => {
      const currentAgreement = Agreement.findById(project.agreement_id);
      const available = Agreement.getAvailableAmount(currentAgreement.id);
      
      if (available < amount) {
        throw new Error(`协议可用额度不足: 可用 ${available}, 需要 ${amount}`);
      }
      
      Agreement.update(project.agreement_id, {
        reservedAmount: currentAgreement.reserved_amount + amount
      });
      
      Project.update(projectId, {
        reservedAmount: project.reserved_amount + amount
      });
      
      const newAvailable = available - amount;
      AmountRecord.create({
        agreementId: project.agreement_id,
        projectId: projectId,
        type: 'reserve_project',
        amount: amount,
        balance: newAvailable,
        description: `项目 "${project.name}" 预留额度: ${amount}`
      });
      
      return {
        success: true,
        agreementReserved: currentAgreement.reserved_amount + amount,
        projectReserved: project.reserved_amount + amount,
        remainingAvailable: newAvailable
      };
    });
    
    try {
      return transaction();
    } catch (error) {
      throw error;
    }
  }

  static createOrder({ projectId, amount, description }) {
    const project = Project.findById(projectId);
    if (!project) {
      throw new Error('项目不存在');
    }
    
    if (project.status !== 'active') {
      throw new Error('项目状态无效');
    }
    
    const agreement = Agreement.findById(project.agreement_id);
    if (!agreement) {
      throw new Error('协议不存在');
    }
    
    if (agreement.status !== 'active') {
      throw new Error('协议状态无效');
    }
    
    if (amount <= 0) {
      throw new Error('订单金额必须大于0');
    }
    
    const transaction = db.transaction(() => {
      const currentProject = Project.findById(projectId);
      const projectAvailable = currentProject.reserved_amount - currentProject.used_amount;
      
      if (projectAvailable < amount) {
        throw new Error(`项目可用额度不足: 可用 ${projectAvailable}, 需要 ${amount}`);
      }
      
      const order = Order.create({
        projectId,
        agreementId: project.agreement_id,
        amount,
        description
      });
      
      Project.update(projectId, {
        reservedAmount: currentProject.reserved_amount - amount,
        usedAmount: currentProject.used_amount + amount
      });
      
      const currentAgreement = Agreement.findById(project.agreement_id);
      Agreement.update(project.agreement_id, {
        reservedAmount: currentAgreement.reserved_amount - amount,
        usedAmount: currentAgreement.used_amount + amount
      });
      
      const remainingAvailable = currentAgreement.total_amount - 
        (currentAgreement.reserved_amount - amount) - 
        (currentAgreement.used_amount + amount);
      
      AmountRecord.create({
        agreementId: project.agreement_id,
        projectId: projectId,
        orderId: order.id,
        type: 'order_reserve',
        amount: amount,
        balance: remainingAvailable,
        description: `订单占用: ${description || '未命名订单'}, 金额: ${amount}`
      });
      
      return {
        ...order,
        projectRemaining: currentProject.reserved_amount - currentProject.used_amount - amount,
        agreementRemaining: remainingAvailable
      };
    });
    
    try {
      return transaction();
    } catch (error) {
      throw error;
    }
  }

  static releaseOrder(orderId) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    
    if (order.status !== 'reserved') {
      throw new Error('只有预留状态的订单可以释放');
    }
    
    const transaction = db.transaction(() => {
      const currentOrder = Order.findById(orderId);
      if (currentOrder.status !== 'reserved') {
        throw new Error('订单状态已变更，无法释放');
      }
      
      const project = Project.findById(currentOrder.project_id);
      Project.update(currentOrder.project_id, {
        reservedAmount: project.reserved_amount + currentOrder.amount,
        usedAmount: project.used_amount - currentOrder.amount
      });
      
      const agreement = Agreement.findById(currentOrder.agreement_id);
      Agreement.update(currentOrder.agreement_id, {
        reservedAmount: agreement.reserved_amount + currentOrder.amount,
        usedAmount: agreement.used_amount - currentOrder.amount
      });
      
      Order.update(orderId, { status: 'released' });
      
      const remainingAvailable = agreement.total_amount - 
        (agreement.reserved_amount + currentOrder.amount) - 
        (agreement.used_amount - currentOrder.amount);
      
      AmountRecord.create({
        agreementId: currentOrder.agreement_id,
        projectId: currentOrder.project_id,
        orderId: orderId,
        type: 'order_release',
        amount: currentOrder.amount,
        balance: remainingAvailable,
        description: `订单释放: 金额 ${currentOrder.amount}`
      });
      
      return {
        success: true,
        orderId: orderId,
        releasedAmount: currentOrder.amount
      };
    });
    
    try {
      return transaction();
    } catch (error) {
      throw error;
    }
  }

  static confirmOrder(orderId) {
    const order = Order.findById(orderId);
    if (!order) {
      throw new Error('订单不存在');
    }
    
    if (order.status !== 'reserved') {
      throw new Error('只有预留状态的订单可以确认');
    }
    
    const transaction = db.transaction(() => {
      const currentOrder = Order.findById(orderId);
      if (currentOrder.status !== 'reserved') {
        throw new Error('订单状态已变更，无法确认');
      }
      
      Order.update(orderId, { status: 'confirmed' });
      
      AmountRecord.create({
        agreementId: currentOrder.agreement_id,
        projectId: currentOrder.project_id,
        orderId: orderId,
        type: 'order_confirm',
        amount: 0,
        balance: Agreement.getAvailableAmount(currentOrder.agreement_id),
        description: `订单确认: ${currentOrder.description || '未命名订单'}`
      });
      
      return {
        success: true,
        orderId: orderId,
        confirmedAmount: currentOrder.amount
      };
    });
    
    try {
      return transaction();
    } catch (error) {
      throw error;
    }
  }

  static getOrder(id) {
    const order = Order.findById(id);
    if (!order) {
      throw new Error('订单不存在');
    }
    return order;
  }

  static getOrdersByProject(projectId) {
    return Order.findByProjectId(projectId);
  }

  static getOrdersByAgreement(agreementId) {
    return Order.findByAgreementId(agreementId);
  }
}

module.exports = OrderService;
