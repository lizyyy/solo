const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

const ERROR_CODES = {
  DEVICE_FAILED_COUPON_CONSUMED: 'DEVICE_FAILED_COUPON_CONSUMED',
  DATA_INCONSISTENCY: 'DATA_INCONSISTENCY',
  COUPON_NOT_AVAILABLE: 'COUPON_NOT_AVAILABLE',
  DEVICE_OFFLINE: 'DEVICE_OFFLINE',
  ORDER_NOT_EXISTS: 'ORDER_NOT_EXISTS'
};

const ERROR_MESSAGES = {
  [ERROR_CODES.DEVICE_FAILED_COUPON_CONSUMED]: '洗车设备执行失败，但优惠券已被消费。请携带订单截图前往服务台人工处理，或在APP内提交申诉材料。',
  [ERROR_CODES.DATA_INCONSISTENCY]: '优惠冻结记录与优惠券状态数据不一致。系统已自动记录异常，请联系客服人员进行数据核对。',
  [ERROR_CODES.COUPON_NOT_AVAILABLE]: '优惠券状态异常，可能已被使用或已过期。请检查优惠券有效期后重试。',
  [ERROR_CODES.DEVICE_OFFLINE]: '当前洗车设备已离线，无法完成优惠冻结。请更换其他在线设备后重试。',
  [ERROR_CODES.ORDER_NOT_EXISTS]: '订单不存在，请确认订单编号是否正确。'
};

class DiscountFreezeService {
  async getDeviceById(deviceId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM car_wash_devices WHERE device_id = ?', [deviceId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getCouponById(couponId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM coupons WHERE coupon_id = ?', [couponId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getOrderById(orderId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM car_wash_orders WHERE order_id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async createFreeze(freezeData) {
    const { orderId, couponId, userId, deviceId, stationId, freezeAmount, freezeReason } = freezeData;
    const freezeId = 'FREEZE' + Date.now();

    return new Promise((resolve, reject) => {
      db.run(
        'INSERT INTO discount_freezes (freeze_id, order_id, coupon_id, user_id, device_id, station_id, freeze_amount, freeze_reason, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [freezeId, orderId, couponId, userId, deviceId, stationId, freezeAmount, freezeReason, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve({ freezeId, ...freezeData, status: 'pending' });
        }
      );
    });
  }

  async createException(exceptionData) {
    const exceptionId = 'EXCEPT' + Date.now();
    const {
      orderId, couponId, userId, deviceId, stationId,
      exceptionType, exceptionCode, exceptionMessage,
      couponConsumed = 0, deviceFailed = 0,
      consistencyStatus = 'consistent'
    } = exceptionData;

    return new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO discount_exceptions 
         (exception_id, order_id, coupon_id, user_id, device_id, station_id, 
          exception_type, exception_code, exception_message, 
          coupon_consumed, device_failed, consistency_status, handle_status) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [exceptionId, orderId, couponId, userId, deviceId, stationId,
         exceptionType, exceptionCode, exceptionMessage,
         couponConsumed, deviceFailed, consistencyStatus, 'pending'],
        function(err) {
          if (err) reject(err);
          else resolve({ exceptionId, ...exceptionData, handle_status: 'pending' });
        }
      );
    });
  }

  async checkConsistency(orderId, couponId) {
    const [order, coupon, freeze] = await Promise.all([
      this.getOrderById(orderId),
      this.getCouponById(couponId),
      this.getFreezeByOrderId(orderId)
    ]);

    const inconsistencies = [];

    if (order && coupon) {
      if (order.status === 'failed' && coupon.status === 'used') {
        inconsistencies.push('订单失败但优惠券已使用');
      }
      if (order.status === 'completed' && coupon.status !== 'used') {
        inconsistencies.push('订单完成但优惠券未使用');
      }
    }

    if (freeze && coupon) {
      if (freeze.status === 'approved' && coupon.status !== 'frozen') {
        inconsistencies.push('优惠冻结已批准但优惠券状态未冻结');
      }
    }

    return {
      isConsistent: inconsistencies.length === 0,
      inconsistencies
    };
  }

  async getFreezeByOrderId(orderId) {
    return new Promise((resolve, reject) => {
      db.get('SELECT * FROM discount_freezes WHERE order_id = ?', [orderId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async processDiscountFreeze(requestData) {
    const { orderId, couponId, userId, deviceId, stationId, freezeAmount, freezeReason } = requestData;

    const [device, coupon, order] = await Promise.all([
      this.getDeviceById(deviceId),
      this.getCouponById(couponId),
      this.getOrderById(orderId)
    ]);

    if (!order) {
      return {
        success: false,
        errorCode: ERROR_CODES.ORDER_NOT_EXISTS,
        errorMessage: ERROR_MESSAGES[ERROR_CODES.ORDER_NOT_EXISTS],
        action: '请确认订单编号是否正确，重新提交',
        nextStep: 'verify_order'
      };
    }

    if (!coupon || coupon.status !== 'available') {
      await this.createException({
        orderId, couponId, userId, deviceId, stationId,
        exceptionType: '优惠券异常',
        exceptionCode: ERROR_CODES.COUPON_NOT_AVAILABLE,
        exceptionMessage: `优惠券${coupon ? '状态为' + coupon.status : '不存在'}，无法完成优惠冻结`,
        couponConsumed: coupon && coupon.status === 'used' ? 1 : 0,
        deviceFailed: 0,
        consistencyStatus: 'inconsistent'
      });

      return {
        success: false,
        errorCode: ERROR_CODES.COUPON_NOT_AVAILABLE,
        errorMessage: ERROR_MESSAGES[ERROR_CODES.COUPON_NOT_AVAILABLE],
        action: '请检查优惠券有效期和状态，或更换其他优惠券后重试',
        nextStep: 'check_coupon',
        couponInfo: coupon ? { status: coupon.status, validEndAt: coupon.valid_end_at } : null
      };
    }

    if (!device || device.status !== 'online') {
      const deviceFailed = device && (device.status === 'offline' || device.status === 'fault') ? 1 : 0;
      
      await this.createException({
        orderId, couponId, userId, deviceId, stationId,
        exceptionType: '设备状态异常',
        exceptionCode: ERROR_CODES.DEVICE_OFFLINE,
        exceptionMessage: `设备${device ? '状态为' + device.status : '不存在'}，无法完成优惠冻结`,
        couponConsumed: 0,
        deviceFailed,
        consistencyStatus: 'consistent'
      });

      return {
        success: false,
        errorCode: ERROR_CODES.DEVICE_OFFLINE,
        errorMessage: ERROR_MESSAGES[ERROR_CODES.DEVICE_OFFLINE],
        action: '请更换其他在线设备后重试，或联系场地方维护设备',
        nextStep: 'change_device',
        deviceInfo: device ? { status: device.status, deviceName: device.device_name } : null
      };
    }

    if (order.status === 'failed' && coupon.status === 'used') {
      await this.createException({
        orderId, couponId, userId, deviceId, stationId,
        exceptionType: '设备故障异常',
        exceptionCode: ERROR_CODES.DEVICE_FAILED_COUPON_CONSUMED,
        exceptionMessage: '设备执行失败但优惠券已被消费',
        couponConsumed: 1,
        deviceFailed: 1,
        consistencyStatus: 'inconsistent'
      });

      return {
        success: false,
        errorCode: ERROR_CODES.DEVICE_FAILED_COUPON_CONSUMED,
        errorMessage: ERROR_MESSAGES[ERROR_CODES.DEVICE_FAILED_COUPON_CONSUMED],
        action: '系统已自动记录异常，您可以：1. 前往服务台处理 2. 在APP内提交订单截图进行申诉',
        nextStep: 'manual_review',
        orderInfo: { orderId, status: order.status, stationName: order.station_name },
        couponInfo: { couponId, status: coupon.status, discountAmount: coupon.discount_amount }
      };
    }

    const consistencyCheck = await this.checkConsistency(orderId, couponId);

    if (!consistencyCheck.isConsistent) {
      await this.createException({
        orderId, couponId, userId, deviceId, stationId,
        exceptionType: '数据一致性异常',
        exceptionCode: ERROR_CODES.DATA_INCONSISTENCY,
        exceptionMessage: consistencyCheck.inconsistencies.join('; '),
        couponConsumed: coupon.status === 'used' ? 1 : 0,
        deviceFailed: device.status !== 'online' ? 1 : 0,
        consistencyStatus: 'inconsistent'
      });

      return {
        success: false,
        errorCode: ERROR_CODES.DATA_INCONSISTENCY,
        errorMessage: ERROR_MESSAGES[ERROR_CODES.DATA_INCONSISTENCY],
        action: '系统检测到数据异常，已自动冻结该笔优惠，客服人员将在24小时内与您联系',
        nextStep: 'data_reconciliation',
        inconsistencies: consistencyCheck.inconsistencies
      };
    }

    const freezeResult = await this.createFreeze({
      orderId, couponId, userId, deviceId, stationId, freezeAmount, freezeReason
    });

    return {
      success: true,
      data: freezeResult,
      message: '优惠冻结申请已提交成功，请等待审核',
      nextStep: 'audit'
    };
  }

  async getFreezeList(params = {}) {
    const { status, userId, stationId, page = 1, pageSize = 10 } = params;
    let query = 'SELECT * FROM discount_freezes WHERE 1=1';
    const queryParams = [];

    if (status) {
      query += ' AND status = ?';
      queryParams.push(status);
    }
    if (userId) {
      query += ' AND user_id = ?';
      queryParams.push(userId);
    }
    if (stationId) {
      query += ' AND station_id = ?';
      queryParams.push(stationId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(pageSize, (page - 1) * pageSize);

    return new Promise((resolve, reject) => {
      db.all(query, queryParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async getExceptionList(params = {}) {
    const { handleStatus, exceptionType, stationId, page = 1, pageSize = 10 } = params;
    let query = 'SELECT * FROM discount_exceptions WHERE 1=1';
    const queryParams = [];

    if (handleStatus) {
      query += ' AND handle_status = ?';
      queryParams.push(handleStatus);
    }
    if (exceptionType) {
      query += ' AND exception_type = ?';
      queryParams.push(exceptionType);
    }
    if (stationId) {
      query += ' AND station_id = ?';
      queryParams.push(stationId);
    }

    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    queryParams.push(pageSize, (page - 1) * pageSize);

    return new Promise((resolve, reject) => {
      db.all(query, queryParams, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async auditFreeze(freezeId, auditData) {
    const { status, operatorId, operatorName, auditRemark } = auditData;

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE discount_freezes SET status = ?, operator_id = ?, operator_name = ?, audit_remark = ?, audit_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE freeze_id = ?',
        [status, operatorId, operatorName, auditRemark, freezeId],
        function(err) {
          if (err) reject(err);
          else resolve({ freezeId, status, updated: this.changes > 0 });
        }
      );
    });
  }

  async handleException(exceptionId, handleData) {
    const { handleStatus, handlerId, handlerName, handleRemark } = handleData;

    return new Promise((resolve, reject) => {
      db.run(
        'UPDATE discount_exceptions SET handle_status = ?, handler_id = ?, handler_name = ?, handle_remark = ?, handle_time = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE exception_id = ?',
        [handleStatus, handlerId, handlerName, handleRemark, exceptionId],
        function(err) {
          if (err) reject(err);
          else resolve({ exceptionId, handleStatus, updated: this.changes > 0 });
        }
      );
    });
  }
}

module.exports = new DiscountFreezeService();
