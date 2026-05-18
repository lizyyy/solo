# 展会制证材料退回批次报告后端API

## 项目概述

这是一个展会制证材料管理系统，用于管理参展商、搭建商和媒体的制证材料，支持材料退回、重新提交、版本管理、批次处理和报告生成功能。

## 核心功能

### 1. 参展主体管理
- 支持参展商、搭建商、媒体三种类型
- 基本信息管理（联系人、电话、邮箱、展位号等）
- 按类型筛选查询

### 2. 人员材料管理
- 材料信息录入（姓名、身份证号、证件类型等）
- 身份证格式验证
- **版本管理**：每次重新提交自动递增版本号
- **完整版本历史记录**

### 3. 材料状态流转（状态机）
- 草稿 → 已提交 → 审核中 → 已通过/已退回/需要人工复核
- 已退回 → 重新提交 → 已通过/已退回
- 已通过 → 已制证（终态）
- 已拒绝（终态）

### 4. 退回原因管理
- 内置8种默认退回原因
- 支持自定义退回原因
- 支持标记是否需要人工复核

### 5. 制证批次管理
- 批量创建制证批次
- 批次材料批量退回
- 批次统计（总数、退回数、通过数）

### 6. 制证报告生成
- 按批次生成退回报告
- 统计退回率、退回原因分布
- 支持Excel/CSV格式导出
- 报告下载功能

## 核心特性

### ✅ 材料版本管理
每次重新提交材料时自动创建版本历史，保留所有修改记录

### ✅ 重复提交幂等性
支持通过幂等键（Idempotency Key）防止重复提交

### ✅ 退回状态机
严格的状态流转控制，防止非法状态转换

### ✅ 错误响应分类
系统将错误清晰分类，调用方可以根据错误码进行相应处理：
- **MISSING_FIELDS**：缺少必填字段
- **INVALID_STATUS**：状态不允许当前操作
- **NEEDS_MANUAL_REVIEW**：需要人工复核
- **ALREADY_PROCESSED**：材料已处于终态，无法操作
- **DUPLICATE_SUBMISSION**：重复提交
- **NOT_FOUND**：资源不存在
- **VALIDATION_ERROR**：验证错误

### ✅ 报告导出
支持导出Excel和CSV格式的退回报告，包含完整统计信息

## 技术栈

- **Web框架**: FastAPI 0.109.0
- **ORM**: SQLAlchemy 2.0.25
- **数据库**: SQLite（可替换为其他数据库）
- **数据验证**: Pydantic 2.5.3
- **报告导出**: Pandas + OpenPyXL

## 项目结构

```
.
├── main.py              # FastAPI主应用和路由
├── models.py            # 数据库模型
├── schemas.py           # Pydantic数据模型
├── services.py          # 业务逻辑服务
├── database.py          # 数据库配置
├── requirements.txt     # 依赖列表
├── test_self_check.py   # 自检脚本
└── README.md            # 项目文档
```

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python3 test_self_check.py
```

自检脚本会验证所有核心功能：
- 参展主体管理（创建、查询、筛选）
- 退回原因管理
- 人员材料创建和版本管理
- 状态流转（提交→退回→重新提交→通过）
- 幂等性验证
- 需要人工复核场景
- 制证批次管理
- 批量退回
- 报告生成和统计
- 错误响应分类

### 3. 启动API服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问API文档

启动服务后，访问以下地址查看API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口概览

### 参展主体
- `POST /participants` - 创建参展主体
- `GET /participants` - 查询参展主体列表（支持按类型筛选）
- `GET /participants/{code}` - 查询单个参展主体
- `PUT /participants/{code}` - 更新参展主体

### 人员材料
- `POST /materials` - 创建人员材料
- `GET /materials` - 查询材料列表（支持多维度筛选）
- `GET /materials/{code}` - 查询单个材料
- `POST /materials/submit` - 提交材料（支持幂等键）
- `POST /materials/return` - 退回材料
- `POST /materials/resubmit` - 重新提交材料
- `POST /materials/approve` - 审核通过材料

### 退回原因
- `POST /return-reasons` - 创建退回原因
- `GET /return-reasons` - 查询所有退回原因

### 制证批次
- `POST /batches` - 创建制证批次
- `GET /batches` - 查询批次列表
- `GET /batches/{code}` - 查询单个批次
- `POST /batches/{code}/add-materials` - 批量添加材料
- `POST /batches/{code}/return-materials` - 批量退回材料

### 制证报告
- `POST /reports/generate` - 生成报告
- `GET /reports` - 查询报告列表
- `GET /reports/{code}` - 查询单个报告
- `GET /reports/{code}/download` - 下载报告文件

## 默认退回原因

系统内置以下默认退回原因：
| 代码 | 分类 | 描述 | 需要人工复核 |
|------|------|------|------------|
| MISSING_NAME | 信息缺失 | 姓名缺失 | 否 |
| MISSING_ID_CARD | 信息缺失 | 身份证号缺失 | 否 |
| INVALID_PHOTO | 照片无效 | 照片不符合要求 | 否 |
| BLURRY_PHOTO | 照片无效 | 照片模糊 | 否 |
| ID_CARD_MISMATCH | 证件错误 | 身份证信息不匹配 | 是 |
| DUPLICATE_PERSON | 重复提交 | 人员重复提交 | 否 |
| FORMAT_ERROR | 格式错误 | 表格格式错误 | 否 |
| OTHER | 其他 | 其他原因 | 是 |

## 证件类型

- 参展商证
- 搭建商证
- 记者证
- 工作人员证
- VIP证

## 使用示例

### 1. 创建参展商

```bash
curl -X POST "http://localhost:8000/participants" \
  -H "Content-Type: application/json" \
  -d '{
    "participant_code": "EXH001",
    "name": "测试展览公司",
    "type": "参展商",
    "contact_person": "张三",
    "contact_phone": "13800138000"
  }'
```

### 2. 创建人员材料

```bash
curl -X POST "http://localhost:8000/materials" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MAT001",
    "participant_code": "EXH001",
    "id_card_type": "参展商证",
    "name": "李四",
    "id_card_number": "110101199001011234"
  }'
```

### 3. 提交材料

```bash
curl -X POST "http://localhost:8000/materials/submit" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MAT001",
    "idempotency_key": "IDEMP001"
  }'
```

### 4. 退回材料

```bash
curl -X POST "http://localhost:8000/materials/return" \
  -H "Content-Type: application/json" \
  -d '{
    "material_code": "MAT001",
    "return_reason_code": "INVALID_PHOTO",
    "return_note": "照片模糊不清"
  }'
```

### 5. 生成报告

```bash
curl -X POST "http://localhost:8000/reports/generate" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_code": "BATCH001",
    "report_code": "REP001",
    "name": "第一批制证退回报告",
    "file_format": "xlsx"
  }'
```

## 错误响应示例

### 需要人工复核
```json
{
  "error_code": "NEEDS_MANUAL_REVIEW",
  "message": "该退回原因需要人工复核",
  "details": {
    "return_reason_code": "ID_CARD_MISMATCH"
  }
}
```

### 材料已处理（终态）
```json
{
  "error_code": "ALREADY_PROCESSED",
  "message": "材料已处于终态，无法退回",
  "details": {
    "current_status": "已通过"
  }
}
```

### 重复提交
```json
{
  "error_code": "DUPLICATE_SUBMISSION",
  "message": "该请求已处理过",
  "details": {
    "idempotency_key": "IDEMP001"
  }
}
```

## 数据库设计

### 核心表结构
1. `participants` - 参展主体表
2. `person_materials` - 人员材料表
3. `material_version_history` - 材料版本历史表
4. `return_reasons` - 退回原因表
5. `certificate_batches` - 制证批次表
6. `batch_items` - 批次明细表
7. `batch_reports` - 制证报告表
8. `id_card_rules` - 证件规则表

## 许可证

MIT License
