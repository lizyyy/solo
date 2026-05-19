# 宠物医院药房管理系统

一个功能完整的宠物医院药房管理系统，支持药品剂量自动计算、库存批号管理、批量导入导出、处方审核流程等功能。

## 功能特性

### 核心功能
- **智能剂量计算**: 根据宠物体重自动计算药品剂量，支持最小/最大剂量限制
- **库存批号管理**: 先进先出的库存批号分配，自动扣减库存
- **批量操作**: 支持Excel/CSV批量导入，详细的成功/失败统计
- **失败重试**: 批量操作失败项可单独重试，不影响已成功记录
- **处方流程**: 草稿 → 待审核 → 已批准/已驳回 → 已发药
- **筛选查询**: 按负责人、时间、状态、异常类型多维度筛选
- **数据导出**: 支持Excel/CSV格式导出，与查询结果一致

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

依赖包包括:
- SQLAlchemy (数据库ORM)
- FastAPI + Uvicorn (API服务)
- Pandas + OpenPyXL (数据处理)
- Typer (命令行工具)
- Pydantic (数据验证)

### 2. 初始化数据库

```bash
python main.py init-db
```

### 3. 初始化示例数据

```bash
python main.py init-sample-data
```

示例数据包含:
- 3种药品 (头孢氨苄注射液、恩诺沙星片、伊维菌素注射液)
- 4个库存批号
- 3位医生 (工号: DOC001, DOC002, DOC003)

### 4. 启动API服务

```bash
python main.py start-api
```

启动后访问:
- API文档: http://localhost:8000/docs
- 备用文档: http://localhost:8000/redoc

## 命令行使用指南

### 处方操作

#### 创建处方

```bash
# 创建处方
# 先手动创建一个宠物记录 (需要通过SQL或者使用批量导入
```

#### 提交审核
```bash
python main.py submit-review 1 "张药师
```

#### 审核通过
```bash
python main.py approve 1 "李主任" "剂量计算正确，库存充足
```

#### 驳回处方
```bash
python main.py reject 1 "王主任" "药品选择错误，请重新选择
```

#### 发药
```bash
python main.py dispense 1 "药房张"
```

#### 查询处方列表
```bash
# 查询所有处方
python main.py list-prescriptions

# 按状态筛选
python main.py list-prescriptions --status approved

# 按创建人筛选
python main.py list-prescriptions --created-by 张医生
```

#### 查看处方详情
```bash
python main.py get-prescription 1
```

### 批量导入

#### 导入处方
```bash
# 使用示例CSV文件导入
python main.py import-prescriptions sample_prescriptions.csv

# 或使用Excel文件
python main.py import-prescriptions sample_prescriptions.xlsx
```

示例CSV格式见 `sample_prescriptions.csv`，包含:
- 正常数据（小体重宠物(0.8kg猫 → 自动调整到最小剂量
- 正常数据（大体重宠物25kg狗 → 自动调整到最大剂量）
- 错误数据（医生工号不存在 → 导入失败）

#### 查询批量操作
```bash
# 查看所有批量操作
python main.py list-batch-operations

# 按状态筛选
python main.py list-batch-operations --status partial_success
```

#### 重试失败项
```bash
python main.py retry_batch BATCH20240101XXXXXX
```

### 数据导出

#### 导出处方
```bash
# 导出所有处方
python main.py export-prescriptions prescriptions.xlsx

# 按状态筛选导出
python main.py export-prescriptions prescriptions.csv --status dispensed
```

## API接口使用

### 初始化数据
```bash
# 调用API初始化示例数据
curl -X POST http://localhost:8000/api/init-data
```

### 创建处方
```bash
curl -X POST http://localhost:8000/api/prescriptions \
  -H "Content-Type: application/json" \
  -d '{
    "pet_id": 1,
    "doctor_id": 1,
    "items": [{"medicine_id": 1, "administration_route": "皮下注射"}],
    "created_by": "张医生"
  }'
```

### 批量导入
```bash
curl -X POST "http://localhost:8000/api/import/prescriptions?created_by=API导入" \
  -F "file=@sample_prescriptions.csv"
```

### 查询处方
```bash
# 查询所有处方
curl http://localhost:8000/api/prescriptions

# 按状态筛选
curl "http://localhost:8000/api/prescriptions?status=pending_review"
```

### 导出处方
```bash
# 导出Excel
curl -O -J "http://localhost:8000/api/export/prescriptions?format=xlsx"

# 导出CSV
curl -O -J "http://localhost:8000/api/export/prescriptions?format=csv"
```

## 业务逻辑详解

### 剂量计算规则

系统自动根据宠物体重计算剂量，同时考虑:

1. **基础剂量**: 体重 × 每公斤剂量
2. **最小剂量限制**: 对小体重宠物保护
   - 头孢氨苄: 最小25mg
   - 恩诺沙星: 最小12.5mg
   - 伊维菌素: 最小0.5mg
3. **最大剂量限制**: 对大体重宠物保护
   - 头孢氨苄: 最大500mg
   - 恩诺沙星: 最大200mg
   - 伊维菌素: 最大20mg
4. **浓度换算**: 根据药品浓度自动转换给药体积

示例:
```
宠物: 0.8kg 小猫
药品: 恩诺沙星片 (25mg/片)
基础剂量: 0.8kg × 5mg/kg = 4mg
调整后: 12.5mg (低于最小剂量，调整)
给药: 0.5片
```

### 库存分配策略

先进先出 (FIFO):
1. 查询该药品所有有效库存批号
2. 按生产日期排序
3. 优先使用最早的批次
4. 数量不足时自动分配下一批次

### 处方状态流转

```
草稿 (draft
  ↓ (提交审核)
待审核 (pending_review)
  ↗ ↓
已批准 (approved) → 发药 → 已发药 (dispensed)
  ↓
已驳回 (rejected)
```

### 批量操作保证

- **原子性**: 单条记录处理，失败不影响其他记录
- **可重试**: 失败记录可单独重试
- **详细日志**: 记录每次操作的详细错误信息
- **状态追踪**: 完整的状态追踪每条记录处理状态

错误类型分类:
- `validation_error`: 数据验证错误
- `dosage_error`: 剂量计算错误
- `inventory_error`: 库存不足错误
- `system_error`: 系统内部错误

## 项目结构

```
.
├── src/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── repositories.py    # 数据访问层
│   ├── services.py        # 业务逻辑层
│   ├── import_export.py # 导入导出
│   ├── api.py           # API接口
│   └── cli.py           # 命令行
├── main.py                # 入口文件
├── requirements.txt       # 依赖列表
├── pyproject.toml         # 项目配置
├── sample_prescriptions.csv  # 示例导入数据
└── README.md             # 说明文档
```

## 数据库设计

### 核心表结构

1. **medicines**: 药品主表
   - 药品基本信息、剂量规则、浓度配置

2. **inventory_batches**: 库存批次
   - 批次号、数量、有效期、位置

3. **pets**: 宠物信息
   - 宠物名称、品种、体重、主人信息

4. **doctors**: 医生信息
   - 医生姓名、工号、科室

5. **prescriptions**: 处方主表
   - 处方编号、宠物、医生、状态、审核信息

6. **prescription_items**: 处方明细
   - 药品、剂量、计算结果、库存批号

7. **batch_operations**: 批量操作记录
   - 操作ID、类型、状态、统计

8. **batch_operation_items**: 批量操作明细
   - 行数据、处理状态、错误信息

## 常见问题

### 问题
:---------:
批量导入失败怎么办？

查看批量操作明细中的错误信息，修正数据后重试失败项。重试只会处理失败的记录，已成功的记录不会重复处理。

### 剂量计算不准确？

检查药品的剂量规则配置是否正确（每公斤剂量、最小/最大剂量限制。

### 库存不足？

先检查库存批次数量，及时补充库存。

## 许可证

MIT License
