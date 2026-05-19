# 查询计划回归参数集合排查CLI

Query Plan Regression Checker - 用于数据库升级后查询计划对比和回归检测的命令行工具

## 功能特性

- ✅ **解析模块**: 支持JSON格式查询计划文件，保留坏行原文件位置
- ✅ **参数归一化**: 参数值标准化处理，支持类型检测和签名生成
- ✅ **规则判断**: 计划摘要对比、风险分级（CRITICAL/HIGH/MEDIUM/LOW/NONE）
- ✅ **确认状态**: 支持确认/驳回/需审核等状态
- ✅ **回归结论**: 自动判定回归/需调查/无回归/误报
- ✅ **来源追踪**: 记录解析错误位置和详情
- ✅ **报告生成**: 支持JSON/Excel/CSV/文本多种格式输出
- ✅ **结果稳定**: 按固定排序输出，重复运行结果一致

## 项目结构

```
query_plan_checker/
├── __init__.py          # 版本信息
├── models.py            # 数据模型定义
├── parser.py            # 解析模块
├── normalizer.py        # 参数归一化模块
├── rules.py             # 规则判断模块
├── reporter.py          # 报告生成模块
└── cli.py               # CLI入口
```

## 快速开始

### 安装依赖

```bash
pip3 install -r requirements.txt
```

### 基本使用

#### 1. 对比查询计划（检测回归）

```bash
python3 main.py check old_plans.json new_plans.json
```

#### 2. 生成报告

```bash
python3 main.py check old_plans.json new_plans.json -o reports
```

#### 3. 解析单个计划文件

```bash
python3 main.py parse plans.json -o result.json
```

#### 4. 查看帮助

```bash
python3 main.py --help
python3 main.py check --help
```

## 命令说明

### check 命令

对比新旧查询计划，检测回归。

**参数:**
- `old_plan_file`: 旧版本查询计划文件（必需）
- `new_plan_file`: 新版本查询计划文件（必需）

**选项:**
- `-o, --output-dir`: 报告输出目录
- `-n, --report-name`: 报告文件名前缀（默认: plan_regression_report）
- `-r, --min-risk-level`: 最小显示风险级别 [CRITICAL/HIGH/MEDIUM/LOW/NONE]
- `-q, --quiet`: 静默模式，不打印控制台摘要

**示例:**
```bash
# 只显示HIGH及以上级别风险
python3 main.py check old.json new.json -r HIGH

# 静默模式，只输出报告
python3 main.py check old.json new.json -o reports -q
```

### parse 命令

解析单个查询计划文件，验证格式。

**参数:**
- `plan_file`: 要解析的查询计划文件（必需）

**选项:**
- `-o, --output`: 输出解析结果到文件

## 风险分级规则

| 级别 | 说明 | 触发条件 |
|------|------|----------|
| CRITICAL | 严重回归 | 索引扫描变全表扫描 |
| HIGH | 高度风险 | 其他扫描方式退化 |
| MEDIUM | 中度风险 | 成本增长>300% 或行数大幅变化 |
| LOW | 低度风险 | 轻度成本增长或小变化 |
| NONE | 无变化 | 计划完全一致 |

## 查询计划文件格式

```json
[
  {
    "query_template": "SELECT * FROM users WHERE id = ?",
    "parameter_set": {"id": 123},
    "plan": {
      "Plan": {
        "Node Type": "Index Scan",
        "Index Name": "users_pkey",
        "Plan Rows": 1,
        "Total Cost": 0.28
      }
    },
    "db_version": "12.0",
    "generated_at": "2024-01-01T10:00:00"
  }
]
```

## 退出码

- `0`: 无回归
- `1`: 检测到回归
- `2`: 执行错误

## 测试数据

项目包含示例测试数据：
- `test_data/old_plans.json` - 旧版本计划
- `test_data/new_plans.json` - 新版本计划（包含1个严重回归，1个中度风险）

运行测试：
```bash
python3 main.py check test_data/old_plans.json test_data/new_plans.json -o reports
```

## 模块说明

### models.py
定义核心数据模型：
- `RiskLevel`: 风险级别枚举
- `ConfirmStatus`: 确认状态枚举
- `RegressionConclusion`: 回归结论枚举
- `SourceLocation`: 来源位置信息
- `PlanSummary`: 计划摘要数据
- `QueryPlan`: 查询计划数据
- `PlanComparison`: 对比结果
- `ParseError`: 解析错误
- `CheckResult`: 检查结果汇总

### parser.py
`PlanParser` 类：
- 支持JSON数组和行式JSON格式
- 保留文件位置信息
- 错误追踪和报告

### normalizer.py
`ParameterNormalizer` 类：
- 参数类型自动检测
- 参数值标准化
- 生成唯一签名
- 查询模板归一化

### rules.py
`RuleEngine` 类：
- 计划对比算法
- 风险评分计算
- 回归结论推导
- 稳定排序输出

### reporter.py
`SourceTracker` + `ReportGenerator` 类：
- 错误来源追踪
- 多格式报告生成
- Excel带样式输出
- 控制台摘要打印
