# 飞灰螯合出库哨

垃圾焚烧厂飞灰固化车间本地后端 API - 飞灰批次管理、螯合剂投加记录、浸出检测、吨袋称重、填埋预约、出库校验。

## 核心功能

- **数据管理**: 飞灰批次、吨袋、浸出检测、填埋预约、复核备注、审计日志
- **智能校验**: 防止检测未过的吨袋被装车、同批次重复出库、预约重量对不上
- **数据导入**: 支持 CSV/JSON 格式批量导入
- **风险评估**: 自动计算风险等级，支持人工重算
- **人工改判**: 特殊情况下允许人工修改合格状态并记录原因
- **导出功能**: Markdown 交接单、JSON 审计包
- **审计追踪**: 所有操作记录审计日志

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy
- **数据验证**: Pydantic
- **服务器**: Uvicorn

## 安装运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## API 接口概览

| 模块 | 接口路径 | 说明 |
|------|----------|------|
| 批次管理 | `/api/batches/` | 飞灰批次 CRUD |
| 吨袋管理 | `/api/bags/` | 吨袋信息 CRUD |
| 检测管理 | `/api/inspections/` | 浸出检测记录 CRUD |
| 预约管理 | `/api/reservations/` | 填埋预约 CRUD |
| 出库管理 | `/api/reservations/{id}/execute` | 执行出库 |
| 复核备注 | `/api/review-notes/` | 复核备注管理 |
| 审计日志 | `/api/audit-logs/` | 审计日志查询 |
| 数据导入 | `/api/import/csv/*` | CSV 格式导入 |
| 数据导入 | `/api/import/json` | JSON 格式导入 |
| 风险管理 | `/api/risk/recalculate` | 风险重算 |
| 人工改判 | `/api/qualification/manual-override` | 人工改判 |
| 数据导出 | `/api/export/handover/{id}` | Markdown 交接单 |
| 数据导出 | `/api/export/audit/{id}` | JSON 审计包 |
| 统计信息 | `/api/stats/summary` | 系统统计概览 |

## 浸出毒性检测标准限值 (GB16889-2008)

| 重金属 | 限值 (mg/L) |
|--------|-------------|
| Pb (铅) | 0.25 |
| Cd (镉) | 0.15 |
| Cr (铬) | 0.30 |
| Hg (汞) | 0.05 |
| As (砷) | 0.30 |
| Zn (锌) | 100.0 |
| Cu (铜) | 40.0 |
| Ni (镍) | 0.50 |

## CURL 验证流程

### 步骤 1: 健康检查

```bash
curl http://localhost:8000/health
```

预期响应:
```json
{"status": "healthy", "timestamp": "2026-05-05T..."}
```

### 步骤 2: 导入样例数据

**方式一: 分别导入各 CSV 文件**

```bash
# 导入批次
curl -X POST "http://localhost:8000/api/import/csv/batches?operator=system" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/batches.csv"

# 导入吨袋
curl -X POST "http://localhost:8000/api/import/csv/bags?operator=system" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/ton_bags.csv"

# 导入检测记录
curl -X POST "http://localhost:8000/api/import/csv/inspections?operator=system" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/inspections.csv"

# 导入预约
curl -X POST "http://localhost:8000/api/import/csv/reservations?operator=system" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/reservations.csv"
```

**方式二: 一次性导入 JSON 数据**

```bash
curl -X POST "http://localhost:8000/api/import/json?operator=system" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@samples/sample_data.json"
```

### 步骤 3: 查询数据验证

**查看所有批次:**

```bash
curl "http://localhost:8000/api/batches/"
```

**查看所有吨袋:**

```bash
curl "http://localhost:8000/api/bags/"
```

**查看检测记录 (注意哪些不合格):**

```bash
curl "http://localhost:8000/api/inspections/"
```

**查看不合格的吨袋:**

```bash
curl "http://localhost:8000/api/bags/?is_qualified=false"
```

预期会发现 `TB-2026-005` 吨袋不合格 (因为 INSP-2026-005 检测超标)

### 步骤 4: 统计信息

```bash
curl "http://localhost:8000/api/stats/summary"
```

### 步骤 5: 出库校验 - 尝试出库不合格吨袋

**先获取预约 ID 和吨袋 ID:**

```bash
# 获取预约列表
curl "http://localhost:8000/api/reservations/"

# 获取吨袋列表 (注意 TB-2026-005 是不合格的)
curl "http://localhost:8000/api/bags/"
```

**假设预约 ID 是 1，尝试出库包含不合格吨袋的列表:**

```bash
# 先验证出库 (bag_ids 包含合格和不合格的吨袋)
curl "http://localhost:8000/api/outbound/validate/1?bag_ids=1&bag_ids=2&bag_ids=3&bag_ids=4&bag_ids=5"
```

预期响应会报错，提示吨袋 5 (TB-2026-005) 未通过检测，禁止出库。

### 步骤 6: 风险重算

```bash
# 对吨袋进行风险重算
curl -X POST "http://localhost:8000/api/risk/recalculate" \
  -H "Content-Type: application/json" \
  -d '{
    "bag_ids": [1, 2, 3, 4, 5],
    "operator": "张操作员"
  }'
```

### 步骤 7: 人工改判 (特殊情况)

假设 TB-2026-005 吨袋需要人工改判为合格 (需要记录原因):

```bash
curl -X POST "http://localhost:8000/api/qualification/manual-override" \
  -H "Content-Type: application/json" \
  -d '{
    "bag_id": 5,
    "new_is_qualified": true,
    "override_reason": "复检结果合格，首次检测为实验室操作误差",
    "operator": "王主管",
    "approval_required": true
  }'
```

### 步骤 8: 创建复核备注

```bash
curl -X POST "http://localhost:8000/api/review-notes/" \
  -H "Content-Type: application/json" \
  -d '{
    "reservation_id": 1,
    "reviewer": "李复核员",
    "risk_assessment": "normal",
    "note_content": "人工改判记录已核查，复检报告存档编号：RE-2026-001",
    "is_exception": true,
    "exception_reason": "包含人工改判记录"
  }'
```

### 步骤 9: 再次验证并执行出库

现在 TB-2026-005 已被人工改判为合格，再次验证:

```bash
# 验证出库
curl "http://localhost:8000/api/outbound/validate/1?bag_ids=1&bag_ids=2&bag_ids=3&bag_ids=4&bag_ids=5"
```

**执行出库:**

```bash
curl -X POST "http://localhost:8000/api/reservations/1/execute?operator=出库管理员" \
  -H "Content-Type: application/json" \
  -d "[1, 2, 3, 4, 5]"
```

### 步骤 10: 导出交接单和审计包

**导出 Markdown 交接单:**

```bash
# 获取交接单内容
curl "http://localhost:8000/api/export/handover/1"

# 保存到文件
curl "http://localhost:8000/api/export/handover/1" -o handover_1.md
```

**导出 JSON 审计包:**

```bash
# 获取审计包
curl "http://localhost:8000/api/export/audit/1"

# 保存到文件
curl "http://localhost:8000/api/export/audit/1/download" -o audit_package_1.json
```

### 步骤 11: 查看审计日志

```bash
# 查看所有审计日志
curl "http://localhost:8000/api/audit-logs/"

# 按操作类型筛选
curl "http://localhost:8000/api/audit-logs/?operation_type=MANUAL_OVERRIDE"

# 按模块筛选
curl "http://localhost:8000/api/audit-logs/?module=outbound_management"
```

## 数据模型说明

### FlyAshBatch (飞灰批次)
- `batch_number`: 批次编号 (唯一)
- `batch_date`: 批次日期
- `ash_source`: 飞灰来源
- `total_weight`: 总重量
- `bag_count`: 吨袋数量
- `chelating_agent_type`: 螯合剂类型
- `chelating_agent_dosage`: 螯合剂投加量 (kg/吨)
- `mixing_duration`: 混合时间 (分钟)

### TonBag (吨袋)
- `bag_number`: 吨袋编号 (唯一)
- `weight`: 重量 (吨)
- `rfid_tag`: RFID 标签
- `storage_location`: 存储位置
- `inspection_status`: 检测状态 (pending/in_progress/passed/failed)
- `risk_level`: 风险等级 (unknown/low/medium/high/critical)
- `is_qualified`: 是否合格
- `is_outbound`: 是否已出库

### InspectionRecord (检测记录)
- `inspection_number`: 检测编号 (唯一)
- `inspection_date`: 检测日期
- `inspector`: 检测员
- `leaching_pb/cd/cr/hg/as/zn/cu/ni`: 各重金属浸出浓度
- `is_qualified`: 是否合格
- `inspection_report`: 检测报告

### LandfillReservation (填埋预约)
- `reservation_number`: 预约编号 (唯一)
- `landfill_site`: 填埋场
- `transport_company`: 运输公司
- `vehicle_number`: 车牌号
- `driver_name`: 司机姓名
- `reserved_weight`: 预约重量
- `actual_weight`: 实际重量
- `status`: 状态 (pending/confirmed/in_progress/completed/cancelled)
- `is_completed`: 是否完成

## 项目结构

```
.
├── main.py                 # 主应用入口
├── requirements.txt        # 依赖配置
├── README.md              # 本文档
├── fly_ash.db             # SQLite 数据库 (运行后自动生成)
├── app/
│   ├── __init__.py
│   ├── database.py        # 数据库配置
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic 验证模型
│   ├── services.py        # 业务逻辑服务
│   └── import_export.py   # 导入导出服务
└── samples/
    ├── batches.csv        # 样例批次数据
    ├── ton_bags.csv       # 样例吨袋数据
    ├── inspections.csv    # 样例检测数据
    ├── reservations.csv   # 样例预约数据
    └── sample_data.json   # 综合样例 JSON 数据
```

## 安全校验规则

系统内置以下安全校验规则，执行出库时自动检查:

1. **检测未过校验**: 检查 `is_qualified=False` 的吨袋，禁止出库
2. **重复出库校验**: 检查 `is_outbound=True` 的吨袋，禁止重复出库
3. **列表重复校验**: 检查请求参数中是否有重复的吨袋
4. **重量差异校验**: 检查实际出库重量与预约重量差异 (±10% 警告，±5% 提示)

所有校验结果都会记录在审计日志中。

## API 文档

启动服务后访问:
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json
