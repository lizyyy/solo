# 公交客服中心失物招领后端服务

一套完整的公交失物招领管理后端系统，支持失物CSV导入、线路班次JSON导入、图片索引管理，提供完整的可追踪记录功能。

## 功能特性

### 核心功能
- ✅ **批次管理** - 支持创建导入批次，便于数据追溯
- ✅ **失物CSV导入** - 批量导入失物数据
- ✅ **线路班次JSON导入** - 导入公交线路和班次信息
- ✅ **图片索引管理** - 管理失物相关图片

### 物品处理
- ✅ **标记处理** - 标记物品为处理中状态
- ✅ **退回修改** - 将物品退回待处理状态
- ✅ **完成处理** - 标记物品处理完成
- ✅ **领取凭证** - 生成唯一领取凭证号

### 查询功能
- ✅ **按线路班次查询** - 根据线路和班次查找失物
- ✅ **按上交司机查询** - 根据司机姓名查找失物
- ✅ **按领取凭证查询** - 根据凭证号追溯来源
- ✅ **多条件组合查询** - 支持状态、时间范围等筛选

### 特殊处理
- ✅ **同名物品识别** - 自动标记同名物品，避免混淆
- ✅ **逾期无人领检测** - 检测超期未领取物品
- ✅ **敏感信息隐藏** - 手机号、身份证号脱敏处理

### 导出功能
- ✅ **CSV导出** - 导出查询结果，数量与查询一致

## 技术栈

- **后端框架**: Node.js + Express
- **数据库**: SQLite3
- **文件处理**: Multer + csv-parser
- **数据导出**: json2csv
- **日期处理**: Moment.js

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 4. 运行API测试

```bash
node scripts/test-api.js
```

## API 接口文档

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/batches` | 创建新批次 |
| GET | `/api/batches` | 获取批次列表 |

**创建批次请求示例:**
```json
{
  "batchType": "lost_items",
  "sourceFile": "data.csv",
  "createdBy": "操作员A",
  "remark": "备注信息"
}
```

### 文件上传

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/upload/lost-items` | 上传失物CSV文件 |
| POST | `/api/upload/route-schedules` | 上传线路班次JSON |
| POST | `/api/upload/images` | 导入图片索引 |

**上传CSV示例 (curl):**
```bash
curl -X POST \
  -F "file=@examples/sample_lost_items.csv" \
  -F "batchId=1" \
  -F "operator=测试员A" \
  http://localhost:3000/api/upload/lost-items
```

### 物品管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/items` | 获取物品列表（支持分页和筛选） |
| GET | `/api/items/:itemId` | 获取物品详情及处理历史 |
| POST | `/api/items/:itemId/process` | 通用物品状态处理 |
| POST | `/api/items/:itemId/return` | 退回修改 |
| POST | `/api/items/:itemId/process/mark` | 标记处理中 |
| POST | `/api/items/:itemId/complete` | 标记处理完成 |
| POST | `/api/items/:itemId/issue-voucher` | 生成领取凭证 |

**物品列表查询参数:**
- `page`: 页码，默认1
- `pageSize`: 每页条数，默认20
- `status`: 状态筛选 (pending/processing/completed/returned/picked_up)
- `routeNo`: 线路号
- `shiftNo`: 班次号
- `driverName`: 司机姓名
- `pickupVoucherNo`: 领取凭证号
- `startDate`: 开始日期
- `endDate`: 结束日期
- `isOverdue`: 是否逾期 (1/0)

### 领取凭证

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/vouchers/:voucherNo` | 获取凭证详情 |
| GET | `/api/vouchers/:voucherNo/trace` | 追溯凭证来源 |
| POST | `/api/vouchers/:voucherNo/pickup` | 物品领取 |

**追溯来源响应示例:**
```json
{
  "success": true,
  "data": {
    "voucher": { ... },
    "item": { ... },
    "batch": { ... },
    "history": [...],
    "traceChain": [
      {
        "type": "batch_import",
        "time": "2024-01-15 10:00:00",
        "operator": "测试员A",
        "description": "批次导入: BATCH202401151000001"
      },
      ...
    ]
  }
}
```

### 查询接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/query/by-route` | 按线路班次查询 |
| GET | `/api/query/by-driver` | 按司机查询 |

### 导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export` | 导出物品列表为CSV |

**导出示例:**
```bash
curl "http://localhost:3000/api/export?routeNo=1" -o output.csv
```

### 任务接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/tasks/check-overdue` | 检查逾期物品 |
| POST | `/api/tasks/check-same-name` | 检查同名物品 |

## 数据结构

### 失物CSV字段格式
| 字段 | 说明 | 必填 |
|------|------|------|
| item_name | 物品名称 | 是 |
| item_description | 物品描述 | 否 |
| item_category | 物品分类 | 否 |
| found_time | 发现时间 | 否 |
| found_location | 发现地点 | 否 |
| route_no | 线路号 | 否 |
| shift_no | 班次号 | 否 |
| driver_name | 司机姓名 | 否 |
| driver_phone | 司机电话 | 否 |
| finder_name | 上交人 | 否 |
| image_ids | 图片ID列表 | 否 |

### 线路班次JSON格式
```json
[
  {
    "route_no": "1",
    "shift_no": "早班",
    "driver_name": "张三",
    "driver_phone": "13800138001",
    "vehicle_no": "粤A12345",
    "departure_time": "2024-01-15 06:00:00",
    "arrival_time": "2024-01-15 14:00:00",
    "start_station": "火车站",
    "end_station": "大学城"
  }
]
```

## 项目结构

```
.
├── src/
│   ├── app.js              # 应用入口
│   ├── models/
│   │   └── database.js     # 数据库连接
│   ├── controllers/
│   │   └── itemController.js  # 控制器
│   ├── services/
│   │   ├── importService.js   # 导入服务
│   │   └── itemService.js     # 业务逻辑服务
│   └── routes/
│       └── itemRoutes.js      # 路由定义
├── scripts/
│   ├── init-db.js          # 数据库初始化脚本
│   └── test-api.js         # API测试脚本
├── examples/
│   ├── sample_lost_items.csv    # 失物示例数据
│   └── sample_route_schedules.json  # 线路班次示例
├── data/                   # 数据库文件目录
├── uploads/                # 临时上传目录
├── package.json
└── README.md
```

## 状态流转

```
待处理 (pending)
    ↓
处理中 (processing) ←→ 已退回 (returned)
    ↓
处理完成 (completed) / 已领取 (picked_up)
```

## 审计追踪

所有操作都会记录完整的审计日志，包括：
- 操作时间
- 操作员
- 操作类型（导入、处理、退回、领取等）
- 操作原因
- 状态变更（旧状态 → 新状态）
- 备注信息

## 安全特性

- 手机号脱敏显示（如：138****8001）
- 身份证号脱敏显示
- 姓名脱敏显示
- 所有操作可追溯

## 示例数据

项目提供示例数据文件：
- `examples/sample_lost_items.csv` - 含10条失物数据
- `examples/sample_route_schedules.json` - 含6条线路班次数据

## 开发模式

使用nodemon启动开发服务器（自动重启）：

```bash
npm run dev
```

## 许可证

MIT License
