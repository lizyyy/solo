const { v4: uuidv4 } = require('uuid');
const db = require('../database');
const Joi = require('joi');

const rebateOrderSchema = Joi.object({
  dealerCode: Joi.string().required().messages({ 'any.required': '经销商编码不能为空' }),
  dealerName: Joi.string().required().messages({ 'any.required': '经销商名称不能为空' }),
  orderNo: Joi.string().required().messages({ 'any.required': '返利单号不能为空' }),
  orderDate: Joi.string().required().messages({ 'any.required': '订单日期不能为空' }),
  settlementPeriod: Joi.string().required().messages({ 'any.required': '结算期间不能为空' }),
  rebateRate: Joi.number().min(0).required().messages({ 'any.required': '返利比例不能为空' }),
  handler: Joi.string().allow(null, ''),
  remark: Joi.string().allow(null, ''),
  details: Joi.array().items(Joi.object({
    productCode: Joi.string().required(),
    productName: Joi.string().required(),
    quantity: Joi.number().min(0).required(),
    unitPrice: Joi.number().min(0).required(),
    rebateRate: Joi.number().min(0).required()
  })).required().messages({ 'any.required': '返利明细不能为空' })
});

const returnAdjustmentSchema = Joi.object({
  returnOrderNo: Joi.string().required().messages({ 'any.required': '退货单号不能为空' }),
  returnDate: Joi.string().required().messages({ 'any.required': '退货日期不能为空' }),
  productCode: Joi.string().required().messages({ 'any.required': '商品编码不能为空' }),
  productName: Joi.string().required().messages({ 'any.required': '商品名称不能为空' }),
  returnQuantity: Joi.number().min(0).required().messages({ 'any.required': '退货数量不能为空' }),
  returnAmount: Joi.number().min(0).required().messages({ 'any.required': '退货金额不能为空' }),
  operator: Joi.string().required().messages({ 'any.required': '操作人不能为空' })
});

class RebateController {
  static createError(message, code = 'VALIDATION_ERROR', statusCode = 400) {
    const error = new Error(message);
    error.code = code;
    error.statusCode = statusCode;
    return error;
  }

  static async createRebateOrder(req, res, next) {
    try {
      const { error, value } = rebateOrderSchema.validate(req.body);
      if (error) {
        throw RebateController.createError(error.details[0].message);
      }

      const { dealerCode, dealerName, orderNo, orderDate, settlementPeriod, rebateRate, handler, remark, details } = value;
      
      const existingOrder = await new Promise((resolve, reject) => {
        db.get('SELECT id FROM rebate_orders WHERE order_no = ?', [orderNo], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (existingOrder) {
        throw RebateController.createError(`返利单号 ${orderNo} 已存在`, 'DUPLICATE_ORDER_NO');
      }

      let rebateBaseAmount = 0;
      details.forEach(detail => {
        detail.salesAmount = detail.quantity * detail.unitPrice;
        detail.rebateAmount = detail.salesAmount * detail.rebateRate;
        rebateBaseAmount += detail.salesAmount;
      });

      const actualRebateBase = rebateBaseAmount;
      const rebateAmount = rebateBaseAmount * rebateRate;

      const orderId = uuidv4();
      const now = new Date().toISOString();

      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO rebate_orders 
          (id, dealer_code, dealer_name, order_no, order_date, settlement_period, 
           rebate_base_amount, return_amount, actual_rebate_base, rebate_rate, 
           rebate_amount, paid_amount, status, handler, remark, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [orderId, dealerCode, dealerName, orderNo, orderDate, settlementPeriod,
            rebateBaseAmount, 0, actualRebateBase, rebateRate, rebateAmount, 0,
            'DRAFT', handler, remark, now, now], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const detailStmt = db.prepare(`
        INSERT INTO rebate_details 
        (id, rebate_order_id, product_code, product_name, quantity, unit_price, 
         sales_amount, rebate_rate, rebate_amount, return_quantity, return_amount, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?)
      `);

      for (const detail of details) {
        await new Promise((resolve, reject) => {
          detailStmt.run([uuidv4(), orderId, detail.productCode, detail.productName,
            detail.quantity, detail.unitPrice, detail.salesAmount, detail.rebateRate,
            detail.rebateAmount, now], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      detailStmt.finalize();

      await RebateController.addHistory(orderId, 'CREATE', handler || 'system', null, 'DRAFT', remark, '创建返利核算单');

      res.status(201).json({
        id: orderId,
        orderNo,
        message: '返利核算单创建成功'
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRebateOrders(req, res, next) {
    try {
      const { dealerCode, status, page = 1, pageSize = 10 } = req.query;
      
      let query = 'SELECT * FROM rebate_orders WHERE 1=1';
      let countQuery = 'SELECT COUNT(*) as total FROM rebate_orders WHERE 1=1';
      const params = [];

      if (dealerCode) {
        query += ' AND dealer_code = ?';
        countQuery += ' AND dealer_code = ?';
        params.push(dealerCode);
      }

      if (status) {
        query += ' AND status = ?';
        countQuery += ' AND status = ?';
        params.push(status);
      }

      query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
      const offset = (page - 1) * pageSize;
      params.push(parseInt(pageSize), offset);

      const orders = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const countResult = await new Promise((resolve, reject) => {
        db.get(countQuery, params.slice(0, -2), (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      res.json({
        data: orders.map(order => ({
          id: order.id,
          dealerCode: order.dealer_code,
          dealerName: order.dealer_name,
          orderNo: order.order_no,
          orderDate: order.order_date,
          settlementPeriod: order.settlement_period,
          rebateBaseAmount: order.rebate_base_amount,
          returnAmount: order.return_amount,
          actualRebateBase: order.actual_rebate_base,
          rebateAmount: order.rebate_amount,
          paidAmount: order.paid_amount,
          status: order.status,
          handler: order.handler,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        })),
        pagination: {
          page: parseInt(page),
          pageSize: parseInt(pageSize),
          total: countResult.total
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static async getRebateOrderDetail(req, res, next) {
    try {
      const { id } = req.params;

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      const details = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM rebate_details WHERE rebate_order_id = ?', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const history = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM modification_history WHERE rebate_order_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const adjustments = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM return_adjustments WHERE rebate_order_id = ? ORDER BY created_at DESC', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      res.json({
        order: {
          id: order.id,
          dealerCode: order.dealer_code,
          dealerName: order.dealer_name,
          orderNo: order.order_no,
          orderDate: order.order_date,
          settlementPeriod: order.settlement_period,
          rebateBaseAmount: order.rebate_base_amount,
          returnAmount: order.return_amount,
          actualRebateBase: order.actual_rebate_base,
          rebateRate: order.rebate_rate,
          rebateAmount: order.rebate_amount,
          paidAmount: order.paid_amount,
          status: order.status,
          handler: order.handler,
          remark: order.remark,
          createdAt: order.created_at,
          updatedAt: order.updated_at
        },
        details: details.map(d => ({
          id: d.id,
          productCode: d.product_code,
          productName: d.product_name,
          quantity: d.quantity,
          unitPrice: d.unit_price,
          salesAmount: d.sales_amount,
          rebateRate: d.rebate_rate,
          rebateAmount: d.rebate_amount,
          returnQuantity: d.return_quantity,
          returnAmount: d.return_amount
        })),
        history: history.map(h => ({
          id: h.id,
          operationType: h.operation_type,
          operator: h.operator,
          oldStatus: h.old_status,
          newStatus: h.new_status,
          remark: h.remark,
          changeContent: h.change_content,
          createdAt: h.created_at
        })),
        adjustments: adjustments.map(a => ({
          id: a.id,
          returnOrderNo: a.return_order_no,
          returnDate: a.return_date,
          productCode: a.product_code,
          productName: a.product_name,
          returnQuantity: a.return_quantity,
          returnAmount: a.return_amount,
          baseAdjustment: a.base_adjustment,
          rebateAdjustment: a.rebate_adjustment,
          isPostPayment: !!a.is_post_payment,
          correctionRecord: a.correction_record,
          operator: a.operator,
          createdAt: a.created_at
        }))
      });
    } catch (err) {
      next(err);
    }
  }

  static async submitRebateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { operator, remark } = req.body;

      if (!operator) {
        throw RebateController.createError('操作人不能为空');
      }

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      if (order.status !== 'DRAFT' && order.status !== 'REVOKED') {
        throw RebateController.createError(`当前状态 ${order.status} 不允许提交`, 'INVALID_STATUS');
      }

      const details = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM rebate_details WHERE rebate_order_id = ?', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const detailTotalRebate = details.reduce((sum, d) => sum + d.rebate_amount, 0);
      if (Math.abs(detailTotalRebate - order.rebate_amount) > 0.01) {
        throw RebateController.createError('返利明细合计与返利总金额不一致，请核对后再提交', 'REBATE_AMOUNT_MISMATCH');
      }

      const now = new Date().toISOString();
      await new Promise((resolve, reject) => {
        db.run('UPDATE rebate_orders SET status = ?, updated_at = ? WHERE id = ?', ['PENDING', now, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await RebateController.addHistory(id, 'SUBMIT', operator, order.status, 'PENDING', remark, '提交返利核算单');

      res.json({ message: '提交成功', status: 'PENDING' });
    } catch (err) {
      next(err);
    }
  }

  static async revokeRebateOrder(req, res, next) {
    try {
      const { id } = req.params;
      const { operator, reason } = req.body;

      if (!operator) {
        throw RebateController.createError('操作人不能为空');
      }

      if (!reason) {
        throw RebateController.createError('撤回原因不能为空');
      }

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      if (order.status === 'PAID' || order.status === 'REVOKED' || order.status === 'DRAFT') {
        throw RebateController.createError(`当前状态 ${order.status} 不允许撤回`, 'INVALID_STATUS');
      }

      const now = new Date().toISOString();
      await new Promise((resolve, reject) => {
        db.run('UPDATE rebate_orders SET status = ?, updated_at = ? WHERE id = ?', ['REVOKED', now, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await RebateController.addHistory(id, 'REVOKE', operator, order.status, 'REVOKED', reason, '撤回返利核算单');

      res.json({ message: '撤回成功', status: 'REVOKED' });
    } catch (err) {
      next(err);
    }
  }

  static async manualProcess(req, res, next) {
    try {
      const { id } = req.params;
      const { operator, remark, action } = req.body;

      if (!operator) {
        throw RebateController.createError('操作人不能为空');
      }

      if (!action || !['APPROVE', 'REJECT', 'REMARK'].includes(action)) {
        throw RebateController.createError('操作类型必须是 APPROVE、REJECT 或 REMARK');
      }

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      if (order.status !== 'PENDING') {
        throw RebateController.createError(`当前状态 ${order.status} 不允许人工处理`, 'INVALID_STATUS');
      }

      let newStatus = order.status;
      let changeContent = '';

      if (action === 'APPROVE') {
        newStatus = 'APPROVED';
        changeContent = '人工审核通过';
      } else if (action === 'REJECT') {
        newStatus = 'REJECTED';
        changeContent = '人工审核驳回';
      } else {
        changeContent = '添加人工处理备注';
      }

      const now = new Date().toISOString();
      if (action !== 'REMARK') {
        await new Promise((resolve, reject) => {
          db.run('UPDATE rebate_orders SET status = ?, updated_at = ? WHERE id = ?', [newStatus, now, id], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }

      await RebateController.addHistory(id, 'MANUAL_PROCESS', operator, order.status, newStatus, remark, changeContent);

      res.json({ message: changeContent + '成功', status: newStatus });
    } catch (err) {
      next(err);
    }
  }

  static async addReturnAdjustment(req, res, next) {
    try {
      const { id } = req.params;
      const { error, value } = returnAdjustmentSchema.validate(req.body);
      if (error) {
        throw RebateController.createError(error.details[0].message);
      }

      const { returnOrderNo, returnDate, productCode, productName, returnQuantity, returnAmount, operator } = value;

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      const detail = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_details WHERE rebate_order_id = ? AND product_code = ?', [id, productCode], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!detail) {
        throw RebateController.createError(`该返利单中不存在商品 ${productCode}`, 'PRODUCT_NOT_FOUND');
      }

      if (returnQuantity > detail.quantity - detail.return_quantity) {
        throw RebateController.createError('退货数量不能大于剩余可退货数量', 'EXCESS_RETURN_QUANTITY');
      }

      const baseAdjustment = returnAmount;
      const rebateAdjustment = returnAmount * detail.rebate_rate;
      const isPostPayment = order.paid_amount > 0;
      const correctionRecord = isPostPayment ? `已打款后冲正，冲正金额: ${rebateAdjustment.toFixed(2)}` : null;

      const newReturnAmount = order.return_amount + returnAmount;
      const newActualRebateBase = order.actual_rebate_base - baseAdjustment;
      const newRebateAmount = newActualRebateBase * order.rebate_rate;

      const now = new Date().toISOString();

      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE rebate_orders 
          SET return_amount = ?, actual_rebate_base = ?, rebate_amount = ?, updated_at = ?
          WHERE id = ?
        `, [newReturnAmount, newActualRebateBase, newRebateAmount, now, id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          UPDATE rebate_details 
          SET return_quantity = return_quantity + ?, return_amount = return_amount + ?, rebate_amount = ?
          WHERE id = ?
        `, [returnQuantity, returnAmount, (detail.sales_amount - returnAmount) * detail.rebate_rate, detail.id], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      const adjustmentId = uuidv4();
      await new Promise((resolve, reject) => {
        db.run(`
          INSERT INTO return_adjustments 
          (id, rebate_order_id, return_order_no, return_date, product_code, product_name, 
           return_quantity, return_amount, base_adjustment, rebate_adjustment, is_post_payment, 
           correction_record, operator, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [adjustmentId, id, returnOrderNo, returnDate, productCode, productName,
            returnQuantity, returnAmount, baseAdjustment, rebateAdjustment,
            isPostPayment ? 1 : 0, correctionRecord, operator, now], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await RebateController.addHistory(id, 'RETURN_ADJUSTMENT', operator, order.status, order.status, 
        `退货单号: ${returnOrderNo}, 商品: ${productName}, 退货金额: ${returnAmount}`, 
        correctionRecord || '退货冲减返利基数');

      res.json({
        message: '退货冲减成功',
        adjustmentId,
        isPostPayment,
        correctionRecord
      });
    } catch (err) {
      next(err);
    }
  }

  static async checkReturnDeduction(req, res, next) {
    try {
      const { id } = req.params;

      const order = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM rebate_orders WHERE id = ?', [id], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      if (!order) {
        throw RebateController.createError(`返利核算单 ${id} 不存在`, 'ORDER_NOT_FOUND', 404);
      }

      const adjustments = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM return_adjustments WHERE rebate_order_id = ?', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const totalAdjusted = adjustments.reduce((sum, a) => sum + a.base_adjustment, 0);
      const expectedActualBase = order.rebate_base_amount - totalAdjusted;

      const issues = [];
      if (Math.abs(expectedActualBase - order.actual_rebate_base) > 0.01) {
        issues.push({
          type: 'RETURN_DEDUCTION_MISSING',
          message: '存在退货单未扣减返利基数',
          expected: expectedActualBase,
          actual: order.actual_rebate_base,
          difference: expectedActualBase - order.actual_rebate_base
        });
      }

      const details = await new Promise((resolve, reject) => {
        db.all('SELECT * FROM rebate_details WHERE rebate_order_id = ?', [id], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      const detailTotalRebate = details.reduce((sum, d) => sum + d.rebate_amount, 0);
      if (Math.abs(detailTotalRebate - order.rebate_amount) > 0.01) {
        issues.push({
          type: 'REBATE_AMOUNT_MISMATCH',
          message: '返利明细合计与返利总金额不一致',
          detailTotal: detailTotalRebate,
          orderTotal: order.rebate_amount,
          difference: detailTotalRebate - order.rebate_amount
        });
      }

      res.json({
        orderNo: order.order_no,
        status: order.status,
        hasIssues: issues.length > 0,
        issues,
        summary: {
          rebateBaseAmount: order.rebate_base_amount,
          totalReturnAdjustment: totalAdjusted,
          actualRebateBase: order.actual_rebate_base,
          detailRebateTotal: detailTotalRebate,
          orderRebateTotal: order.rebate_amount
        }
      });
    } catch (err) {
      next(err);
    }
  }

  static addHistory(rebateOrderId, operationType, operator, oldStatus, newStatus, remark, changeContent) {
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO modification_history 
        (id, rebate_order_id, operation_type, operator, old_status, new_status, remark, change_content, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [uuidv4(), rebateOrderId, operationType, operator, oldStatus, newStatus, remark, changeContent, new Date().toISOString()], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

module.exports = RebateController;
