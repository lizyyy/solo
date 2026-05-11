"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.initializeSeedData = initializeSeedData;
const uuid_1 = require("uuid");
const types_1 = require("../shared/types");
const database_1 = require("./database");
const DEFAULT_USERS = [
    {
        id: (0, uuid_1.v4)(),
        username: 'admin',
        password: 'admin123',
        name: '系统管理员',
        role: types_1.UserRole.ADMIN
    },
    {
        id: (0, uuid_1.v4)(),
        username: 'cs001',
        password: 'cs001123',
        name: '客服张三',
        role: types_1.UserRole.CUSTOMER_SERVICE
    },
    {
        id: (0, uuid_1.v4)(),
        username: 'cs002',
        password: 'cs002123',
        name: '客服李四',
        role: types_1.UserRole.CUSTOMER_SERVICE
    },
    {
        id: (0, uuid_1.v4)(),
        username: 'user001',
        password: 'user001123',
        name: '普通用户王五',
        role: types_1.UserRole.NORMAL
    }
];
const SAMPLE_ORDERS = [
    {
        orderNo: 'RS202605090001',
        customerName: '张晓明',
        customerPhone: '13800138001',
        customerAddress: '北京市朝阳区建国路88号',
        productName: '华为Mate 60 Pro手机壳',
        productSku: 'HW-MATE60-PRO-CASE-01',
        quantity: 2,
        reason: '商品损坏',
        description: '收到货后发现手机壳边角有明显裂痕',
        status: types_1.ReissueStatus.PENDING
    },
    {
        orderNo: 'RS202605090002',
        customerName: '李小红',
        customerPhone: '13900139002',
        customerAddress: '上海市浦东新区世纪大道100号',
        productName: 'iPhone 15 Pro 充电器',
        productSku: 'APPLE-IPHONE15-CHARGER-20W',
        quantity: 1,
        reason: '发错商品',
        description: '订购的是20W快充，收到的是5W慢充',
        status: types_1.ReissueStatus.PROCESSING
    },
    {
        orderNo: 'RS202605090003',
        customerName: '王大伟',
        customerPhone: '13700137003',
        customerAddress: '广州市天河区珠江新城',
        productName: '小米手环8表带',
        productSku: 'XM-BAND8-STRAP-SILICON',
        quantity: 3,
        reason: '数量不足',
        description: '订购了5个，但只收到了2个',
        status: types_1.ReissueStatus.SHIPPED
    },
    {
        orderNo: 'RS202605080004',
        customerName: '赵小芳',
        customerPhone: '13600136004',
        customerAddress: '深圳市南山区科技园',
        productName: 'MacBook Pro 14寸电脑包',
        productSku: 'APPLE-MBP14-BAG-01',
        quantity: 1,
        reason: '质量问题',
        description: '拉链使用一周后出现卡顿，开合不顺畅',
        status: types_1.ReissueStatus.COMPLETED
    },
    {
        orderNo: 'RS202605080005',
        customerName: '刘强',
        customerPhone: '13500135005',
        customerAddress: '杭州市西湖区文三路',
        productName: 'AirPods Pro 2 保护套',
        productSku: 'APPLE-AIRPODSPRO2-CASE-01',
        quantity: 1,
        reason: '颜色不符',
        description: '订购的是蓝色，收到的是黑色',
        status: types_1.ReissueStatus.FAILED
    },
    {
        orderNo: 'RS202605070006',
        customerName: '陈静',
        customerPhone: '13400134006',
        customerAddress: '成都市武侯区天府大道',
        productName: 'iPad Air 5 保护膜',
        productSku: 'APPLE-IPADAIR5-SCREEN-01',
        quantity: 2,
        reason: '快递丢失',
        description: '物流显示已签收，但实际未收到',
        status: types_1.ReissueStatus.CANCELLED
    },
    {
        orderNo: 'RS202605070007',
        customerName: '周明',
        customerPhone: '13300133007',
        customerAddress: '南京市鼓楼区中山北路',
        productName: 'Switch 游戏卡带收纳盒',
        productSku: 'NIN-SWITCH-CASE-01',
        quantity: 1,
        reason: '版本错误',
        description: '订购的是可装24卡带，收到的只能装12个',
        status: types_1.ReissueStatus.DELIVERED
    },
    {
        orderNo: 'RS202605060008',
        customerName: '吴丽',
        customerPhone: '13200132008',
        customerAddress: '武汉市江汉区解放大道',
        productName: 'Kindle Paperwhite 5 保护套',
        productSku: 'AMZ-KINDLEPW5-CASE-01',
        quantity: 1,
        reason: '其他',
        description: '客户主动要求更换款式',
        status: types_1.ReissueStatus.PROCESSING
    }
];
function initializeSeedData() {
    const db = (0, database_1.getDatabase)();
    const now = new Date().toISOString();
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get();
    if (userCount.count === 0) {
        console.log('正在初始化用户数据...');
        const stmt = db.prepare(`
      INSERT INTO users (id, username, password, name, role, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
        DEFAULT_USERS.forEach(user => {
            stmt.run(user.id, user.username, user.password, user.name, user.role, now, now);
        });
        console.log(`已创建 ${DEFAULT_USERS.length} 个用户`);
    }
    const orderCount = db.prepare('SELECT COUNT(*) as count FROM reissue_orders').get();
    if (orderCount.count === 0) {
        console.log('正在初始化订单数据...');
        const orderStmt = db.prepare(`
      INSERT INTO reissue_orders (
        id, order_no, customer_name, customer_phone, customer_address,
        product_name, product_sku, quantity, reason, description,
        status, assignee_id, assignee_name, tracking_no, shipping_company,
        retry_count, created_at, updated_at, completed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const historyStmt = db.prepare(`
      INSERT INTO reissue_history (
        id, order_id, before_status, after_status, change_reason,
        operator_id, operator_name, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        const csUser = db.prepare('SELECT id, name FROM users WHERE role = ?').get(types_1.UserRole.CUSTOMER_SERVICE);
        const adminUser = db.prepare('SELECT id, name FROM users WHERE role = ?').get(types_1.UserRole.ADMIN);
        SAMPLE_ORDERS.forEach((order, index) => {
            const orderId = (0, uuid_1.v4)();
            const createdAt = new Date(Date.now() - index * 24 * 60 * 60 * 1000).toISOString();
            const trackingNo = order.status === types_1.ReissueStatus.SHIPPED || order.status === types_1.ReissueStatus.DELIVERED || order.status === types_1.ReissueStatus.COMPLETED
                ? `SF${Math.floor(Math.random() * 10000000000)}`
                : null;
            orderStmt.run(orderId, order.orderNo, order.customerName, order.customerPhone, order.customerAddress, order.productName, order.productSku, order.quantity, order.reason, order.description, order.status, csUser?.id || null, csUser?.name || null, trackingNo, trackingNo ? '顺丰速运' : null, 0, createdAt, createdAt, order.status === types_1.ReissueStatus.COMPLETED ? createdAt : null);
            historyStmt.run((0, uuid_1.v4)(), orderId, null, types_1.ReissueStatus.PENDING, '创建订单', adminUser?.id || '', adminUser?.name || '系统', createdAt);
            if (order.status !== types_1.ReissueStatus.PENDING) {
                historyStmt.run((0, uuid_1.v4)(), orderId, types_1.ReissueStatus.PENDING, order.status, getStatusChangeReason(order.status), csUser?.id || '', csUser?.name || '客服', createdAt);
            }
        });
        console.log(`已创建 ${SAMPLE_ORDERS.length} 个订单`);
    }
}
function getStatusChangeReason(status) {
    const reasons = {
        [types_1.ReissueStatus.PROCESSING]: '开始处理补发',
        [types_1.ReissueStatus.SHIPPED]: '补发商品已发货',
        [types_1.ReissueStatus.DELIVERED]: '商品已送达',
        [types_1.ReissueStatus.COMPLETED]: '客户确认收货，补发完成',
        [types_1.ReissueStatus.CANCELLED]: '客户取消补发',
        [types_1.ReissueStatus.FAILED]: '补发处理失败'
    };
    return reasons[status] || '状态变更';
}
