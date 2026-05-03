const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { successResponse, createdResponse, paginatedResponse } = require('../utils/response');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const { validateTransition, getAvailableActions, getStateLabel, ORDER_STATES } = require('../utils/stateMachine');

const generateOrderNumber = () => {
  const date = new Date();
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const random = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `ORD-${dateStr}-${random}`;
};

const getOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { 
      status, 
      role,
      page = 1, 
      limit = 10 
    } = req.query;

    const query = db('orders')
      .leftJoin('products', 'orders.product_id', 'products.id')
      .leftJoin('users as buyers', 'orders.buyer_id', 'buyers.id')
      .leftJoin('users as sellers', 'orders.seller_id', 'sellers.id')
      .select(
        'orders.*',
        'products.title as product_title',
        'products.brand as product_brand',
        'products.model as product_model',
        'products.category as product_category',
        'buyers.name as buyer_name',
        'sellers.name as seller_name'
      );

    if (role === 'buyer') {
      query.where('orders.buyer_id', userId);
    } else if (role === 'seller') {
      query.where('orders.seller_id', userId);
    } else {
      query.where(function() {
        this.where('orders.buyer_id', userId)
          .orWhere('orders.seller_id', userId);
      });
    }

    if (status) {
      query.where('orders.status', status);
    }

    const countQuery = query.clone().clearSelect().count('orders.id as count');
    const countResult = await countQuery.first();
    const total = parseInt(countResult.count);

    const offset = (page - 1) * limit;
    const orders = await query
      .orderBy('orders.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    const formattedOrders = orders.map(order => ({
      ...order,
      status_label: getStateLabel(order.status),
      available_actions: getAvailableActions(order.status)
    }));

    paginatedResponse(res, formattedOrders, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }, '获取成功');
  } catch (error) {
    next(error);
  }
};

const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await db('orders')
      .leftJoin('products', 'orders.product_id', 'products.id')
      .leftJoin('users as buyers', 'orders.buyer_id', 'buyers.id')
      .leftJoin('users as sellers', 'orders.seller_id', 'sellers.id')
      .select(
        'orders.*',
        'products.title as product_title',
        'products.description as product_description',
        'products.brand as product_brand',
        'products.model as product_model',
        'products.category as product_category',
        'products.serial_number_suffix as product_serial_suffix',
        'products.condition as product_condition',
        'products.accessories as product_accessories',
        'products.specs as product_specs',
        'buyers.name as buyer_name',
        'buyers.phone as buyer_phone',
        'sellers.name as seller_name',
        'sellers.phone as seller_phone'
      )
      .where('orders.id', id)
      .first();

    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new AuthorizationError('您没有权限查看此订单');
    }

    const [paymentRecords, inspectionItems, inspectionReports, logistics, disputes] = await Promise.all([
      db('payment_records').where('order_id', id).orderBy('created_at', 'desc'),
      db('inspection_items').where('order_id', id).orderBy('sort_order', 'asc'),
      db('inspection_reports')
        .leftJoin('users', 'inspection_reports.submitted_by', 'users.id')
        .select('inspection_reports.*', 'users.name as submitter_name')
        .where('inspection_reports.order_id', id)
        .first(),
      db('logistics').where('order_id', id).orderBy('created_at', 'desc'),
      db('disputes')
        .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
        .select('disputes.*', 'raisers.name as raiser_name')
        .where('disputes.order_id', id)
        .orderBy('created_at', 'desc')
    ]);

    const formattedOrder = {
      ...order,
      product_accessories: order.product_accessories ? JSON.parse(order.product_accessories) : [],
      product_specs: order.product_specs ? JSON.parse(order.product_specs) : {},
      status_label: getStateLabel(order.status),
      available_actions: getAvailableActions(order.status),
      payment_records: paymentRecords,
      inspection_items: inspectionItems.map(item => ({
        ...item,
        evidence_urls: item.evidence_urls ? JSON.parse(item.evidence_urls) : []
      })),
      inspection_report: inspectionReports ? {
        ...inspectionReports,
        additional_evidence_urls: inspectionReports.additional_evidence_urls ? JSON.parse(inspectionReports.additional_evidence_urls) : []
      } : null,
      logistics: logistics.map(log => ({
        ...log,
        tracking_history: log.tracking_history ? JSON.parse(log.tracking_history) : []
      })),
      disputes: disputes.map(d => ({
        ...d,
        evidence_urls: d.evidence_urls ? JSON.parse(d.evidence_urls) : []
      }))
    };

    successResponse(res, formattedOrder, '获取成功');
  } catch (error) {
    next(error);
  }
};

const createOrder = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const buyerId = req.user.id;
    const { product_id, final_price, notes } = req.body;

    const product = await trx('products').where('id', product_id).first();
    if (!product) {
      throw new NotFoundError('商品不存在');
    }

    if (product.status !== 'available') {
      throw new ValidationError('商品已被预订或已售出');
    }

    if (product.seller_id === buyerId) {
      throw new ValidationError('不能购买自己的商品');
    }

    const actualPrice = final_price || product.price;
    const depositAmount = actualPrice * product.deposit_ratio;
    const balanceAmount = actualPrice - depositAmount;

    const orderNumber = generateOrderNumber();
    const orderId = uuidv4();

    await trx('orders').insert({
      id: orderId,
      order_number: orderNumber,
      buyer_id: buyerId,
      seller_id: product.seller_id,
      product_id,
      final_price: actualPrice,
      deposit_amount: depositAmount,
      balance_amount: balanceAmount,
      status: ORDER_STATES.DRAFT,
      notes
    });

    await trx('products').where('id', product_id).update({ status: 'reserved' });

    await trx.commit();

    const order = await db('orders')
      .leftJoin('products', 'orders.product_id', 'products.id')
      .leftJoin('users as sellers', 'orders.seller_id', 'sellers.id')
      .select(
        'orders.*',
        'products.title as product_title',
        'sellers.name as seller_name'
      )
      .where('orders.id', orderId)
      .first();

    const formattedOrder = {
      ...order,
      status_label: getStateLabel(order.status),
      available_actions: getAvailableActions(order.status)
    };

    createdResponse(res, formattedOrder, '订单创建成功');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const confirmDeposit = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { payment_method, transaction_id } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId) {
      throw new AuthorizationError('只有买家可以锁定订金');
    }

    validateTransition(order.status, null, 'confirm_deposit');

    await trx('orders')
      .where('id', id)
      .update({ 
        status: ORDER_STATES.DEPOSIT_LOCKED,
        updated_at: db.fn.now()
      });

    await trx('payment_records').insert({
      id: uuidv4(),
      order_id: id,
      type: 'deposit',
      amount: order.deposit_amount,
      status: 'frozen',
      payment_method: payment_method || 'other',
      transaction_id,
      reason: '订单订金锁定',
      created_by: userId
    });

    await trx.commit();

    const updatedOrder = await db('orders')
      .leftJoin('products', 'orders.product_id', 'products.id')
      .select(
        'orders.*',
        'products.title as product_title'
      )
      .where('orders.id', id)
      .first();

    successResponse(res, {
      ...updatedOrder,
      status_label: getStateLabel(updatedOrder.status),
      available_actions: getAvailableActions(updatedOrder.status)
    }, '订金已锁定');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const shipOrder = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { logistics_company, tracking_number, receiver_info } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.seller_id !== userId) {
      throw new AuthorizationError('只有卖家可以发货');
    }

    validateTransition(order.status, null, 'ship');

    await trx('orders')
      .where('id', id)
      .update({ 
        status: ORDER_STATES.SHIPPED,
        updated_at: db.fn.now()
      });

    if (logistics_company || tracking_number) {
      await trx('logistics').insert({
        id: uuidv4(),
        order_id: id,
        type: 'shipping',
        logistics_company,
        tracking_number,
        status: 'shipped',
        shipped_at: new Date().toISOString(),
        receiver_name: receiver_info?.name,
        receiver_phone: receiver_info?.phone,
        receiver_address: receiver_info?.address
      });
    }

    await trx.commit();

    successResponse(res, {
      order_id: id,
      status: ORDER_STATES.SHIPPED,
      status_label: getStateLabel(ORDER_STATES.SHIPPED)
    }, '订单已标记发货');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const startInspection = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { logistics_id, delivered_at } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId) {
      throw new AuthorizationError('只有买家可以开始验货');
    }

    validateTransition(order.status, null, 'deliver');

    await trx('orders')
      .where('id', id)
      .update({ 
        status: ORDER_STATES.BUYER_INSPECTING,
        updated_at: db.fn.now()
      });

    if (logistics_id) {
      await trx('logistics')
        .where('id', logistics_id)
        .update({
          status: 'delivered',
          delivered_at: delivered_at || new Date().toISOString()
        });
    }

    const product = await trx('products').where('id', order.product_id).first();
    const inspectionTemplates = [
      { name: '外观成色检查', description: '检查外观是否有划痕、磕碰、掉漆', sort_order: 1 },
      { name: '功能测试', description: '测试所有功能是否正常', sort_order: 2 },
      { name: '配件核对', description: '核对配件是否齐全', sort_order: 3 }
    ];

    for (const template of inspectionTemplates) {
      await trx('inspection_items').insert({
        id: uuidv4(),
        order_id: id,
        name: template.name,
        description: template.description,
        result: 'pending',
        sort_order: template.sort_order
      });
    }

    await trx.commit();

    successResponse(res, {
      order_id: id,
      status: ORDER_STATES.BUYER_INSPECTING,
      status_label: getStateLabel(ORDER_STATES.BUYER_INSPECTING),
      message: '已进入验货阶段，请完成验货清单'
    }, '已进入验货阶段');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const submitInspection = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { items, overall_result, notes, additional_evidence_urls } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId) {
      throw new AuthorizationError('只有买家可以提交验货结果');
    }

    if (order.status !== ORDER_STATES.BUYER_INSPECTING) {
      throw new ValidationError('当前订单状态不允许提交验货');
    }

    if (items && items.length > 0) {
      for (const item of items) {
        if (item.id) {
          await trx('inspection_items')
            .where('id', item.id)
            .update({
              result: item.result || 'pending',
              evidence_urls: item.evidence_urls ? JSON.stringify(item.evidence_urls) : null,
              notes: item.notes
            });
        } else {
          await trx('inspection_items').insert({
            id: uuidv4(),
            order_id: id,
            name: item.name,
            description: item.description,
            result: item.result || 'pending',
            evidence_urls: item.evidence_urls ? JSON.stringify(item.evidence_urls) : null,
            notes: item.notes,
            sort_order: item.sort_order || 0
          });
        }
      }
    }

    await trx('inspection_reports').insert({
      id: uuidv4(),
      order_id: id,
      submitted_by: userId,
      overall_result,
      notes,
      additional_evidence_urls: additional_evidence_urls ? JSON.stringify(additional_evidence_urls) : null
    });

    await trx.commit();

    successResponse(res, {
      order_id: id,
      overall_result,
      next_steps: overall_result === 'pass' ? '确认放款' : '申请部分退款或发起争议'
    }, '验货结果已提交');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const confirmRelease = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { notes } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId) {
      throw new AuthorizationError('只有买家可以确认放款');
    }

    validateTransition(order.status, null, 'confirm_release');

    await trx('orders')
      .where('id', id)
      .update({ 
        status: ORDER_STATES.RELEASED,
        updated_at: db.fn.now()
      });

    const depositRecord = await trx('payment_records')
      .where({ order_id: id, type: 'deposit', status: 'frozen' })
      .first();
    
    if (depositRecord) {
      await trx('payment_records')
        .where('id', depositRecord.id)
        .update({ status: 'released' });
    }

    await trx('payment_records').insert({
      id: uuidv4(),
      order_id: id,
      type: 'balance',
      amount: order.balance_amount,
      status: 'released',
      reason: '订单尾款已释放给卖家',
      created_by: userId
    });

    await trx('products')
      .where('id', order.product_id)
      .update({ status: 'sold' });

    await trx('orders')
      .where('id', id)
      .update({ status: ORDER_STATES.COMPLETED });

    await trx.commit();

    successResponse(res, {
      order_id: id,
      status: ORDER_STATES.COMPLETED,
      status_label: getStateLabel(ORDER_STATES.COMPLETED),
      total_released: parseFloat(order.deposit_amount) + parseFloat(order.balance_amount)
    }, '已确认放款，交易完成');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const cancelOrder = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason } = req.body;

    const order = await trx('orders').where('id', id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new AuthorizationError('您没有权限取消此订单');
    }

    validateTransition(order.status, null, 'cancel');

    await trx('orders')
      .where('id', id)
      .update({ 
        status: ORDER_STATES.CLOSED,
        updated_at: db.fn.now()
      });

    const depositRecord = await trx('payment_records')
      .where({ order_id: id, type: 'deposit', status: 'frozen' })
      .first();
    
    if (depositRecord) {
      await trx('payment_records')
        .where('id', depositRecord.id)
        .update({ 
          status: 'refunded',
          reason: `订单已取消，订金退还买家。原因: ${reason || '无'}`
        });
    }

    await trx('products')
      .where('id', order.product_id)
      .update({ status: 'available' });

    await trx.commit();

    successResponse(res, {
      order_id: id,
      status: ORDER_STATES.CLOSED,
      status_label: getStateLabel(ORDER_STATES.CLOSED)
    }, '订单已取消');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

module.exports = {
  getOrders,
  getOrderById,
  createOrder,
  confirmDeposit,
  shipOrder,
  startInspection,
  submitInspection,
  confirmRelease,
  cancelOrder
};
