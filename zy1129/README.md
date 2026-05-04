# 家庭保险保单和理赔跟进系统

一个本地运行的家庭保险保单和理赔跟进小系统，帮助管理家庭成员、保单、保障责任、出险事件、理赔材料清单和理赔进度。

## 功能特性

- 📋 **保单管理**：记录医疗险、意外险、车险、家财险等各类保单
- 👨‍👩‍👧‍👦 **成员管理**：管理家庭成员信息，关联保单
- 🚨 **出险事件**：记录出险情况，支持自动理赔分析
- 📝 **理赔追踪**：完整的理赔状态时间线，支持材料管理
- 📊 **风险看板**：30天内到期、断档警告、重复保障检查、免赔额进度
- 📤 **数据导出**：支持 Markdown、HTML、CSV 三种格式
- 📥 **数据导入**：支持 CSV/JSON 文件批量导入
- 🔧 **理赔引擎**：自动计算等待期、免赔额、报案期限、材料清单

## 技术栈

### 后端
- **框架**：Python 3.8+ + FastAPI (异步)
- **ORM**：SQLAlchemy 2.0
- **数据库**：SQLite (数据持久化)
- **其他**：Pydantic (数据验证)、Uvicorn (ASGI 服务器)

### 前端
- **框架**：React 18 + TypeScript
- **UI 组件**：Ant Design 5
- **构建工具**：Vite
- **HTTP 客户端**：Axios

## 项目结构

```
zy1129/
├── backend/                    # 后端项目
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py            # FastAPI 应用入口
│   │   ├── config.py          # 配置管理
│   │   ├── database.py        # 数据库配置
│   │   ├── models/            # 数据模型
│   │   │   ├── __init__.py
│   │   │   ├── member.py
│   │   │   ├── policy.py
│   │   │   ├── coverage.py
│   │   │   ├── incident.py
│   │   │   ├── claim.py
│   │   │   ├── claim_status_timeline.py
│   │   │   ├── claim_document.py
│   │   │   ├── claim_rule.py
│   │   │   └── claim_calculation_result.py
│   │   ├── schemas/           # Pydantic 模型
│   │   │   ├── __init__.py
│   │   │   ├── member.py
│   │   │   ├── policy.py
│   │   │   ├── coverage.py
│   │   │   ├── incident.py
│   │   │   ├── claim.py
│   │   │   ├── analysis.py
│   │   │   └── dashboard.py
│   │   ├── routers/           # API 路由
│   │   │   ├── __init__.py
│   │   │   ├── members.py
│   │   │   ├── policies.py
│   │   │   ├── coverages.py
│   │   │   ├── incidents.py
│   │   │   ├── claims.py
│   │   │   ├── analysis.py
│   │   │   ├── import_router.py
│   │   │   ├── export_router.py
│   │   │   └── dashboard.py
│   │   ├── services/          # 核心业务逻辑
│   │   │   ├── __init__.py
│   │   │   ├── claim_engine.py    # 理赔计算引擎
│   │   │   ├── import_service.py  # 数据导入服务
│   │   │   ├── export_service.py  # 数据导出服务
│   │   │   └── dashboard_service.py # 风险看板服务
│   │   └── data/
│   │       ├── __init__.py
│   │       └── seed_data.py   # 种子数据
│   ├── samples/                # 示例导入文件
│   │   ├── policies.csv
│   │   ├── members.csv
│   │   └── claim-rules.json
│   ├── requirements.txt        # Python 依赖
│   ├── init_db.py              # 数据库初始化脚本
│   └── tests/                  # 测试目录
│       ├── __init__.py
│       ├── conftest.py
│       ├── test_members.py
│       ├── test_policies.py
│       └── test_claim_engine.py
│
├── frontend/                    # 前端项目
│   ├── src/
│   │   ├── main.tsx            # 入口文件
│   │   ├── App.tsx             # 主应用组件
│   │   ├── types/              # TypeScript 类型
│   │   │   └── index.ts
│   │   ├── services/           # API 服务
│   │   │   └── api.ts
│   │   └── pages/              # 页面组件
│   │       ├── Dashboard.tsx       # 风险看板
│   │       ├── Members.tsx         # 成员管理
│   │       ├── Policies.tsx        # 保单管理
│   │       ├── Incidents.tsx       # 出险事件
│   │       ├── Claims.tsx          # 理赔进度
│   │       └── ImportExport.tsx    # 导入导出
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
│
└── README.md
```

## 快速开始

### 环境要求

- Python 3.8+
- Node.js 16+ (建议使用 18+)
- npm 或 yarn

### 1. 安装后端依赖

```bash
cd backend
pip install -r requirements.txt
```

### 2. 初始化数据库（可选，会自动创建种子数据）

```bash
cd backend
python init_db.py
```

> 注意：首次运行后端时会自动初始化数据库并创建种子数据。

### 3. 启动后端服务

```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

后端服务将在 `http://localhost:8000` 启动。

- API 文档（Swagger）：`http://localhost:8000/docs`
- ReDoc 文档：`http://localhost:8000/redoc`

### 4. 安装前端依赖

```bash
cd frontend
npm install
```

### 5. 启动前端开发服务器

```bash
cd frontend
npm run dev
```

前端服务将在 `http://localhost:5173` 启动。

### 6. 访问系统

打开浏览器访问：`http://localhost:5173`

## 主要功能页面

### 1. 风险看板 (`/`)

**功能说明**：
- 统计概览：有效保单数、家庭成员数、进行中理赔、待处理事件
- 即将到期保单：30天内到期的保单提醒
- 已过期保单：已经断档的保单警告
- 报案期限预警：出险后报案期限快过或已过期
- 可能重复保障：同一成员同一险种有多个保单
- 免赔额未达标：年度免赔额还没累计够的保单

### 2. 家庭成员 (`/members`)

**功能说明**：
- 查看、新增、编辑、删除家庭成员
- 记录姓名、关系、出生日期、性别等信息

### 3. 保单管理 (`/policies`)

**功能说明**：
- 管理所有保单（医疗险、意外险、车险、家财险）
- 查看保单详情，包含保障责任列表
- 支持添加保障责任
- 自动显示保单状态（有效/即将到期/已过期）

**字段说明**：
- **保单号**：保险公司提供的保单编号
- **保险公司**：承保公司名称
- **险种类型**：medical(医疗险)/accident(意外险)/auto(车险)/property(家财险)
- **被保险人**：关联的家庭成员（为空表示全家）
- **等待期**：保单生效后多少天内出险不赔付
- **免赔额**：单次/年度需要自付的金额
- **免赔额周期**：annual(年度累计)/per_claim(单次)

### 4. 出险事件 (`/incidents`)

**功能说明**：
- 记录出险事件（疾病、意外、交通事故等）
- 查看详情时自动进行理赔分析
- **理赔分析功能**：
  - 检查等待期：出险日期是否在等待期内
  - 计算免赔额：年度免赔额累计情况
  - 检查报案期限：是否已过报案时效（默认30天）
  - 生成材料清单：根据险种类型自动列出需要的材料
  - 风险提示：列出可能影响理赔的风险点
  - 待办事项：需要完成的任务清单
  - 涉及保单：列出可能适用的保单及是否可理赔

### 5. 理赔进度 (`/claims`)

**功能说明**：
- 管理理赔申请
- 查看理赔详情和状态时间线
- 更新理赔状态（支持时间线记录）
- 管理理赔材料

**理赔状态**：
| 状态值 | 说明 | 颜色 |
|--------|------|------|
| draft | 新建理赔 | 灰色 |
| collecting | 收集材料 | 蓝色 |
| submitted | 已提交 | 橙色 |
| insurer_requested | 保险公司要求补件 | 金色 |
| supplementary_submitted | 补件已提交 | 青色 |
| reviewing | 审核中 | 处理中 |
| approved | 已赔付 | 绿色 |
| partially_approved | 部分赔付 | 亮绿 |
| declined | 已拒赔 | 红色 |
| closed | 结案 | 默认 |

### 6. 数据导入导出 (`/import-export`)

**导出功能**：
- 支持导出 Markdown、HTML、CSV 三种格式
- 可按成员或险种类型筛选
- 导出内容包含：成员、保单、出险、理赔、风险看板

**导入功能**：
- 支持导入 `policies.csv`、`members.csv`、`claim-rules.json`
- 支持同时上传多个文件
- 显示导入结果统计

## 数据导入示例

### 1. 保单导入 (policies.csv)

```csv
policy_number,insurance_company,policy_type,insured_member_name,start_date,end_date,waiting_period_days,deductible_amount,deductible_period,premium_amount,coverage_type,coverage_limit,reimbursement_ratio
MED-2024-001,平安保险,medical,张三,2024-01-01,2025-01-01,30,10000,annual,5000,住院医疗,200000,0.9
MED-2024-001,平安保险,medical,张三,2024-01-01,2025-01-01,30,10000,annual,5000,门诊医疗,20000,0.7
ACC-2024-001,友邦保险,accident,李四,2023-06-01,2033-06-01,0,0,per_claim,800,意外医疗,50000,1.0
```

**必需列**：
- `policy_number`：保单号
- `insurance_company`：保险公司
- `policy_type`：险种类型 (medical/accident/auto/property)
- `start_date`：生效日期 (YYYY-MM-DD)
- `end_date`：到期日期 (YYYY-MM-DD)

**可选列**：
- `insured_member_name`：被保险人姓名（需与系统中成员匹配）
- `waiting_period_days`：等待期天数
- `deductible_amount`：免赔额
- `deductible_period`：免赔额周期 (annual/per_claim)
- `premium_amount`：保费
- `coverage_type`：保障责任类型
- `coverage_limit`：保障限额
- `reimbursement_ratio`：报销比例 (0-1)

### 2. 成员导入 (members.csv)

```csv
name,relationship,birth_date,gender,notes
张三,父亲,1980-05-15,男,主要收入来源
李四,母亲,1982-08-20,女,家庭主妇
张小宝,儿子,2010-03-10,男,小学四年级
张小贝,女儿,2015-12-25,女,幼儿园大班
```

**必需列**：
- `name`：姓名
- `relationship`：关系

**可选列**：
- `birth_date`：出生日期
- `gender`：性别 (男/女)
- `notes`：备注

### 3. 理赔规则导入 (claim-rules.json)

```json
{
  "rules": [
    {
      "rule_name": "医疗险材料要求",
      "rule_type": "document",
      "policy_type": "medical",
      "is_active": true,
      "priority": 10,
      "config": {
        "required_documents": [
          "门诊病历",
          "收费票据",
          "费用清单",
          "诊断证明"
        ]
      }
    },
    {
      "rule_name": "意外险材料要求",
      "rule_type": "document",
      "policy_type": "accident",
      "is_active": true,
      "priority": 10,
      "config": {
        "required_documents": [
          "意外事故证明",
          "门诊病历",
          "收费票据"
        ]
      }
    }
  ]
}
```

## API 接口说明

### 基础路径

所有 API 都以 `/api` 为前缀。

### 成员管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/members/` | 获取成员列表 |
| GET | `/api/members/{id}` | 获取成员详情 |
| POST | `/api/members/` | 创建成员 |
| PUT | `/api/members/{id}` | 更新成员 |
| DELETE | `/api/members/{id}` | 删除成员 |

### 保单管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/policies/` | 获取保单列表（支持 member_id, policy_type 筛选） |
| GET | `/api/policies/{id}` | 获取保单详情 |
| POST | `/api/policies/` | 创建保单 |
| PUT | `/api/policies/{id}` | 更新保单 |
| DELETE | `/api/policies/{id}` | 删除保单 |

### 出险事件

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/incidents/` | 获取出险列表 |
| GET | `/api/incidents/{id}` | 获取出险详情 |
| POST | `/api/incidents/` | 创建出险 |
| PUT | `/api/incidents/{id}` | 更新出险 |
| DELETE | `/api/incidents/{id}` | 删除出险 |

### 理赔分析

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/analysis/{incident_id}` | 分析出险事件，返回理赔建议 |

**返回示例**：
```json
{
  "incident_id": 1,
  "summary": "本次出险涉及2份保单，其中1份可理赔，1份因等待期不可理赔",
  "overall_rating": "yellow",
  "risks": [
    {
      "risk_type": "等待期风险",
      "risk_level": "red",
      "description": "保单 MED-2024-002 处于等待期内，出险日期距离保单生效仅15天，等待期90天"
    }
  ],
  "todos": [
    {
      "priority": "high",
      "task": "收集门诊病历",
      "due_date": "2024-01-15"
    }
  ],
  "documents": [
    {
      "document_name": "门诊病历",
      "required": true,
      "notes": "需包含诊断内容"
    }
  ],
  "affected_policies": [
    {
      "policy_number": "ACC-2024-001",
      "insurance_company": "友邦保险",
      "policy_type": "accident",
      "is_claimable": true,
      "reasons": []
    }
  ]
}
```

### 风险看板

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/dashboard/` | 获取风险看板数据 |

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/upload` | 上传文件导入（支持多文件） |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/export/report` | 导出全量报告 |
| GET | `/api/export/policies` | 导出保单数据 |
| GET | `/api/export/claims` | 导出理赔数据 |

**查询参数**：
- `format`：导出格式 (csv/markdown/html)
- `member_id`：筛选成员 ID（可选）
- `policy_type`：筛选险种类型（可选）

## 运行测试

### 后端测试

```bash
cd backend
pytest -v
```

### 测试文件说明

- `test_members.py`：成员 API 测试
- `test_policies.py`：保单 API 测试
- `test_claim_engine.py`：理赔计算引擎测试

## 异常输入示例

### 1. 等待期内出险

**场景**：保单等待期30天，生效后第15天出险

**系统行为**：
- 风险提示：等待期风险（红色级别）
- 涉及保单标记为不可理赔
- 风险描述：说明等待期天数和出险日期

### 2. 报案期限过期

**场景**：出险后超过30天未报案

**系统行为**：
- 风险提示：报案期限风险（红色级别）
- 待办事项：高优先级提醒尽快联系保险公司
- 计算已过期天数

### 3. 免赔额未达标

**场景**：年度免赔额10000元，本次出险累计已达8000元

**系统行为**：
- 待办事项：提醒需要自付剩余免赔额
- 风险看板显示"免赔额未达标"
- 计算剩余需要自付金额

### 4. 保单即将到期

**场景**：保单距离到期日还有15天

**系统行为**：
- 风险看板显示在"即将到期保单"
- 橙色标签显示剩余天数
- 若小于等于7天，红色标签警告

### 5. 重复保障

**场景**：同一成员有2份医疗险

**系统行为**：
- 风险看板显示"可能重复保障"
- 列出重复的保单号
- 统计总保额

## 常见问题

### Q: 数据存储在哪里？

A: 使用 SQLite 数据库，文件位于 `backend/insurance.db`。首次运行会自动创建。

### Q: 如何重置数据？

A: 删除 `backend/insurance.db` 文件，重新启动后端服务会自动创建新数据库并加载种子数据。

### Q: 如何修改报案期限默认值？

A: 编辑 `backend/app/services/claim_engine.py` 中的 `_check_report_deadline` 方法，修改默认30天的配置。

### Q: 前端 API 代理如何配置？

A: 在 `frontend/vite.config.ts` 中配置，默认代理 `/api` 到 `http://localhost:8000`。

## 更新日志

### v1.0.0 (2024-01-xx)
- 初始版本发布
- 实现完整的保单管理功能
- 实现理赔计算引擎
- 实现风险看板
- 实现数据导入导出
- 种子数据和示例文件

## 许可证

MIT License
