# 客服质检后端服务

一个用于自动检测外包转写文本中是否包含道歉、退款承诺以及敏感词，支持按负责人、时间、状态和异常类型筛选，并可导出CSV报告。

## 功能特性

- 自动质检：检测道歉、退款承诺、敏感词
- 批量导入通话记录
- 多维度筛选查询
- 单条/批量复核
- CSV格式导出报告
- 批量操作成功/失败追踪，支持重试

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 导入示例数据

```bash
npm run seed-data
```

### 4. 启动服务

```bash
npm start
```

服务运行在 http://localhost:3000

## API 接口文档

### 健康检查

```bash
GET /api/health
```

### 批量导入通话记录

```bash
POST /api/calls/import
Content-Type: application/json

{
  "calls": [
    {
      "call_id": "CALL_006",
      "agent_name": "张三",
      "transcript": "客户反映问题，客服道歉并退款",
      "call_time": "2024-01-17 10:00:00",
      "duration": 120,
      "customer_phone": "13800138006"
    }
  ]
}
```

返回示例（包含成功/失败详情）

```json
{
  "batch_id": 1,
  "total": 1,
  "success": 1,
  "failed": 0,
  "success_ids": ["CALL_006"],
  "failed_ids": [],
  "error_details": {}
}
```

### 查询通话记录（支持筛选）

```bash
GET /api/calls?agent_id=1&start_time=2024-01-15&end_time=2024-01-16&review_status=pending&anomaly_type=missing_apology
```

筛选参数：
- `agent_id`: 负责人ID
- `start_time`: 开始时间
- `end_time`: 结束时间
- `status`: 通话状态
- `review_status`: 复核状态 (pending/approved/rejected/corrected)
- `anomaly_type`: 异常类型 (missing_apology/missing_refund_promise/sensitive_word)
- `limit`: 每页数量
- `offset`: 偏移量

### 获取通话详情

```bash
GET /api/calls/:id
```

### 复核通话记录

```bash
PUT /api/calls/:id/review
Content-Type: application/json

{
  "reviewed_by": 3,
  "review_status": "approved"
}
```

review_status 可选值: approved（通过）, rejected（驳回）, corrected（修正）

### 批量复核

```bash
POST /api/calls/batch-review
Content-Type: application/json

{
  "call_ids": [1, 2, 3],
  "reviewed_by": 3,
  "review_status": "approved"
}
```

### 查询批量操作结果

```bash
GET /api/calls/batch/:id
```

### 导出CSV报告

```bash
GET /api/calls/export?agent_id=1&start_time=2024-01-15
```

支持与查询接口相同的筛选参数

### 用户管理

```bash
# 创建用户
POST /api/users
Content-Type: application/json
{ "name": "赵六", "role": "agent" }

# 获取所有用户
GET /api/users

# 获取单个用户
GET /api/users/:id
```

## 使用示例

### 示例 1: 导入包含成功和失败的批量导入

```bash
curl -X POST http://localhost:3000/api/calls/import \
  -H "Content-Type: application/json" \
  -d '{
    "calls": [
      {
        "call_id": "CALL_SUCCESS",
        "agent_name": "张三",
        "transcript": "正常的通话记录，包含道歉",
        "call_time": "2024-01-17 10:00:00"
      },
      {
        "call_id": "CALL_DUPLICATE",
        "agent_name": "李四",
        "transcript": "这条会失败，因为call_id重复",
        "call_time": "2024-01-17 11:00:00"
      },
      {
        "agent_name": "王五",
        "transcript": "这条会失败，缺少call_id",
        "call_time": "2024-01-17 12:00:00"
      }
    ]
  }'
```

重试时只需重新提交失败的记录即可，成功记录不会被重复处理。

### 示例 2: 筛选缺少道歉的记录

```bash
curl "http://localhost:3000/api/calls?anomaly_type=missing_apology"
```

### 示例 3: 导出张三的所有通话记录

```bash
curl -O "http://localhost:3000/api/calls/export?agent_id=1"
```

## 示例数据说明

导入示例数据后会有以下测试用例：

- CALL_001: 包含道歉 + 退款承诺 ✓✓
- CALL_002: 缺少道歉 + 缺少退款承诺 ✗✗
- CALL_003: 包含敏感词 ⚠
- CALL_004: 缺少道歉 + 缺少退款承诺 ✗✗
- CALL_005: 包含道歉 + 退款承诺 ✓✓

用户列表：
- 张三 (ID: 1)
- 李四 (ID: 2)
- 王组长 (ID: 3)

## 项目结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── config/
│   │   └── database.js    # 数据库配置
│   ├── controllers/        # 控制器层
│   ├── models/             # 数据模型层
│   ├── routes/             # 路由层
│   ├── scripts/          # 脚本
│   └── services/         # 业务逻辑层
├── data/                # SQLite数据库文件目录
├── package.json
└── README.md
```

## 技术栈

- Node.js + Express
- SQLite3
- csv-writer (CSV导出)
