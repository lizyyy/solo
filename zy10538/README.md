# 投诉证据材料补交API

基于 FastAPI + SQLAlchemy 构建的投诉材料补交管理系统，支持多批次提交、审核流转、缺项提醒、人工修正、完整追溯链和数据导出。

## 核心功能

### 数据模型
- **投诉编号** (complaint_no): 唯一标识投诉
- **材料类型** (material_type): 支持 complaint_form, identity_proof, service_contract, payment_proof 等
- **补交批次** (batch_no): 同一材料可多次提交，批次递增
- **审核状态** (status): pending/submitted/reviewing/approved/rejected/needs_supplement/completed
- **缺失说明** (missing_description): 缺项或驳回原因
- **材料报告** (material_report): JSON格式的材料详情
- **原始输入** (raw_input): 异常路径保留原始请求数据
- **处理依据/最终结论**: 审核记录的完整痕迹

### API 接口

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | `/api/materials/` | 创建材料 |
| GET | `/api/materials/` | 查询材料列表 |
| GET | `/api/materials/{id}` | 获取单个材料详情 |
| PUT | `/api/materials/{id}/status` | 更新材料状态 |
| POST | `/api/materials/{id}/audit` | 审核材料 |
| POST | `/api/materials/{id}/correct` | 人工修正 |
| GET | `/api/materials/{id}/corrections` | 查看修正历史 |
| POST | `/api/materials/{id}/retry` | 补交新材料（创建新批次） |
| GET | `/api/materials/{id}/trace` | 材料追溯链 |
| GET | `/api/complaints/{no}/missing` | 查询缺项材料 |
| GET | `/api/complaints/{no}/export` | 导出Excel报告 |
| GET | `/api/health` | 健康检查 |

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/api/health

### 3. 运行自检

```bash
python test_api.py
```

自检脚本将覆盖所有核心功能：
- ✅ 创建材料
- ✅ 查询列表
- ✅ 缺项提醒
- ✅ 审核流转
- ✅ 批次补交
- ✅ 人工修正
- ✅ 修正历史
- ✅ 追溯链条
- ✅ 导出报告

## 关键特性

### 1. 材料清单与缺项提醒
- 预定义服务投诉和产品投诉两种材料清单
- 自动对比已提交材料与清单要求
- 清晰展示每项材料的提交状态和批次信息

### 2. 补交状态管理
- 支持同一材料多次补交（batch_no 自动递增）
- 通过 parent_id 关联批次历史
- 保留每个批次的独立审核记录

### 3. 审核流转
- 8种标准状态覆盖完整生命周期
- 审核时记录审核人、时间、意见、处理依据、最终结论
- 支持批量查询和状态更新

### 4. 异常处理与追溯
- **原始输入**: 每个材料提交都保留原始请求数据
- **处理依据**: 审核决策的合规依据
- **最终结论**: 明确的审核结果
- **追溯链**: 从任意批次可追溯完整历史（含所有父批次）
- 重启服务后数据不丢失（SQLite持久化）

### 5. 人工修正
- 支持管理员人工修正材料信息
- 完整记录修正人、修正原因、新旧值对比
- 修正历史可查询、可审计

### 6. 导出功能
- 导出为 Excel 格式
- 包含所有字段和修正次数统计
- 便于归档和报表生成

## 使用示例

### 创建材料
```bash
curl -X POST "http://localhost:8000/api/materials/" \
  -H "Content-Type: application/json" \
  -d '{
    "complaint_no": "CP2024001",
    "material_type": "identity_proof",
    "batch_no": 1,
    "submitted_by": "customer001",
    "raw_input": {"user_data": "原始数据"}
  }'
```

### 查询缺项
```bash
curl "http://localhost:8000/api/complaints/CP2024001/missing?complaint_type=service_complaint"
```

### 审核材料
```bash
curl -X POST "http://localhost:8000/api/materials/1/audit" \
  -H "Content-Type: application/json" \
  -d '{
    "auditor": "auditor001",
    "audit_comment": "材料完整",
    "status": "approved",
    "processing_basis": "审核规范第5条",
    "final_conclusion": "通过"
  }'
```

## 数据库结构

- `complaint_materials`: 主表，存储所有材料信息
- `material_corrections`: 修正历史表
- `material_checklists`: 材料清单配置表

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型和初始化
├── schemas.py           # Pydantic数据模型
├── test_api.py          # 完整自检脚本
├── requirements.txt     # 依赖列表
├── README.md           # 项目文档
└── complaint_materials.db  # SQLite数据库（自动创建）
```
