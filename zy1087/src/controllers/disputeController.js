const { v4: uuidv4 } = require('uuid');
const db = require('../db');
const { successResponse, createdResponse, paginatedResponse } = require('../utils/response');
const { NotFoundError, AuthorizationError, ValidationError } = require('../utils/errors');
const { validateTransition, getStateLabel, ORDER_STATES } = require('../utils/stateMachine');

const raiseDispute = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { order_id, reason, evidence_urls } = req.body;
    const userId = req.user.id;

    const order = await trx('orders').where('id', order_id).first();
    if (!order) {
      throw new NotFoundError('订单不存在');
    }

    if (order.buyer_id !== userId && order.seller_id !== userId) {
      throw new AuthorizationError('您没有权限为此订单发起争议');
    }

    validateTransition(order.status, null, 'raise_dispute');

    await trx('orders')
      .where('id', order_id)
      .update({ 
        status: ORDER_STATES.DISPUTED,
        updated_at: db.fn.now()
      });

    const disputeId = uuidv4();
    await trx('disputes').insert({
      id: disputeId,
      order_id,
      raised_by: userId,
      reason,
      responsibility: 'undecided',
      status: 'open',
      evidence_urls: evidence_urls ? JSON.stringify(evidence_urls) : null,
      escalation_hours: 48
    });

    await trx.commit();

    const dispute = await db('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
      .select(
        'disputes.*',
        'orders.order_number',
        'orders.final_price',
        'raisers.name as raiser_name'
      )
      .where('disputes.id', disputeId)
      .first();

    createdResponse(res, {
      ...dispute,
      evidence_urls: dispute.evidence_urls ? JSON.parse(dispute.evidence_urls) : [],
      order_status_label: getStateLabel(ORDER_STATES.DISPUTED)
    }, '争议已发起');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

const getDisputes = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { status, page = 1, limit = 10 } = req.query;

    const query = db('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
      .select(
        'disputes.*',
        'orders.order_number',
        'orders.final_price',
        'orders.buyer_id',
        'orders.seller_id',
        'raisers.name as raiser_name'
      )
      .where(function() {
        this.where('orders.buyer_id', userId)
          .orWhere('orders.seller_id', userId);
      });

    if (status) {
      query.where('disputes.status', status);
    }

    const countQuery = query.clone().clearSelect().count('disputes.id as count');
    const countResult = await countQuery.first();
    const total = parseInt(countResult.count);

    const offset = (page - 1) * limit;
    const disputes = await query
      .orderBy('disputes.created_at', 'desc')
      .limit(parseInt(limit))
      .offset(offset);

    const formattedDisputes = disputes.map(d => ({
      ...d,
      evidence_urls: d.evidence_urls ? JSON.parse(d.evidence_urls) : []
    }));

    paginatedResponse(res, formattedDisputes, {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }, '获取成功');
  } catch (error) {
    next(error);
  }
};

const getDisputeById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const dispute = await db('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .leftJoin('products', 'orders.product_id', 'products.id')
      .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
      .leftJoin('users as assignees', 'disputes.assigned_to', 'assignees.id')
      .select(
        'disputes.*',
        'orders.order_number',
        'orders.final_price',
        'orders.buyer_id',
        'orders.seller_id',
        'orders.status as order_status',
        'products.title as product_title',
        'raisers.name as raiser_name',
        'assignees.name as assignee_name'
      )
      .where('disputes.id', id)
      .first();

    if (!dispute) {
      throw new NotFoundError('争议不存在');
    }

    if (dispute.buyer_id !== userId && dispute.seller_id !== userId) {
      throw new AuthorizationError('您没有权限查看此争议');
    }

    successResponse(res, {
      ...dispute,
      evidence_urls: dispute.evidence_urls ? JSON.parse(dispute.evidence_urls) : [],
      order_status_label: getStateLabel(dispute.order_status)
    }, '获取成功');
  } catch (error) {
    next(error);
  }
};

const updateDispute = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { reason, evidence_urls, suggestion } = req.body;

    const dispute = await db('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .select('disputes.*', 'orders.buyer_id', 'orders.seller_id')
      .where('disputes.id', id)
      .first();

    if (!dispute) {
      throw new NotFoundError('争议不存在');
    }

    if (dispute.raised_by !== userId) {
      throw new AuthorizationError('只有争议发起者可以更新此争议');
    }

    if (dispute.status !== 'open' && dispute.status !== 'processing') {
      throw new ValidationError('此争议已处理完成，无法更新');
    }

    const updateData = {};
    if (reason !== undefined) updateData.reason = reason;
    if (evidence_urls !== undefined) updateData.evidence_urls = JSON.stringify(evidence_urls);
    if (suggestion !== undefined) updateData.suggestion = suggestion;

    if (Object.keys(updateData).length > 0) {
      await db('disputes').where('id', id).update(updateData);
    }

    const updatedDispute = await db('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .leftJoin('users as raisers', 'disputes.raised_by', 'raisers.id')
      .select(
        'disputes.*',
        'orders.order_number',
        'raisers.name as raiser_name'
      )
      .where('disputes.id', id)
      .first();

    successResponse(res, {
      ...updatedDispute,
      evidence_urls: updatedDispute.evidence_urls ? JSON.parse(updatedDispute.evidence_urls) : []
    }, '争议已更新');
  } catch (error) {
    next(error);
  }
};

const resolveDispute = async (req, res, next) => {
  const trx = await db.transaction();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const { resolution, responsibility, refund_amount, resolution_details } = req.body;

    const dispute = await trx('disputes')
      .leftJoin('orders', 'disputes.order_id', 'orders.id')
      .select('disputes.*', 'orders.final_price', 'orders.deposit_amount')
      .where('disputes.id', id)
      .first();

    if (!dispute) {
      throw new NotFoundError('争议不存在');
    }

    if (dispute.status === 'resolved' || dispute.status === 'closed') {
      throw new ValidationError('此争议已处理完成');
    }

    let action;
    let newOrderStatus;

    switch (resolution) {
      case 'release':
        action = 'resolve_release';
        newOrderStatus = ORDER_STATES.RELEASED;
        break;
      case 'partial_refund':
        action = 'resolve_partial_refund';
        newOrderStatus = ORDER_STATES.PARTIALLY_REFUNDED;
        break;
      case 'close':
        action = 'resolve_close';
        newOrderStatus = ORDER_STATES.CLOSED;
        break;
      default:
        throw new ValidationError('无效的处理结果');
    }

    validateTransition(dispute.status, null, action);

    await trx('disputes')
      .where('id', id)
      .update({
        status: 'resolved',
        responsibility: responsibility || 'undecided',
        refund_amount,
        resolution_details,
        resolved_at: new Date().toISOString()
      });

    await trx('orders')
      .where('id', dispute.order_id)
      .update({
        status: newOrderStatus,
        updated_at: db.fn.now()
      });

    if (refund_amount && refund_amount > 0) {
      await trx('payment_records').insert({
        id: uuidv4(),
        order_id: dispute.order_id,
        type: 'refund',
        amount: refund_amount,
        status: 'refunded',
        reason: `争议处理退款: ${resolution_details || '无详情'}`,
        created_by: userId
      });
    }

    await trx.commit();

    successResponse(res, {
      dispute_id: id,
      status: 'resolved',
      order_status: newOrderStatus,
      order_status_label: getStateLabel(newOrderStatus),
      refund_amount
    }, '争议已处理');
  } catch (error) {
    await trx.rollback();
    next(error);
  }
};

module.exports = {
  raiseDispute,
  getDisputes,
  getDisputeById,
  updateDispute,
  resolveDispute
};
