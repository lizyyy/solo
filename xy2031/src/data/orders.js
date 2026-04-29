export const ORDER_STATUS = {
  PENDING_PAYMENT: { id: 'pending_payment', name: '待支付', color: 'text-orange-500', bgColor: 'bg-orange-50' },
  PENDING_SHIPMENT: { id: 'pending_shipment', name: '待发货', color: 'text-blue-500', bgColor: 'bg-blue-50' },
  SHIPPED: { id: 'shipped', name: '已发货', color: 'text-purple-500', bgColor: 'bg-purple-50' },
  DELIVERED: { id: 'delivered', name: '已签收', color: 'text-green-500', bgColor: 'bg-green-50' },
  COMPLETED: { id: 'completed', name: '已完成', color: 'text-gray-500', bgColor: 'bg-gray-50' },
  CANCELLED: { id: 'cancelled', name: '已取消', color: 'text-red-500', bgColor: 'bg-red-50' },
  RETURNED: { id: 'returned', name: '已退货', color: 'text-gray-500', bgColor: 'bg-gray-50' }
}

export const ORDERS = [
  {
    id: 'order_20240425001',
    orderNo: 'TC202404250001',
    userId: 'user_001',
    status: 'delivered',
    totalAmount: 143.7,
    discountAmount: 20.0,
    shippingFee: 0,
    actualAmount: 123.7,
    pointsEarned: 12,
    paymentMethod: '微信支付',
    shippingAddress: {
      name: '张三',
      phone: '13812345678',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号SOHO现代城A座1201室'
    },
    items: [
      {
        id: 'order_item_001',
        productId: 'prod_001',
        name: '故宫文创冰箱贴',
        image: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?w=200',
        price: 24.9,
        originalPrice: 29.9,
        quantity: 3,
        specs: {
          color: 'red',
          shape: 'square',
          size: 'medium'
        }
      },
      {
        id: 'order_item_002',
        productId: 'prod_005',
        name: '上海外滩夜景明信片',
        image: 'https://images.unsplash.com/photo-1537996194471-e657df975ab4?w=200',
        price: 15.0,
        originalPrice: 18.0,
        quantity: 2,
        specs: {
          color: 'white',
          shape: 'rectangle',
          size: 'medium'
        }
      }
    ],
    logistics: {
      company: '顺丰速运',
      trackingNo: 'SF1234567890123',
      status: 'delivered',
      estimatedDelivery: '2024-04-28',
      actualDelivery: '2024-04-27',
      timeline: [
        {
          time: '2024-04-27 14:30',
          status: '已签收',
          description: '快递已被签收，感谢使用顺丰速运'
        },
        {
          time: '2024-04-27 08:15',
          status: '派送中',
          description: '快递员张师傅正在为您派送，电话：138****9999'
        },
        {
          time: '2024-04-26 20:45',
          status: '到达派送站',
          description: '快递已到达【北京朝阳营业点】'
        },
        {
          time: '2024-04-25 15:30',
          status: '已发货',
          description: '商家已发货，快递正在运输中'
        },
        {
          time: '2024-04-25 10:00',
          status: '订单确认',
          description: '订单已确认，等待商家发货'
        }
      ]
    },
    createdAt: '2024-04-25T10:00:00Z',
    paidAt: '2024-04-25T10:05:00Z',
    shippedAt: '2024-04-25T15:30:00Z',
    deliveredAt: '2024-04-27T14:30:00Z',
    canCancel: false,
    canReturn: false,
    canReview: true
  },
  {
    id: 'order_20240426001',
    orderNo: 'TC202404260002',
    userId: 'user_001',
    status: 'shipped',
    totalAmount: 148.0,
    discountAmount: 30.0,
    shippingFee: 0,
    actualAmount: 118.0,
    pointsEarned: 11,
    paymentMethod: '支付宝',
    shippingAddress: {
      name: '张三',
      phone: '13812345678',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号SOHO现代城A座1201室'
    },
    items: [
      {
        id: 'order_item_003',
        productId: 'prod_011',
        name: '大理风花雪月冰箱贴套装',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
        price: 45.0,
        originalPrice: 58.0,
        quantity: 2,
        specs: {
          color: 'blue',
          shape: 'square',
          size: 'medium'
        }
      },
      {
        id: 'order_item_004',
        productId: 'prod_014',
        name: '玉龙雪山钥匙扣',
        image: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=200',
        price: 28.0,
        originalPrice: 35.0,
        quantity: 1,
        specs: {
          color: 'silver',
          shape: 'circle',
          size: 'small'
        }
      }
    ],
    logistics: {
      company: '圆通速递',
      trackingNo: 'YT9876543210987',
      status: 'shipped',
      estimatedDelivery: '2024-04-29',
      actualDelivery: null,
      timeline: [
        {
          time: '2024-04-28 06:30',
          status: '运输中',
          description: '快递已到达【北京转运中心】，正在分拣中'
        },
        {
          time: '2024-04-27 18:45',
          status: '运输中',
          description: '快递已从【昆明转运中心】发出'
        },
        {
          time: '2024-04-26 16:20',
          status: '已发货',
          description: '商家已发货，快递正在运输中'
        },
        {
          time: '2024-04-26 11:30',
          status: '订单确认',
          description: '订单已确认，等待商家发货'
        }
      ]
    },
    createdAt: '2024-04-26T11:30:00Z',
    paidAt: '2024-04-26T11:35:00Z',
    shippedAt: '2024-04-26T16:20:00Z',
    deliveredAt: null,
    canCancel: false,
    canReturn: true,
    canReview: false
  },
  {
    id: 'order_20240428001',
    orderNo: 'TC202404280003',
    userId: 'user_001',
    status: 'pending_payment',
    totalAmount: 198.0,
    discountAmount: 20.0,
    shippingFee: 10.0,
    actualAmount: 188.0,
    pointsEarned: 0,
    paymentMethod: null,
    shippingAddress: {
      name: '李四',
      phone: '13987654321',
      province: '上海市',
      city: '上海市',
      district: '浦东新区',
      detail: '陆家嘴环路1000号恒生银行大厦'
    },
    items: [
      {
        id: 'order_item_005',
        productId: 'prod_019',
        name: '薰衣草精油手办礼盒',
        image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=200',
        price: 128.0,
        originalPrice: 158.0,
        quantity: 1,
        specs: {
          color: 'purple',
          shape: 'circle',
          size: 'medium'
        }
      },
      {
        id: 'order_item_006',
        productId: 'prod_020',
        name: '那拉提草原风光明信片套装',
        image: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=200',
        price: 25.0,
        originalPrice: 32.0,
        quantity: 2,
        specs: {
          color: 'white',
          shape: 'rectangle',
          size: 'medium'
        }
      }
    ],
    logistics: null,
    createdAt: '2024-04-28T14:30:00Z',
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    canCancel: true,
    canReturn: false,
    canReview: false,
    paymentDeadline: '2024-04-29T14:30:00Z'
  },
  {
    id: 'order_20240429001',
    orderNo: 'TC202404290004',
    userId: 'user_001',
    status: 'pending_shipment',
    totalAmount: 246.0,
    discountAmount: 40.0,
    shippingFee: 0,
    actualAmount: 206.0,
    pointsEarned: 0,
    paymentMethod: '微信支付',
    shippingAddress: {
      name: '张三',
      phone: '13812345678',
      province: '北京市',
      city: '北京市',
      district: '朝阳区',
      detail: '建国路88号SOHO现代城A座1201室'
    },
    items: [
      {
        id: 'order_item_007',
        productId: 'prod_008',
        name: '粤式早茶点心手办套装',
        image: 'https://images.unsplash.com/photo-1529921879218-f99546d03a98?w=200',
        price: 128.0,
        originalPrice: 168.0,
        quantity: 1,
        specs: {
          color: 'gold',
          shape: 'circle',
          size: 'medium'
        }
      },
      {
        id: 'order_item_008',
        productId: 'prod_013',
        name: '白族扎染围巾',
        image: 'https://images.unsplash.com/photo-1520903920243-00d872a2d1c9?w=200',
        price: 148.0,
        originalPrice: 188.0,
        quantity: 1,
        specs: {
          color: 'blue',
          shape: 'rectangle',
          size: 'large'
        }
      }
    ],
    logistics: null,
    createdAt: '2024-04-29T09:15:00Z',
    paidAt: '2024-04-29T09:20:00Z',
    shippedAt: null,
    deliveredAt: null,
    canCancel: true,
    canReturn: false,
    canReview: false
  }
]

export function getOrderById(id) {
  return ORDERS.find(o => o.id === id)
}

export function getOrdersByUserId(userId, status = null) {
  let orders = ORDERS.filter(o => o.userId === userId)
  
  if (status) {
    orders = orders.filter(o => o.status === status)
  }
  
  return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
}

export function getOrderStatusInfo(statusId) {
  return ORDER_STATUS[statusId.toUpperCase()] || ORDER_STATUS.PENDING_PAYMENT
}

export function createOrder(orderData) {
  const newOrder = {
    id: `order_${Date.now()}`,
    orderNo: `TC${Date.now().toString().slice(-10)}`,
    userId: 'user_001',
    status: 'pending_payment',
    ...orderData,
    logistics: null,
    createdAt: new Date().toISOString(),
    paidAt: null,
    shippedAt: null,
    deliveredAt: null,
    canCancel: true,
    canReturn: false,
    canReview: false,
    paymentDeadline: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  }
  
  ORDERS.unshift(newOrder)
  return newOrder
}

export function payOrder(orderId) {
  const order = getOrderById(orderId)
  if (order && order.status === 'pending_payment') {
    order.status = 'pending_shipment'
    order.paidAt = new Date().toISOString()
    order.canCancel = true
    return order
  }
  return null
}

export function cancelOrder(orderId, reason) {
  const order = getOrderById(orderId)
  if (order && order.canCancel) {
    order.status = 'cancelled'
    order.cancelReason = reason
    order.cancelledAt = new Date().toISOString()
    order.canCancel = false
    return order
  }
  return null
}

export function applyReturn(orderId, reason) {
  const order = getOrderById(orderId)
  if (order && order.canReturn) {
    order.returnStatus = 'pending'
    order.returnReason = reason
    order.returnAppliedAt = new Date().toISOString()
    return order
  }
  return null
}
