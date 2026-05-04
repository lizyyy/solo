const { Exception, Order, OrderItem, Product, InventoryBatch } = require('../models');
const { Op } = require('sequelize');
const dayjs = require('dayjs');

const createException = async (exceptionData) => {
  const exception = await Exception.create({
    order_id: exceptionData.orderId,
    type: exceptionData.type,
    product_id: exceptionData.productId,
    affected_quantity: exceptionData.affectedQuantity,
    description: exceptionData.description,
    action: 'pending',
    status: 'open'
  });

  return exception;
};

const getExceptions = async (filters = {}) => {
  const whereClause = {};
  
  if (filters.status) {
    whereClause.status = filters.status;
  }
  if (filters.type) {
    whereClause.type = filters.type;
  }
  if (filters.orderId) {
    whereClause.order_id = filters.orderId;
  }

  const exceptions = await Exception.findAll({
    where: whereClause,
    include: [
      { model: Order, attributes: ['id', 'order_no', 'customer_name', 'status'] },
      { model: Product, attributes: ['id', 'name', 'sku', 'unit'] }
    ],
    order: [['created_at', 'DESC']]
  });

  return exceptions;
};

const processRefundSuggestion = async (exceptionId) => {
  const exception = await Exception.findByPk(exceptionId, {
    include: [Order, OrderItem, Product]
  });

  if (!exception) {
    return { success: false, message: '异常记录不存在' };
  }

  if (exception.type !== 'shortage' && exception.type !== 'quality') {
    return { 
      success: false, 
      message: '只有缺货和质量问题类型可以建议退款' 
    };
  }

  const orderItem = await OrderItem.findOne({
    where: {
      order_id: exception.order_id,
      product_id: exception.product_id
    }
  });

  if (!orderItem) {
    return { success: false, message: '订单项不存在' };
  }

  const refundAmount = orderItem.unit_price * exception.affected_quantity;

  return {
    success: true,
    suggestion: {
      type: 'refund',
      exceptionId: exception.id,
      orderId: exception.order_id,
      product: exception.Product?.name,
      affectedQuantity: exception.affected_quantity,
      unitPrice: orderItem.unit_price,
      refundAmount: refundAmount.toFixed(2),
      description: `建议退款 ${exception.affected_quantity}${exception.Product?.unit || ''} ${exception.Product?.name}，金额 ¥${refundAmount.toFixed(2)}`
    }
  };
};

const processTransferSuggestion = async (exceptionId) => {
  const exception = await Exception.findByPk(exceptionId, {
    include: [Order, Product]
  });

  if (!exception) {
    return { success: false, message: '异常记录不存在' };
  }

  if (exception.type !== 'shortage') {
    return { 
      success: false, 
      message: '只有缺货类型可以建议调拨' 
    };
  }

  const availableInventory = await InventoryBatch.findAll({
    where: {
      product_id: exception.product_id,
      status: { [Op.in]: ['in_stock', 'partial_allocated'] },
      quantity: { [Op.gt]: sequelize.col('allocated_quantity') }
    },
    include: [Product]
  });

  const totalAvailable = availableInventory.reduce((sum, inv) => 
    sum + (inv.quantity - inv.allocated_quantity), 0);

  const canTransfer = totalAvailable >= exception.affected_quantity;

  return {
    success: true,
    suggestion: {
      type: 'transfer',
      exceptionId: exception.id,
      orderId: exception.order_id,
      product: exception.Product?.name,
      requiredQuantity: exception.affected_quantity,
      availableQuantity: totalAvailable,
      canTransfer,
      availableBatches: availableInventory.map(inv => ({
        batchNo: inv.batch_no,
        available: inv.quantity - inv.allocated_quantity,
        expiryDate: inv.expiry_date,
        isExpiring: inv.expiry_date && dayjs(inv.expiry_date).diff(dayjs(), 'day') <= 7
      })),
      description: canTransfer 
        ? `可以从其他批次调拨 ${exception.affected_quantity}${exception.Product?.unit || ''}` 
        : `库存不足，需要 ${exception.affected_quantity}${exception.Product?.unit || ''}，可用 ${totalAvailable}${exception.Product?.unit || ''}`
    }
  };
};

const resolveException = async (exceptionId, action, actionDetail) => {
  const exception = await Exception.findByPk(exceptionId);
  
  if (!exception) {
    return { success: false, message: '异常记录不存在' };
  }

  exception.action = action;
  exception.action_detail = actionDetail;
  exception.status = 'resolved';
  exception.resolved_at = new Date();
  
  await exception.save();

  return {
    success: true,
    message: '异常已解决',
    exception: {
      id: exception.id,
      type: exception.type,
      action: exception.action,
      status: exception.status,
      resolvedAt: exception.resolved_at
    }
  };
};

const getExceptionStatistics = async () => {
  const openExceptions = await Exception.count({ where: { status: 'open' } });
  const processingExceptions = await Exception.count({ where: { status: 'processing' } });
  const resolvedExceptions = await Exception.count({ where: { status: 'resolved' } });
  
  const shortageExceptions = await Exception.count({ where: { type: 'shortage' } });
  const expiryExceptions = await Exception.count({ where: { type: 'expiry' } });
  const qualityExceptions = await Exception.count({ where: { type: 'quality' } });

  return {
    summary: {
      total: openExceptions + processingExceptions + resolvedExceptions,
      open: openExceptions,
      processing: processingExceptions,
      resolved: resolvedExceptions
    },
    byType: {
      shortage: shortageExceptions,
      expiry: expiryExceptions,
      quality: qualityExceptions,
      other: (openExceptions + processingExceptions + resolvedExceptions) - 
             (shortageExceptions + expiryExceptions + qualityExceptions)
    },
    urgentActions: openExceptions > 0 
      ? `有 ${openExceptions} 个待处理异常需要关注` 
      : '所有异常已处理完毕'
  };
};

module.exports = {
  createException,
  getExceptions,
  processRefundSuggestion,
  processTransferSuggestion,
  resolveException,
  getExceptionStatistics
};
