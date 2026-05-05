# 司法鉴定所管理系统 API

本地纯后端 API 服务，用于管理司法鉴定所的委托单、证物封签、检验步骤和取还库日志。

## 功能特点

- **委托单管理**：支持单个创建和批量导入委托单
- **证物封签扫码**：完整的封签链管理，防止封签断链
- **检验步骤记录**：多步骤检验流程管理，超期预警
- **取还库日志**：完整的证物出入库记录，借阅跟踪
- **风险复核备注**：自动风险检测和人工复核机制
- **按案件查询**：支持多种筛选条件的案件查询
- **数据导出**：Markdown 交接单和 JSON 审计包导出

## 技术栈

- Python 3.8+
- Flask 3.0.0
- Flask-SQLAlchemy 3.1.1
- SQLite 数据库

## 安装步骤

1. 克隆项目到本地

```bash
cd /path/to/project
```

2. 创建虚拟环境（可选但推荐）

```bash
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate  # Windows
```

3. 安装依赖

```bash
pip install -r requirements.txt
```

4. 运行服务

```bash
python app.py
```

服务将在 `http://localhost:5001` 启动。

## API 接口概览

| 模块 | 基础路径 | 功能描述 |
|------|----------|----------|
| 案件管理 | `/api/cases` | 委托单的 CRUD 和批量导入 |
| 证物管理 | `/api/evidence` | 证物管理和封签扫码 |
| 检验步骤 | `/api/inspection` | 检验步骤记录和超期检测 |
| 取还库日志 | `/api/inventory` | 证物出入库和借阅管理 |
| 风险复核 | `/api/risk` | 风险检测和复核记录 |
| 案件查询 | `/api/query` | 按条件查询案件和风险汇总 |
| 数据导出 | `/api/export` | Markdown 交接单和 JSON 审计包 |

---

## Curl 验证流程

以下是完整的功能验证流程，按顺序执行即可测试所有核心功能。

### 1. 基础验证

#### 1.1 检查服务是否运行

```bash
curl http://localhost:5001/
```

**预期响应**：
```json
{
  "name": "司法鉴定所管理系统 API",
  "status": "运行中",
  "timestamp": "2026-05-05T...",
  "version": "1.0.0"
}
```

---

### 2. 案件管理

#### 2.1 创建单个案件

```bash
curl -X POST http://localhost:5001/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "SFJD-2026-001",
    "case_name": "张三故意伤害案",
    "case_type": "法医临床",
    "entrusted_by": "XX县公安局",
    "entrust_date": "2026-05-01",
    "deadline": "2026-05-10"
  }'
```

#### 2.2 创建第二个案件

```bash
curl -X POST http://localhost:5001/api/cases \
  -H "Content-Type: application/json" \
  -d '{
    "case_number": "SFJD-2026-002",
    "case_name": "李四盗窃案",
    "case_type": "痕迹鉴定",
    "entrusted_by": "XX县检察院",
    "entrust_date": "2026-04-28",
    "deadline": "2026-05-08"
  }'
```

#### 2.3 批量导入委托单

```bash
curl -X POST http://localhost:5001/api/cases/import \
  -H "Content-Type: application/json" \
  -d '[
    {
      "case_number": "SFJD-2026-003",
      "case_name": "王五交通肇事案",
      "case_type": "法医病理",
      "entrusted_by": "XX县交警大队",
      "entrust_date": "2026-05-03",
      "deadline": "2026-05-15"
    },
    {
      "case_number": "SFJD-2026-004",
      "case_name": "赵六合同纠纷案",
      "case_type": "文书鉴定",
      "entrusted_by": "XX县人民法院",
      "entrust_date": "2026-04-25",
      "deadline": "2026-05-05"
    }
  ]'
```

#### 2.4 获取所有案件

```bash
curl http://localhost:5001/api/cases
```

#### 2.5 根据案件编号查询

```bash
curl http://localhost:5001/api/cases/number/SFJD-2026-001
```

#### 2.6 搜索案件（按关键词）

```bash
curl "http://localhost:5001/api/cases/search?keyword=张三"
```

#### 2.7 更新案件信息

```bash
curl -X PUT http://localhost:5001/api/cases/1 \
  -H "Content-Type: application/json" \
  -d '{
    "case_status": "进行中"
  }'
```

---

### 3. 证物管理与封签扫码

#### 3.1 为第一个案件添加证物

```bash
curl -X POST http://localhost:5001/api/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_number": "ZW-2026-001-01",
    "evidence_name": "受害人病历资料",
    "evidence_type": "书证",
    "seal_number": "SEAL-001",
    "case_id": 1
  }'
```

#### 3.2 添加第二个证物

```bash
curl -X POST http://localhost:5001/api/evidence \
  -H "Content-Type: application/json" \
  -d '{
    "evidence_number": "ZW-2026-001-02",
    "evidence_name": "伤情照片",
    "evidence_type": "影像资料",
    "seal_number": "SEAL-002",
    "case_id": 1
  }'
```

#### 3.3 获取案件的所有证物

```bash
curl http://localhost:5001/api/evidence/case/1
```

#### 3.4 首次封签扫码（封签操作）

```bash
curl -X POST http://localhost:5001/api/evidence/scan \
  -H "Content-Type: application/json" \
  -d '{
    "seal_number": "SEAL-001",
    "operation": "封签",
    "operator": "李鉴定人",
    "location": "证物室A-01",
    "purpose": "案件受理封签"
  }'
```

#### 3.5 解封操作（检验前）

```bash
curl -X POST http://localhost:5001/api/evidence/scan \
  -H "Content-Type: application/json" \
  -d '{
    "seal_number": "SEAL-001",
    "operation": "解封",
    "operator": "李鉴定人",
    "location": "检验室",
    "purpose": "法医临床检验"
  }'
```

#### 3.6 重新封签（检验完成后，使用新封签号）

```bash
curl -X POST http://localhost:5001/api/evidence/scan \
  -H "Content-Type: application/json" \
  -d '{
    "seal_number": "SEAL-001",
    "new_seal_number": "SEAL-001-NEW",
    "operation": "封签",
    "operator": "李鉴定人",
    "location": "证物室A-01",
    "purpose": "检验完成重新封签"
  }'
```

#### 3.7 获取证物的封签历史

```bash
curl http://localhost:5001/api/evidence/1/seal-history
```

#### 3.8 检查是否有封签断链

```bash
curl http://localhost:5001/api/evidence/broken-chains
```

---

### 4. 检验步骤记录

#### 4.1 为案件创建检验步骤

```bash
curl -X POST http://localhost:5001/api/inspection \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "inspection_step": 1,
    "step_name": "伤情检查",
    "inspector": "王法医",
    "status": "进行中"
  }'
```

#### 4.2 创建第二个检验步骤

```bash
curl -X POST http://localhost:5001/api/inspection \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "inspection_step": 2,
    "step_name": "病历审核",
    "inspector": "李法医",
    "status": "待开始"
  }'
```

#### 4.3 获取案件的所有检验步骤

```bash
curl http://localhost:5001/api/inspection/case/1
```

#### 4.4 完成检验步骤

```bash
curl -X PUT http://localhost:5001/api/inspection/1/complete \
  -H "Content-Type: application/json" \
  -d '{
    "result": "受害人左侧肋骨骨折，符合钝性外力作用特征"
  }'
```

#### 4.5 检查是否有超期检验

```bash
curl http://localhost:5001/api/inspection/overdue
```

---

### 5. 取还库日志

#### 5.1 证物入库

```bash
curl -X POST http://localhost:5001/api/inventory/check-in \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "evidence_id": 1,
    "operator": "张管理员",
    "location": "证物室A-01"
  }'
```

#### 5.2 证物出库（借阅）

```bash
curl -X POST http://localhost:5001/api/inventory/check-out \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "evidence_id": 1,
    "operator": "张管理员",
    "borrower": "李鉴定人",
    "borrow_purpose": "法医检验",
    "expected_return_time": "2026-05-07",
    "location": "检验室"
  }'
```

#### 5.3 获取已借出但未归还的证物

```bash
curl http://localhost:5001/api/inventory/borrowed
```

#### 5.4 归还证物

```bash
curl -X PUT http://localhost:5001/api/inventory/return/2 \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "张管理员",
    "location": "证物室A-01"
  }'
```

#### 5.5 检查是否有超期未归还的证物

```bash
curl http://localhost:5001/api/inventory/overdue
```

#### 5.6 获取案件的所有取还库日志

```bash
curl http://localhost:5001/api/inventory/case/1
```

---

### 6. 风险复核

#### 6.1 自动检测风险

```bash
curl http://localhost:5001/api/risk/detect
```

#### 6.2 自动创建风险复核记录

```bash
curl -X POST http://localhost:5001/api/risk/auto-create
```

#### 6.3 手动创建风险复核记录

```bash
curl -X POST http://localhost:5001/api/risk \
  -H "Content-Type: application/json" \
  -d '{
    "case_id": 1,
    "risk_type": "检验超期",
    "risk_level": "中",
    "risk_description": "案件检验步骤2已超期2天未完成",
    "reviewer": "张主任",
    "review_comment": "请李鉴定人尽快完成检验，并说明超期原因"
  }'
```

#### 6.4 获取所有未解决的风险

```bash
curl http://localhost:5001/api/risk/unresolved
```

#### 6.5 解决风险

```bash
curl -X PUT http://localhost:5001/api/risk/1/resolve \
  -H "Content-Type: application/json" \
  -d '{
    "resolution_comment": "检验已完成，超期原因：受害人复检延误"
  }'
```

#### 6.6 获取案件的风险复核记录

```bash
curl http://localhost:5001/api/risk/case/1
```

---

### 7. 按案件查询

#### 7.1 查询案件完整信息（含所有关联数据）

```bash
curl http://localhost:5001/api/query/case/1
```

#### 7.2 按案件编号查询

```bash
curl http://localhost:5001/api/query/case/number/SFJD-2026-001
```

#### 7.3 带筛选条件查询案件列表

```bash
# 按关键词搜索
curl "http://localhost:5001/api/query/cases?keyword=张三"

# 按案件类型筛选
curl "http://localhost:5001/api/query/cases?case_type=法医临床"

# 按状态筛选
curl "http://localhost:5001/api/query/cases?status=进行中"

# 组合筛选：有风险的案件
curl "http://localhost:5001/api/query/cases?has_risk=true"

# 组合筛选：有封签断链的案件
curl "http://localhost:5001/api/query/cases?has_broken_chain=true"

# 组合筛选：有超期检验的案件
curl "http://localhost:5001/api/query/cases?has_overdue_inspection=true"

# 组合筛选：有借阅未归还的案件
curl "http://localhost:5001/api/query/cases?has_unreturned=true"

# 排序和分页
curl "http://localhost:5001/api/query/cases?sort_by=deadline&sort_order=asc&page=1&per_page=10"
```

#### 7.4 查询风险汇总信息

```bash
curl http://localhost:5001/api/query/risks/summary
```

---

### 8. 数据导出

#### 8.1 导出 Markdown 交接单

```bash
curl -o 交接单_SFJD-2026-001.md http://localhost:5001/api/export/markdown/case/1
```

#### 8.2 导出 JSON 审计包（单个案件）

```bash
curl -o 审计包_SFJD-2026-001.json http://localhost:5001/api/export/json/case/1
```

#### 8.3 导出 JSON 审计包（所有案件）

```bash
curl -o 完整审计包_20260505.json http://localhost:5001/api/export/json/all
```

#### 8.4 查看所有导出文件

```bash
curl http://localhost:5001/api/export/list
```

---

## 数据模型说明

### 案件 (Case)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| case_number | String(50) | 案件编号（唯一） |
| case_name | String(200) | 案件名称 |
| case_type | String(50) | 案件类型 |
| entrusted_by | String(100) | 委托单位 |
| entrust_date | Date | 委托日期 |
| deadline | Date | 截止日期 |
| case_status | String(20) | 案件状态 |

### 证物 (Evidence)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| evidence_number | String(50) | 证物编号（唯一） |
| evidence_name | String(200) | 证物名称 |
| evidence_type | String(50) | 证物类型 |
| seal_number | String(50) | 封签编号（唯一） |
| case_id | Integer | 关联案件ID |

### 封签记录 (SealRecord)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| evidence_id | Integer | 关联证物ID |
| operation | String(20) | 操作类型（封签/解封） |
| operator | String(50) | 操作人 |
| seal_number | String(50) | 当前封签编号 |
| previous_seal | String(50) | 上一个封签编号 |
| next_seal | String(50) | 下一个封签编号 |
| operation_time | DateTime | 操作时间 |
| location | String(100) | 地点 |
| purpose | String(200) | 目的 |
| is_chain_complete | Boolean | 封签链是否完整 |

### 检验步骤 (Inspection)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| case_id | Integer | 关联案件ID |
| inspection_step | Integer | 步骤号 |
| step_name | String(100) | 步骤名称 |
| inspector | String(50) | 检验人 |
| start_time | DateTime | 开始时间 |
| end_time | DateTime | 结束时间 |
| status | String(20) | 状态 |
| result | Text | 检验结果 |
| is_overdue | Boolean | 是否超期 |

### 取还库日志 (InventoryLog)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| evidence_id | Integer | 关联证物ID |
| case_id | Integer | 关联案件ID |
| operation_type | String(20) | 操作类型（入库/出库/归还） |
| operator | String(50) | 操作人 |
| operation_time | DateTime | 操作时间 |
| borrower | String(50) | 借阅人 |
| borrow_purpose | String(200) | 借阅目的 |
| expected_return_time | DateTime | 预期归还时间 |
| actual_return_time | DateTime | 实际归还时间 |
| is_returned | Boolean | 是否已归还 |
| is_overdue | Boolean | 是否超期 |
| location | String(100) | 地点 |

### 风险复核 (RiskReview)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | Integer | 主键 |
| case_id | Integer | 关联案件ID |
| risk_type | String(50) | 风险类型 |
| risk_level | String(20) | 风险级别（高/中/低） |
| risk_description | Text | 风险描述 |
| reviewer | String(50) | 复核人 |
| review_time | DateTime | 复核时间 |
| review_comment | Text | 复核意见 |
| is_resolved | Boolean | 是否已解决 |
| resolution_time | DateTime | 解决时间 |

---

## 风险检测机制

系统会自动检测以下风险：

1. **封签断链**：封签记录中 `is_chain_complete` 为 False 的记录
2. **检验超期**：进行中的检验，且当前时间超过案件截止日期
3. **借阅未归还**：出库操作后未归还，且超过预期归还时间

可以通过以下接口触发风险检测：
- `GET /api/risk/detect` - 只检测不创建记录
- `POST /api/risk/auto-create` - 检测并自动创建风险复核记录

---

## 目录结构

```
xy4475/
├── app.py              # 应用入口
├── models.py           # 数据模型定义
├── requirements.txt    # Python依赖
├── README.md           # 本文档
├── routes/             # 路由模块
│   ├── __init__.py
│   ├── cases.py        # 案件管理
│   ├── evidence.py     # 证物管理
│   ├── inspection.py   # 检验步骤
│   ├── inventory.py    # 取还库日志
│   ├── risk.py         # 风险复核
│   ├── query.py        # 案件查询
│   └── export.py       # 数据导出
├── data/               # 数据目录（自动创建）
└── exports/            # 导出文件目录（自动创建）
```

---

## 常见问题

### Q: 封签断链是怎么发生的？

A: 当执行"解封"操作时，封签链会被标记为不完整。只有执行"封签"操作后，封签链才会恢复完整。系统会追踪每一个封签的前一个和后一个封签编号，确保链条完整。

### Q: 检验超期是怎么判断的？

A: 系统会检查进行中的检验步骤，如果当前时间超过了案件的截止日期，就会标记为超期。可以通过 `GET /api/inspection/overdue` 查看所有超期检验。

### Q: 借阅超期是怎么判断的？

A: 当执行出库操作时可以设置预期归还时间。如果当前时间超过预期归还时间且证物未归还，就会标记为超期。可以通过 `GET /api/inventory/overdue` 查看所有超期借阅。

### Q: 如何避免证物编号和封签编号冲突？

A: 系统在创建证物时会检查：
- 证物编号是否已存在
- 封签编号是否已存在
- 封签扫码时会检查新封签编号是否已被使用

如果存在冲突，会返回 400 错误。

---

## 注意事项

1. 本系统使用 SQLite 数据库，适合本地部署和小规模使用
2. 数据文件 `forensic.db` 会在首次运行时自动创建
3. 建议定期备份数据库文件
4. 生产环境建议使用更强大的数据库（如 PostgreSQL）并添加用户认证
5. 封签链完整性依赖于正确的操作流程，请确保工作人员按规定执行封签/解封操作
