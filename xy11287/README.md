# 宠物医院药房管理系统

一个专为宠物医院药房设计的后端管理系统，提供处方校验、审核留痕、库存管理和追溯查询功能。

## 核心功能

### 1. 处方智能校验
- **剂量上下限校验**：根据宠物体重自动计算推荐剂量范围，超剂量自动拦截
- **禁忌组合检查**：检测药物间禁忌配伍，高风险自动拦截
- **批号过期校验**：自动检查药品批号有效期
- **库存不足检查**：发药前验证库存是否充足

### 2. 完整业务流程
- **处方提交**：医生提交处方，系统自动校验
- **处方审核**：药师审核处方，记录审核意见
- **处方发药**：扣减库存，更新处方状态
- **处方拦截**：异常处方自动标记为拦截状态

### 3. 审计与追溯
- **操作留痕**：所有状态变更记录操作人、时间、原因
- **追溯查询**：按处方ID查询完整历史记录
- **筛选查询**：按负责人、状态、异常类型、时间范围筛选

### 4. 数据安全
- **幂等性保证**：重复提交结果稳定，防止重复扣库
- **报表导出**：支持Excel格式导出查询结果

## 项目结构

```
├── main.py              # FastAPI主应用，API接口定义
├── models.py            # SQLAlchemy数据库模型
├── schemas.py           # Pydantic数据模型
├── crud.py              # 数据库操作逻辑
├── rules.py             # 业务规则引擎（剂量校验等）
├── database.py          # 数据库连接配置
├── test_system.py       # 系统功能测试脚本
├── requirements.txt     # Python依赖包
└── pharmacy.db          # SQLite数据库文件（自动生成）
```

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

### 3. 访问API文档
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

### 4. 运行功能测试
```bash
python test_system.py
```

## API接口说明

### 药品管理
- `POST /drugs/` - 创建药品
- `GET /drugs/` - 查询药品列表
- `GET /drugs/{drug_id}` - 查询单个药品

### 库存管理
- `POST /inventory/batches/` - 创建库存批号
- `GET /inventory/batches/` - 查询库存批号

### 禁忌管理
- `POST /contraindications/` - 创建药物禁忌

### 处方管理
- `POST /prescriptions/` - 提交处方（幂等键：idempotency_key）
- `GET /prescriptions/{prescription_id}` - 查询处方详情

### 处方审核
- `POST /prescriptions/review` - 审核处方

### 发药管理
- `POST /prescriptions/dispense` - 处方发药

### 追溯查询
- `GET /prescriptions/trace/{prescription_id}` - 处方完整追溯
- `GET /prescriptions/query/` - 处方筛选查询
  - 参数：doctor, status, exception_type, start_date, end_date, operator

### 审计日志
- `GET /audit-logs/` - 查询审计日志

### 报表导出
- `GET /reports/export` - 导出Excel报表（支持相同筛选参数）

## 业务规则说明

### 剂量计算规则
```
最小剂量 = 药品最小剂量/kg × 体重
最大剂量 = 药品最大剂量/kg × 体重

处方剂量 < 最小剂量 → 警告
处方剂量 > 最大剂量 → 拦截（blocked）
```

### 禁忌严重程度
- `high/critical` → 自动拦截
- `medium/low` → 警告提示

### 处方状态流转
```
submitted → pending_review → approved → dispensed
                          ↘ rejected
                ↘ blocked（自动校验不通过）
```

## 数据模型

### 主要实体
1. **Drug** - 药品信息（含剂量范围配置）
2. **InventoryBatch** - 库存批号（含有效期）
3. **Contraindication** - 药物禁忌关系
4. **Prescription** - 处方主表
5. **PrescriptionItem** - 处方明细
6. **ValidationResult** - 校验结果记录
7. **AuditLog** - 审计日志
8. **DispenseRecord** - 发药记录
9. **IdempotencyKey** - 幂等键记录

## 使用示例

### 1. 创建药品
```python
import requests

drug = {
    "name": "阿莫西林",
    "unit": "片",
    "min_dose_per_kg": 10,
    "max_dose_per_kg": 20,
    "dose_unit": "mg",
    "created_by": "admin"
}
response = requests.post("http://localhost:8000/drugs/", json=drug)
```

### 2. 提交处方
```python
prescription = {
    "prescription_no": "RX-001",
    "patient_name": "小白",
    "species": "犬",
    "weight": 5,
    "weight_unit": "kg",
    "doctor": "张医生",
    "created_by": "张医生",
    "items": [
        {
            "drug_id": 1,
            "drug_name": "阿莫西林",
            "prescribed_dose": 75,
            "dose_unit": "mg",
            "quantity": 10,
            "quantity_unit": "片"
        }
    ]
}
response = requests.post(
    "http://localhost:8000/prescriptions/?idempotency_key=key001",
    json=prescription
)
result = response.json()
print(f"处方状态: {result['prescription']['status']}")
print(f"拦截原因: {result['validation_summary']['blocking_exceptions']}")
```

### 3. 审核处方
```python
review = {
    "prescription_id": 1,
    "reviewer": "李药师",
    "reviewer_role": "pharmacist",
    "approved": True,
    "reason": "剂量正常，审核通过"
}
response = requests.post(
    "http://localhost:8000/prescriptions/review?idempotency_key=key002",
    json=review
)
```

### 4. 追溯查询
```python
response = requests.get("http://localhost:8000/prescriptions/trace/1")
trace = response.json()
print(f"审计日志: {trace['audit_logs']}")
print(f"校验结果: {trace['validations']}")
```

## 技术栈

- **FastAPI** - 高性能Web框架
- **SQLAlchemy** - ORM数据库操作
- **Pydantic** - 数据验证
- **SQLite** - 嵌入式数据库
- **Pandas + openpyxl** - Excel报表生成
- **Uvicorn** - ASGI服务器

## 注意事项

1. **幂等键要求**：提交、审核、发药接口必须提供 `idempotency_key` 参数，确保重复操作结果一致
2. **角色字段**：所有操作记录真实操作人姓名和角色，参与审计
3. **数据库**：默认使用SQLite，生产环境建议切换为PostgreSQL/MySQL
4. **时间戳**：所有记录自动记录创建/更新时间，无需手动传入
