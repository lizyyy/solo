# 健身私教馆私教课转让 API

基于 Node.js + Express + SQLite 构建的私教课转让管理系统，支持批量导入、状态流转、条件筛选等功能。

## 项目结构

```
├── src/
│   ├── app.js                 # 应用入口
│   ├── config/
│   │   └── database.js        # 数据库配置
│   ├── routes/
│   │   └── transfers.js       # 转让相关路由
│   ├── services/
│   │   └── transferService.js # 业务逻辑
│   ├── utils/
│   │   └── validation.js      # 数据验证
│   └── scripts/
│       ├── initDb.js          # 数据库初始化
│       ├── sampleData.js      # 样例数据
│       └── testApi.js         # API测试脚本
├── data/                      # 数据库文件目录
└── package.json
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（包含样例数据）

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务默认运行在 `http://localhost:3000`

### 4. 运行测试（需要先启动服务）

```bash
npm test
```

---

## API 接口

### 一、创建转让

**接口**: `POST /api/transfers`

**请求体**:
```json
{
  "transfer_date": "2024-05-10",
  "store_id": "store-001",
  "store_name": "朝阳健身旗舰店",
  "assignor_id": "member-001",
  "assignor_name": "张三",
  "assignor_phone": "13800138000",
  "assignee_id": "member-002",
  "assignee_name": "李四",
  "assignee_phone": "13900139000",
  "coach_id": "coach-001",
  "coach_name": "王教练",
  "class_package_id": "pkg-001",
  "class_package_name": "VIP减脂私教课30节包",
  "transfer_class_count": 5,
  "remaining_class_count": 10,
  "original_unit_price": 280.00,
  "transfer_fee": 50.00,
  "total_amount": 1450.00,
  "scheduled_class_time": "2024-05-20 14:00:00",
  "remark": "朋友之间转让"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transfer_no": "TR202405100001"
  }
}
```

**字段说明**:
- `transfer_date`: 转让日期 (YYYY-MM-DD)
- `transfer_class_count`: 转让节数
- `remaining_class_count`: 剩余总节数（必须 >= 转让节数）
- `scheduled_class_time`: 预约上课时间，系统会检测受让人是否已有同时间课程

---

### 二、修改转让（状态流转）

**接口**: `PATCH /api/transfers/:id`

**状态流转规则**:
- `pending` (待审核) → `approved` (已通过) / `rejected` (已拒绝) / `cancelled` (已取消)
- `approved` (已通过) → `completed` (已完成) / `cancelled` (已取消)
- 最终状态不可逆转

**请求体** (审核通过):
```json
{
  "status": "approved",
  "handler_id": "H001",
  "handler_name": "张经理",
  "remark": "材料齐全，审核通过"
}
```

**请求体** (拒绝):
```json
{
  "status": "rejected",
  "handler_id": "H001",
  "handler_name": "张经理",
  "reject_reason": "课包信息不一致，请核对",
  "remark": "需补充转让协议"
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "status": "approved"
  }
}
```

---

### 三、查询转让

#### 3.1 查询单条记录

**接口**: `GET /api/transfers/:id`

**响应**:
```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "transfer_no": "TR202405100001",
    "status": "approved",
    "...": "其他字段"
  }
}
```

#### 3.2 列表查询（支持筛选）

**接口**: `GET /api/transfers`

**查询参数**:
| 参数 | 说明 | 示例 |
|------|------|------|
| `start_date` | 转让日期开始 | `2024-05-01` |
| `end_date` | 转让日期结束 | `2024-05-31` |
| `status` | 状态筛选 | `pending` |
| `handler_id` | 负责人ID | `H001` |
| `store_id` | 门店ID | `store-001` |
| `page` | 页码 | `1` |
| `page_size` | 每页条数 | `20` |

**示例请求**:
```
GET /api/transfers?status=pending&start_date=2024-05-01&end_date=2024-05-31&store_id=store-001
```

**响应**:
```json
{
  "success": true,
  "data": {
    "list": [...],
    "pagination": {
      "page": 1,
      "page_size": 20,
      "total": 10,
      "total_pages": 1
    }
  }
}
```

---

### 四、导出数据

**接口**: `GET /api/transfers/export/csv`

支持与列表查询相同的筛选参数，导出为 CSV 文件。

**示例请求**:
```
GET /api/transfers/export/csv?status=approved&start_date=2024-05-01
```

---

### 五、批量导入

**接口**: `POST /api/transfers/batch`

**特性**:
- 行级处理：单条失败不影响整体
- 返回每条记录的处理结果
- 自动检测时间冲突和课包流水一致性

**请求体**:
```json
{
  "transfers": [
    {...},
    {...}
  ]
}
```

**响应**:
```json
{
  "success": true,
  "data": {
    "total": 3,
    "success_count": 2,
    "fail_count": 1,
    "results": [
      {
        "row_index": 1,
        "success": true,
        "transfer_no": "TR202405100001",
        "error": null,
        "conflict": null
      },
      {
        "row_index": 2,
        "success": false,
        "transfer_no": null,
        "error": "受让人已有同时间课程安排",
        "conflict": {...}
      },
      {...}
    ]
  }
}
```

---

## 异常处理说明

### 1. 坏数据验证
- 手机号格式校验（1开头11位）
- 日期格式校验
- 数字范围校验
- 必填字段校验

### 2. 业务校验
- 转让节数不能超过剩余节数
- 受让人同一教练同一时间不能有重复课程
- 状态越级检测（如 pending 不能直接到 completed）

### 3. 重复调用保护
- 同一状态重复更新会被拒绝
- 操作日志全程记录

---

## 样例数据说明

初始化数据库后会自动插入以下样例数据：

- **门店**: 2家（朝阳健身旗舰店、海淀健身会所）
- **教练**: 3位（张教练、李教练、王教练）
- **会员**: 4位（陈明、刘芳、张伟、赵丽）
- **转让记录**: 4条，涵盖各种状态（approved、pending、rejected、cancelled）

---

## 健康检查

**接口**: `GET /health`

验证服务是否正常运行。
