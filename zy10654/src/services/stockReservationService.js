const pool = require('../config/database');
const moment = require('moment');
const { v4: uuidv4 } = require('uuid');
const {
  RESERVATION_STATUS,
  OPERATION_TYPE,
  ERROR_CODES,
  ERROR_MESSAGES
} = require('../constants/status');
const operationLogService = require('./operationLogService');

class StockReservationService {
  generateReservationNo() {
    const dateStr = moment().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `RES${dateStr}${random}`;
  }

  async getProductByCode(productCode) {
    const sql = 'SELECT * FROM products WHERE product_code = ?';
    const [rows] = await pool.execute(sql, [productCode]);
    return rows[0];
  }

  async getMemberByNo(memberNo) {
    const sql = 'SELECT * FROM members WHERE member_no = ?';
    const [rows] = await pool.execute(sql, [memberNo]);
    return rows[0];
  }

  async getReleaseReasonByCode(reasonCode) {
    const sql = 'SELECT * FROM release_reasons WHERE reason_code = ?';
    const [rows] = await pool.execute(sql, [reasonCode]);
    return rows[0];
  }

  async checkDuplicateReservation(memberId, productId, minutes = 1) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM stock_reservations 
      WHERE member_id = ? 
        AND product_id = ? 
        AND status IN (?, ?)
        AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;
    const [rows] = await pool.execute(sql, [
      memberId, productId,
      RESERVATION_STATUS.AVAILABLE,
      RESERVATION_STATUS.RESERVED,
      minutes
    ]);
    return rows[0].count > 0;
  }

  async createReservation(productCode, memberNo, quantity = 1, operator = 'system') {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const product = await this.getProductByCode(productCode);
      if (!product) {
        throw { code: ERROR_CODES.PRODUCT_NOT_FOUND, message: ERROR_MESSAGES[1002] };
      }

      const member = await this.getMemberByNo(memberNo);
      if (!member) {
        throw { code: ERROR_CODES.MEMBER_NOT_FOUND, message: ERROR_MESSAGES[1003] };
      }

      if (product.available_stock < quantity) {
        throw { code: ERROR_CODES.STOCK_INSUFFICIENT, message: `${ERROR_MESSAGES[1001]}，当前可用: ${product.available_stock}` };
      }

      const isDuplicate = await this.checkDuplicateReservation(member.id, product.id, 1);
      const reservationNo = this.generateReservationNo();
      const pointsAmount = product.points_price * quantity;
      const expireMinutes = parseInt(process.env.RESERVATION_EXPIRE_MINUTES || 30);
      const expiredAt = moment().add(expireMinutes, 'minutes').format('YYYY-MM-DD HH:mm:ss');

      const beforeStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock,
        reserved_stock: product.reserved_stock,
        sold_stock: product.sold_stock
      };

      const insertSql = `
        INSERT INTO stock_reservations 
        (reservation_no, product_id, product_code, member_id, member_no, quantity, points_amount, status, expired_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const [result] = await connection.execute(insertSql, [
        reservationNo, product.id, productCode, member.id, memberNo,
        quantity, pointsAmount, RESERVATION_STATUS.AVAILABLE, expiredAt
      ]);
      const reservationId = result.insertId;

      await operationLogService.createLog({
        reservationId,
        reservationNo,
        operationType: OPERATION_TYPE.CREATE,
        operationDesc: '创建预占单',
        beforeStatus: null,
        afterStatus: RESERVATION_STATUS.AVAILABLE,
        beforeStock,
        afterStock: beforeStock,
        remark: '用户发起兑换请求',
        operator
      });

      await connection.commit();
      return { reservationId, reservationNo };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async reserveStock(reservationNo, operator = 'system') {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const reservationSql = 'SELECT * FROM stock_reservations WHERE reservation_no = ? FOR UPDATE';
      const [reservations] = await connection.execute(reservationSql, [reservationNo]);
      const reservation = reservations[0];

      if (!reservation) {
        throw { code: ERROR_CODES.RESERVATION_NOT_FOUND, message: ERROR_MESSAGES[1004] };
      }

      if (reservation.status !== RESERVATION_STATUS.AVAILABLE) {
        throw { code: ERROR_CODES.RESERVATION_STATUS_ERROR, message: `${ERROR_MESSAGES[1005]}，当前状态: ${reservation.status}` };
      }

      const productSql = 'SELECT * FROM products WHERE id = ? FOR UPDATE';
      const [products] = await connection.execute(productSql, [reservation.product_id]);
      const product = products[0];

      if (product.available_stock < reservation.quantity) {
        throw { code: ERROR_CODES.STOCK_INSUFFICIENT, message: `${ERROR_MESSAGES[1001]}，当前可用: ${product.available_stock}` };
      }

      const beforeStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock,
        reserved_stock: product.reserved_stock,
        sold_stock: product.sold_stock
      };

      const updateProductSql = `
        UPDATE products 
        SET available_stock = available_stock - ?, reserved_stock = reserved_stock + ?
        WHERE id = ?
      `;
      await connection.execute(updateProductSql, [reservation.quantity, reservation.quantity, product.id]);

      const updateReservationSql = `
        UPDATE stock_reservations 
        SET status = ?
        WHERE id = ?
      `;
      await connection.execute(updateReservationSql, [RESERVATION_STATUS.RESERVED, reservation.id]);

      const afterStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock - reservation.quantity,
        reserved_stock: product.reserved_stock + reservation.quantity,
        sold_stock: product.sold_stock
      };

      await operationLogService.createLog({
        reservationId: reservation.id,
        reservationNo: reservation.reservation_no,
        operationType: OPERATION_TYPE.RESERVE,
        operationDesc: '库存预占成功',
        beforeStatus: RESERVATION_STATUS.AVAILABLE,
        afterStatus: RESERVATION_STATUS.RESERVED,
        beforeStock,
        afterStock,
        remark: `预占库存${reservation.quantity}件`,
        operator
      });

      await connection.commit();
      return { success: true, reservationNo };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async releaseStock(reservationNo, releaseReasonCode, remark = '', operator = 'system') {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const reason = await this.getReleaseReasonByCode(releaseReasonCode);
      if (!reason) {
        throw { code: ERROR_CODES.PARAM_ERROR, message: '释放原因不存在' };
      }

      const reservationSql = 'SELECT * FROM stock_reservations WHERE reservation_no = ? FOR UPDATE';
      const [reservations] = await connection.execute(reservationSql, [reservationNo]);
      const reservation = reservations[0];

      if (!reservation) {
        throw { code: ERROR_CODES.RESERVATION_NOT_FOUND, message: ERROR_MESSAGES[1004] };
      }

      if (reservation.status !== RESERVATION_STATUS.RESERVED) {
        throw { code: ERROR_CODES.RESERVATION_STATUS_ERROR, message: `${ERROR_MESSAGES[1005]}，当前状态: ${reservation.status}` };
      }

      const productSql = 'SELECT * FROM products WHERE id = ? FOR UPDATE';
      const [products] = await connection.execute(productSql, [reservation.product_id]);
      const product = products[0];

      const beforeStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock,
        reserved_stock: product.reserved_stock,
        sold_stock: product.sold_stock
      };

      let afterStatus;
      let afterStock = { ...beforeStock };

      if (reason.need_manual) {
        afterStatus = RESERVATION_STATUS.PENDING_MANUAL;
        afterStock = beforeStock;
      } else {
        afterStatus = RESERVATION_STATUS.RELEASED;
        afterStock = {
          total_stock: product.total_stock,
          available_stock: product.available_stock + reservation.quantity,
          reserved_stock: product.reserved_stock - reservation.quantity,
          sold_stock: product.sold_stock
        };

        const updateProductSql = `
          UPDATE products 
          SET available_stock = available_stock + ?, reserved_stock = reserved_stock - ?
          WHERE id = ?
        `;
        await connection.execute(updateProductSql, [reservation.quantity, reservation.quantity, product.id]);
      }

      const updateReservationSql = `
        UPDATE stock_reservations 
        SET status = ?, release_reason_id = ?, release_reason_code = ?, release_remark = ?, released_at = NOW()
        WHERE id = ?
      `;
      await connection.execute(updateReservationSql, [
        afterStatus, reason.id, releaseReasonCode, remark, reservation.id
      ]);

      await operationLogService.createLog({
        reservationId: reservation.id,
        reservationNo: reservation.reservation_no,
        operationType: OPERATION_TYPE.RELEASE,
        operationDesc: reason.reason_name,
        beforeStatus: RESERVATION_STATUS.RESERVED,
        afterStatus,
        beforeStock,
        afterStock,
        releaseReasonId: reason.id,
        releaseReasonCode,
        remark,
        operator
      });

      await connection.commit();

      const result = {
        success: true,
        reservationNo,
        status: afterStatus,
        needManual: reason.need_manual
      };

      if (reason.need_manual) {
        result.code = ERROR_CODES.NEED_MANUAL_PROCESS;
        result.message = `需要人工处理：${reason.description}`;
        result.action = '请联系管理员核实交易状态后手动处理库存';
      }

      return result;

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async exchangeStock(reservationNo, operator = 'system') {
    const connection = await pool.getConnection();
    await connection.beginTransaction();

    try {
      const reservationSql = 'SELECT * FROM stock_reservations WHERE reservation_no = ? FOR UPDATE';
      const [reservations] = await connection.execute(reservationSql, [reservationNo]);
      const reservation = reservations[0];

      if (!reservation) {
        throw { code: ERROR_CODES.RESERVATION_NOT_FOUND, message: ERROR_MESSAGES[1004] };
      }

      if (reservation.status !== RESERVATION_STATUS.RESERVED) {
        throw { code: ERROR_CODES.RESERVATION_STATUS_ERROR, message: `${ERROR_MESSAGES[1005]}，当前状态: ${reservation.status}` };
      }

      const memberSql = 'SELECT * FROM members WHERE id = ? FOR UPDATE';
      const [members] = await connection.execute(memberSql, [reservation.member_id]);
      const member = members[0];

      if (member.points_balance < reservation.points_amount) {
        throw { code: ERROR_CODES.POINTS_INSUFFICIENT, message: `${ERROR_MESSAGES[1006]}，当前积分: ${member.points_balance}` };
      }

      const productSql = 'SELECT * FROM products WHERE id = ? FOR UPDATE';
      const [products] = await connection.execute(productSql, [reservation.product_id]);
      const product = products[0];

      const beforeStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock,
        reserved_stock: product.reserved_stock,
        sold_stock: product.sold_stock
      };

      const updateMemberSql = `
        UPDATE members 
        SET points_balance = points_balance - ?
        WHERE id = ?
      `;
      await connection.execute(updateMemberSql, [reservation.points_amount, member.id]);

      const updateProductSql = `
        UPDATE products 
        SET reserved_stock = reserved_stock - ?, sold_stock = sold_stock + ?
        WHERE id = ?
      `;
      await connection.execute(updateProductSql, [reservation.quantity, reservation.quantity, product.id]);

      const updateReservationSql = `
        UPDATE stock_reservations 
        SET status = ?, exchanged_at = NOW()
        WHERE id = ?
      `;
      await connection.execute(updateReservationSql, [RESERVATION_STATUS.EXCHANGED, reservation.id]);

      const orderNo = `ORD${moment().format('YYYYMMDDHHmmss')}${Math.floor(Math.random() * 1000)}`;
      const insertOrderSql = `
        INSERT INTO exchange_orders 
        (order_no, reservation_id, reservation_no, product_id, product_code, member_id, member_no, 
         quantity, points_amount, pay_status, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.execute(insertOrderSql, [
        orderNo, reservation.id, reservationNo, product.id, product.product_code,
        member.id, member.member_no, reservation.quantity, reservation.points_amount,
        30, 30
      ]);

      const afterStock = {
        total_stock: product.total_stock,
        available_stock: product.available_stock,
        reserved_stock: product.reserved_stock - reservation.quantity,
        sold_stock: product.sold_stock + reservation.quantity
      };

      await operationLogService.createLog({
        reservationId: reservation.id,
        reservationNo: reservation.reservation_no,
        operationType: OPERATION_TYPE.EXCHANGE,
        operationDesc: '兑换成功',
        beforeStatus: RESERVATION_STATUS.RESERVED,
        afterStatus: RESERVATION_STATUS.EXCHANGED,
        beforeStock,
        afterStock,
        remark: '支付成功，完成兑换',
        operator
      });

      await connection.commit();
      return { success: true, reservationNo, orderNo };

    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async getReservationList(params = {}) {
    const { page = 1, pageSize = 20, status, memberNo, productCode, startDate, endDate } = params;
    const offset = (page - 1) * pageSize;

    let whereSql = 'WHERE 1=1';
    const queryParams = [];

    if (status) {
      whereSql += ' AND r.status = ?';
      queryParams.push(status);
    }
    if (memberNo) {
      whereSql += ' AND r.member_no = ?';
      queryParams.push(memberNo);
    }
    if (productCode) {
      whereSql += ' AND r.product_code = ?';
      queryParams.push(productCode);
    }
    if (startDate) {
      whereSql += ' AND r.created_at >= ?';
      queryParams.push(startDate);
    }
    if (endDate) {
      whereSql += ' AND r.created_at <= ?';
      queryParams.push(endDate);
    }

    const countSql = `SELECT COUNT(*) as total FROM stock_reservations r ${whereSql}`;
    const [countResult] = await pool.execute(countSql, queryParams);

    const listSql = `
      SELECT r.*, 
             p.product_name,
             m.member_name,
             rr.reason_name as release_reason_name
      FROM stock_reservations r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN members m ON r.member_id = m.id
      LEFT JOIN release_reasons rr ON r.release_reason_id = rr.id
      ${whereSql}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `;
    queryParams.push(pageSize, offset);
    const [rows] = await pool.execute(listSql, queryParams);

    return {
      list: rows,
      total: countResult[0].total,
      page: parseInt(page),
      pageSize: parseInt(pageSize)
    };
  }

  async getReservationDetail(reservationNo) {
    const sql = `
      SELECT r.*, 
             p.product_name,
             m.member_name,
             m.phone as member_phone,
             rr.reason_name as release_reason_name,
             rr.description as release_reason_desc
      FROM stock_reservations r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN members m ON r.member_id = m.id
      LEFT JOIN release_reasons rr ON r.release_reason_id = rr.id
      WHERE r.reservation_no = ?
    `;
    const [rows] = await pool.execute(sql, [reservationNo]);
    return rows[0];
  }

  async getReservationHistory(reservationNo) {
    return await operationLogService.getLogsByReservationNo(reservationNo);
  }

  async exportReservations(params = {}) {
    const { status, memberNo, productCode, startDate, endDate } = params;

    let whereSql = 'WHERE 1=1';
    const queryParams = [];

    if (status) {
      whereSql += ' AND r.status = ?';
      queryParams.push(status);
    }
    if (memberNo) {
      whereSql += ' AND r.member_no = ?';
      queryParams.push(memberNo);
    }
    if (productCode) {
      whereSql += ' AND r.product_code = ?';
      queryParams.push(productCode);
    }
    if (startDate) {
      whereSql += ' AND r.created_at >= ?';
      queryParams.push(startDate);
    }
    if (endDate) {
      whereSql += ' AND r.created_at <= ?';
      queryParams.push(endDate);
    }

    const sql = `
      SELECT 
        r.reservation_no as '预占单号',
        r.product_code as '商品编码',
        p.product_name as '商品名称',
        r.member_no as '会员编号',
        m.member_name as '会员姓名',
        r.quantity as '数量',
        r.points_amount as '积分金额',
        CASE r.status 
          WHEN 10 THEN '可兑换'
          WHEN 20 THEN '预占中'
          WHEN 30 THEN '已释放'
          WHEN 40 THEN '已兑换'
          WHEN 50 THEN '待人工处理'
        END as '状态',
        rr.reason_name as '释放原因',
        r.release_remark as '释放备注',
        r.operator as '操作人',
        r.created_at as '创建时间',
        r.expired_at as '过期时间',
        r.released_at as '释放时间',
        r.exchanged_at as '兑换时间'
      FROM stock_reservations r
      LEFT JOIN products p ON r.product_id = p.id
      LEFT JOIN members m ON r.member_id = m.id
      LEFT JOIN release_reasons rr ON r.release_reason_id = rr.id
      ${whereSql}
      ORDER BY r.created_at DESC
    `;
    const [rows] = await pool.execute(sql, queryParams);
    return rows;
  }
}

module.exports = new StockReservationService();
