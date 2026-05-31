# 票据到期提醒系统

## 系统概述

基于 Python FastAPI + SQLite 的本地票据到期提醒系统，解决财务结算中常见的问题：
- 同一流水重复入账
- 手续费跨期
- 退款挂账
- 数据来源无法追溯

系统实现了 **导入 → 异常检测 → 复核 → 修正 → 历史留痕 → 导出** 全流程闭环，每条记录均可追溯到原始附件和操作依据。

## 快速开始

### 方法一：使用启动脚本（推荐）

**Mac/Linux:**
```bash
chmod +x start.sh
./start.sh
```

**Windows:**
```
双击运行 start.bat
```

### 方法二：手动启动

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 安装依赖
pip install -r requirements.txt

# 生成示例数据
python scripts/generate_sample_data.py

# 启动服务
python main.py
```

启动后访问：
- 主界面: http://127.0.0.1:8000
- API文档: http://127.0.0.1:8000/docs

## 核心功能

### 1. 数据导入
- 支持 Excel (.xlsx, .xls) 和 CSV 格式
- 自动识别中英文列名
- 分别导入 **票据** 和 **对账单**
- 导入文件自动留底，可在"上传记录"中查看

### 2. 智能异常检测
系统自动识别以下异常情况，标记为 **待确认**：

| 异常类型 | 检测规则 |
|---------|---------|
| 🔴 重复入账 | 同一流水号 + 相同金额已存在 |
| 🟠 退款挂账 | 字段包含"退款/挂账/待确认/争议"或负金额 |
| 🟠 手续费跨期 | 票据日期与到期日期间隔>90天，或手续费比例>10% |
| 🟡 手续费不匹配 | 手续费与按0.6%估算的差额超过50%或10元 |

> **原则**：宁可标成待确认，也不混进正常结果里。

### 3. 智能匹配
根据 **流水号 + 金额** 自动关联票据与对账单，建立可追溯的证据链。

### 4. 复核流程
- **确认通过**：数据无误，解除异常标记
- **标记待确认**：需进一步核实
- **标记为争议**：存在纠纷，需特别处理
- **批量复核**：支持多选批量操作
- 每次复核必须填写 **复核原因**，可选填 **复核依据**（附件名/链接）

### 5. 数据修正
- 支持修改所有核心字段
- 每次修正必须填写 **修正原因**
- 系统自动记录 **字段变更历史**（原值 → 新值）
- 修正后自动重新检测异常

### 6. 操作历史
- 完整记录每一条数据的所有变更：导入、复核、修正
- 支持按票据ID筛选历史
- 每个操作记录操作人、操作时间、变更内容

### 7. Excel导出
导出文件包含 **5个工作表**，实现完整可追溯：

| 工作表 | 内容说明 |
|-------|---------|
| 汇总 | 统计概览、状态分布、异常分布 |
| 票据明细 | 所有票据数据 + 可追溯链接 |
| 操作历史 | 所有操作变更记录 |
| 复核记录 | 所有复核操作及原因、依据 |
| 证据明细 | 来源文件、关联票据/对账单、异常原因说明 |

> **关键特性**：从票据明细的"可追溯链接"可直接跳转到证据明细，让接手的人一眼看到依据。

## 项目结构

```
.
├── main.py                    # FastAPI主程序
├── config.py                  # 配置文件
├── database.py                # 数据库连接
├── models.py                  # 数据模型
├── schemas.py                 # API数据结构
├── requirements.txt           # 依赖列表
├── start.sh / start.bat       # 启动脚本
├── data/
│   ├── bill_reminder.db       # SQLite数据库（自动创建）
│   ├── uploads/               # 上传文件留存
│   ├── exports/               # 导出文件
│   └── sample_data/           # 示例数据
├── scripts/
│   └── generate_sample_data.py # 生成示例数据
├── services/
│   ├── anomaly_detector.py    # 异常检测服务
│   ├── import_service.py      # 导入服务
│   ├── review_service.py      # 复核服务
│   ├── revise_service.py      # 修正服务
│   └── export_service.py      # 导出服务
└── static/
    └── index.html             # 前端界面
```

## 数据库表结构

### bills 票据主表
- 核心字段：票据号、日期、到期日、金额、手续费、收付款方、流水号
- 状态字段：status (normal/pending/confirmed/revised/disputed)
- 异常字段：anomaly_type, anomaly_reason
- 关联字段：related_statement_id, related_invoice_id
- 来源字段：source_file, source_type

### review_records 复核记录表
- 记录每次复核的操作、原因、依据、状态变更

### history_records 操作历史表
- 记录每次字段修改的原值、新值、操作人、原因

### upload_files 上传文件表
- 记录所有上传的文件，便于追溯来源

## 使用流程建议

1. **导入票据**：上传票据文件，系统自动检测异常
2. **导入对账单**：上传银行对账单
3. **智能匹配**：点击"智能匹配"自动关联票据与对账单
4. **复核异常**：重点处理"待确认"的异常记录，填写复核原因
5. **修正数据**：如发现数据错误，修正并记录原因
6. **导出报表**：导出完整Excel，包含所有历史和证据

## 示例数据说明

系统自带示例数据，包含以下场景：
- 第2、5条票据：同一流水重复入账
- 第3条票据：退款挂账
- 第7条票据：待确认
- 第10条票据：手续费跨期
- 第1-8条：票据与对账单可匹配

## API接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/statistics | 获取统计数据 |
| GET | /api/bills | 查询票据列表 |
| GET | /api/bills/{id} | 获取票据详情（含历史） |
| PUT | /api/bills/{id} | 修正票据数据 |
| POST | /api/upload/invoice | 导入票据 |
| POST | /api/upload/statement | 导入对账单 |
| POST | /api/match | 智能匹配票据与对账单 |
| POST | /api/review/confirm | 复核通过 |
| POST | /api/review/pending | 标记待确认 |
| POST | /api/review/dispute | 标记争议 |
| POST | /api/review/batch | 批量复核 |
| GET | /api/history | 查询操作历史 |
| GET | /api/export | 导出Excel |
| GET | /api/uploads | 查询上传记录 |
| POST | /api/redetect | 重新检测异常 |

## 技术栈

- **后端**: FastAPI + SQLAlchemy
- **数据库**: SQLite（零配置，本地运行）
- **前端**: 原生 HTML + JavaScript（无需构建）
- **数据处理**: pandas + openpyxl + xlsxwriter

## 注意事项

1. 数据库文件为 `data/bill_reminder.db`，定期备份
2. 上传的原始文件保存在 `data/uploads/`，请勿删除
3. 导出文件保存在 `data/exports/`
4. 所有操作均需填写原因，确保可追溯
