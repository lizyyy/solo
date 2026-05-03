# 二手电子产品验货和担保交易 API

一个本地运行的二手电子产品验货和担保交易后端服务，适用于微信群或熟人圈交易场景。

## 功能特性

- **用户管理**：买家和卖家用户信息管理
- **商品管理**：记录二手电子产品详细信息（型号、序列号、成色、配件、电池健康/快门数等）
- **订单管理**：完整的订单状态机，支持订金/尾款冻结与释放
- **验货管理**：买家可按清单提交验货结果、备注和证据
- **物流管理**：物流信息跟踪
- **争议处理**：争议记录、责任归类、处理建议和超时升级
- **交易导出**：支持将完整交易记录导出为 Markdown 或 JSON 格式

## 技术栈

- **Node.js** >= 18.0.0
- **Express** - Web 框架
- **SQLite3** - 本地持久化数据库
- **Knex.js** - SQL 查询构建器和迁移工具
- **express-validator** - 输入校验
- **JWT** - 身份认证
- **Jest** - 测试框架

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

```bash
cp .env.example .env
```

编辑 `.env` 文件，根据需要修改配置。

### 3. 运行数据库迁移

```bash
npm run migrate
```

### 4. 填充种子数据

```bash
npm run seed
```

### 5. 启动服务

```bash
# 开发模式
npm run dev

# 生产模式
npm start
```

服务将在 `http://localhost:3000` 运行。

## 项目结构

```
├── data/                  # 数据库文件目录
├── src/
│   ├── controllers/       # 控制器
│   ├── db/
│   │   ├── migrations/    # 数据库迁移
│   │   ├── seeds/         # 种子数据
│   │   └── index.js       # 数据库连接
│   ├── middleware/        # 中间件
│   ├── models/            # 数据模型
│   ├── routes/            # 路由定义
│   ├── scripts/           # 脚本文件
│   ├── utils/             # 工具函数
│   ├── app.js             # Express 应用配置
│   └── server.js          # 服务器入口
├── tests/                 # 测试文件
├── .env.example           # 环境变量示例
├── .gitignore
├── knexfile.js            # Knex 配置
├── package.json
└── README.md
```

## API 文档

### 基础 URL
```
http://localhost:3000/api/v1
```

### 通用响应格式

**成功响应：**
```json
{
  "success": true,
  "data": {},
  "message": "操作成功"
}
```

**错误响应：**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入参数错误",
    "details": []
  }
}
```

### 订单状态流转

```
草稿 → 已锁定订金 → 已发货 → 买家验货中 → 确认放款 → 已完成
                ↓           ↓
            部分退款 ← 争议中
                ↓
              已关闭
```

## CURL 示例

### 1. 用户注册
```bash
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "email": "zhangsan@example.com",
    "password": "Secure123!",
    "phone": "13800138000"
  }'
```

### 2. 用户登录
```bash
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "zhangsan@example.com",
    "password": "Secure123!"
  }'
```

### 3. 创建商品
```bash
curl -X POST http://localhost:3000/api/v1/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "title": "iPhone 13 Pro Max 256GB",
    "description": "自用一年，保养良好",
    "category": "phone",
    "brand": "Apple",
    "model": "iPhone 13 Pro Max",
    "serial_number_suffix": "2345",
    "condition": "good",
    "accessories": ["charger", "case", "original_box"],
    "specs": {
      "battery_health": 89,
      "storage": "256GB",
      "color": "远峰蓝"
    },
    "price": 5999.00,
    "deposit_ratio": 0.3
  }'
```

### 4. 创建订单
```bash
curl -X POST http://localhost:3000/api/v1/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "product_id": "PRODUCT_UUID",
    "final_price": 5800.00,
    "notes": "希望当面验货"
  }'
```

### 5. 确认订单并锁定订金
```bash
curl -X POST http://localhost:3000/api/v1/orders/ORDER_UUID/confirm-deposit \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "payment_method": "wechat",
    "transaction_id": "wx_20240101001"
  }'
```

### 6. 标记发货
```bash
curl -X POST http://localhost:3000/api/v1/orders/ORDER_UUID/ship \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "logistics_company": "顺丰速运",
    "tracking_number": "SF1234567890"
  }'
```

### 7. 提交验货结果
```bash
curl -X POST http://localhost:3000/api/v1/orders/ORDER_UUID/inspection \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "items": [
      {
        "name": "外观成色",
        "description": "检查屏幕、边框是否有划痕",
        "result": "pass",
        "evidence_urls": ["https://example.com/photo1.jpg"],
        "notes": "屏幕有轻微划痕，符合描述"
      },
      {
        "name": "功能测试",
        "description": "测试触控、相机、扬声器",
        "result": "pass",
        "evidence_urls": ["https://example.com/video1.mp4"]
      }
    ],
    "overall_result": "pass",
    "notes": "整体符合描述"
  }'
```

### 8. 确认放款
```bash
curl -X POST http://localhost:3000/api/v1/orders/ORDER_UUID/confirm-release \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 9. 导出交易记录
```bash
# JSON 格式
curl -X GET http://localhost:3000/api/v1/orders/ORDER_UUID/export?format=json \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Markdown 格式
curl -X GET http://localhost:3000/api/v1/orders/ORDER_UUID/export?format=markdown \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## 运行测试

```bash
# 运行所有测试
npm test

# 监听模式
npm run test:watch
```

## 数据库管理

```bash
# 运行迁移
npm run migrate

# 回滚迁移
npm run migrate:rollback

# 填充种子数据
npm run seed
```

## 许可证

MIT
