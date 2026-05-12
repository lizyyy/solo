import config from '../config.js';

class MockBusinessService {
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async processPayment(request) {
    await this.delay(config.business.simulateDelay.payment);
    
    const success = Math.random() > 0.1;
    return {
      success,
      code: success ? 'PAYMENT_SUCCESS' : 'PAYMENT_FAILED',
      message: success ? '支付成功' : '支付失败：余额不足',
      data: success ? {
        transactionId: `TXN_PAY_${Date.now()}`,
        amount: request.amount,
        orderId: request.orderId,
        status: 'completed',
      } : {
        orderId: request.orderId,
        errorCode: 'INSUFFICIENT_BALANCE',
      },
    };
  }

  async processRefund(request) {
    await this.delay(config.business.simulateDelay.refund);
    
    const success = Math.random() > 0.15;
    return {
      success,
      code: success ? 'REFUND_SUCCESS' : 'REFUND_FAILED',
      message: success ? '退款成功' : '退款失败：原交易不存在',
      data: success ? {
        refundId: request.refundId,
        refundTransactionId: `TXN_REF_${Date.now()}`,
        amount: request.amount,
        originalOrderId: request.orderId,
        status: 'completed',
      } : {
        refundId: request.refundId,
        errorCode: 'ORIGINAL_TRANSACTION_NOT_FOUND',
      },
    };
  }

  async processCoupon(request) {
    await this.delay(config.business.simulateDelay.coupon);
    
    const success = Math.random() > 0.05;
    return {
      success,
      code: success ? 'COUPON_ISSUED' : 'COUPON_FAILED',
      message: success ? '发券成功' : '发券失败：库存不足',
      data: success ? {
        couponBatchId: request.couponBatchId,
        issuedCount: request.quantity || 1,
        couponCodes: Array.from({ length: request.quantity || 1 }, (_, i) => 
          `CPN_${Date.now()}_${i}`
        ),
        status: 'issued',
      } : {
        couponBatchId: request.couponBatchId,
        errorCode: 'INSUFFICIENT_INVENTORY',
      },
    };
  }

  async execute(businessType, request) {
    switch (businessType) {
      case 'payment':
        return this.processPayment(request);
      case 'refund':
        return this.processRefund(request);
      case 'coupon':
        return this.processCoupon(request);
      default:
        throw new Error(`未知业务类型: ${businessType}`);
    }
  }
}

export const mockBusinessService = new MockBusinessService();
