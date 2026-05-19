# 采样预算Trace标签规则排查CLI工具

## 项目概述

这是一个用于日志平台采样预算和Trace标签规则管理的命令行工具，帮助解决月底预算调整和采样规则排查问题。

## 核心功能

### 1. 采样预算扣减
- 按服务和日期管理每日采样预算
- 实时扣减预算，防止超采
- 支持预算预留机制

### 2. 标签匹配规则
- 支持多种匹配模式：精确匹配、前缀匹配、存在匹配
- 规则优先级排序
- 按规则配置采样率

### 3. 调整审批流程
- 支持预算调整申请
- 支持规则参数调整申请
- 完整的审批流程（待审批、已批准、已拒绝）

### 4. 幂等性保障
- 基于幂等键防止重复提交
- 确保调整申请的一致性

### 5. 双重输出报告
- 人类可读格式：友好的文本报告
- 机器可读格式：JSON格式，便于系统集成

## 项目结构

```
.
├── trace_sampler/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型定义
│   └── engine.py            # 核心业务逻辑引擎
├── cli.py                   # 命令行接口
├── requirements.txt         # 依赖列表
├── demo.sh                  # 功能演示脚本
├── test_demo.py             # Python测试脚本
└── README.md                # 项目文档
```

## 安装依赖

```bash
pip install click pydantic rich
```

## 使用说明

### 1. 创建服务预算

```bash
python cli.py create-budget <service-name> <daily-budget> [--date YYYY-MM-DD]
```

示例：
```bash
python cli.py create-budget order-service 1000
```

### 2. 创建采样规则

```bash
python cli.py create-rule <rule-id> <service-name> <tag-key> \
    [--tag-value <value>] \
    [--match-type exact|prefix|regex|exists] \
    [--priority <0-100>] \
    [--sampling-rate <0-1>] \
    [--created-by <user>]
```

示例：
```bash
python cli.py create-rule error-high order-service level ERROR \
    --priority 100 --sampling-rate 1.0
```

### 3. 采样决策

```bash
python cli.py decide <trace-id> <service-name> [--tag key=value...]
```

示例：
```bash
python cli.py decide trace-001 order-service \
    --tag level=ERROR --tag operation=create_order
```

### 4. 调整申请

```bash
python cli.py request-adjustment <request-id> <service-name> <requester> \
    <reason> <adjustment-type> <old-value> <new-value> <idempotency-key>
```

示例：
```bash
python cli.py request-adjustment adj-001 order-service zhangsan \
    "大促流量突增" BUDGET_INCREASE 1000 2000 idem-key-001
```

### 5. 审批调整

```bash
python cli.py approve <request-id> <approver>
python cli.py reject <request-id> <approver>
```

### 6. 生成预算报告

```bash
python cli.py report <service-name> \
    [--date YYYY-MM-DD] \
    [--format human|json|both] \
    [--output <file>]
```

示例：
```bash
python cli.py report order-service --format both --output report.json
```

### 7. 查看列表

```bash
python cli.py list-services              # 查看所有服务
python cli.py list-rules [--service <name>]  # 查看采样规则
python cli.py list-adjustments [--service <name>] [--status <status>]
```

## 测试场景

### 正常输入场景
- 创建预算、规则、调整申请
- 正常的采样决策流程

### 脏数据场景
- 重复创建预算（应该失败）
- 无效的参数输入

### 边界冲突场景
- 预算耗尽后的采样决策
- 无预算配置的服务

### 空结果场景
- 查询不存在的服务规则
- 查询无调整申请的服务

## 运行演示

### Bash脚本演示
```bash
chmod +x demo.sh
./demo.sh
```

### Python测试脚本
```bash
python3 test_demo.py
```

## 数据存储

所有数据以JSON格式存储在`./data`目录下：
- `budgets.json` - 预算数据
- `rules.json` - 规则配置
- `adjustments.json` - 调整申请
- `decisions.json` - 采样决策记录

## 核心模型说明

### SamplingBudget (采样预算)
- service_name: 服务名称
- daily_budget: 日预算总额
- used_budget: 已使用预算
- reserved_budget: 已预留预算
- date: 预算日期

### TagRule (标签规则)
- rule_id: 规则ID
- service_name: 服务名称
- tag_key: 标签键
- tag_value: 标签值（可选）
- match_type: 匹配类型
- priority: 优先级
- sampling_rate: 采样率
- is_active: 是否启用

### AdjustmentRequest (调整申请)
- request_id: 申请ID
- service_name: 服务名称
- requester: 申请人
- reason: 申请原因
- adjustment_type: 调整类型
- old_value: 原值
- new_value: 新值
- status: 状态（pending/approved/rejected）
- idempotency_key: 幂等键

## 验收标准

1. ✅ 正常输入场景测试通过
2. ✅ 脏数据场景正确处理
3. ✅ 边界冲突场景正确处理
4. ✅ 空结果场景正确处理
5. ✅ 机器可读输出与人类可读报告数据一致性
6. ✅ 幂等性功能正常工作
7. ✅ 预算扣减逻辑正确
8. ✅ 审批流程完整
