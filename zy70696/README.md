# 眼镜加工度数版本取件提醒后端API

基于 FastAPI + SQLite 的眼镜店加工订单管理系统，支持度数版本管理、加工状态机、改度拦截、取件提醒和报告导出等核心功能。

## 核心功能

- **顾客管理**: 顾客信息增删改查
- **验光单管理**: 支持多版本验光数据
- **镜架管理**: 镜架库存管理
- **镜片订单管理**: 订单创建、状态跟踪
- **加工状态机**: 10种加工状态，严格状态流转控制
- **改度拦截机制**: 加工到一定阶段后自动拦截改度申请
- **度数版本管理**: 改度审批通过后自动创建新版验光单
- **取件提醒**: 待取件状态后发送提醒，支持多轮提醒
- **人工修正**: 异常订单人工修正并记录日志
- **订单撤回**: 支持订单取消撤回
- **报告导出**: Excel格式导出加工订单和取件报告

## 加工状态流转

```
pending → lens_preparing → lens_cutting → lens_polishing → frame_fitting → quality_check → ready_for_pickup → picked_up
                           ↓                    ↓                    ↓                    ↓                    ↓
                        cancelled          cancelled          cancelled          cancelled          cancelled
                           ↓                    ↓                    ↓                    ↓                    ↓
                        on_hold            on_hold            on_hold            on_hold            on_hold
```

## 改度拦截规则

- **镜片抛光阶段及之后**: 自动拦截，无法改度
- **镜片切割阶段**: 需人工审核，有改度次数限制
- **待审核及之前阶段**: 可正常申请改度，审批通过后生效

## 项目结构

```
.
├── main.py              # FastAPI主程序和路由
├── models.py            # SQLAlchemy数据模型
├── schemas.py           # Pydantic请求/响应模型
├── services.py          # 核心业务逻辑服务
├── database.py          # 数据库连接配置
├── seed_data.py         # 测试数据生成脚本
├── conftest.py          # pytest配置
├── test_main.py         # 测试用例
├── requirements.txt     # 依赖包
└── optical_lab.db       # SQLite数据库文件(自动生成)
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- Redoc文档: http://localhost:8000/redoc

### 3. 生成测试数据

```bash
python seed_data.py
```

该脚本会自动创建:
- 3位顾客
- 3份验光单
- 3款镜架
- 3个加工订单(不同状态)

## API接口示例 (curl)

### 顾客管理

```bash
# 创建顾客
curl -X POST "http://localhost:8000/customers/" \
  -H "Content-Type: application/json" \
  -d '{"name":"张三","phone":"13800138000","email":"zhangsan@example.com"}'

# 查询顾客
curl "http://localhost:8000/customers/1"

# 顾客列表
curl "http://localhost:8000/customers/"
```

### 验光单管理

```bash
# 创建验光单
curl -X POST "http://localhost:8000/prescriptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "optometrist": "王医生",
    "exam_date": "2024-01-15T10:00:00",
    "od_sphere": -2.0,
    "od_cylinder": -0.5,
    "od_axis": 180,
    "os_sphere": -2.5,
    "os_cylinder": -0.75,
    "os_axis": 170,
    "pd_distance": 62,
    "notes": "初诊验光"
  }'

# 查询顾客验光单
curl "http://localhost:8000/prescriptions/customer/1"
```

### 镜片订单管理

```bash
# 创建订单
curl -X POST "http://localhost:8000/lens-orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "customer_id": 1,
    "prescription_id": 1,
    "frame_id": 1,
    "lens_type_od": "1.67非球面",
    "lens_type_os": "1.67非球面",
    "lens_brand": "依视路",
    "rush_order": false,
    "created_by": "前台小王"
  }'

# 查询订单详情
curl "http://localhost:8000/lens-orders/1"

# 订单列表(带筛选)
curl "http://localhost:8000/lens-orders/?status=pending&page=1&page_size=20"
```

### 加工状态推进

```bash
# 更新加工状态
curl -X PATCH "http://localhost:8000/lens-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "lens_preparing",
    "changed_by": "操作员A",
    "notes": "开始镜片准备"
  }'

# 查看状态历史
curl "http://localhost:8000/lens-orders/1/status-history"
```

### 改度申请和审核 (主流程)

```bash
# 1. 申请改度
curl -X POST "http://localhost:8000/degree-changes/" \
  -H "Content-Type: application/json" \
  -d '{
    "lens_order_id": 1,
    "reason": "顾客反馈度数不准确，重新验光后需调整",
    "requested_by": "客服小王",
    "od_sphere": -1.75,
    "os_sphere": -2.25
  }'

# 2. 审核改度(批准)
curl -X POST "http://localhost:8000/degree-changes/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "reviewed_by": "张主管",
    "review_notes": "已复核新验光数据，批准改度"
  }'

# 3. 审核改度(拒绝)
curl -X POST "http://localhost:8000/degree-changes/1/review" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "rejected",
    "reviewed_by": "张主管",
    "review_notes": "建议先适应一周，观察后再决定"
  }'

# 查询改度记录
curl "http://localhost:8000/degree-changes/?order_id=1"
```

### 取件管理

```bash
# 发送取件提醒
curl -X POST "http://localhost:8000/pickup-reports/3/reminder" \
  -H "Content-Type: application/json" \
  -d '{
    "reminder_type": "first",
    "sent_by": "客服小王",
    "notes": "短信已发送"
  }'

# 确认取件
curl -X POST "http://localhost:8000/pickup-reports/3/confirm" \
  -H "Content-Type: application/json" \
  -d '{
    "picked_up_by": "张三本人",
    "pickup_notes": "顾客对成品满意"
  }'

# 查询取件报告
curl "http://localhost:8000/pickup-reports/3"
```

### 订单管理

```bash
# 撤回订单
curl -X POST "http://localhost:8000/lens-orders/1/withdraw" \
  -H "Content-Type: application/json" \
  -d '{
    "reason": "顾客取消订单，要求退款",
    "changed_by": "客服小王"
  }'

# 人工修正
curl -X POST "http://localhost:8000/lens-orders/1/manual-correction" \
  -H "Content-Type: application/json" \
  -d '{
    "field_name": "lens_type_od",
    "old_value": "1.67非球面",
    "new_value": "1.74非球面",
    "reason": "顾客补差价升级镜片",
    "corrected_by": "主管老李"
  }'
```

### 报告导出

```bash
# 导出加工订单Excel
curl -X POST "http://localhost:8000/export/lens-orders" \
  -H "Content-Type: application/json" \
  -d '{
    "status": ["pending", "lens_preparing", "lens_cutting"],
    "date_from": "2024-01-01T00:00:00"
  }' \
  --output orders.xlsx

# 导出取件报告Excel
curl "http://localhost:8000/export/pickup-reports" \
  --output pickup_reports.xlsx
```

## 冲突路径和异常场景示例

### 场景1: 抛光阶段改度被拦截

```bash
# 先将订单推进到抛光阶段
curl -X PATCH "http://localhost:8000/lens-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "lens_preparing", "changed_by": "操作员A"}'
curl -X PATCH "http://localhost:8000/lens-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "lens_cutting", "changed_by": "操作员A"}'
curl -X PATCH "http://localhost:8000/lens-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "lens_polishing", "changed_by": "操作员A"}'

# 尝试改度 - 会被自动拦截
curl -X POST "http://localhost:8000/degree-changes/" \
  -H "Content-Type: application/json" \
  -d '{
    "lens_order_id": 1,
    "reason": "顾客要求改度",
    "requested_by": "客服小王",
    "od_sphere": -1.5
  }'
# 响应中 can_apply = false, status = rejected
```

### 场景2: 无效的状态流转

```bash
# 将订单推进到待取件状态后，尝试退回pending
curl -X PATCH "http://localhost:8000/lens-orders/3/status" \
  -H "Content-Type: application/json" \
  -d '{"status": "pending", "changed_by": "操作员A"}'
# 返回 400 错误: 无效的状态转换
```

### 场景3: 非待取件状态发送提醒

```bash
# 尝试给还在加工中的订单发送取件提醒
curl -X POST "http://localhost:8000/pickup-reports/2/reminder" \
  -H "Content-Type: application/json" \
  -d '{"reminder_type": "first", "sent_by": "客服小王"}'
# 返回 400 错误: 订单状态不是待取件
```

### 场景4: 重复审核改度申请

```bash
# 第一次审核拒绝后，尝试再次批准
curl -X POST "http://localhost:8000/degree-changes/1/review" \
  -H "Content-Type: application/json" \
  -d '{"status": "approved", "reviewed_by": "李主管", "review_notes": "再次审核"}'
# 返回 400 错误: 该改度记录已处理
```

## 运行测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试类
pytest test_main.py::TestDegreeChangeFlow -v

# 运行单个测试用例
pytest test_main.py::TestDegreeChangeFlow::test_degree_change_interception_polishing_stage -v

# 生成测试覆盖率报告
pytest --cov=. --cov-report=html
```

## 数据模型说明

### 核心实体关系

```
顾客 (Customer)
  ├── 验光单 (Prescription) [1:N]
  │     └── 改度记录 (DegreeChangeRecord) [1:N]
  └── 镜片订单 (LensOrder) [1:N]
        ├── 镜架 (Frame) [N:1]
        ├── 验光单 (Prescription) [N:1]
        ├── 改度记录 (DegreeChangeRecord) [1:N]
        ├── 加工状态历史 (ProcessingStatusHistory) [1:N]
        └── 取件报告 (PickupReport) [1:1]
```

### 改度记录字段说明

- `raw_input`: 保存原始请求JSON，用于审计和问题追溯
- `processing_conclusion`: 处理结论，记录自动拦截或人工审核结果
- `interception_reason`: 自动拦截原因
- `requested_by/reviewed_by/applied_by`: 操作人记录

## 开发说明

### 状态机扩展

在 `services.py` 的 `ProcessingStateMachine` 类中修改 `VALID_TRANSITIONS` 字典来扩展状态流转规则。

### 拦截规则修改

在 `DegreeChangeInterceptor` 类中修改 `can_apply_change` 方法来调整改度拦截逻辑。

### 数据库迁移

如需修改数据模型，删除 `optical_lab.db` 文件后重新启动服务，SQLAlchemy会自动重建表结构。

## 许可证

MIT
