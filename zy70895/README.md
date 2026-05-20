# 制造工单返修归因系统 API

工厂质量工程师可以提交材料、触发复核流程、查询处理轨迹和导出数据。

## 功能特性

1. **批次管理**：创建和查询批次
2. **材料登记**：上传或登记原始材料，支持去重识别
3. **复核流程**：触发复核、完成复核
4. **审计追踪**：记录谁改过结论、为什么改、改动前是什么
5. **查询明细**：查询单条明细的处理轨迹
6. **数据导出**：导出Excel，包含返修原因、工位、物料批次、最后处理人
7. **统计分析**：各状态数量统计、Top返修原因、Top问题工位

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

或直接运行启动脚本：
- Windows: `start.bat`
- Mac/Linux: `./start.sh`

服务启动后访问: http://localhost:8000/docs

## API 接口说明

### 1. 批次管理

#### 创建批次
```http
POST /batches/
Content-Type: application/json

{
  "batch_number": "BATCH2024001",
  "product_model": "产品A",
  "production_line": "1号线",
  "description": "2024年5月批次",
  "created_by": "张工"
}
```

#### 查询批次列表
```http
GET /batches/?skip=0&limit=100
```

#### 查询单个批次
```http
GET /batches/{batch_id}
```

### 2. 材料管理

#### 登记材料（支持去重）
```http
POST /materials/
Content-Type: application/json

{
  "work_order": "WO20240501001",
  "workstation": "SMT-03",
  "material_batch": "MAT20240428",
  "rework_reason": "焊点虚焊",
  "raw_data": "原始数据详情...",
  "batch_id": 1
}
```

**响应示例（重复提交）**：
```json
{
  "message": "材料已存在，返回原有记录",
  "is_duplicate": true,
  "material": {...}
}
```

#### 查询材料列表
```http
GET /materials/?batch_id=1&skip=0&limit=100
```

#### 查询材料详情（含审计日志）
```http
GET /materials/{material_id}/detail
```

#### 更新材料（自动记录审计日志）
```http
PUT /materials/{material_id}?operator=李工&change_reason=复核后调整结论
Content-Type: application/json

{
  "conclusion": "确认物料批次问题，需追溯",
  "status": "completed"
}
```

#### 查询审计日志（变更历史）
```http
GET /materials/{material_id}/audit-logs
```

### 3. 复核管理

#### 触发复核流程
```http
POST /review/trigger
Content-Type: application/json

{
  "material_id": 1,
  "reviewer": "王工",
  "review_comment": "原因需要进一步确认",
  "review_result": "pending"
}
```

#### 完成复核
```http
POST /review/complete?material_id=1&reviewer=王工&final_conclusion=最终结论...&change_reason=复核完成
```

### 4. 导出管理

#### 获取统计数据
```http
GET /export/statistics
```

**响应示例**：
```json
{
  "total_materials": 100,
  "pending_count": 20,
  "processing_count": 15,
  "completed_count": 60,
  "rejected_count": 5,
  "top_reasons": [
    {"reason": "焊点虚焊", "count": 25},
    {"reason": "元器件不良", "count": 18}
  ],
  "top_workstations": [
    {"workstation": "SMT-03", "count": 30},
    {"workstation": "TEST-01", "count": 22}
  ]
}
```

#### 导出Excel
```http
GET /export/excel?batch_id=1
```

导出字段：
- 制造工单号 (work_order)
- 返修原因 (rework_reason)
- 工位 (workstation)
- 物料批次 (material_batch)
- 结论 (conclusion)
- 最后处理人 (final_processor)
- 状态 (status)
- 创建时间 (created_at)

#### 导出JSON（含统计数据）
```http
GET /export/data?batch_id=1
```

## 核心设计

### 去重机制

系统通过 `work_order + workstation + material_batch + raw_data` 组合生成 MD5 哈希值，当同一批材料重复提交时：
- 识别到重复，返回原有记录
- 标记 `is_duplicate: true`
- 不会生成新的有效记录

### 审计追踪

每次修改操作自动记录：
- `material_id`: 关联的材料ID
- `change_type`: 变更类型（结论变更/状态变更等）
- `operator`: 操作人
- `change_reason`: 修改原因
- `old_value`: 改动前的值（JSON格式）
- `new_value`: 改动后的值（JSON格式）
- `changed_at`: 变更时间

### 状态流转

```
pending (待处理)
    ↓
processing (处理中)
    ↓
reviewing (复核中)
    ↓
completed (已完成) / rejected (已拒绝)
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # SQLAlchemy 数据模型
│   ├── schemas.py           # Pydantic 数据结构
│   ├── crud.py              # 业务逻辑层
│   └── api/
│       ├── __init__.py
│       ├── batches.py       # 批次管理接口
│       ├── materials.py     # 材料管理接口
│       ├── review.py        # 复核管理接口
│       └── export.py        # 导出管理接口
├── main.py                  # 应用入口
├── requirements.txt         # 依赖列表
├── start.sh                 # Linux/Mac启动脚本
├── start.bat                # Windows启动脚本
└── README.md
```

## 数据库表

- `batches`: 批次表
- `materials`: 材料表（含去重hash字段）
- `audit_logs`: 审计日志表
- `review_records`: 复核记录表

## 技术栈

- **Web框架**: FastAPI
- **ORM**: SQLAlchemy
- **数据库**: SQLite（可扩展为MySQL/PostgreSQL）
- **Excel导出**: pandas + openpyxl
