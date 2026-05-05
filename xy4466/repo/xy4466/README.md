# 用印室管理系统 (Stamp Room Management System)

一个面向公司行政用印室的本地 REST API 服务，用于管理用印申请、印章授权、外借记录和风险审计。

## 功能特性

### 核心功能
- **数据导入**：支持导入用印申请 CSV、印章柜开关日志 JSON、授权名单和寄章快递表
- **风险评估**：基于预设规则自动判断合同或证明能否盖章、是否越权外借或逾期未归还
- **人工复核**：支持管理员对系统判断进行备注和改判
- **数据导出**：支持导出 Markdown 格式用印交接单和 JSON 格式审计包
- **灵活查询**：支持按状态、申请编号、申请人等多维度查询

### 风险规则
系统内置以下风险评估规则：

| 规则类型 | 描述 | 严重程度 | 风险分值 |
|---------|------|---------|---------|
| 未授权使用 | 申请人无使用该印章的授权 | 高 | +50 |
| 逾期未归还 | 印章有逾期外借记录 | 高 | +40 |
| 印章不可用 | 印章状态为外借或其他不可用状态 | 中 | +25 |
| 高风险文件 | 担保合同、贷款合同等高风险文件类型 | 中 | +20 |
| 外借中 | 印章当前有外借记录 | 中 | +15 |

### 申请状态
- `pending`：待处理 - 新导入的申请，尚未计算风险
- `reviewing`：审核中 - 低风险，待进一步确认
- `approved`：已批准 - 风险评分为 0，所有检查通过
- `hold`：暂缓 - 中等风险，需要人工复核
- `rejected`：已拒绝 - 高风险，自动拒绝

## 技术栈

- **后端框架**：Flask 2.3.3
- **数据库**：SQLite (通过 Flask-SQLAlchemy)
- **数据处理**：Pandas 2.0.3
- **日期处理**：python-dateutil 2.8.2

## 项目结构

```
stamp-room/
├── app/
│   ├── __init__.py              # 应用初始化
│   ├── models.py                # 数据库模型
│   ├── routes/                  # API 路由
│   │   ├── __init__.py          # 路由注册
│   │   ├── applications.py      # 用印申请接口
│   │   ├── stamps.py            # 印章管理接口
│   │   ├── authorizations.py    # 授权名单接口
│   │   ├── cabinet_logs.py      # 印章柜日志接口
│   │   ├── express_deliveries.py # 寄章快递接口
│   │   ├── loans.py             # 外借记录接口
│   │   ├── reviews.py           # 复核记录接口
│   │   ├── risk.py              # 风险计算接口
│   │   └── export.py            # 导出功能接口
│   └── utils/                   # 工具函数
│       ├── __init__.py
│       └── risk_calculator.py   # 风险计算引擎
├── examples/                    # 示例数据和测试脚本
│   ├── stamp_applications.csv   # 用印申请示例
│   ├── cabinet_logs.json        # 印章柜日志示例
│   ├── authorizations.csv       # 授权名单示例
│   ├── express_deliveries.csv   # 寄章快递表示例
│   └── test_stamp_api.sh        # API测试脚本
├── config.py                    # 配置文件
├── requirements.txt             # 依赖列表
├── run.py                       # 应用入口
└── README.md                    # 本文档
```

## 安装与运行

### 1. 环境准备
确保已安装 Python 3.8+ 和 pip。

### 2. 安装依赖
```bash
# 创建虚拟环境（推荐）
python3 -m venv venv
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate  # Windows

# 安装依赖
pip install -r requirements.txt
```

### 3. 运行服务
```bash
python run.py
```

服务将在 `http://localhost:5001` 启动。

## API 文档

### 基础 URL
```
http://localhost:5001/api
```

---

### 一、印章管理接口

#### 1. 创建印章
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "stamp_code": "STAMP-001",
    "stamp_name": "公司公章",
    "stamp_type": "公章",
    "status": "in_cabinet",
    "location": "印章柜A-01"
  }' \
  http://localhost:5001/api/stamps
```

#### 2. 查询印章列表
```bash
# 获取所有印章
curl http://localhost:5001/api/stamps

# 按状态筛选
curl "http://localhost:5001/api/stamps?status=in_cabinet"

# 按印章编号搜索
curl "http://localhost:5001/api/stamps?stamp_code=STAMP-001"
```

#### 3. 获取单个印章详情
```bash
curl http://localhost:5001/api/stamps/1
```

---

### 二、授权管理接口

#### 1. 导入授权名单 CSV
```bash
curl -X POST \
  -F "file=@examples/authorizations.csv" \
  http://localhost:5001/api/authorizations/import
```

**CSV 格式要求**：
| 列名 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| employee_id | 字符串 | 是 | 员工编号 |
| employee_name | 字符串 | 是 | 员工姓名 |
| department | 字符串 | 否 | 部门 |
| stamp_code | 字符串 | 是 | 印章编号 |
| authorization_type | 字符串 | 否 | 授权类型（use/loan） |
| start_date | 日期 | 是 | 授权开始日期 (YYYY-MM-DD) |
| end_date | 日期 | 否 | 授权结束日期 (YYYY-MM-DD) |
| is_active | 布尔 | 否 | 是否生效 |

#### 2. 查询授权列表
```bash
# 获取所有授权
curl http://localhost:5001/api/authorizations

# 按员工编号筛选
curl "http://localhost:5001/api/authorizations?employee_id=E001"

# 按印章编号筛选
curl "http://localhost:5001/api/authorizations?stamp_code=STAMP-001"

# 只查询生效的授权
curl "http://localhost:5001/api/authorizations?is_active=true"
```

---

### 三、用印申请接口

#### 1. 导入用印申请 CSV
```bash
curl -X POST \
  -F "file=@examples/stamp_applications.csv" \
  http://localhost:5001/api/applications/import
```

**CSV 格式要求**：
| 列名 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| application_number | 字符串 | 是 | 申请编号 |
| applicant_id | 字符串 | 是 | 申请人编号 |
| applicant_name | 字符串 | 是 | 申请人姓名 |
| department | 字符串 | 否 | 部门 |
| stamp_code | 字符串 | 是 | 印章编号 |
| document_type | 字符串 | 是 | 文件类型 |
| document_title | 字符串 | 是 | 文件标题 |
| usage_reason | 字符串 | 否 | 用印原因 |
| application_date | 日期 | 是 | 申请日期 (YYYY-MM-DD) |
| expected_use_date | 日期 | 否 | 预计用印日期 (YYYY-MM-DD) |

#### 2. 查询用印申请列表
```bash
# 获取所有申请
curl http://localhost:5001/api/applications

# 按状态筛选
curl "http://localhost:5001/api/applications?status=pending"

# 按申请人搜索
curl "http://localhost:5001/api/applications?applicant_name=张三"

# 按印章编号筛选
curl "http://localhost:5001/api/applications?stamp_code=STAMP-001"

# 分页查询
curl "http://localhost:5001/api/applications?page=1&per_page=10"
```

**查询参数**：
| 参数 | 类型 | 说明 |
|-----|------|------|
| status | 字符串 | 状态筛选 |
| application_number | 字符串 | 申请编号模糊搜索 |
| applicant_name | 字符串 | 申请人姓名模糊搜索 |
| department | 字符串 | 部门筛选 |
| stamp_code | 字符串 | 印章编号筛选 |
| document_type | 字符串 | 文件类型筛选 |
| sort_by | 字符串 | 排序字段 (默认 application_date) |
| sort_order | 字符串 | 排序方式 (asc/desc，默认 desc) |
| page | 整数 | 页码 (默认 1) |
| per_page | 整数 | 每页数量 (默认 20) |

#### 3. 获取单个申请详情
```bash
curl http://localhost:5001/api/applications/1
```

---

### 四、印章柜日志接口

#### 1. 导入印章柜开关日志 JSON
```bash
curl -X POST \
  -F "file=@examples/cabinet_logs.json" \
  http://localhost:5001/api/cabinet-logs/import
```

**JSON 格式要求**：
```json
[
  {
    "log_number": "LOG-2026-0001",
    "stamp_code": "STAMP-001",
    "operation_type": "take_out",
    "operator_id": "E001",
    "operator_name": "张三",
    "operation_time": "2026-05-05T09:30:00",
    "cabinet_id": "CAB-001",
    "notes": "正常取章"
  }
]
```

#### 2. 查询印章柜日志
```bash
# 获取所有日志
curl http://localhost:5001/api/cabinet-logs

# 按印章编号筛选
curl "http://localhost:5001/api/cabinet-logs?stamp_code=STAMP-001"

# 按操作类型筛选（take_out/put_back）
curl "http://localhost:5001/api/cabinet-logs?operation_type=take_out"
```

---

### 五、寄章快递接口

#### 1. 导入寄章快递表 CSV
```bash
curl -X POST \
  -F "file=@examples/express_deliveries.csv" \
  http://localhost:5001/api/express-deliveries/import
```

**CSV 格式要求**：
| 列名 | 类型 | 必填 | 说明 |
|-----|------|-----|------|
| delivery_number | 字符串 | 是 | 快递编号 |
| express_company | 字符串 | 是 | 快递公司 |
| tracking_number | 字符串 | 否 | 运单号 |
| stamp_code | 字符串 | 是 | 印章编号 |
| sender_name | 字符串 | 是 | 寄件人 |
| sender_department | 字符串 | 否 | 寄件人部门 |
| receiver_name | 字符串 | 是 | 收件人 |
| receiver_address | 字符串 | 是 | 收件地址 |
| receiver_phone | 字符串 | 否 | 收件人电话 |
| delivery_type | 字符串 | 否 | 快递类型 |
| send_date | 日期 | 是 | 寄件日期 |
| expected_return_date | 日期 | 否 | 预计归还日期 |
| actual_return_date | 日期 | 否 | 实际归还日期 |
| status | 字符串 | 否 | 状态 |
| notes | 字符串 | 否 | 备注 |

#### 2. 查询寄章快递记录
```bash
# 获取所有快递记录
curl http://localhost:5001/api/express-deliveries

# 按状态筛选
curl "http://localhost:5001/api/express-deliveries?status=in_transit"

# 按印章编号筛选
curl "http://localhost:5001/api/express-deliveries?stamp_code=STAMP-001"
```

---

### 六、外借记录接口

#### 1. 创建外借记录
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "loan_number": "LOAN-2026-0001",
    "stamp_code": "STAMP-002",
    "borrower_id": "E002",
    "borrower_name": "李四",
    "borrower_department": "市场部",
    "loan_reason": "外出签署合作协议",
    "loan_date": "2026-05-05",
    "expected_return_date": "2026-05-08",
    "status": "on_loan"
  }' \
  http://localhost:5001/api/loans
```

#### 2. 查询外借记录
```bash
# 获取所有外借记录
curl http://localhost:5001/api/loans

# 只查询逾期记录
curl "http://localhost:5001/api/loans?is_overdue=true"

# 只查询进行中的外借
curl "http://localhost:5001/api/loans?status=on_loan"
```

#### 3. 归还印章
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"return_date": "2026-05-08"}' \
  http://localhost:5001/api/loans/1/return
```

---

### 七、风险计算接口

#### 1. 计算所有待处理申请的风险
```bash
curl -X POST http://localhost:5001/api/risk/calculate-all
```

#### 2. 检查逾期外借记录
```bash
curl -X POST http://localhost:5001/api/risk/check-overdue
```

#### 3. 检查未授权访问记录
```bash
curl -X POST http://localhost:5001/api/risk/check-unauthorized
```

#### 4. 获取风险概览
```bash
curl http://localhost:5001/api/risk/summary
```

#### 5. 获取特定申请的风险评估详情
```bash
curl http://localhost:5001/api/risk/assessment/1
```

---

### 八、人工复核接口

#### 1. 创建复核记录（改判申请状态）
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{
    "application_id": 1,
    "reviewer_id": "ADMIN001",
    "reviewer_name": "管理员",
    "new_status": "approved",
    "notes": "经人工复核，该申请材料齐全，符合用印规定，同意盖章。",
    "risk_override": true,
    "risk_adjustment": -50.0
  }' \
  http://localhost:5001/api/reviews
```

#### 2. 查询复核记录
```bash
# 获取所有复核记录
curl http://localhost:5001/api/reviews

# 按申请ID筛选
curl "http://localhost:5001/api/reviews?application_id=1"

# 获取特定申请的所有复核记录
curl http://localhost:5001/api/applications/1/reviews
```

---

### 九、导出功能接口

#### 1. 导出单个申请的用印交接单（Markdown）
```bash
curl -o handover_001.md http://localhost:5001/api/export/handover/1
```

#### 2. 批量导出用印交接单
```bash
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"application_ids": [1, 2, 3]}' \
  -o handover_batch.md \
  http://localhost:5001/api/export/handover/batch
```

#### 3. 导出审计包（JSON）
```bash
# 按日期范围导出
curl -o audit_202605.json "http://localhost:5001/api/export/audit?start_date=2026-05-01&end_date=2026-05-31"

# 按状态筛选导出
curl -o audit_pending.json "http://localhost:5001/api/export/audit?status=pending"
```

---

## 快速开始示例流程

### 1. 启动服务
```bash
python run.py
```

### 2. 运行完整测试脚本
```bash
chmod +x examples/test_stamp_api.sh
./examples/test_stamp_api.sh
```

### 3. 手动完整流程示例

```bash
# 步骤1: 创建印章
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"stamp_code":"STAMP-001","stamp_name":"公司公章","stamp_type":"公章","status":"in_cabinet"}' \
  http://localhost:5001/api/stamps

# 步骤2: 导入授权名单
curl -X POST \
  -F "file=@examples/authorizations.csv" \
  http://localhost:5001/api/authorizations/import

# 步骤3: 导入用印申请
curl -X POST \
  -F "file=@examples/stamp_applications.csv" \
  http://localhost:5001/api/applications/import

# 步骤4: 计算风险
curl -X POST http://localhost:5001/api/risk/calculate-all

# 步骤5: 查看风险概览
curl http://localhost:5001/api/risk/summary

# 步骤6: 人工复核改判
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"application_id":1,"reviewer_id":"ADMIN001","reviewer_name":"管理员","new_status":"approved","notes":"同意盖章"}' \
  http://localhost:5001/api/reviews

# 步骤7: 导出交接单
curl -o handover.md http://localhost:5001/api/export/handover/1

# 步骤8: 导出审计包
curl -o audit.json "http://localhost:5001/api/export/audit?start_date=2026-05-01&end_date=2026-05-31"
```

## 数据库模型说明

### 主要实体关系
```
Stamp (印章) 1:* StampApplication (用印申请)
Stamp 1:* Authorization (授权记录)
Stamp 1:* StampLoan (外借记录)
Stamp 1:* StampCabinetLog (印章柜日志)
StampApplication 1:* Review (复核记录)
StampApplication 1:* AuditResult (审计结果)
```

### 状态字段说明

**印章状态 (Stamp.status)**:
- `in_cabinet`: 在柜中
- `on_loan`: 外借中
- `in_transit`: 快递中
- `maintenance`: 维护中

**申请状态 (StampApplication.status)**:
- `pending`: 待处理
- `reviewing`: 审核中
- `approved`: 已批准
- `hold`: 暂缓
- `rejected`: 已拒绝
- `completed`: 已完成

**外借状态 (StampLoan.status)**:
- `on_loan`: 外借中
- `returned`: 已归还
- `overdue`: 逾期

**风险等级 (AuditResult.risk_level)**:
- `low`: 低风险 (0-29分)
- `medium`: 中风险 (30-69分)
- `high`: 高风险 (70分以上)

## 配置说明

在 `config.py` 中可以配置风险规则：

```python
RISK_RULES = {
    'high_risk_documents': [
        '担保合同',
        '贷款合同', 
        '股权转让协议',
        '重大资产处置'
    ],
    'overdue_days_threshold': 0,  # 逾期天数阈值
    'high_risk_threshold': 70,     # 高风险阈值
    'medium_risk_threshold': 30    # 中风险阈值
}
```

## 注意事项

1. **首次运行**: 首次运行会自动创建 SQLite 数据库文件
2. **数据导入**: 支持 CSV 和 JSON 格式导入，重复数据会更新而非重复插入
3. **风险计算**: 建议每次导入数据后执行风险计算接口
4. **日期格式**: 所有日期字段使用 ISO 格式 (YYYY-MM-DD 或 YYYY-MM-DDTHH:MM:SS)
5. **授权检查**: 系统会自动检查申请人是否有使用印章的授权
6. **逾期检查**: 建议定期调用逾期检查接口更新外借状态

## 故障排除

### 常见问题

1. **导入失败**
   - 检查 CSV/JSON 格式是否正确
   - 确认必填字段是否完整
   - 检查日期格式是否为 YYYY-MM-DD

2. **风险计算异常**
   - 确认印章和授权数据已正确导入
   - 检查申请人编号是否与授权记录匹配

3. **数据库连接错误**
   - 删除现有的 `.db` 文件后重新运行
   - 检查 Flask-SQLAlchemy 配置是否正确

### 日志查看

应用运行时会输出详细日志，可用于排查问题。
