# 工单 SLA 违约归因 CLI 工具

本工具用于分析客服工单跨队列流转后的SLA违约情况，帮助客服经理在每周复盘时快速定位责任队列和违约原因。

---

## 核心功能

- **跨队列归因**: 精确计算每个队列消耗的工时，确定违约责任归属
- **SLA智能计算**: 自动排除暂停时段和节假日，支持不同客户类型的工时配置
- **数据完整性校验**: 检测缺少暂停结束时间、升级早于创建等异常数据
- **人工修正追溯**: 所有人工修改都记录原值、新值、操作人和修改时间
- **幂等性保障**: 重复导入相同ID的记录不会产生重复数据

---

## 快速开始

### 1. 环境准备

```bash
# 安装依赖
pip install -r requirements.txt

# 为执行脚本添加权限
chmod +x sla
```

### 2. 初始化并加载样例数据

```bash
# 初始化数据库并创建样例数据
./sla init --sample
```

或者分开执行：
```bash
./sla init
./sla sample create
```

### 3. 查看样例工单

```bash
./sla sample list
```

### 4. 进行SLA检查

```bash
# 检查所有工单
./sla check --all

# 检查单个工单
./sla check T-2026-002
```

### 5. 查看工单详情

```bash
# 查看基本详情
./sla detail T-2026-002

# 查看完整时间线
./sla detail T-2026-002 --timeline
```

### 6. 生成复盘报告

```bash
# 汇总报告
./sla report

# 按队列统计
./sla report --format queue

# 导出JSON报告
./sla report --output report.json
```

---

## 内置样例工单说明

样例数据覆盖以下典型场景：

| 工单ID | 场景说明 | 预期结果 |
|--------|----------|----------|
| T-2026-001 | 普通客户工单，正常处理流程 | 未违约 |
| T-2026-002 | VIP客户工单，有"等待客户"暂停 | 可能违约，需排除等待客户时间 |
| T-2026-003 | 普通客户工单，跨夜暂停场景 | 测试跨日SLA计算 |
| T-2026-004 | VIP客户工单，误升级（升级时间早于创建时间） | 数据异常，责任归为"数据异常" |
| T-2026-005 | 紧急工单，缺少暂停结束时间 | 数据异常，责任归为"数据异常" |

---

## 主要演示路径

### 成功路径：正常分析流程

```bash
# 1. 初始化
./sla init --sample

# 2. 查看所有工单
./sla sample list

# 3. 检查所有工单的SLA状态
./sla check --all

# 4. 查看违约工单详情
./sla detail T-2026-002 --timeline

# 5. 生成复盘报告
./sla report
```

### 失败路径：数据异常分析

```bash
# 1. 查看存在数据问题的工单
./sla check T-2026-004

# 2. 查看详情中的问题提示
./sla detail T-2026-004

# 3. 另一个数据异常工单
./sla validate T-2026-005

# 4. 查看问题类型
./sla check T-2026-005
```

### 人工修正流程

```bash
# 1. 查看当前状态
./sla detail T-2026-002

# 2. 人工修正（需要确认）
./sla correct T-2026-002 current_status "已解决" --operator="张主管" --notes="客户确认问题已解决"

# 3. 查看修正记录
./sla detail T-2026-002

# 4. 重新检查SLA
./sla check T-2026-002
```

---

## 完整命令列表

### 初始化

```bash
./sla init                    # 初始化数据库
./sla init --sample           # 初始化并创建样例数据
```

### 数据导入

```bash
./sla import tickets data/tickets.csv           # 导入工单基础表
./sla import transitions data/transitions.csv   # 导入状态流转表
./sla import pauses data/pauses.csv             # 导入暂停说明表
./sla import escalations data/escalations.csv   # 导入升级记录表
```

**导入文件格式（CSV）：**

工单表必需字段：`ticket_id`, `customer_id`, `created_at`

流转表必需字段：`ticket_id`, `to_queue`, `to_status`, `transition_time`, `transition_id`

暂停表必需字段：`ticket_id`, `pause_start`, `pause_reason`, `pause_id`

升级表必需字段：`ticket_id`, `escalation_time`, `to_level`, `escalation_id`

### 检查和分析

```bash
./sla check --all              # 检查所有工单
./sla check <ticket_id>        # 检查单个工单
./sla check --all --json       # JSON格式输出
```

### 详情查看

```bash
./sla detail <ticket_id>              # 查看基本详情
./sla detail <ticket_id> --history    # 显示历史记录
./sla detail <ticket_id> --timeline   # 显示完整时间线
```

### 报告生成

```bash
./sla report                          # 汇总报告
./sla report --format queue           # 按队列统计
./sla report --format detail          # 详细JSON报告
./sla report --output report.json     # 导出到文件
```

### 样例管理

```bash
./sla sample create                   # 创建样例数据
./sla sample list                     # 列出现有工单
```

### 人工修正

```bash
./sla correct <ticket_id> <field> <new_value> --operator=<name> [--notes=<reason>]

# 示例：
./sla correct T-2026-002 current_status "已解决" --operator="李经理" --notes="客户确认关闭"
```

### 数据验证

```bash
./sla validate <ticket_id>            # 验证单个工单数据完整性
```

---

## SLA配置规则

### 客户类型与SLA时限

| 客户类型 | 响应时限 | 解决时限 | 工作时段 |
|----------|----------|----------|----------|
| NORMAL（普通） | 4小时 | 24工时 | 9:00-18:00 |
| VIP | 1小时 | 8工时 | 9:00-20:00 |
| URGENT（紧急） | 0.5小时 | 4工时 | 9:00-20:00 |

### 排除SLA计算的暂停原因

- 等待客户
- 等待第三方
- 等待系统
- 其他业务原因

### 队列负责人配置

| 队列 | 负责人 |
|------|--------|
| 客服一线 | 张主管 |
| 客服二线 | 李主管 |
| 技术支持 | 王主管 |
| 产品支持 | 赵主管 |
| 管理层 | 陈总监 |

---

## 违约归因规则

1. **数据异常优先**: 若存在数据问题（如缺少暂停结束时间、升级早于创建），直接标记为"数据异常"
2. **责任队列判定**: 正常情况下，责任归属于消耗工时最多的队列
3. **违约类型分类**:
   - 客户响应延迟: 存在"等待客户"暂停
   - 升级流转超时: 存在升级记录
   - 处理超时: 常规处理超时

---

## 数据模型

本地SQLite数据库包含以下表：

- `tickets`: 工单基础信息
- `status_transitions`: 状态流转记录
- `pauses`: 暂停记录
- `escalations`: 升级记录
- `sla_breaches`: SLA违约分析结果
- `corrections`: 人工修正记录
- `holidays`: 节假日配置
- `import_logs`: 导入日志

---

## 项目结构

```
sla_cli/
├── __init__.py
├── models.py         # 数据库模型和连接
├── sla_engine.py     # 核心SLA计算和归因引擎
├── cli.py            # CLI命令实现
└── sample_data.py    # 内置样例数据
sla                   # 可执行脚本
requirements.txt      # 依赖列表
README.md             # 本文档
```

---

## 注意事项

1. **时间格式**: 支持多种时间格式，推荐使用 `YYYY-MM-DD HH:MM:SS`
2. **幂等性**: 导入时使用 `INSERT OR IGNORE`，相同ID的记录不会重复插入
3. **工作日期**: 自动排除周末和配置的节假日
4. **修正追溯**: 所有人工修改都会在 `corrections` 表中保留历史记录
