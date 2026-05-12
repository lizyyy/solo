# 售卖机补货路线 API

围绕自动售卖机补货的综合业务系统，结合缺货、保质期、路线容量和紧急故障安排展开。

## 项目概述

### 核心能力

1. **补货任务管理**：结合缺货、保质期、销量预测创建补货任务
2. **路线规划**：考虑补货车容量限制，支持任务拆分和多路线分配
3. **故障管理**：故障插单、暂停故障机器补货、故障优先级
4. **状态追踪**：完整的历史记录、状态变化轨迹
5. **幂等性保障**：重复执行/重复回调保持幂等
6. **人工修正**：记录前后差异和操作者
7. **报告导出**：日报生成、Excel导出

### 业务规则

- **重复派单保护**：同一机器同一时间只能有一个待处理任务
- **容量管理**：路线容量不足时自动校验，需拆分任务或增加路线
- **临期检测**：临期商品（默认3天内）自动标记为需回收
- **故障处理**：故障机器自动暂停补货，故障解决后恢复
- **幂等性**：通过 `idempotent-key` Header 确保重复调用安全

## 快速开始

### 环境要求

- Python 3.8+
- pip

### 本地启动

```bash
# 进入项目目录
cd vending_restock_api

# 安装依赖
python3 -m pip install -r requirements.txt

# 启动服务（默认端口 8000）
python3 -m uvicorn main:app --host 0.0.0.0 --port 8000

# 或者使用热重载模式开发
python3 main.py
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- API 首页：http://localhost:8000/

### 初始化样例数据

```bash
# 方式1: 调用 API
curl -X POST http://localhost:8000/api/samples/init

# 方式2: 查看 Swagger 文档中的 /api/samples/init 接口
```

样例数据包含：
- **4台售卖机** (M001-M004)：覆盖不同场景
- **8种商品**：饮料、零食、方便食品
- **17条库存记录**：含缺货、临期、过期商品
- **5条销量预测**
- **1条历史故障**（已解决）

## API 接口说明

### 接口总览

| 模块 | 路径前缀 | 说明 |
|------|----------|------|
| 主数据 | `/api/master` | 售卖机、商品、库存、销量预测 |
| 补货任务 | `/api/tasks` | 任务创建、推进、查询、异常处理 |
| 补货路线 | `/api/routes` | 路线创建、任务分配、状态推进 |
| 故障管理 | `/api/faults` | 故障报告、处理、解决 |
| 报告导出 | `/api/reports` | 日报生成、Excel 导出 |

### 核心接口

#### 1. 任务相关

**分析补货需求**
```
GET /api/tasks/analyze/{machine_id}
```
返回机器的缺货分析、临期商品、是否有故障等信息。

**创建补货任务**
```
POST /api/tasks
Headers: idempotent-key (可选，用于幂等性)
Body:
{
  "id": "TASK-001",
  "machine_id": "M001",
  "priority": 1,
  "notes": "备注信息",
  "assigned_operator": "李师傅",
  "items": [
    {"product_id": "P001", "item_type": "restock", "requested_quantity": 48},
    {"product_id": "P003", "item_type": "recovery", "requested_quantity": 15}
  ]
}
```
- `item_type`: "restock" 表示补货，"recovery" 表示回收

**推进任务状态**
```
POST /api/tasks/{task_id}/start     # pending -> in_progress
POST /api/tasks/{task_id}/execute   # 记录实际执行数量
POST /api/tasks/{task_id}/complete  # in_progress -> completed
POST /api/tasks/{task_id}/cancel    # 取消任务
POST /api/tasks/{task_id}/fail      # 标记失败，需提供失败原因
```

**查询任务**
```
GET /api/tasks                     # 列表，支持按 status/machine_id/route_id 过滤
GET /api/tasks/{task_id}           # 详情，包含历史记录
```

#### 2. 路线相关

**创建路线**
```
POST /api/routes
Body:
{
  "id": "ROUTE-001",
  "name": "A座路线",
  "total_capacity": 600,
  "operator": "李师傅",
  "vehicle_id": "VAN-001",
  "scheduled_date": "2026-05-12T10:00:00"
}
```

**任务分配**
```
POST /api/routes/{route_id}/tasks/{task_id}    # 添加任务到路线
DELETE /api/routes/{route_id}/tasks/{task_id}  # 从路线移除任务
```

**推进路线状态**
```
POST /api/routes/{route_id}/dispatch  # planned -> dispatched
POST /api/routes/{route_id}/start     # dispatched -> in_progress
POST /api/routes/{route_id}/complete  # in_progress -> completed
```

**查询路线**
```
GET /api/routes
GET /api/routes/{route_id}
GET /api/routes/{route_id}/detail     # 包含任务明细
```

#### 3. 故障相关

**报告故障**
```
POST /api/faults
Body:
{
  "id": "FAULT-001",
  "machine_id": "M003",
  "fault_type": "硬件故障-取货机构",
  "description": "取货口卡住，显示错误代码E102",
  "priority": 2,
  "assigned_operator": "张维修"
}
```
- 报告故障后，该机器的待处理任务会被**自动取消**

**处理故障**
```
PATCH /api/faults/{fault_id}
POST /api/faults/{fault_id}/resolve   # 标记已解决
```

#### 4. 报告相关

**获取日报**
```
GET /api/reports/daily?report_date=2026-05-12
```
返回包含：
- 路线/任务完成统计
- 缺货风险列表（按风险级别排序）
- 临期回收商品列表
- 执行差异列表
- 未解决故障列表

**导出 Excel 报告**
```
GET /api/reports/daily/export?report_date=2026-05-12
```
下载包含多个 Sheet 的 Excel 文件。

## 演示场景

### 前置条件

确保服务已启动并初始化样例数据：
```bash
curl -X POST http://localhost:8000/api/samples/init
```

### Demo 1: 正常补货流程

**场景**：M001 办公楼大厅售卖机缺货，需要补货 + 临期商品回收

**路径**：
1. 分析需求 → 2. 创建任务 → 3. 创建路线 → 4. 分配任务 → 5. 派发路线 → 6. 开始执行 → 7. 记录实际数量 → 8. 完成任务 → 9. 完成路线

**执行脚本**：
```bash
cd vending_restock_api
python3 samples/demo_normal_restock.py
```

**预期结果**：
- 任务状态：pending → in_progress → completed
- 路线状态：planned → dispatched → in_progress → completed
- 历史记录完整，包含每个状态变化的时间、操作者、原因
- 执行差异：P001 请求 48，实际 45（差异 -3）

### Demo 2: 容量不足拆分

**场景**：大订单超过单辆车容量，需要拆分或使用大容量车辆

**路径**：
1. 创建大任务（容量需求 440）→ 2. 创建小容量路线（200）→ 3. 添加失败（CAPACITY_EXCEEDED）→ 4. 方案A：使用大容量路线（600）→ 5. 方案B：拆分任务到两条路线

**执行脚本**：
```bash
cd vending_restock_api
python3 samples/demo_capacity_split.py
```

**预期结果**：
- 小容量路线添加失败，返回明确的错误码和详情
- 大容量路线添加成功
- 或拆分任务后分配到两条路线

### Demo 3: 临期商品回收

**场景**：M002 科技园东门有过期商品（P007 好丽友派，过期 5 天）需要回收

**路径**：
1. 分析需求（自动识别临期商品）→ 2. 创建回收任务 → 3. 执行 → 4. 生成日报查看回收统计

**执行脚本**：
```bash
cd vending_restock_api
python3 samples/demo_expiry_recovery.py
```

**预期结果**：
- 分析结果中显示 "临期商品需回收(剩余-5天)"
- 日报的 recovery_items 包含回收商品
- 日报统计 total_quantity_recovered = 25

### Demo 4: 故障插单

**场景**：M003 食堂售卖机报告故障，自动暂停补货，故障解决后恢复

**路径**：
1. 创建待处理任务 → 2. 报告故障 → 3. 任务被自动取消 → 4. 尝试创建新任务失败（MACHINE_FAULT）→ 5. 解决故障 → 6. 可以创建新任务

**执行脚本**：
```bash
cd vending_restock_api
python3 samples/demo_fault_interrupt.py
```

**预期结果**：
- 报告故障后，原有 pending 任务变为 cancelled
- 新任务创建失败，错误码 MACHINE_FAULT
- 故障解决后，可以创建新任务

### Demo 5: 失败路径与异常处理

**场景**：验证各种错误场景和幂等性

**执行脚本**：
```bash
cd vending_restock_api
python3 samples/demo_failure_path.py
```

**验证内容**：
1. **重复派单**：同一机器重复创建任务失败（DUPLICATE_TASK）
2. **幂等性**：相同 idempotent-key 重复调用返回相同结果
3. **状态转换**：不能从 pending 直接 complete，需先 start
4. **人工修正**：修改任务后历史记录包含 diff_before/diff_after

### 一键执行所有演示

```bash
cd vending_restock_api
python3 samples/run_all_demos.py
```

## 状态流转

### 任务状态

```
pending ──→ in_progress ──→ completed
   │              │
   │              ├──→ failed
   │              └──→ cancelled
   └──────────────→ cancelled
```

有效转换：
- pending → in_progress, cancelled
- in_progress → completed, failed, cancelled

### 路线状态

```
planned ──→ dispatched ──→ in_progress ──→ completed
   │              │                         │
   │              └──→ cancelled            └──→ partially_completed
   └──────────────→ cancelled
```

有效转换：
- planned → dispatched, cancelled
- dispatched → in_progress, cancelled
- in_progress → completed, partially_completed

## 错误码说明

| 错误码 | 说明 | 示例 |
|--------|------|------|
| DUPLICATE_TASK | 同一机器有待处理任务 | 重复创建补货任务 |
| CAPACITY_EXCEEDED | 路线容量不足 | 大任务加到小容量路线 |
| MACHINE_FAULT | 机器有活动故障 | 给故障机器补货 |
| INVALID_STATUS_TRANSITION | 无效状态转换 | pending 直接到 completed |
| IDEMPOTENT_VIOLATION | 幂等键冲突 | 同一 key 不同参数 |
| NOT_FOUND | 资源不存在 | 查询不存在的任务/路线 |

## 项目结构

```
vending_restock_api/
├── app/
│   ├── models/
│   │   └── models.py          # 数据模型定义
│   ├── schemas/
│   │   └── schemas.py         # Pydantic 模型定义
│   ├── services/
│   │   ├── task_service.py    # 任务业务逻辑
│   │   ├── route_service.py   # 路线业务逻辑
│   │   ├── fault_service.py   # 故障业务逻辑
│   │   └── report_service.py  # 报告生成逻辑
│   ├── routes/
│   │   ├── tasks_api.py       # 任务 API
│   │   ├── routes_api.py      # 路线 API
│   │   ├── faults_api.py      # 故障 API
│   │   ├── reports_api.py     # 报告 API
│   │   └── master_api.py      # 主数据 API
│   ├── utils/
│   │   ├── exceptions.py      # 异常定义
│   │   └── idempotent.py      # 幂等性管理
│   ├── config.py              # 配置
│   └── database.py            # 数据库连接
├── samples/
│   ├── demo_data.py           # 样例数据初始化
│   ├── demo_normal_restock.py # Demo 1
│   ├── demo_capacity_split.py # Demo 2
│   ├── demo_expiry_recovery.py# Demo 3
│   ├── demo_fault_interrupt.py# Demo 4
│   ├── demo_failure_path.py   # Demo 5
│   └── run_all_demos.py       # 批量执行脚本
├── main.py                    # 应用入口
├── requirements.txt
└── README.md
```

## 配置说明

可通过环境变量或修改 `app/config.py` 配置：

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| DATABASE_URL | sqlite:///./vending_restock.db | 数据库连接 |
| EXPIRE_WARNING_DAYS | 3 | 临期商品警告天数 |
| ROUTE_DEFAULT_CAPACITY | 500 | 默认路线容量 |
| IDEMPOTENT_EXPIRE_HOURS | 24 | 幂等记录过期时间（小时） |

## 验证业务闭环

不看源码，通过以下方式验证业务是否闭环：

### 1. 查看路线明细
```
GET /api/routes/{route_id}/detail
```
- 容量使用情况（总容量/已用/剩余）
- 每个任务的状态和商品明细
- 每个任务的历史记录轨迹

### 2. 查看缺货风险
```
GET /api/reports/daily
```
- 风险级别：HIGH/MEDIUM/LOW
- 每个商品的当前库存/警戒线/缺货数量

### 3. 查看回收商品
```
GET /api/reports/daily → recovery_items
```
- 商品名称、数量、过期日期、距过期天数

### 4. 查看执行差异
```
GET /api/reports/daily → execution_diffs
```
- 每个商品的请求数量 vs 实际数量
- 差异值（正数多补，负数少补）

### 5. 查看历史记录
```
GET /api/tasks/{task_id} → history
GET /api/routes/{route_id} → history
```
- 每次状态变化的时间、操作者、原因
- 人工修改的前后差异

## 失败路径演示

### 路径 1: 重复派单
```bash
# 创建第一个任务
curl -X POST http://localhost:8000/api/tasks ...

# 第二个任务会失败
curl -X POST http://localhost:8000/api/tasks ...
# 返回: {"code": "DUPLICATE_TASK", "details": {"existing_task_id": "..."}}
```

### 路径 2: 容量不足
```bash
# 创建 200 容量路线
curl -X POST http://localhost:8000/api/routes -d '{"total_capacity": 200}' ...

# 添加需要 440 容量的任务
curl -X POST http://localhost:8000/api/routes/ROUTE-001/tasks/BIG-TASK ...
# 返回: {"code": "CAPACITY_EXCEEDED", "details": {"required": 440, "available": 200}}
```

### 路径 3: 故障机器补货
```bash
# 报告故障
curl -X POST http://localhost:8000/api/faults -d '{"machine_id": "M003"}' ...

# 尝试给 M003 补货
curl -X POST http://localhost:8000/api/tasks -d '{"machine_id": "M003"}' ...
# 返回: {"code": "MACHINE_FAULT", "details": {"fault_id": "..."}}
```

### 路径 4: 无效状态转换
```bash
# 创建任务（pending）
curl -X POST http://localhost:8000/api/tasks ...

# 直接 complete（应该失败）
curl -X POST http://localhost:8000/api/tasks/TASK-001/complete
# 返回: {"code": "INVALID_STATUS_TRANSITION", "details": {"from": "pending", "to": "completed"}}

# 正确流程
curl -X POST http://localhost:8000/api/tasks/TASK-001/start
curl -X POST http://localhost:8000/api/tasks/TASK-001/complete
```

## 数据持久化

本项目使用 SQLite 数据库，文件保存在：
```
vending_restock_api/vending_restock.db
```

**重置数据库**：
```bash
curl -X POST http://localhost:8000/api/samples/reset
```

## License

MIT License
