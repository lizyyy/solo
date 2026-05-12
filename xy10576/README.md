# 报表口径变更管理 CLI

一个用于管理数据报表指标口径变更的命令行工具，帮助数据团队在调整指标口径后，系统地追踪影响、管理回填并确保业务闭环。

---

## 功能特性

- **多指标对比**：支持新旧指标定义的详细对比（SQL、聚合方式、过滤条件等）
- **影响看板追踪**：自动识别受影响的看板，支持同一看板多指标场景
- **回填任务管理**：跟踪回填任务状态，支持幂等更新
- **负责人完整性检查**：确保所有指标和看板都有负责人
- **状态工作流**：完整的状态流转（pending → check → notify/backfill/internal → completed）
- **历史记录**：所有变更和操作都有完整的审计日志
- **幂等操作**：重复执行相同操作不会产生副作用
- **人工修正**：支持人工干预，强制记录前后差异和操作者
- **分类报告**：自动分类为「必须通知业务」「需要回填」「仅内部调整」

---

## 快速开始

### 环境要求

- Python 3.8 及以上

### 安装依赖

```bash
cd /Users/mac/pro/solo/workspaces/xy10576
pip install -e .
```

### 验证安装

```bash
python -m metric_cli.main --help
```

---

## 命令说明

| 命令 | 功能 | 关键参数 |
|------|------|----------|
| `list` | 列出所有项目 | - |
| `init` | 初始化新项目 | `--name`, `--operator`, `--sample`(加载样例) |
| `import` | 导入数据 | `--metrics`, `--dashboards`, `--backfill` |
| `check` | 执行规则检查 | `--project`, `--operator` |
| `detail` | 查看变更详情 | `--project`, `--change`(可选), `--history` |
| `report` | 生成报告 | `--project`, `--format`(text/markdown), `--output` |
| `update-status` | 更新变更状态 | `--project`, `--change`, `--to`, `--operator` |
| `correct` | 人工修正 | `--project`, `--change`, `--field`, `--old`, `--new`, `--operator`, `--reason` |
| `update-backfill` | 更新回填状态 | `--project`, `--task`, `--to`, `--operator` |

---

## 内置样例说明

工具内置了完整的演示样例，包含三个核心指标场景：

### 1. GMV（总成交额）- 必须通知业务
- **变更类型**：SQL 逻辑变更（排除测试订单）
- **影响范围**：3 个看板（销售总览、运营监控、未指派看板）
- **状态分类**：notify_business（必须通知业务）
- **负责人**：完整

### 2. 活跃用户（DAU）- 需要回填
- **变更类型**：指标重定义（id 从 dau_v1 改为 dau_v2，SQL 完全不同）
- **影响范围**：2 个看板（用户分析、运营监控）
- **回填状态**：部分完成（2025上半年已完成，下半年运行中）
- **状态分类**：needs_backfill（需要回填）

### 3. 退款率 - 仅内部调整
- **变更类型**：仅重命名（refund_ratio_old → refund_rate，SQL 不变）
- **影响范围**：2 个看板
- **回填需求**：无
- **状态分类**：internal_only（仅内部调整）

---

## 主要演示路径（成功闭环）

### 步骤 1：初始化项目并加载内置样例

```bash
python -m metric_cli.main init \
  --id "demo_q1_2026" \
  --name "2026Q1 指标口径优化" \
  --operator "data_lead_zhangsan" \
  --sample
```

你会看到：
```
✓ 项目已创建: demo_q1_2026
已加载内置样例：GMV、活跃用户、退款率 三个场景
```

### 步骤 2：执行规则检查

```bash
python -m metric_cli.main check \
  --project "demo_q1_2026" \
  --operator "data_lead_zhangsan"
```

你会看到检查结果，包括：
- 检测到的指标重命名
- 同一看板多个指标变更的警告（运营综合监控包含 3 个变更指标）
- 回填未完成的警告
- 负责人缺失的警告（未指派看板没有负责人）

### 步骤 3：查看具体变更详情

查看所有变更：
```bash
python -m metric_cli.main detail --project "demo_q1_2026"
```

或者查看特定变更并显示历史：
```bash
python -m metric_cli.main detail \
  --project "demo_q1_2026" \
  --change "<从上一步输出中复制一个change_id>" \
  --history
```

### 步骤 4：修复问题

**修复负责人缺失（未指派看板）：**

先找到看板关联的变更（GMV 变更），然后修正 GMV 指标或看板的负责人（示例：假设我们人工添加看板负责人）：

```bash
# 或者用 correct 命令修正指标的负责人
python -m metric_cli.main correct \
  --project "demo_q1_2026" \
  --change "<gmv的change_id>" \
  --field "tech_owner" \
  --old "zhang_wei@example.com" \
  --new "zhang_wei_updated@example.com" \
  --operator "data_manager_lisi" \
  --reason "原负责人离职，已交接给新同事"
```

**完成回填任务：**

将待处理的回填任务标记为成功：
```bash
# GMV 回填
python -m metric_cli.main update-backfill \
  --project "demo_q1_2026" \
  --task "bf_gmv_202601" \
  --to "succeeded" \
  --operator "etl_engineer_wang"

# DAU 运行中回填
python -m metric_cli.main update-backfill \
  --project "demo_q1_2026" \
  --task "bf_dau_202601" \
  --to "succeeded" \
  --operator "etl_engineer_wang"
```

**幂等验证**：再次执行相同的 update-backfill 命令，会提示「状态未变更（幂等）」。

### 步骤 5：重新检查并获取业务确认

```bash
python -m metric_cli.main check \
  --project "demo_q1_2026" \
  --operator "data_manager_lisi"
```

假设业务已确认 GMV 变更，手动更新状态：
```bash
python -m metric_cli.main update-status \
  --project "demo_q1_2026" \
  --change "<gmv的change_id>" \
  --to "completed" \
  --operator "data_manager_lisi" \
  --reason "业务负责人已邮件确认接受新口径"
```

同样处理活跃用户（回填完成后可以关闭）：
```bash
python -m metric_cli.main update-status \
  --project "demo_q1_2026" \
  --change "<dau的change_id>" \
  --to "completed" \
  --operator "data_manager_lisi" \
  --reason "回填任务全部成功，历史数据已刷新"
```

退款率是仅内部调整，也可以关闭：
```bash
python -m metric_cli.main update-status \
  --project "demo_q1_2026" \
  --change "<refund的change_id>" \
  --to "completed" \
  --operator "data_manager_lisi" \
  --reason "仅重命名，无需业务确认"
```

### 步骤 6：生成最终报告

```bash
python -m metric_cli.main report \
  --project "demo_q1_2026" \
  --format "text"
```

或者输出 Markdown 到文件：
```bash
python -m metric_cli.main report \
  --project "demo_q1_2026" \
  --format "markdown" \
  --output "./closure_report.md"
```

**业务闭环判断标准**：
- 所有 `notify_business` 状态的变更都收到业务确认 → 标记为 completed
- 所有 `needs_backfill` 状态的回填任务都已成功 → 标记为 completed
- 所有负责人信息已完整（通过 correct 命令补充）
- 最终报告显示「✅ 所有变更已闭环！」

---

## 失败演示路径

### 场景：负责人缺失 + 回填失败

```bash
# 初始化失败场景项目
python -m metric_cli.main init \
  --id "fail_demo" \
  --name "失败场景演示" \
  --operator "junior_engineer" \
  --fail-sample

# 执行检查（会发现问题）
python -m metric_cli.main check \
  --project "fail_demo" \
  --operator "junior_engineer"
```

你会看到：
- 🔴 指标缺少 business_owner 和 tech_owner
- 🔴 看板缺少负责人
- 🔴 回填任务状态为 failed（错误：分区不存在）
- 🟡 回填任务重试了 3 次

**如果不修复就尝试生成报告**：报告会明确显示「业务未完全闭环」，并列出需要跟进的事项。

---

## 数据导入格式

如果要导入自定义数据，可以准备以下 JSON 文件：

### metrics.json（指标变更）
```json
[
  {
    "old": {
      "metric_id": "old_gmv",
      "name": "GMV",
      "type": "counter",
      "sql": "SELECT SUM(amount) FROM orders",
      "aggregation": "sum",
      "time_window": "daily",
      "filters": {},
      "business_owner": "biz@example.com",
      "tech_owner": "tech@example.com"
    },
    "new": {
      "metric_id": "new_gmv",
      "name": "GMV(新)",
      "type": "counter",
      "sql": "SELECT SUM(amount) FROM orders WHERE is_test = false",
      "aggregation": "sum",
      "time_window": "daily",
      "filters": {"is_test": false},
      "business_owner": "biz@example.com",
      "tech_owner": "tech@example.com"
    }
  }
]
```

### dashboards.json（看板关系）
```json
[
  {
    "dashboard_id": "dash_001",
    "name": "销售总览",
    "owner": "sales@example.com",
    "metrics": ["old_gmv"]
  }
]
```

### backfill.json（回填任务）
```json
[
  {
    "task_id": "bf_001",
    "metric_id": "new_gmv",
    "start_date": "2025-01-01T00:00:00",
    "end_date": "2025-12-31T23:59:59",
    "status": "pending",
    "retry_count": 0,
    "created_by": "engineer"
  }
]
```

导入命令：
```bash
python -m metric_cli.main import \
  --project "my_project" \
  --metrics "./metrics.json" \
  --dashboards "./dashboards.json" \
  --backfill "./backfill.json" \
  --operator "my_name"
```

---

## 规则引擎

| 规则名称 | 描述 | 严重程度 | 触发后动作 |
|----------|------|----------|------------|
| rename_detection | 检测指标 ID 变更（重命名） | medium | 标记 renamed_from |
| multiple_metrics_dashboard | 同一看板多个指标变更 | high | 警告需特别注意 |
| backfill_status_check | 回填任务未完成 | critical | 状态设为 needs_backfill |
| owner_missing | 指标/看板缺少负责人 | high | 状态设为 needs_review |
| logic_change_detection | SQL/过滤条件变更 | medium | 状态设为 notify_business |

---

## 状态流转

```
pending → check → notify_business → completed
                → needs_backfill  → completed
                → needs_review    → completed
                → internal_only   → completed
                → failed
```

**状态说明**：
- `pending`：初始状态，刚导入
- `notify_business`：SQL/逻辑变更，需业务确认
- `needs_backfill`：有未完成的回填任务
- `needs_review`：负责人缺失或其他信息不完整
- `internal_only`：仅重命名等不影响业务的变更
- `completed`：业务已闭环
- `failed`：处理失败

---

## 数据存储

- 所有项目数据存储在 `./metric_data/` 目录
- 每次保存自动创建备份（带时间戳的 .bak 文件）
- JSON 格式，方便调试和迁移
- 历史记录内嵌在项目数据中，可随时追溯

---

## 不看源码也能懂的业务判断

看 `report` 命令输出的最后部分：

```
✅ 业务闭环判断标准
====================

业务已闭环当且仅当:
  - 所有notify_business状态的变更都收到业务确认
  - 所有needs_backfill状态的回填任务都已成功
  - 所有负责人信息已完整

✅ 所有变更已闭环！
```

或者：

```
⚠️  业务未完全闭环，还需跟进上述事项
❌ 仍有 2 项需要业务确认
❌ 仍有 1 项需等待回填
```

**红色 = 需要立即跟进**
**黄色 = 需要等待或确认**
**绿色 = 已处理**

---

## 项目结构

```
.
├── metric_cli/
│   ├── __init__.py
│   ├── main.py          # CLI入口，所有命令定义
│   ├── models.py        # Pydantic数据模型
│   ├── storage.py       # JSON存储与状态管理
│   ├── rules.py         # 规则引擎与状态流转
│   ├── report.py        # 报告生成器
│   └── samples.py       # 内置样例数据
├── metric_data/         # 运行时数据（自动创建）
├── pyproject.toml       # 项目配置
└── README.md            # 本文档
```
