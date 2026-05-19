# 家电售后仓管理系统

解决工程师领件、旧件返还和厂商索赔对账问题，确保每个环节可追溯、可审核。

## 功能特点

- ✅ 旧件未回拦截：未返还旧件无法提交索赔
- ✅ 重复索赔检测：同一旧件只能提交一次索赔
- ✅ 批次追踪：管理零件批次和质保期
- ✅ 完整审计日志：每条操作都记录原因
- ✅ 多条件筛选查询：按负责人、时间、状态、异常类型筛选
- ✅ Excel 报表导出：导出与查询结果一致的报告

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动

- API 文档: `http://localhost:8000/docs`
- Redoc 文档: `http://localhost:8000/redoc`

## 主流程操作

### 第一步：导入基础数据

```bash
# 添加零件
curl -X POST "http://localhost:8000/parts/" \
  -H "Content-Type: application/json" \
  -d '{"part_code":"COMP-001","name":"空调压缩机","model":"GMCC-PH225","quantity":50,"unit_price":280.00,"location":"A-01-01"}'

# 添加工程师
curl -X POST "http://localhost:8000/engineers/" \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"ENG001","name":"张三","phone":"13800138001","department":"空调维修组"}'

# 添加批次
curl -X POST "http://localhost:8000/batches/" \
  -H "Content-Type: application/json" \
  -d '{"batch_no":"BAT202401001","part_id":1,"quantity":50,"supplier":"美芝压缩机"}'
```

### 第二步：工程师领件

```bash
curl -X POST "http://localhost:8000/issuances/" \
  -H "Content-Type: application/json" \
  -d '{
    "engineer_id": 1,
    "part_id": 1,
    "batch_id": 1,
    "quantity": 1,
    "service_order_no": "SO20240115001",
    "customer_name": "李四",
    "customer_phone": "13900139001",
    "appliance_model": "格力KFR-35GW",
    "fault_description": "压缩机不启动",
    "issued_by": "仓库管理员",
    "old_part_expected": true
  }'
```

### 第三步：旧件返还

```bash
curl -X POST "http://localhost:8000/returns/" \
  -H "Content-Type: application/json" \
  -d '{
    "issuance_id": 1,
    "engineer_id": 1,
    "part_id": 1,
    "quantity": 1,
    "condition": "损坏",
    "defect_description": "线圈烧毁，无法启动",
    "received_by": "仓库管理员",
    "storage_location": "旧件区-B01"
  }'
```

### 第四步：提交索赔

```bash
curl -X POST "http://localhost:8000/claims/" \
  -H "Content-Type: application/json" \
  -d '{
    "return_id": 1,
    "quantity": 1,
    "claim_amount": 280.00,
    "vendor": "美芝压缩机",
    "claim_reason": "质量问题，压缩机线圈烧毁",
    "submitted_by": "索赔专员"
  }'
```

### 第五步：复核与查询

#### 查看审计日志（按条件筛选）

```bash
# 查看所有被拦截的操作
curl "http://localhost:8000/audit-logs/?status=blocked"

# 查看特定操作人记录
curl "http://localhost:8000/audit-logs/?operator=索赔专员"

# 按日期范围查询
curl "http://localhost:8000/audit-logs/?start_date=2024-01-01&end_date=2024-12-31"
```

#### 查看索赔汇总

```bash
# 查看所有索赔
curl "http://localhost:8000/reports/claims-summary"

# 按状态筛选
curl "http://localhost:8000/reports/claims-summary/?status=pending"

# 按厂商筛选
curl "http://localhost:8000/reports/claims-summary/?vendor=美芝"
```

### 第六步：导出报告

```bash
# 导出索赔报告
curl -o claims_report.xlsx "http://localhost:8000/reports/export?report_type=claims"

# 导出审计日志报告
curl -o audit_report.xlsx "http://localhost:8000/reports/export?report_type=audit"
```

## 测试样例

### 正常流程测试

运行完整测试脚本：

```bash
python test_flow.py
```

### 异常场景测试

#### 1. 旧件未回拦截测试

```bash
# 先领件但不返还旧件
curl -X POST "http://localhost:8000/issuances/" \
  -H "Content-Type: application/json" \
  -d '{"engineer_id":1,"part_id":1,"batch_id":1,"quantity":1,"service_order_no":"SO20240115002","customer_name":"王五","issued_by":"仓库管理员"}'

# 直接提交索赔（会被拦截）
curl -X POST "http://localhost:8000/claims/" \
  -H "Content-Type: application/json" \
  -d '{"return_id":999,"quantity":1,"claim_amount":280.00,"vendor":"美芝","claim_reason":"测试","submitted_by":"索赔专员"}'
```

#### 2. 重复索赔测试

```bash
# 对同一返还记录提交两次索赔
# 第二次会被拦截
```

#### 3. 库存不足测试

```bash
# 领用超过库存数量的零件
curl -X POST "http://localhost:8000/issuances/" \
  -H "Content-Type: application/json" \
  -d '{"engineer_id":1,"part_id":1,"batch_id":1,"quantity":9999,"service_order_no":"TEST001","customer_name":"测试","issued_by":"仓库管理员"}'
```

## API 接口列表

| 接口 | 方法 | 说明 |
|------|------|------|
| `/parts/` | POST/GET | 零件管理 |
| `/engineers/` | POST/GET | 工程师管理 |
| `/batches/` | POST/GET | 批次管理 |
| `/issuances/` | POST/GET | 领件记录 |
| `/returns/` | POST/GET | 旧件返还 |
| `/claims/` | POST/GET | 索赔申请 |
| `/audit-logs/` | GET | 审计日志（支持筛选） |
| `/reports/claims-summary` | GET | 索赔汇总（支持筛选） |
| `/reports/export` | GET | 导出 Excel 报告 |

## 业务规则说明

### 1. 旧件返还校验
- 规则：如果领件时标记需要返还旧件，则必须完成旧件返还后才能提交索赔
- 拦截原因："旧件未返还，无法提交索赔"

### 2. 重复索赔校验
- 规则：同一条旧件返还记录只能提交一次索赔（已拒绝的除外）
- 拦截原因："该旧件已提交过索赔申请"

### 3. 批次追踪校验
- 规则：检查零件批次是否已过质保期
- 拦截原因："该批次零件已过质保期"

## 目录结构

```
.
├── main.py              # 主服务程序
├── models.py            # 数据库模型
├── requirements.txt     # 依赖列表
├── test_flow.py         # 测试脚本（运行后生成）
├── README.md            # 本文件
└── warehouse.db         # SQLite 数据库（自动生成）
```
