-- ========================================
-- 积分商城库存预占释放系统 - 数据库 Schema
-- ========================================

-- 1. 商品表
CREATE TABLE IF NOT EXISTS products (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '商品ID',
    product_code VARCHAR(64) NOT NULL UNIQUE COMMENT '商品编码',
    product_name VARCHAR(255) NOT NULL COMMENT '商品名称',
    points_price INT NOT NULL COMMENT '积分价格',
    total_stock INT NOT NULL DEFAULT 0 COMMENT '总库存',
    available_stock INT NOT NULL DEFAULT 0 COMMENT '可用库存',
    reserved_stock INT NOT NULL DEFAULT 0 COMMENT '预占库存',
    sold_stock INT NOT NULL DEFAULT 0 COMMENT '已售库存',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-下架, 1-上架',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_product_code (product_code),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='商品表';

-- 2. 会员表
CREATE TABLE IF NOT EXISTS members (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '会员ID',
    member_no VARCHAR(64) NOT NULL UNIQUE COMMENT '会员编号',
    member_name VARCHAR(128) NOT NULL COMMENT '会员姓名',
    phone VARCHAR(32) COMMENT '手机号',
    points_balance INT NOT NULL DEFAULT 0 COMMENT '积分余额',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-正常',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_member_no (member_no),
    INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='会员表';

-- 3. 释放原因字典表
CREATE TABLE IF NOT EXISTS release_reasons (
    id INT PRIMARY KEY AUTO_INCREMENT COMMENT '原因ID',
    reason_code VARCHAR(32) NOT NULL UNIQUE COMMENT '原因编码',
    reason_name VARCHAR(128) NOT NULL COMMENT '原因名称',
    reason_type TINYINT NOT NULL COMMENT '原因类型: 1-系统自动, 2-用户取消, 3-支付失败, 4-人工处理',
    need_manual TINYINT NOT NULL DEFAULT 0 COMMENT '是否需要人工处理: 0-否, 1-是',
    description VARCHAR(512) COMMENT '原因描述',
    sort_order INT NOT NULL DEFAULT 0 COMMENT '排序',
    status TINYINT NOT NULL DEFAULT 1 COMMENT '状态: 0-禁用, 1-启用',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_reason_code (reason_code),
    INDEX idx_reason_type (reason_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='释放原因字典表';

-- 4. 预占单表（核心表）
CREATE TABLE IF NOT EXISTS stock_reservations (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '预占单ID',
    reservation_no VARCHAR(64) NOT NULL UNIQUE COMMENT '预占单号',
    product_id BIGINT NOT NULL COMMENT '商品ID',
    product_code VARCHAR(64) NOT NULL COMMENT '商品编码',
    member_id BIGINT NOT NULL COMMENT '会员ID',
    member_no VARCHAR(64) NOT NULL COMMENT '会员编号',
    quantity INT NOT NULL DEFAULT 1 COMMENT '预占数量',
    points_amount INT NOT NULL COMMENT '积分金额',
    status TINYINT NOT NULL DEFAULT 10 COMMENT '状态: 10-可兑换, 20-预占中, 30-已释放, 40-已兑换, 50-待人工处理',
    release_reason_id INT COMMENT '释放原因ID',
    release_reason_code VARCHAR(32) COMMENT '释放原因编码',
    release_remark VARCHAR(512) COMMENT '释放备注',
    operator VARCHAR(64) COMMENT '操作人',
    expired_at DATETIME NOT NULL COMMENT '预占过期时间',
    released_at DATETIME COMMENT '释放时间',
    exchanged_at DATETIME COMMENT '兑换时间',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_reservation_no (reservation_no),
    INDEX idx_product_id (product_id),
    INDEX idx_member_id (member_id),
    INDEX idx_status (status),
    INDEX idx_expired_at (expired_at),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预占单表';

-- 5. 操作日志表（审计追踪核心）
CREATE TABLE IF NOT EXISTS stock_reservation_logs (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '日志ID',
    reservation_id BIGINT NOT NULL COMMENT '预占单ID',
    reservation_no VARCHAR(64) NOT NULL COMMENT '预占单号',
    operation_type VARCHAR(32) NOT NULL COMMENT '操作类型: CREATE, RESERVE, RELEASE, EXCHANGE, MANUAL, EXPIRE',
    operation_desc VARCHAR(128) NOT NULL COMMENT '操作描述',
    before_status TINYINT COMMENT '操作前状态',
    after_status TINYINT NOT NULL COMMENT '操作后状态',
    before_stock JSON COMMENT '操作前库存快照',
    after_stock JSON COMMENT '操作后库存快照',
    release_reason_id INT COMMENT '释放原因ID',
    release_reason_code VARCHAR(32) COMMENT '释放原因编码',
    remark VARCHAR(512) COMMENT '备注',
    operator VARCHAR(64) COMMENT '操作人',
    operator_ip VARCHAR(64) COMMENT '操作IP',
    request_id VARCHAR(64) COMMENT '请求ID',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    INDEX idx_reservation_id (reservation_id),
    INDEX idx_reservation_no (reservation_no),
    INDEX idx_operation_type (operation_type),
    INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='库存预占操作日志表';

-- 6. 兑换订单表
CREATE TABLE IF NOT EXISTS exchange_orders (
    id BIGINT PRIMARY KEY AUTO_INCREMENT COMMENT '订单ID',
    order_no VARCHAR(64) NOT NULL UNIQUE COMMENT '订单号',
    reservation_id BIGINT NOT NULL COMMENT '预占单ID',
    reservation_no VARCHAR(64) NOT NULL COMMENT '预占单号',
    product_id BIGINT NOT NULL COMMENT '商品ID',
    product_code VARCHAR(64) NOT NULL COMMENT '商品编码',
    member_id BIGINT NOT NULL COMMENT '会员ID',
    member_no VARCHAR(64) NOT NULL COMMENT '会员编号',
    quantity INT NOT NULL DEFAULT 1 COMMENT '兑换数量',
    points_amount INT NOT NULL COMMENT '积分金额',
    pay_status TINYINT NOT NULL DEFAULT 10 COMMENT '支付状态: 10-待支付, 20-支付中, 30-支付成功, 40-支付失败',
    pay_time DATETIME COMMENT '支付时间',
    pay_transaction_id VARCHAR(128) COMMENT '支付交易号',
    pay_fail_reason VARCHAR(512) COMMENT '支付失败原因',
    status TINYINT NOT NULL DEFAULT 10 COMMENT '订单状态: 10-待处理, 20-处理中, 30-已完成, 40-已取消',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
    INDEX idx_order_no (order_no),
    INDEX idx_reservation_id (reservation_id),
    INDEX idx_member_id (member_id),
    INDEX idx_pay_status (pay_status),
    INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='兑换订单表';
