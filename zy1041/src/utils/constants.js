const ORDER_STATUSES = {
  PENDING_MATCHING: 'pending_matching',
  LOCKED: 'locked',
  BOTH_CONFIRMED: 'both_confirmed',
  PICKED_UP: 'picked_up',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  TIMEOUT_RELEASED: 'timeout_released',
  IN_DISPUTE: 'in_dispute'
};

const ORDER_STATUS_NAMES = {
  [ORDER_STATUSES.PENDING_MATCHING]: '待撮合',
  [ORDER_STATUSES.LOCKED]: '已锁定',
  [ORDER_STATUSES.BOTH_CONFIRMED]: '双方确认',
  [ORDER_STATUSES.PICKED_UP]: '取到物',
  [ORDER_STATUSES.DELIVERED]: '已送达',
  [ORDER_STATUSES.CANCELLED]: '取消',
  [ORDER_STATUSES.TIMEOUT_RELEASED]: '超时释放',
  [ORDER_STATUSES.IN_DISPUTE]: '争议中'
};

const STATUS_TRANSITIONS = {
  [ORDER_STATUSES.PENDING_MATCHING]: [
    { to: ORDER_STATUSES.LOCKED, actor: 'traveler', action: 'lock_order', description: '顺路人锁定订单' },
    { to: ORDER_STATUSES.CANCELLED, actor: 'requester', action: 'cancel_request', description: '发起人取消请求' },
    { to: ORDER_STATUSES.TIMEOUT_RELEASED, actor: 'system', action: 'timeout_release', description: '系统超时释放' }
  ],
  [ORDER_STATUSES.LOCKED]: [
    { to: ORDER_STATUSES.BOTH_CONFIRMED, actor: 'both', action: 'confirm_order', description: '双方确认订单' },
    { to: ORDER_STATUSES.CANCELLED, actor: 'either', action: 'cancel_order', description: '任一方取消订单' },
    { to: ORDER_STATUSES.TIMEOUT_RELEASED, actor: 'system', action: 'timeout_release', description: '系统超时释放' }
  ],
  [ORDER_STATUSES.BOTH_CONFIRMED]: [
    { to: ORDER_STATUSES.PICKED_UP, actor: 'traveler', action: 'pickup_item', description: '顺路人取到物品' },
    { to: ORDER_STATUSES.CANCELLED, actor: 'either', action: 'cancel_order', description: '任一方取消订单' },
    { to: ORDER_STATUSES.IN_DISPUTE, actor: 'either', action: 'raise_dispute', description: '任一方发起争议' }
  ],
  [ORDER_STATUSES.PICKED_UP]: [
    { to: ORDER_STATUSES.DELIVERED, actor: 'traveler', action: 'deliver_item', description: '顺路人送达物品' },
    { to: ORDER_STATUSES.CANCELLED, actor: 'either', action: 'cancel_order', description: '任一方取消订单' },
    { to: ORDER_STATUSES.IN_DISPUTE, actor: 'either', action: 'raise_dispute', description: '任一方发起争议' }
  ],
  [ORDER_STATUSES.DELIVERED]: [],
  [ORDER_STATUSES.CANCELLED]: [],
  [ORDER_STATUSES.TIMEOUT_RELEASED]: [],
  [ORDER_STATUSES.IN_DISPUTE]: [
    { to: ORDER_STATUSES.CANCELLED, actor: 'system', action: 'resolve_dispute_cancel', description: '系统解决争议-取消' },
    { to: ORDER_STATUSES.DELIVERED, actor: 'system', action: 'resolve_dispute_deliver', description: '系统解决争议-送达' }
  ]
};

const AUDIT_ACTIONS = {
  REQUEST_CREATED: 'request_created',
  TRIP_CREATED: 'trip_created',
  MATCHING_ATTEMPTED: 'matching_attempted',
  MATCHING_SUCCESS: 'matching_success',
  ORDER_LOCKED: 'order_locked',
  ORDER_CONFIRMED: 'order_confirmed',
  ITEM_PICKED_UP: 'item_picked_up',
  ITEM_DELIVERED: 'item_delivered',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_TIMEOUT: 'order_timeout',
  DISPUTE_RAISED: 'dispute_raised',
  DISPUTE_RESOLVED: 'dispute_resolved'
};

const MATCHING_WEIGHTS = {
  ROUTE_PROXIMITY: 0.35,
  TIME_WINDOW: 0.25,
  CAPACITY: 0.20,
  FORBIDDEN_ITEMS: 0.10,
  TIP_AMOUNT: 0.10
};

const LOCK_TIMEOUT_SECONDS = 300;

module.exports = {
  ORDER_STATUSES,
  ORDER_STATUS_NAMES,
  STATUS_TRANSITIONS,
  AUDIT_ACTIONS,
  MATCHING_WEIGHTS,
  LOCK_TIMEOUT_SECONDS
};
