# 社区诊疗车流动诊疗药品 API

## 项目简介

社区诊疗车流动诊疗药品管理后端系统，支持药品流转记录的创建、修改、提交、撤回、重新提交以及完整的历史记录追踪。

## 技术栈

- Node.js
- Express
- SQLite (better-sqlite3)

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据

```bash
node init-data.js
```

### 3. 启动服务

```bash
node app.js
```

服务将在 `http://localhost:3000` 启动

### 4. 运行测试

```bash
node test.js
```

## API 接口列表

### 1. 药品流转记录列表

**GET** `/api/transactions`

查询参数：
- `vehicle_no`: 车辆编号
- `site_code`: 站点编号
- `status`: 状态
- `page`: 页码（默认1）
- `page_size`: 每页数量（默认20）

示例：
```bash
curl "http://localhost:3000/api/transactions?page=1&page_size=10"
```

### 2. 获取单条记录详情

**GET** `/api/transactions/:id`

示例：
```bash
curl "http://localhost:3000/api/transactions/1"
```

### 3. 获取记录历史

**GET** `/api/transactions/:id/history`

示例：
```bash
curl "http://localhost:3000/api/transactions/1/history"
```

### 4. 创建药品流转记录（草稿）

**POST** `/api/transactions`

请求体：
```json
{
  "vehicle_no": "VH001",
  "vehicle_name": "社区诊疗车1号",
  "site_code": "ST001",
  "site_name": "幸福社区卫生服务站",
  "medicine_code": "MED001",
  "medicine_name": "阿莫西林胶囊",
  "batch_no": "B202401001",
  "manufacture_date": "2024-01-15",
  "expiry_date": "2026-01-14",
  "specification": "0.25g*24粒",
  "unit": "盒",
  "quantity": 20,
  "flow_type": "VEHICLE_TO_SITE",
  "operator": "张医生",
  "remark": "日常补药"
}
```

示例：
```bash
curl -X POST "http://localhost:3000/api/transactions" \
  -H "Content-Type: application/json" \
  -d '{
    "vehicle_no": "VH001",
    "vehicle_name": "社区诊疗车1号",
    "site_code": "ST001",
    "site_name": "幸福社区卫生服务站",
    "medicine_code": "MED001",
    "medicine_name": "阿莫西林胶囊",
    "batch_no": "B202401001",
    "manufacture_date": "2024-01-15",
    "expiry_date": "2026-01-14",
    "specification": "0.25g*24粒",
    "unit": "盒",
    "quantity": 20,
    "flow_type": "VEHICLE_TO_SITE",
    "operator": "张医生",
    "remark": "日常补药"
  }'
```

### 5. 修改草稿记录

**PUT** `/api/transactions/:id`

请求体：
```json
{
  "quantity": 25,
  "remark": "修改后的备注",
  "operator": "张医生"
}
```

示例：
```bash
curl -X PUT "http://localhost:3000/api/transactions/1" \
  -H "Content-Type: application/json" \
  -d '{
    "quantity": 25,
    "remark": "日常补药，调整数量",
    "operator": "张医生"
  }'
```

### 6. 提交记录

**POST** `/api/transactions/:id/submit`

请求体：
```json
{
  "operator": "李护士"
}
```

示例：
```bash
curl -X POST "http://localhost:3000/api/transactions/1/submit" \
  -H "Content-Type: application/json" \
  -d '{"operator": "李护士"}'
```

### 7. 撤回记录

**POST** `/api/transactions/:id/withdraw`

请求体：
```json
{
  "operator": "王主任",
  "remark": "数量有误"
}
```

示例：
```bash
curl -X POST "http://localhost:3000/api/transactions/1/withdraw" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "王主任",
    "remark": "数量有误，需要重新核对"
  }'
```

### 8. 人工处理（添加备注）

**POST** `/api/transactions/:id/manual`

请求体：
```json
{
  "operator": "审核员",
  "manual_remark": "已核对库存",
  "action": "REVIEW"
}
```

示例：
```bash
curl -X POST "http://localhost:3000/api/transactions/1/manual" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "审核员",
    "manual_remark": "已核对库存，确认数量需要调整为30盒",
    "action": "REVIEW"
  }'
```

### 9. 重新提交

**POST** `/api/transactions/:id/resubmit`

请求体：
```json
{
  "operator": "李护士",
  "quantity": 30,
  "remark": "按审核意见调整"
}
```

示例：
```bash
curl -X POST "http://localhost:3000/api/transactions/1/resubmit" \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "李护士",
    "quantity": 30,
    "remark": "按审核意见调整数量后重新提交"
  }'
```

### 10. 库存查询

**GET** `/api/stock`

查询参数：
- `stock_type`: 库存类型（VEHICLE / SITE）
- `location_code`: 位置编号
- `medicine_code`: 药品编号
- `page`: 页码
- `page_size`: 每页数量

示例：
```bash
# 查询车上库存
curl "http://localhost:3000/api/stock?stock_type=VEHICLE"

# 查询站点库存
curl "http://localhost:3000/api/stock?stock_type=SITE"
```

### 11. 库存一致性检查

**GET** `/api/stock/check-consistency`

示例：
```bash
curl "http://localhost:3000/api/stock/check-consistency"
```

## 数据模型

### 药品流转记录 (medicine_transactions)

| 字段 | 说明 |
|------|------|
| transaction_no | 流转单号 |
| vehicle_no | 车辆编号 |
| vehicle_name | 车辆名称 |
| site_code | 站点编号 |
| site_name | 站点名称 |
| medicine_code | 药品编号 |
| medicine_name | 药品名称 |
| batch_no | 批号 |
| manufacture_date | 生产日期 |
| expiry_date | 有效期至 |
| specification | 规格 |
| unit | 单位 |
| quantity | 数量 |
| vehicle_stock_before | 车上变动前库存 |
| vehicle_stock_after | 车上变动后库存 |
| site_stock_before | 站点变动前库存 |
| site_stock_after | 站点变动后库存 |
| flow_type | 流转类型（VEHICLE_TO_SITE / SITE_TO_VEHICLE） |
| operator | 操作人 |
| operate_time | 操作时间 |
| status | 状态（DRAFT / SUBMITTED / WITHDRAWN） |
| remark | 备注 |

### 历史记录 (medicine_history)

| 字段 | 说明 |
|------|------|
| transaction_id | 流转记录ID |
| transaction_no | 流转单号 |
| action | 操作类型（CREATE / UPDATE / SUBMIT / WITHDRAW / MANUAL_PROCESS / RESUBMIT） |
| operator | 操作人 |
| operate_time | 操作时间 |
| before_status | 操作前状态 |
| after_status | 操作后状态 |
| before_quantity | 操作前数量 |
| after_quantity | 操作后数量 |
| before_remark | 操作前备注 |
| after_remark | 操作后备注 |
| change_content | 变更内容说明 |

## 测试场景覆盖

1. ✅ 列表进入详情
2. ✅ 详情查看每次修改历史
3. ✅ 车上剩药和站点库存不同步检测
4. ✅ 药品流水一致性检查
5. ✅ 撤回后再次提交的组合
6. ✅ 人工处理后备注留痕

## 项目结构

```
.
├── app.js              # 主应用入口
├── database.js         # 数据库初始化和连接
├── init-data.js        # 样例数据初始化
├── test.js             # 测试脚本
├── package.json        # 项目配置
└── README.md           # 项目说明
```
