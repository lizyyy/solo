# 遥测异常确认 API

面向运维的设备指标异常检测与复核管理平台，支持完整的异常生命周期管理、幂等性保障和数据补偿机制。

## 功能特性

### 核心功能
- **异常生命周期管理**：待处理 → 已确认 → 转工单 → 已恢复 → 已关闭
- **前后变化对比**：直观展示异常发生前后的指标变化
- **批量操作**：支持批量确认、忽略、关闭异常
- **数据导出**：支持 Excel/CSV 格式导出
- **操作审计**：完整的操作历史记录，包含操作人、时间、备注

### 高级特性
- **幂等性保障**：通过幂等键防止重复创建异常
- **状态流转校验**：严格的状态机控制，防止非法状态转换
- **补偿机制**：脏数据修复、状态不一致处理、历史记录重建
- **系统健康监控**：实时监控待处理异常数和补偿任务状态

## 技术栈

### 后端
- **框架**：FastAPI
- **数据库**：SQLite（可替换为 PostgreSQL/MySQL）
- **ORM**：SQLAlchemy 2.0
- **数据处理**：Pandas + OpenPyXL

### 前端
- 原生 HTML/CSS/JavaScript
- 响应式设计

## 快速开始

### 1. 安装依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 初始化测试数据

```bash
python init_data.py
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问应用

- **前端页面**：http://localhost:8000/static/index.html
- **API 文档**：http://localhost:8000/docs
- **Redoc**：http://localhost:8000/redoc

## 核心概念说明

### 异常状态流转

```
pending (待处理)
    ├─→ confirmed (已确认)
    │       ├─→ ticketed (已转工单) ──→ recovered (已恢复) ──→ closed (已关闭)
    │       └─→ recovered (已恢复) ──→ closed (已关闭)
    ├─→ ignored (已忽略)
    │       └─→ pending (可重新确认)
    └─→ ticketed (直接转工单)
            └─→ recovered (已恢复) ──→ closed (已关闭)
```

### 严重程度等级

| 等级 | 说明 | 颜色 |
|------|------|------|
| low | 低 | 绿色 |
| medium | 中 | 黄色 |
| high | 高 | 红色 |
| critical | 严重 | 深红 |

## API 接口说明

### 异常记录 API

#### 创建异常记录
```http
POST /api/v1/anomalies/
Headers:
  X-Idempotency-Key: <unique-key>  # 可选，用于幂等性
```

#### 查询异常列表
```http
GET /api/v1/anomalies/?status=pending&severity=high&device_id=server-001&page=1&page_size=20
```

#### 获取异常详情
```http
GET /api/v1/anomalies/{id}
```

#### 更新异常状态
```http
PUT /api/v1/anomalies/{id}/status
Content-Type: application/json

{
  "new_status": "confirmed",
  "operator_id": "op_001",
  "operator_name": "张三",
  "comment": "确认为真实异常",
  "reason_category": "known_issue",  # 当 status 为 ignored 时需要
  "ticket_id": "TICKET-123",         # 当 status 为 ticketed 时需要
  "ticket_title": "CPU 性能优化工单"
}
```

#### 批量操作
```http
POST /api/v1/anomalies/batch
Content-Type: application/json

{
  "anomaly_ids": [1, 2, 3],
  "action": "confirm",  # confirm/ignore/close
  "operator_id": "op_001",
  "operator_name": "张三",
  "comment": "批量处理"
}
```

#### 导出数据
```http
POST /api/v1/anomalies/export
Content-Type: application/json

{
  "status": ["pending", "confirmed"],
  "format": "xlsx"  # xlsx 或 csv
}
```

#### 获取操作历史
```http
GET /api/v1/anomalies/{id}/history
```

### 补偿操作 API

#### 创建补偿任务
```http
POST /api/v1/compensation/tasks
Content-Type: application/json

{
  "task_type": "fix_status_inconsistency",
  "task_description": "修复状态不一致问题",
  "anomaly_id": 1  # 可选，针对特定异常
}
```

#### 执行补偿任务
```http
POST /api/v1/compensation/tasks/{id}/execute
```

#### 修复单条异常
```http
POST /api/v1/compensation/anomalies/{id}/repair?repair_type=reset_status
```

支持的修复类型：
- `reset_status`：重置状态为 pending
- `fix_missing_timestamps`：修复缺失的时间戳
- `remove_duplicate_history`：移除重复历史记录

#### 清理脏数据
```http
POST /api/v1/compensation/cleanup/dirty_data
```

#### 系统健康状态
```http
GET /api/v1/compensation/health/status
```

## 关键实现机制说明

### 1. 幂等性处理

**实现方式**：

1. **幂等键生成**：
   - 用户可通过 `X-Idempotency-Key` 请求头传入自定义键
   - 如未传入，系统自动生成基于设备ID + 标题 + 时间戳的 Hash 键

2. **幂等记录表**：
   ```python
   class IdempotentRequest(Base):
       idempotency_key = Column(String, unique=True)
       status = Column(String)  # processing/completed
       response_data = Column(JSON)
       created_at = Column(DateTime)
       expires_at = Column(DateTime)  # 24小时后过期
   ```

3. **处理流程**：
   - 请求到达时，先检查幂等表
   - 如已存在 `completed` 状态的记录，直接返回缓存的响应
   - 如存在 `processing` 状态，返回 409 冲突错误
   - 创建新的 processing 记录后执行业务逻辑
   - 完成后更新为 completed 并保存响应数据

**测试方式**：
```bash
# 两次相同请求，第二次返回第一次的结果
curl -X POST http://localhost:8000/api/v1/anomalies/ \
  -H "X-Idempotency-Key: my-unique-key-001" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-001","title":"幂等测试","severity":"high"}'
```

### 2. 重复请求处理

**异常记录去重**：
- 每条异常记录都有唯一的 `anomaly_idempotency_key`
- 创建前先检查该键是否已存在
- 如已存在直接返回原有记录，不创建重复数据

**状态转换防重复**：
- 严格的状态机校验，防止同一操作重复执行
- 每次状态变更都写入历史记录，可追踪完整过程

**并发控制**：
- 使用数据库事务保证操作原子性
- 对于批量操作，逐个处理并记录成功/失败

### 3. 脏数据处理与补偿机制

#### 常见脏数据场景

| 场景 | 原因 | 补偿方式 |
|------|------|----------|
| 状态为 confirmed 但 confirmed_at 为空 | 系统故障、事务中断 | fix_missing_timestamps |
| 状态为 recovered 但 recovered_at 为空 | 异步回调失败 | fix_missing_timestamps |
| 状态流转跳过中间状态 | 数据迁移、手动修改 | fix_status_inconsistency |
| 重复的历史记录 | 重试机制问题 | remove_duplicate_history |
| 过期的 pending 异常 | 检测系统问题 | cleanup_dirty_data |

#### 补偿操作流程

1. **单条异常修复**：
   - 进入异常详情页
   - 点击"数据修复工具"区域的相应按钮
   - 查看修复结果

2. **批量补偿任务**：
   - 进入"补偿管理"标签页
   - 创建补偿任务（修复状态不一致、重建历史记录等）
   - 执行任务并查看结果

3. **系统自动清理**：
   - 调用 `/compensation/cleanup/dirty_data` 接口
   - 系统自动扫描并清理符合条件的脏数据

#### 补偿任务类型

| 任务类型 | 说明 | 适用场景 |
|----------|------|----------|
| fix_status_inconsistency | 修复状态与字段不一致 | 状态变更后相关字段未同步更新 |
| rebuild_history | 重建操作历史记录 | 历史记录丢失或损坏 |
| sync_ticket_status | 同步工单状态 | 外部工单系统状态变更未同步 |

### 4. 状态机校验

**状态转换矩阵**：

| 当前状态 | 允许转换到的状态 |
|----------|------------------|
| pending | confirmed, ignored, ticketed |
| confirmed | ticketed, recovered, ignored |
| ticketed | recovered, closed |
| recovered | closed |
| ignored | pending, confirmed |
| closed | （无，终态） |

**实现代码位置**：`app/api/anomalies.py` 中的 `valid_transitions` 字典

### 5. 操作审计

所有状态变更都会记录到 `confirmation_history` 表，包含：
- 操作人 ID 和姓名
- 操作时间
- 之前状态和新状态
- 操作备注
- 客户端 IP（可选）
- User-Agent（可选）

## 前端使用说明

### 主要页面

#### 1. 异常列表页
- **统计卡片**：展示各状态的异常数量
- **筛选栏**：按状态、严重程度、设备ID筛选
- **批量操作**：多选后执行批量确认/忽略/关闭
- **数据表格**：展示异常列表和数值变化
- **分页**：支持翻页浏览

#### 2. 异常详情页
点击列表中的"查看"按钮进入：
- **基本信息**：异常ID、设备、标题、严重程度、状态、时间
- **数值变化对比**：清晰展示之前值 → 当前值 → 阈值
- **描述**：异常详细描述
- **操作历史**：完整的审计日志，包含所有操作记录
- **数据修复工具**：针对单条异常的修复按钮
- **操作栏**：根据当前状态显示可用的操作

#### 3. 补偿管理页
- **数据修复工具**：快速创建补偿任务
- **补偿任务列表**：展示所有补偿任务的状态和进度

#### 4. 系统健康页
- 系统健康状态指示
- 待处理异常数
- 补偿任务统计（待执行/失败）
- 异常状态分布统计

## 测试指南

### 1. 幂等性测试

```bash
# 第一次请求
curl -X POST http://localhost:8000/api/v1/anomalies/ \
  -H "X-Idempotency-Key: idempotency-test-001" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-001","title":"幂等性测试异常","severity":"high","current_value":90.0,"previous_value":50.0}'

# 第二次请求（相同 key）- 返回相同结果，不创建新记录
curl -X POST http://localhost:8000/api/v1/anomalies/ \
  -H "X-Idempotency-Key: idempotency-test-001" \
  -H "Content-Type: application/json" \
  -d '{"device_id":"test-001","title":"幂等性测试异常","severity":"high","current_value":90.0,"previous_value":50.0}'
```

验证：数据库中只有一条记录，`anomaly_idempotency_key` 相同

### 2. 重复请求测试

快速连续点击前端的"确认异常"按钮，验证：
- 只有第一次操作生效
- 不会创建重复的历史记录
- 后续操作会被正确拒绝

### 3. 状态转换测试

测试无效的状态转换：
```bash
# 尝试从 pending 直接转到 closed - 应该失败
curl -X PUT http://localhost:8000/api/v1/anomalies/1/status \
  -H "Content-Type: application/json" \
  -d '{"new_status":"closed","operator_id":"op_001","operator_name":"测试"}'
```

验证：返回 400 错误，提示无效的状态转换

### 4. 脏数据修复测试

1. 通过数据库手动制造脏数据：
   ```sql
   -- 将状态改为 confirmed 但不设置 confirmed_at
   UPDATE anomaly_records SET status='confirmed', confirmed_at=NULL WHERE id=1;
   ```

2. 在前端进入异常详情页
3. 点击"修复缺失时间戳"按钮
4. 验证数据已修复

### 5. 补偿任务测试

1. 进入"补偿管理"页面
2. 点击"修复状态不一致"
3. 查看新创建的任务
4. 点击"执行"按钮
5. 验证任务状态变为 completed

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py           # FastAPI 应用入口
│   │   ├── config.py         # 配置文件
│   │   ├── database.py       # 数据库连接
│   │   ├── models.py         # 数据模型定义
│   │   ├── schemas.py        # Pydantic 模式
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── anomalies.py  # 异常记录 API
│   │       ├── devices.py    # 设备指标 API
│   │       ├── rules.py      # 规则管理 API
│   │       └── compensation.py # 补偿操作 API
│   ├── frontend/
│   │   └── index.html        # 前端页面
│   ├── requirements.txt      # Python 依赖
│   ├── init_data.py          # 测试数据初始化脚本
│   └── telemetry.db          # SQLite 数据库文件
└── README.md                 # 本文档
```

## 数据库 ER 图

```
anomaly_records (异常记录)
    ├─ id (PK)
    ├─ anomaly_idempotency_key (唯一索引)
    ├─ device_id
    ├─ metric_id (FK → device_metrics)
    ├─ rule_id (FK → anomaly_rules)
    ├─ title, description
    ├─ severity, status
    ├─ current_value, previous_value, threshold_value
    ├─ detected_at, confirmed_at, recovered_at, closed_at
    └─ metadata (JSON)
    │
    ├─→ confirmation_history (1:N)
    ├─→ ignore_reasons (1:N)
    ├─→ tickets (1:N)
    └─→ recovery_events (1:N)

device_metrics (设备指标)
    ├─ id, device_id, metric_name
    ├─ metric_value, unit, previous_value
    └─ timestamp, metadata

anomaly_rules (异常规则)
    ├─ id, rule_name, rule_type
    ├─ metric_name, threshold_min/max, operator
    ├─ severity, enabled, description
    └─ created_at, updated_at

idempotent_requests (幂等请求记录)
    ├─ id, idempotency_key (唯一)
    ├─ status, response_data
    └─ created_at, expires_at

compensation_tasks (补偿任务)
    ├─ id, anomaly_id (FK)
    ├─ task_type, task_description
    ├─ status, retry_count, max_retries
    └─ last_error, executed_at, completed_at
```

## 常见问题

### Q: 为什么创建异常时需要幂等键？
A: 防止网络重试、前端重复提交导致的重复数据。相同的幂等键多次调用只会创建一条记录。

### Q: 补偿任务执行失败了怎么办？
A: 系统支持重试机制，失败的任务可以再次点击"执行"按钮重试。每个任务默认最多重试 3 次，可以在数据库中修改 `max_retries` 字段。

### Q: 如何扩展支持更多的状态？
A: 在 `models.py` 的 `AnomalyStatus` 枚举中添加新状态，然后在 `anomalies.py` 的 `valid_transitions` 字典中配置允许的状态转换路径。

### Q: 如何替换数据库为 PostgreSQL？
A: 修改 `config.py` 中的 `SQLALCHEMY_DATABASE_URL` 为 PostgreSQL 连接串，安装 `psycopg2-binary` 包即可。数据模型和业务逻辑无需修改。
