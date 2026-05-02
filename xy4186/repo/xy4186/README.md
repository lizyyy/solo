# 广告串播合规回放台

本地纯后端 API 服务，专为地方电视台播出编排员设计，用于每日广告串播合规核查。

## 功能特性

- **数据导入**: 支持节目单 CSV、广告合同 JSON、排期表、播出日志、禁播时段、行业冲突规则导入
- **规则引擎**: 自动校验时长、频次、相邻竞品、禁播窗口、补播去重、合同余量
- **状态机**: 播出事件全生命周期状态管理
- **多格式导出**: Markdown 核查单、CSV 问题表、JSON 审计包
- **人工意见**: 支持人工复核意见录入

## 核心规则

| 规则代码 | 规则名称 | 严重程度 | 说明 |
|---------|---------|---------|------|
| CONSECUTIVE_BRAND | 同一品牌连播检查 | error | 同一品牌连播不可超过2次 |
| BRAND_FREQUENCY | 品牌日播出频次检查 | error | 同一品牌日播出不可超过12次 |
| BRAND_INTERVAL | 同品牌间隔检查 | warning | 同品牌两次播出间隔需超过30分钟 |
| INDUSTRY_CONFLICT | 行业竞品间隔检查 | warning | 竞品行业广告需保持最小间隔 |
| BLACKOUT_PERIOD | 禁播时段检查 | error | 广告不可在禁播时段播出 |
| CHILDREN_PROGRAM | 少儿节目限制检查 | error | 少儿节目时段禁播医药、烟酒、游戏、成人用品广告 |
| CONTRACT_BALANCE | 合同余量检查 | error | 播出广告需有足够合同余量 |
| RERUN_DUPLICATE | 补播去重检查 | warning | 补播广告需防止重复计费 |
| DURATION_CONSISTENCY | 时长一致性检查 | warning | 广告时长应为标准值 |

## 目录结构

```
xy4186/
├── app/
│   ├── __init__.py
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py          # 数据模型定义
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── import_routes.py   # 导入API
│   │   ├── query_routes.py    # 查询API
│   │   ├── validation_routes.py # 校验API
│   │   ├── export_routes.py   # 导出API
│   │   └── opinion_routes.py  # 人工意见API
│   └── services/
│       ├── __init__.py
│       ├── storage_service.py  # 数据存储服务
│       ├── import_service.py   # 导入解析服务
│       ├── rules_engine.py     # 规则引擎
│       ├── state_machine.py    # 状态机
│       └── export_service.py   # 导出服务
├── examples/                    # 示例数据文件
├── tests/                       # 测试文件
├── config.py                    # 配置文件
├── requirements.txt             # Python依赖
└── run.py                       # 启动入口
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 使用示例数据验证

examples 目录包含完整的示例数据，可以用于测试系统功能。

## API 接口

### 导入接口

#### 导入节目单 CSV

```bash
curl -X POST -F "file=@examples/program_schedule_20240503.csv" http://localhost:5000/api/import/program
```

#### 导入广告合同 JSON

```bash
curl -X POST -F "file=@examples/contracts.json" http://localhost:5000/api/import/contract
```

#### 导入排期表 CSV

```bash
curl -X POST -F "file=@examples/schedule_20240503.csv" http://localhost:5000/api/import/schedule
```

#### 导入播出日志 CSV

```bash
curl -X POST -F "file=@examples/broadcast_log_20240503.csv" http://localhost:5000/api/import/log
```

#### 导入禁播规则 JSON

```bash
curl -X POST -F "file=@examples/blackout_rules.json" http://localhost:5000/api/import/blackout
```

#### 导入行业冲突规则 JSON

```bash
curl -X POST -F "file=@examples/industry_conflicts.json" http://localhost:5000/api/import/conflict
```

### 查询接口

#### 查询节目列表

```bash
curl "http://localhost:5000/api/query/programs?date=2024-05-03"
```

#### 查询合同列表

```bash
curl "http://localhost:5000/api/query/contracts"
```

#### 查询播出事件

```bash
curl "http://localhost:5000/api/query/events?date=2024-05-03"
```

#### 查询特定品牌的播出事件

```bash
curl "http://localhost:5000/api/query/events/brand/某品牌手机?date=2024-05-03"
```

#### 查询禁播规则

```bash
curl "http://localhost:5000/api/query/blackouts"
```

#### 查询行业冲突规则

```bash
curl "http://localhost:5000/api/query/conflicts"
```

#### 查询每日统计

```bash
curl "http://localhost:5000/api/query/stats/daily?date=2024-05-03"
```

### 校验接口

#### 执行每日合规校验

```bash
curl -X POST -H "Content-Type: application/json" -d '{"date": "2024-05-03"}' http://localhost:5000/api/validation/daily
```

#### 排期与日志对齐检查

```bash
curl -X POST -H "Content-Type: application/json" -d '{"date": "2024-05-03"}' http://localhost:5000/api/validation/reconcile
```

#### 列出所有校验规则

```bash
curl "http://localhost:5000/api/validation/rules"
```

#### 更新校验结果状态

```bash
curl -X PUT -H "Content-Type: application/json" -d '{"status": "resolved", "resolution_note": "已人工复核通过"}' http://localhost:5000/api/validation/result/1
```

#### 更新事件状态

```bash
curl -X PUT -H "Content-Type: application/json" -d '{"status": "validated", "operator": "编排员A", "reason": "合规校验通过"}' http://localhost:5000/api/validation/event/1/status
```

### 导出接口

#### 导出合规核查报告 (Markdown)

```bash
curl "http://localhost:5000/api/export/validation/markdown?date=2024-05-03"
```

#### 导出问题表 (CSV)

```bash
curl "http://localhost:5000/api/export/problems/csv?date=2024-05-03"
```

#### 导出审计包 (JSON)

```bash
curl "http://localhost:5000/api/export/audit/json?date=2024-05-03"
```

#### 导出每日报告 (Markdown)

```bash
curl "http://localhost:5000/api/export/daily/report?date=2024-05-03"
```

#### 直接下载文件

添加 `download=true` 参数直接下载文件：

```bash
curl -O "http://localhost:5000/api/export/validation/markdown?date=2024-05-03&download=true"
curl -O "http://localhost:5000/api/export/problems/csv?date=2024-05-03&download=true"
curl -O "http://localhost:5000/api/export/audit/json?date=2024-05-03&download=true"
```

### 人工意见接口

#### 添加人工意见

```bash
curl -X POST -H "Content-Type: application/json" -d '{
    "event_id": 1,
    "opinion_type": "comment",
    "content": "经核查，该广告属于合法补播",
    "reviewer_name": "编排员A",
    "decision": "approve",
    "is_overruled": true
}' http://localhost:5000/api/opinion/add
```

#### 查询校验结果的意见

```bash
curl "http://localhost:5000/api/opinion/validation/1"
```

#### 查询意见类型选项

```bash
curl "http://localhost:5000/api/opinion/types"
```

#### 查询决策选项

```bash
curl "http://localhost:5000/api/opinion/decisions"
```

### 导入批次查询

#### 列出所有导入批次

```bash
curl "http://localhost:5000/api/import/batches"
```

#### 按类型查询导入批次

```bash
curl "http://localhost:5000/api/import/batches?type=schedule"
```

#### 查询特定批次详情

```bash
curl "http://localhost:5000/api/import/batch/1"
```

## 完整验证流程示例

以下是一个完整的端到端验证流程：

### 步骤 1: 启动服务

```bash
python run.py
```

### 步骤 2: 导入基础数据

```bash
# 导入节目单
curl -X POST -F "file=@examples/program_schedule_20240503.csv" http://localhost:5000/api/import/program

# 导入合同
curl -X POST -F "file=@examples/contracts.json" http://localhost:5000/api/import/contract

# 导入禁播规则
curl -X POST -F "file=@examples/blackout_rules.json" http://localhost:5000/api/import/blackout

# 导入行业冲突规则
curl -X POST -F "file=@examples/industry_conflicts.json" http://localhost:5000/api/import/conflict
```

### 步骤 3: 导入排期和日志

```bash
# 导入排期表
curl -X POST -F "file=@examples/schedule_20240503.csv" http://localhost:5000/api/import/schedule

# 导入播出日志
curl -X POST -F "file=@examples/broadcast_log_20240503.csv" http://localhost:5000/api/import/log
```

### 步骤 4: 查询导入的数据

```bash
# 查询节目
curl "http://localhost:5000/api/query/programs?date=2024-05-03"

# 查询合同
curl "http://localhost:5000/api/query/contracts"

# 查询排期事件
curl "http://localhost:5000/api/query/events?date=2024-05-03&source_type=schedule"

# 查询日志事件
curl "http://localhost:5000/api/query/events?date=2024-05-03&source_type=log"
```

### 步骤 5: 执行合规校验

```bash
# 执行每日校验
curl -X POST -H "Content-Type: application/json" -d '{"date": "2024-05-03"}' http://localhost:5000/api/validation/daily

# 检查排期与日志对齐
curl -X POST -H "Content-Type: application/json" -d '{"date": "2024-05-03"}' http://localhost:5000/api/validation/reconcile
```

### 步骤 6: 导出核查报告

```bash
# 导出 Markdown 核查报告
curl "http://localhost:5000/api/export/validation/markdown?date=2024-05-03"

# 导出 CSV 问题表
curl "http://localhost:5000/api/export/problems/csv?date=2024-05-03"

# 导出 JSON 审计包
curl "http://localhost:5000/api/export/audit/json?date=2024-05-03"

# 导出每日报告
curl "http://localhost:5000/api/export/daily/report?date=2024-05-03"
```

### 步骤 7: 添加人工意见（如有问题）

```bash
# 先查询事件ID
curl "http://localhost:5000/api/query/events?date=2024-05-03"

# 然后对特定事件添加意见
curl -X POST -H "Content-Type: application/json" -d '{
    "event_id": 1,
    "opinion_type": "comment",
    "content": "经复核，该广告符合播出规定",
    "reviewer_name": "编排员张三"
}' http://localhost:5000/api/opinion/add
```

## 预期问题示例

使用示例数据执行校验后，可能会发现以下问题：

1. **某牛奶品牌连续播出 2 次** (在 06:35 和 06:40)
   - 规则: CONSECUTIVE_BRAND
   - 严重程度: error
   - 说明: 同一品牌连播不可超过 2 次（实际刚好 2 次，不会触发；示例中有 3 次连续的测试品牌会触发）

2. **某品牌手机播出频次较高**
   - 规则: BRAND_FREQUENCY
   - 严重程度: error
   - 说明: 日播出超过 12 次

3. **少儿节目时段有医药和游戏广告** (17:00-19:00)
   - 规则: CHILDREN_PROGRAM
   - 严重程度: error
   - 说明: 少儿节目时段禁播医药、游戏类广告

4. **数码电子与汽车广告间隔不足**
   - 规则: INDUSTRY_CONFLICT
   - 严重程度: warning
   - 说明: 竞品行业需保持 5 分钟间隔

## 运行测试

```bash
python -m pytest tests/test_api_flow.py -v
```

## 数据文件格式

### 节目单 CSV 字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 节目编码 | 节目唯一标识 | PROG001 |
| 节目名称 | 节目名称 | 早间新闻 |
| 分类 | 节目分类 | 新闻资讯 |
| 少儿节目 | 是否为少儿节目 | 是/否 |
| 播出日期 | 播出日期 | 2024-05-03 |
| 开始时间 | 开始时间 | 06:30:00 |
| 结束时间 | 结束时间 | 07:30:00 |
| 时长 | 时长（秒） | 3600 |
| 频道 | 播出频道 | 综合频道 |

### 排期表/播出日志 CSV 字段

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 播出日期 | 播出日期 | 2024-05-03 |
| 播出时间 | 播出时间 | 09:00:00 |
| 品牌 | 品牌名称 | 某品牌手机 |
| 广告名称 | 广告名称 | 新品上市 |
| 时长(秒) | 广告时长 | 15 |
| 行业分类 | 行业分类 | 数码电子 |
| 补播 | 是否为补播 | 是/否 |

### 合同 JSON 字段

```json
[
  {
    "contract_code": "CT202405001",
    "contract_name": "某品牌手机Q2推广合同",
    "advertiser_name": "某科技有限公司",
    "brand_name": "某品牌手机",
    "industry_category": "数码电子",
    "total_amount": 500000,
    "total_duration_seconds": 3600,
    "start_date": "2024-04-01",
    "end_date": "2024-06-30",
    "status": "active"
  }
]
```

## 状态机

播出事件的状态流转：

```
scheduled → imported → pending_validation → validated → logged → reconciled → completed
                    ↓                    ↓
              (cancelled)          has_errors
```

状态说明：
- **scheduled**: 已排期 - 等待导入确认
- **imported**: 已导入 - 等待校验
- **pending_validation**: 校验中 - 正在执行合规检查
- **validated**: 已校验 - 合规检查通过
- **has_errors**: 存在问题 - 需人工复核
- **logged**: 已记录 - 播出日志已确认
- **reconciled**: 已对齐 - 排期与日志一致
- **completed**: 已完成 - 全流程结束
- **cancelled**: 已取消 - 流程终止

## 配置说明

在 `config.py` 中可调整以下规则参数：

```python
RULE_ENGINE_CONFIG = {
    'MAX_CONSECUTIVE_SAME_BRAND': 2,           # 最大连播次数
    'MIN_INTERVAL_SAME_BRAND_SECONDS': 1800,   # 同品牌最小间隔（秒）
    'MAX_DAILY_FREQUENCY_PER_BRAND': 12,        # 品牌日播出最大频次
    'CHILDREN_PROGRAM_RESTRICTED_CATEGORIES': ['医药', '烟酒', '游戏', '成人用品'],
}
```

## 注意事项

1. 所有日期格式统一使用 `YYYY-MM-DD`
2. 所有时间格式统一使用 `HH:MM:SS`
3. 广告时长支持以下标准值：5, 10, 15, 20, 30, 45, 60, 90, 120 秒
4. 建议每日工作流程：导入排期 → 执行校验 → 导出报告 → 人工复核 → 导入日志 → 对齐检查
