# 驿站包裹对账服务

一个后端对账服务，用于驿站包裹的自动核对、人工复核和报告导出。

## 功能特性

- 📥 **数据导入**: 支持包裹 CSV、短信 JSON、退回规则 JSON 导入
- 🔍 **自动比对**: 超期未取、重复催取、短信缺失、隐私未脱敏自动检测
- ✍️ **人工复核**: 修改处置结果、填写复核意见、操作留痕
- 🔄 **重新计算**: 数据更新后重新对账，保留已复核记录
- 📊 **报告导出**: 详情 CSV、汇总 Excel（含审计日志）
- 🔗 **差异解释**: 每条记录可追溯证据链，支持向他人说明处置理由

## 项目结构

```
.
├── main.py                    # FastAPI 服务入口
├── demo.py                    # 完整流程演示脚本
├── requirements.txt           # 依赖列表
├── package/
│   ├── __init__.py
│   ├── models.py              # 数据模型定义
│   ├── importer.py            # 数据导入模块
│   ├── reconciler.py          # 对账核心逻辑
│   ├── exporter.py            # 报告导出模块
│   └── sample_data.py         # 样例数据
└── tests/
    ├── __init__.py
    └── test_reconciliation.py # 测试用例
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行演示脚本

```bash
python demo.py
```

演示脚本将展示完整流程：
- 导入样例数据（5个包裹、10条短信、2条规则）
- 自动对账，标记超期、重复催取等问题
- 人工复核修改 PKG004 的处置结果
- 重新计算（保留已复核记录）
- 导出 CSV 和 Excel 报告

### 3. 启动 API 服务

```bash
python main.py
```

服务启动后访问 `http://localhost:8000/docs` 查看交互式 API 文档。

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/import/sample` | 导入样例数据 |
| POST | `/api/import/packages` | 上传包裹 CSV |
| POST | `/api/import/sms` | 上传短信 JSON |
| POST | `/api/import/rules` | 上传规则 JSON |
| GET | `/api/reconcile` | 执行自动对账 |
| POST | `/api/reconcile/review` | 人工复核 |
| POST | `/api/reconcile/recalculate` | 重新计算 |
| GET | `/api/explain/{package_id}` | 差异解释（证据链） |
| GET | `/api/report/summary` | 汇总报告 |
| GET | `/api/report/details.csv` | 下载明细 CSV |
| GET | `/api/report/full.xlsx` | 下载完整 Excel |
| GET | `/api/audit/{package_id}` | 审计日志 |

## 数据格式

### 包裹 CSV 字段

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| package_id | 是 | 包裹唯一ID | PKG001 |
| tracking_no | 是 | 运单号 | SF1234567890123 |
| recipient_name | 是 | 收件人姓名 | 张三 |
| recipient_phone | 是 | 手机号 | 13800138001 |
| pickup_code | 是 | 取件码 | 1-2-333 |
| arrival_date | 是 | 到件日期 | 2026-05-20 |
| status | 是 | 状态 | pending/picked/overdue |
| pickup_date | 否 | 取件日期 | 2026-05-20 |
| shelf_location | 否 | 货架位置 | A-01 |
| courier_company | 否 | 快递公司 | 顺丰 |
| weight | 否 | 重量 | 1.5 |

### 短信 JSON 字段

```json
[
  {
    "sms_id": "SMS001",
    "package_id": "PKG001",
    "sms_type": "arrival",
    "send_time": "2026-05-20 09:30:00",
    "content": "您的包裹已到驿站，取件码1-2-333",
    "recipient_phone": "138****8001"
  }
]
```

`sms_type` 可选值: `arrival`（入库）、`reminder`（催取）、`overdue`（超期）、`return_notice`（退回通知）

### 退回规则 JSON

```json
[
  {
    "rule_id": "RULE001",
    "rule_name": "普通包裹7天退回",
    "overdue_days": 7,
    "priority": 1,
    "description": "普通包裹存放超过7天自动退回"
  }
]
```

## 使用场景

### 场景：向他人说明处置理由

站长可以通过 `/api/explain/{package_id}` 接口获取完整证据链：

```json
{
  "package_id": "PKG004",
  "pickup_code": "1-3-111",
  "disposal_type": "放行",
  "reasons": ["重复催取3次"],
  "evidence": ["共发送3条催取短信: 05-15, 05-20, 05-22"],
  "reviewed_by": "张站长",
  "review_note": "已与收件人电话沟通，收件人将于三日内取件",
  "audit_logs": [
    {"action": "auto_reconcile", "operator": "system", "timestamp": "..."},
    {"action": "manual_review", "operator": "张站长", "timestamp": "..."}
  ]
}
```

## 运行测试

```bash
pytest tests/ -v
```

## 样例数据说明

样例中包含 5 个包裹：

| 包裹ID | 取件码 | 到件日期 | 状态 | 自动检测结果 |
|--------|--------|----------|------|-------------|
| PKG001 | 1-2-333 | 2026-05-20 | pending | 放行（7天内） |
| PKG002 | 2-5-666 | 2026-05-20 | picked | 放行（已取件） |
| PKG003 | 3-1-888 | 2026-05-10 | pending | **退回**（超期17天） |
| PKG004 | 1-3-111 | 2026-05-15 | pending | **补材料**（重复催取3次，需人工复核） |
| PKG005 | 2-2-222 | 2026-05-05 | overdue | **退回**（超期22天） |

PKG004 是需要人工修正的记录，演示了从自动标记到人工复核的完整流程。
