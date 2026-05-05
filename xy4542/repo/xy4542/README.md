# 现金中心清分核对系统

> 县域银行支行现金中心下班前清分结果核对本地后端API系统

## 功能特性

- **多源数据导入**: 支持柜员缴款CSV、清分机冠字号日志CSV、扎把标签JSON、ATM加钞计划CSV、差错备注CSV
- **智能风险识别**: 自动识别重复入库、柜员金额不平、冠字号断档、ATM箱计划金额不匹配、扎把金额不一致等风险
- **数据持久化**: 基于SQLite数据库存储所有数据
- **人工复核**: 支持单条和批量复核风险预警
- **重算机制**: 支持风险检查重算
- **多格式导出**: 导出Markdown交接单和JSON审计明细
- **完整审计**: 所有操作均有审计日志记录

## 技术栈

- **Web框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy
- **语言**: Python 3.8+
- **API文档**: Swagger UI / ReDoc

## 项目结构

```
xy4542/
├── app/
│   ├── __init__.py
│   ├── config.py                 # 数据库配置
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py             # 数据模型
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── import_routes.py      # 导入接口
│   │   ├── query_routes.py       # 查询接口
│   │   └── action_routes.py      # 操作接口(复核/重算/导出)
│   └── services/
│       ├── __init__.py
│       ├── import_service.py     # 数据导入服务
│       ├── risk_service.py       # 风险识别服务
│       └── export_service.py     # 导出服务
├── data/                          # 示例数据
│   ├── teller_payments.csv       # 柜员缴款
│   ├── sorting_logs.csv          # 清分机日志
│   ├── bundle_tags.json          # 扎把标签
│   ├── atm_plans.csv             # ATM加钞计划
│   └── error_remarks.csv         # 差错备注
├── exports/                       # 导出文件目录(自动创建)
├── main.py                        # 应用入口
├── requirements.txt               # 依赖包
├── curl_test.sh                   # 测试脚本
├── CURL_EXAMPLES.md               # CURL接口示例
├── README.md                      # 本文档
└── cash_center.db                 # SQLite数据库(运行时创建)
```

## 数据模型

### 核心数据表

| 表名 | 说明 |
|------|------|
| teller_payments | 柜员缴款记录 |
| sorting_logs | 清分机冠字号日志 |
| bundle_tags | 扎把标签 |
| atm_plans | ATM加钞计划 |
| error_remarks | 差错备注 |
| bundles | 扎把主表 |
| risk_alerts | 风险预警 |
| review_records | 复核记录 |
| audit_logs | 审计日志 |

### 风险类型

| 风险编码 | 风险类型 | 严重程度 | 说明 |
|---------|---------|---------|------|
| R001 | 重复入库 | high | 同一扎把编号出现多次 |
| R002 | 柜员金额不平 | high | 柜员缴款记录与实际扎把金额不一致 |
| R003 | 冠字号断档 | medium | 同一扎把内冠字号不连续 |
| R004 | ATM计划不匹配 | medium | ATM计划金额与实际扎把金额不一致 |
| R005 | 扎把金额不一致 | high | 主记录与标签记录金额不一致 |

## 快速开始

### 1. 安装依赖

```bash
# 创建虚拟环境(可选)
python3 -m venv venv
source venv/bin/activate  # Linux/macOS
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务启动后访问：
- 服务地址: http://localhost:8000
- API文档(Swagger): http://localhost:8000/docs
- API文档(ReDoc): http://localhost:8000/redoc

### 3. 运行测试

```bash
# 赋予执行权限
chmod +x curl_test.sh

# 运行完整测试流程
./curl_test.sh
```

## API接口总览

### 导入接口 (`/import/*`)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/import/teller-payment` | POST | 导入柜员缴款CSV |
| `/import/sorting-log` | POST | 导入清分机日志CSV |
| `/import/bundle-tag` | POST | 导入扎把标签JSON |
| `/import/atm-plan` | POST | 导入ATM加钞计划CSV |
| `/import/error-remark` | POST | 导入差错备注CSV |

### 查询接口 (`/query/*`)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/query/stats` | GET | 查询统计信息 |
| `/query/risks` | GET | 查询风险预警列表 |
| `/query/bundles` | GET | 查询扎把列表 |
| `/query/bundles/{bundle_no}` | GET | 查询扎把详情 |
| `/query/tellers` | GET | 查询柜员缴款汇总 |
| `/query/atm-plans` | GET | 查询ATM加钞计划 |
| `/query/audit-logs` | GET | 查询审计日志 |

### 操作接口 (`/action/*`)

| 接口 | 方法 | 说明 |
|------|------|------|
| `/action/recalculate` | POST | 执行风险重算 |
| `/action/review/{alert_id}` | POST | 复核单个风险预警 |
| `/action/review/batch` | POST | 批量复核风险预警 |
| `/action/verify-bundle/{bundle_no}` | POST | 复核扎把状态 |
| `/action/export/handover` | GET | 导出Markdown交接单 |
| `/action/export/audit` | GET | 导出JSON审计明细 |
| `/action/export/list` | GET | 查询已导出文件列表 |
| `/action/export/download/{filename}` | GET | 下载导出文件 |

## 完整业务流程示例

### 步骤1: 导入数据

```bash
# 导入柜员缴款
curl -X POST "http://localhost:8000/import/teller-payment" \
  -F "file=@./data/teller_payments.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=张主管"

# 导入清分机日志
curl -X POST "http://localhost:8000/import/sorting-log" \
  -F "file=@./data/sorting_logs.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=刘管理员"

# 导入扎把标签
curl -X POST "http://localhost:8000/import/bundle-tag" \
  -F "file=@./data/bundle_tags.json" \
  -F "business_date=2026-05-05" \
  -F "operator=陈管理员"

# 导入ATM计划
curl -X POST "http://localhost:8000/import/atm-plan" \
  -F "file=@./data/atm_plans.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=ATM管理员"

# 导入差错备注
curl -X POST "http://localhost:8000/import/error-remark" \
  -F "file=@./data/error_remarks.csv" \
  -F "business_date=2026-05-05" \
  -F "operator=李主管"
```

### 步骤2: 执行风险检查

```bash
curl -X POST "http://localhost:8000/action/recalculate" \
  -F "business_date=2026-05-05" \
  -F "operator=系统管理员"
```

### 步骤3: 查看风险预警

```bash
# 查看待复核风险
curl "http://localhost:8000/query/risks?business_date=2026-05-05&is_reviewed=false"

# 查看统计信息
curl "http://localhost:8000/query/stats?business_date=2026-05-05"
```

### 步骤4: 人工复核

```bash
# 确认风险
curl -X POST "http://localhost:8000/action/review/1" \
  -F "reviewer=张主管" \
  -F "decision=confirm" \
  -F "remark=经核实，确实存在问题"

# 忽略风险
curl -X POST "http://localhost:8000/action/review/2" \
  -F "reviewer=李主管" \
  -F "decision=dismiss" \
  -F "remark=系统误报"

# 批量复核
curl -X POST "http://localhost:8000/action/review/batch" \
  -F "alert_ids=3,4,5" \
  -F "reviewer=王主管" \
  -F "decision=dismiss" \
  -F "remark=批量复核，均为误报"
```

### 步骤5: 导出文件

```bash
# 导出Markdown交接单
curl -OJ "http://localhost:8000/action/export/handover?business_date=2026-05-05&download=true"

# 导出JSON审计明细
curl -OJ "http://localhost:8000/action/export/audit?business_date=2026-05-05&download=true"

# 查看已导出文件列表
curl "http://localhost:8000/action/export/list"
```

## 示例数据说明

`data/` 目录下包含示例数据，用于测试系统功能。这些数据中故意包含了一些风险场景：

### teller_payments.csv
- 柜员001(张三)：扎把BD20260505001重复出现2次（测试重复入库）
- 柜员003(王五)：扎把BD20260505007金额为9000元（测试金额不平）

### sorting_logs.csv
- 扎把BD20260505002：冠字号从CE00000102跳到CE00000105（测试冠字号断档）

### atm_plans.csv
- ATM002钞箱B1：计划金额18000元，实际扎把金额19000元（测试ATM计划不匹配）

### bundle_tags.json
- 扎把BD20260505007：标签金额9000元，与柜员缴款记录一致（测试扎把金额不一致）

## 导出文件格式

### Markdown交接单示例

```markdown
# 现金中心交接单 - 2026-05-05

**生成时间:** 2026-05-05 18:00:00

---

## 一、柜员缴款汇总

| 柜员号 | 柜员姓名 | 扎把数 | 金额(元) |
|--------|----------|--------|----------|
| 001 | 张三 | 3 | 25,000.00 |
| 002 | 李四 | 2 | 20,000.00 |
| 003 | 王五 | 2 | 19,000.00 |
| **合计** | - | **7** | **64,000.00** |

---

## 二、扎把明细

| 扎把编号 | 面额 | 金额(元) | 来源 | 状态 |
|----------|------|----------|------|------|
| BD20260505001 | 100 | 10,000.00 | teller | 待复核 |
| ... | ... | ... | ... | ... |

---

## 三、ATM加钞计划

...

---

## 四、风险预警

### 待复核风险 (3 项)

| 风险编码 | 类型 | 严重程度 | 描述 |
|----------|------|----------|------|
| R001 | 重复入库 | high | 扎把编号 BD20260505001 重复入库... |
| ... | ... | ... | ... |

---

## 五、交接签字

| 岗位 | 签字 | 日期 |
|------|------|------|
| 现金中心主管 | ____________ | |
| 柜员代表 | ____________ | |
| ATM管理员 | ____________ | |
```

### JSON审计明细格式

```json
{
  "business_date": "2026-05-05",
  "generated_at": "2026-05-05T18:00:00",
  "data": {
    "teller_payments": [...],
    "sorting_logs": [...],
    "bundle_tags": [...],
    "atm_plans": [...],
    "bundles": [...]
  },
  "risks": [...],
  "audit_logs": [...],
  "summary": {
    "teller_count": 3,
    "total_bundles": 7,
    "total_amount": 64000,
    "risk_count": 5,
    "pending_risks": 3,
    "reviewed_risks": 2
  }
}
```

## 常见问题

### Q1: 如何重置数据库？

删除数据库文件即可，下次启动时会自动重建：

```bash
rm cash_center.db
```

### Q2: 导入CSV时中文乱码怎么办？

确保CSV文件使用UTF-8编码。如果是Excel导出的CSV，使用以下命令转码：

```bash
iconv -f GBK -t UTF-8 input.csv > output.csv
```

### Q3: 如何查看API详细文档？

启动服务后访问：
- Swagger UI (交互式): http://localhost:8000/docs
- ReDoc (更美观): http://localhost:8000/redoc

### Q4: 导出的文件在哪里？

导出的文件默认保存在 `exports/` 目录下，也可以通过API直接下载。

### Q5: 如何添加新的风险检查规则？

在 `app/services/risk_service.py` 中添加新的检查方法，并在 `run_all_checks` 方法中调用即可。

## 开发说明

### 添加新的导入类型

1. 在 `app/models/models.py` 中添加数据模型
2. 在 `app/services/import_service.py` 中添加解析和导入方法
3. 在 `app/routes/import_routes.py` 中添加API接口

### 添加新的风险检查

1. 在 `app/services/risk_service.py` 中添加检查方法
2. 在 `RISK_TYPES` 字典中添加风险类型定义
3. 在 `run_all_checks` 方法中调用新的检查方法

## 许可证

本项目仅供内部使用。

## 更新日志

### v1.0.0 (2026-05-05)

- 初始版本发布
- 支持5种数据导入格式
- 支持5种风险类型识别
- 支持人工复核和批量复核
- 支持Markdown和JSON导出
- 完整的审计日志记录
