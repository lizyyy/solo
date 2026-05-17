-- 正常的表
CREATE TABLE users (
    id INT PRIMARY KEY COMMENT '用户ID',
    name VARCHAR(100) NOT NULL COMMENT '用户名',
    email VARCHAR(255) COMMENT '用户邮箱',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP
) COMMENT '用户表';

-- 缺少表注释
CREATE TABLE orders (
    id INT PRIMARY KEY COMMENT '订单ID',
    user_id INT NOT NULL COMMENT '用户ID',
    total_amount DECIMAL(10, 2) NOT NULL COMMENT '订单总金额',
    status INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间'
);

-- 矛盾注释示例（同一个字段有不同注释）
CREATE TABLE products (
    id INT PRIMARY KEY COMMENT '产品ID',
    name VARCHAR(100) NOT NULL COMMENT '商品名称',
    price DECIMAL(10, 2) NOT NULL COMMENT '价格'
) COMMENT '商品表';

CREATE TABLE products (
    id INT PRIMARY KEY COMMENT '产品主键',
    name VARCHAR(100) NOT NULL COMMENT '产品名称',
    price DECIMAL(10, 2) NOT NULL COMMENT '售价'
) COMMENT '产品表';

-- 这是一行坏数据
INVALID SQL SYNTAX HERE

-- 重复注释示例
CREATE TABLE category (
    id INT PRIMARY KEY COMMENT 'ID',
    name VARCHAR(100) NOT NULL COMMENT '名称'
) COMMENT '分类表';

CREATE TABLE tag (
    id INT PRIMARY KEY COMMENT 'ID',
    name VARCHAR(100) NOT NULL COMMENT '名称'
) COMMENT '标签表';
