"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STATUS_COLORS = exports.STATUS_LABELS = exports.RETRY_DELAY = exports.MAX_RETRY_COUNT = exports.DEFAULT_PAGE_SIZE = exports.ROLE_PERMISSIONS = exports.STATUS_TRANSITIONS = void 0;
exports.STATUS_TRANSITIONS = {
    pending: ['processing', 'cancelled'],
    processing: ['shipped', 'failed', 'cancelled'],
    shipped: ['delivered', 'failed'],
    delivered: ['completed'],
    completed: [],
    cancelled: [],
    failed: ['processing', 'cancelled']
};
exports.ROLE_PERMISSIONS = {
    admin: [
        'order.create',
        'order.read',
        'order.update',
        'order.delete',
        'order.export',
        'order.import',
        'order.batch_update',
        'user.create',
        'user.read',
        'user.update',
        'user.delete',
        'log.read',
        'system.recover',
        'system.config'
    ],
    customer_service: [
        'order.create',
        'order.read',
        'order.update',
        'order.export',
        'order.import',
        'order.batch_update',
        'log.read'
    ],
    normal: [
        'order.read',
        'order.export'
    ]
};
exports.DEFAULT_PAGE_SIZE = 20;
exports.MAX_RETRY_COUNT = 3;
exports.RETRY_DELAY = 60000;
exports.STATUS_LABELS = {
    pending: '待处理',
    processing: '处理中',
    shipped: '已发货',
    delivered: '已送达',
    completed: '已完成',
    cancelled: '已取消',
    failed: '处理失败'
};
exports.STATUS_COLORS = {
    pending: 'gold',
    processing: 'blue',
    shipped: 'cyan',
    delivered: 'purple',
    completed: 'green',
    cancelled: 'default',
    failed: 'red'
};
