# 港口调度室后端服务 API 文档

## 服务信息
- 服务地址: http://localhost:3001
- 健康检查: GET /api/health

## API 接口

### 1. 批次管理

#### 创建批次
- **POST** `/api/batches`
- 请求体:
  ```json
  {
    "name": "批次名称",
    "created_by": "创建人"
  }
  ```

#### 查询批次列表
- **GET** `/api/batches?status=pending&limit=50&offset=0`

#### 查询单批次详情（含记录）
- **GET** `/api/batches/:id`

### 2. 调度记录管理

#### 创建调度记录
- **POST** `/api/records`
- 请求体:
  ```json
  {
    "batch_id": 1,
    "vessel_data": {
      "vessel_name": "船名",
      "vessel_imo": "IMO号",
      "draft": 11.5,
      "length": 200,
      "width": 30,
      "agent": "船代公司"
    },
    "berth_data": {
      "berth_no": "B01",
      "berth_name": "一号泊位",
      "max_draft": 12.0
    },
    "arrival_date": "2025-05-20",
    "departure_date": "2025-05-22",
    "planned_berth_time": "2025-05-20 08:00:00",
    "handling_type": "装卸货",
    "cargo_quantity": 5000,
    "created_by": "创建人"
  }
  ```

#### 查询记录列表
- **GET** `/api/records`
- 查询参数:
  - `batch_id`: 批次ID
  - `status`: 状态 (pending/processed/returned)
  - `agent_confirmed`: true/false
  - `berth_locked`: true/false
  - `loading_plan_confirmed`: true/false
  - `vessel_name`: 船名模糊搜索
  - `start_date`, `end_date`: 到港日期范围
  - `limit`, `offset`: 分页

#### 查询记录详情（含操作日志）
- **GET** `/api/records/:id`

#### 标记处理
- **PUT** `/api/records/:id/process`
- 请求体:
  ```json
  {
    "handled_by": "处理人",
    "status": "processed",
    "reason": "处理原因"
  }
  ```

#### 退回修改
- **PUT** `/api/records/:id/return`
- 请求体:
  ```json
  {
    "handled_by": "处理人",
    "reason": "退回原因"
  }
  ```

### 3. 特殊情况处理

#### 记录特殊情况
- **PUT** `/api/records/:id/special-case`
- 请求体:
  ```json
  {
    "case_type": "draft_restriction", // 吃水限制
    // "cross_day_window" - 跨日窗口
    // "urgent_insertion" - 临时插队
    "reason": "原因说明",
    "handled_by": "处理人"
  }
  ```

### 4. 确认操作

#### 船代确认
- **PUT** `/api/records/:id/confirm-agent`
- 请求体: `{ "confirmed_by": "确认人" }`

#### 泊位锁定
- **PUT** `/api/records/:id/lock-berth`
- 请求体: `{ "locked_by": "锁定人" }`

#### 装卸计划确认
- **PUT** `/api/records/:id/confirm-loading-plan`
- 请求体: `{ "confirmed_by": "确认人" }`

### 5. 数据导入

#### 导入船舶数据 (CSV)
- **POST** `/api/import/vessels`
- Content-Type: `multipart/form-data`
- 字段: `file`

#### 导入泊位数据 (JSON)
- **POST** `/api/import/berths`
- Content-Type: `multipart/form-data`
- 字段: `file`

#### 导入潮汐数据 (CSV)
- **POST** `/api/import/tides`
- Content-Type: `multipart/form-data`
- 字段: `file`

### 6. 数据导出

#### 导出统计
- **GET** `/api/export/summary`
- 支持与记录列表相同的查询参数

#### 导出CSV
- **GET** `/api/export/records`
- 支持与记录列表相同的查询参数

## 数据库表结构

### batches (批次表)
- id, batch_no, name, status, created_by, created_at, updated_at

### vessels (船舶表)
- id, vessel_name, vessel_imo, draft, length, width, agent, created_at

### berths (泊位表)
- id, berth_no, berth_name, max_draft, max_length, is_locked, locked_by, locked_at

### tide_schedules (潮汐表)
- id, tide_date, tide_time, tide_height, tide_type

### scheduling_records (调度记录表)
- 包含批次关联、船舶信息、泊位信息、时间、三个确认标记、状态、特殊情况记录等

### operation_logs (操作日志表)
- id, record_id, batch_id, operation_type, operation_status, reason, handled_by, handled_at, details
