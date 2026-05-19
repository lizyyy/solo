# 订单回调合并站

> 多平台电商订单回调数据统一管理平台 - 解决客服在三套后台来回查询的痛点

## 项目概述

这是一个偏技术方向的全栈Web/API应用，用于统一管理多个电商平台的订单回调数据。系统支持载荷归一化、状态合并、异常回执、重复事件去重、统一检索等核心功能。

## 技术栈

- **后端**: Python 3.x + Flask + SQLAlchemy
- **前端**: 原生 HTML/JavaScript (无需框架)
- **数据库**: SQLite (可扩展至其他数据库)
- **跨域**: Flask-CORS

## 目录结构

```
order-callback-merge/
├── backend/
│   ├── app/
│   │   ├── __init__.py      # 应用初始化
│   │   ├── models.py        # 数据模型
│   │   ├── services.py      # 业务逻辑
│   │   ├── api.py           # API接口
│   │   └── config.py        # 配置
│   ├── requirements.txt     # 依赖
│   └── run.py               # 启动入口
├── frontend/
│   └── index.html           # 控制台页面
├── scripts/
│   └── generate_test_data.py # 测试数据生成
└── README.md
```

## 数据模型

### 核心实体

- **PlatformOrder (平台订单)**: 存储各平台原始订单
- **CallbackPayload (回调载荷)**: 存储每一次回调的原始数据及归一化结果
- **UnifiedOrder (统一订单)**: 合并后的订单，关联多个平台订单
- **MergeRule (合并规则)**: 归一化、状态映射、去重等规则配置
- **ExceptionReceipt (异常回执)**: 异常订单记录及处理状态
- **SearchIndex (查询索引)**: 统一检索索引优化

## 核心功能

### 1. 载荷归一化 (Payload Normalization)

将不同平台的字段映射到统一格式：

| 平台 | 平台字段 | 统一字段 |
|------|---------|---------|
| 淘宝 | tid | platform_order_id |
| 淘宝 | payment | amount |
| 淘宝 | buyer_nick | customer_name |
| 京东 | orderId | platform_order_id |
| 京东 | orderPrice | amount |
| 拼多多 | orderSn | platform_order_id |
| 拼多多 | orderAmount | amount |

### 2. 状态合并 (Status Merge)

按优先级合并各平台状态，终态优先：

| 优先级 | 状态 | 说明 |
|-------|------|------|
| 100 | after_sale | 售后 |
| 90 | exception | 异常 |
| 80 | completed | 已完成 (终态) |
| 70 | cancelled | 已取消 (终态) |
| 60 | shipped | 已发货 |
| 50 | paid | 已付款 |
| 40 | pending_payment | 待付款 |
| 30 | pending | 待处理 |

### 3. 重复事件去重 (Deduplication)

基于 `event_id` 去重，相同事件ID的重复回调直接拒绝。

### 4. 异常回执 (Exception Handling)

支持记录订单异常、标记严重程度、人工标记解决。

### 5. 统一检索 (Unified Search)

支持按订单号、客户、平台、状态等多维度搜索。

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
# 在 backend 目录下执行
python run.py
```

服务将在 `http://localhost:8080` 启动。

### 3. 生成测试数据

打开新的终端窗口：

```bash
cd scripts
pip install requests
python generate_test_data.py
```

脚本会自动生成以下测试场景：
- ✓ 成功回调示例
- ✓ 重复提交检测
- ✓ 异常订单记录
- ✓ 多平台订单数据 (淘宝/京东/拼多多)
- ✓ 状态推进/人工修正示例

### 4. 打开控制台

直接用浏览器打开 `frontend/index.html` 即可。

**无需启动额外前端服务！**

## API接口文档

### 回调接收

```bash
POST /api/callbacks
Content-Type: application/json

{
  "platform": "taobao",          # 平台标识
  "platform_order_id": "TB123",  # 平台订单号
  "event_type": "trade_success", # 事件类型
  "event_id": "EVT12345",        # 事件唯一ID
  "payload": {...}               # 原始回调载荷
}
```

响应：
```json
{
  "success": true,
  "unified_order_id": 1,
  "unified_order_no": "U202401151234561",
  "callback_id": 1,
  "platform_order_id": 1
}
```

### 订单查询

```bash
# 分页查询
GET /api/orders?page=1&per_page=10

# 按状态过滤
GET /api/orders?status=paid

# 按平台过滤
GET /api/orders?platform=taobao

# 搜索关键词
GET /api/orders?search=张三
```

### 订单详情

```bash
GET /api/orders/{order_id}
```

返回完整信息，包括平台订单、回调历史、异常记录。

### 状态推进/人工修正

```bash
PUT /api/orders/{order_id}/status
Content-Type: application/json

{
  "status": "shipped",
  "operator": "客服小王"
}
```

### 异常管理

```bash
# 创建异常
POST /api/exceptions
{
  "unified_order_id": 1,
  "exception_type": "payment_mismatch",
  "severity": "critical",
  "message": "支付金额不匹配",
  "callback_id": 5
}

# 查询异常列表
GET /api/exceptions?status=open

# 解决异常
POST /api/exceptions/{exception_id}/resolve
{
  "resolved_by": "客服小李",
  "resolution_note": "已确认金额, 系统BUG已修复"
}
```

### 数据导出

```bash
# 导出为CSV
GET /api/orders/export?format=csv

# 导出JSON (默认)
GET /api/orders/export

# 带过滤条件导出
GET /api/orders/export?status=exception&platform=taobao
```

### 统计面板

```bash
GET /api/dashboard/stats
```

响应：
```json
{
  "total_orders": 50,
  "exception_orders": 3,
  "open_exceptions": 2,
  "status_stats": {"paid": 20, "shipped": 15, "completed": 10, "exception": 3},
  "platform_stats": {"taobao": 25, "jd": 15, "pdd": 10}
}
```

### 规则查询

```bash
GET /api/rules
```

查看所有激活的归一化规则、状态映射、去重配置。

## 前端控制台功能

打开 `frontend/index.html` 即可使用以下功能：

### 1. 统计概览
- 总订单数
- 异常订单数
- 待处理异常数
- 接入平台数量

### 2. 订单列表
- 分页展示所有统一订单
- 按状态、平台过滤
- 关键词搜索
- 查看详情模态框
- 导出CSV
- 人工更新状态

### 3. 异常管理
- 待处理/已解决异常列表
- 查看异常详情
- 标记异常为已解决

### 4. 规则配置
- 查看所有合并规则配置
- 字段映射详情
- 优先级展示

### 5. 快速测试面板
前端内置测试按钮，可一键：
- 模拟成功回调
- 测试重复提交检测
- 测试异常订单
- 生成批量测试数据

## 测试场景

项目已覆盖5类核心测试场景：

| 场景 | 说明 | 测试方式 |
|------|------|---------|
| 成功回调 | 正常接收各平台订单 | 前端按钮 / 脚本 |
| 重复提交 | 相同event_id去重 | 前端按钮 / 脚本 |
| 异常订单 | 金额不匹配等异常 | 前端按钮 / 脚本 |
| 多平台数据 | 淘宝/京东/拼多多混合 | 脚本 |
| 人工修正 | 客服手动推进状态 | 前端操作 / API |

## 扩展说明

### 添加新平台

1. 在 `backend/app/services.py` 的默认规则中添加平台配置
2. 添加对应的字段映射和状态映射
3. 重启服务即可生效

### 更换数据库

在 `backend/app/config.py` 中修改 `SQLALCHEMY_DATABASE_URI`:

```python
# PostgreSQL
SQLALCHEMY_DATABASE_URI = 'postgresql://user:pass@localhost/orders'

# MySQL
SQLALCHEMY_DATABASE_URI = 'mysql+pymysql://user:pass@localhost/orders'
```

### 配置生产环境

```bash
# 设置环境变量
export SECRET_KEY="your-production-secret-key"
export DATABASE_URL="postgresql://..."

# 使用生产级WSGI服务器
pip install gunicorn
gunicorn -w 4 -b 0.0.0.0:8080 run:app
```

## 常见问题

**Q: 前端打开后显示"加载失败"?**
> A: 请确保后端服务已启动 (http://localhost:8080)，检查浏览器控制台是否有CORS错误。

**Q: 如何重置所有数据?**
> A: 直接删除 `backend/orders.db` 文件，重启服务会自动重建空数据库。

**Q: 如何添加自定义的合并规则?**
> A: 修改 `MergeRule` 表，或在 `services.py` 中扩展业务逻辑。

**Q: 支持更多平台吗?**
> A: 是的，系统设计为平台无关架构，只需添加对应字段映射规则即可接入新平台。

## 许可证

MIT License - 详见 LICENSE 文件