# 第三方回调补偿站

## 项目简介

这是一个全栈应用，用于管理第三方回调的补偿、回滚和人工确认流程。系统解决了回调次数超限、签名验证失败等问题。

## 核心概念关系

```
合作方事件 → 签名验证 → 对账摘要
     ↓
签名无效/超重试次数 → 人工确认介入
```

## 功能特性

### 后端API (Python Flask)
- **查询事件**: 分页查询、按状态筛选、按合作方筛选
- **创建事件**: 自动验证签名，重复event_id自动拦截
- **补偿执行**: 重试回调，超过最大次数自动标记需人工确认
- **人工确认**: 重置重试次数，允许继续补偿
- **回滚操作**: 记录回滚原因和操作人
- **修正数据**: 修改回调URL、请求数据、对账摘要
- **批量导入**: 支持批量导入事件
- **统计数据**: 展示各状态事件数量

### 前端控制台 (HTML/JS)
- **错误明细**: 查看事件详情和补偿日志
- **回滚入口**: 执行回滚操作并记录原因
- **批量导入**: 批量导入回调事件
- **数据筛选**: 按状态、合作方、人工确认筛选
- **统计面板**: 实时展示各状态数据

## 项目结构

```
.
├── app.py              # Flask应用主文件，包含所有API
├── models.py           # SQLAlchemy数据库模型
├── index.html          # 前端控制台页面
├── app.js              # 前端逻辑
├── requirements.txt    # Python依赖
└── .env               # 环境配置
```

## 安装与运行

### 1. 安装Python依赖

```bash
pip install -r requirements.txt
```

### 2. 启动后端服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动

### 3. 打开前端控制台

在浏览器中直接打开 `index.html` 文件，或访问 `http://localhost:5000`

## 使用说明

### 验收测试流程

#### 测试1: 页面操作 + 接口重复提交验证

1. 点击"加载样例数据"按钮
2. 选择一个事件，点击"查看"
3. 多次点击"执行补偿"，观察重试次数变化
4. **关键点**: 使用curl重复提交同一event_id:
   ```bash
   curl -X POST http://localhost:5000/api/events \
     -H "Content-Type: application/json" \
     -d '{
       "partner_code": "ALIPAY",
       "event_id": "已存在的事件ID",
       "event_type": "PAYMENT",
       "callback_url": "https://example.com",
       "request_data": "{\"test\": 123}",
       "signature": "test"
     }'
   ```
5. **预期结果**: 返回409错误，提示重复event_id，不会重复写入

#### 测试2: 脏数据与人工确认流程

1. 系统会自动识别签名无效的事件
2. 签名验证失败的事件会被标记为"人工确认"状态
3. 当补偿次数超过max_retries时，自动标记需人工确认
4. 点击"人工确认"按钮，重置重试次数后可继续补偿

#### 测试3: 回滚功能

1. 选择任意非回滚状态的事件
2. 点击"回滚"按钮，输入回滚原因
3. 确认后事件状态变为"已回滚"
4. 回滚历史可追踪

## API接口文档

### 查询事件列表
```
GET /api/events?page=1&per_page=10&status=pending&partner_code=ALIPAY&manual_only=true
```

### 查询单个事件详情
```
GET /api/events/{event_id}
```

### 创建事件
```
POST /api/events
Content-Type: application/json

{
  "partner_code": "ALIPAY",
  "event_id": "EVT001",
  "event_type": "PAYMENT",
  "callback_url": "https://example.com/webhook",
  "request_data": "{\"order_id\": \"123\"}",
  "signature": "signature_string",
  "reconcile_summary": "订单支付回调"
}
```

### 执行补偿
```
POST /api/events/{event_id}/compensate
```

### 人工确认
```
POST /api/events/{event_id}/confirm
Content-Type: application/json

{
  "confirmed_by": "admin"
}
```

### 回滚事件
```
POST /api/events/{event_id}/rollback
Content-Type: application/json

{
  "reason": "重复回调需要回滚",
  "rolled_back_by": "admin"
}
```

### 修正事件
```
PUT /api/events/{event_id}/fix
Content-Type: application/json

{
  "callback_url": "https://new-url.com",
  "request_data": {"key": "value"},
  "reconcile_summary": "修正后的摘要"
}
```

### 批量导入
```
POST /api/batch/import
Content-Type: application/json

{
  "events": [
    {...},
    {...}
  ]
}
```

### 获取统计
```
GET /api/stats
```

### 获取合作方列表
```
GET /api/partners
```

## 数据库模型

### CallbackEvent (回调事件)
- event_id: 事件唯一标识（防重）
- partner_code: 合作方代码
- event_type: 事件类型
- status: 状态 (pending/success/failed/needs_manual/rolled_back/signature_invalid)
- retry_count: 已重试次数
- max_retries: 最大重试次数
- signature: 签名
- manual_confirmation: 是否需要人工确认
- reconcile_summary: 对账摘要

### CallbackLog (补偿日志)
- 记录每次补偿尝试的详细信息
- 包含请求数据、响应状态、错误信息

### RollbackHistory (回滚历史)
- 记录回滚原因、操作人、时间

## 关键业务规则

1. **防重机制**: event_id唯一，重复提交返回409
2. **签名验证**: 创建事件时自动验证签名，无效则标记需人工确认
3. **重试控制**: 超过max_retries后自动标记需人工确认
4. **人工确认**: 确认后重置重试次数，可重新补偿
5. **回滚保护**: 已回滚事件无法再补偿

## 测试建议

1. 使用httpbin.org测试不同响应状态
2. 使用无效签名测试人工确认流程
3. 重复提交同一event_id验证防重机制
4. 多次补偿直到超过最大次数，验证人工确认流程
