module.exports = {
  payment: {
    succeeded: {
      event_type: 'payment.succeeded',
      payload: {
        id: 'pay_abc123',
        object: 'payment',
        amount: 9999,
        currency: 'cny',
        status: 'succeeded',
        created: 1700000000,
        customer: {
          id: 'cus_xyz789',
          email: 'customer@example.com'
        },
        payment_method: {
          type: 'card',
          card: {
            last4: '4242',
            brand: 'visa'
          }
        }
      },
      description: '支付成功事件'
    },
    failed: {
      event_type: 'payment.failed',
      payload: {
        id: 'pay_def456',
        object: 'payment',
        amount: 9999,
        currency: 'cny',
        status: 'failed',
        created: 1700000000,
        failure_reason: 'insufficient_funds',
        failure_message: '余额不足'
      },
      description: '支付失败事件'
    }
  },
  order: {
    created: {
      event_type: 'order.created',
      payload: {
        id: 'ord_123abc',
        object: 'order',
        status: 'created',
        created: 1700000000,
        customer: {
          id: 'cus_xyz789',
          name: '张三',
          email: 'zhangsan@example.com'
        },
        items: [
          {
            id: 'item_1',
            name: '商品A',
            quantity: 2,
            unit_price: 1000
          },
          {
            id: 'item_2',
            name: '商品B',
            quantity: 1,
            unit_price: 5000
          }
        ],
        total_amount: 7000,
        shipping_address: {
          province: '北京市',
          city: '北京市',
          district: '朝阳区',
          detail: '某某街道123号'
        }
      },
      description: '订单创建事件'
    },
    updated: {
      event_type: 'order.updated',
      payload: {
        id: 'ord_123abc',
        object: 'order',
        status: 'paid',
        updated: 1700000100,
        previous_status: 'created'
      },
      description: '订单更新事件'
    }
  },
  subscription: {
    created: {
      event_type: 'subscription.created',
      payload: {
        id: 'sub_abc789',
        object: 'subscription',
        status: 'active',
        plan: {
          id: 'plan_monthly',
          name: '月度订阅',
          interval: 'month',
          amount: 9900
        },
        current_period_start: 1700000000,
        current_period_end: 1702678400,
        customer: {
          id: 'cus_xyz789',
          email: 'customer@example.com'
        }
      },
      description: '订阅创建事件'
    },
    cancelled: {
      event_type: 'subscription.cancelled',
      payload: {
        id: 'sub_abc789',
        object: 'subscription',
        status: 'cancelled',
        cancel_at_period_end: true,
        cancellation_reason: 'customer_requested',
        current_period_end: 1702678400
      },
      description: '订阅取消事件'
    }
  },
  user: {
    created: {
      event_type: 'user.created',
      payload: {
        id: 'user_123',
        object: 'user',
        email: 'newuser@example.com',
        phone: '13800138000',
        name: '新用户',
        created: 1700000000,
        verified: false
      },
      description: '用户创建事件'
    },
    verified: {
      event_type: 'user.verified',
      payload: {
        id: 'user_123',
        object: 'user',
        verified: true,
        verified_at: 1700000100,
        verification_method: 'sms'
      },
      description: '用户验证事件'
    }
  },

  list() {
    const events = [];
    
    const categories = ['payment', 'order', 'subscription', 'user'];
    for (const category of categories) {
      const categoryEvents = this[category];
      for (const key in categoryEvents) {
        if (key !== 'list') {
          events.push({
            ...categoryEvents[key],
            category
          });
        }
      }
    }
    
    return events;
  },

  get(category, type) {
    if (!this[category]) {
      return null;
    }
    return this[category][type] || null;
  }
};