# 多仓库依赖升级许可延期管理排查CLI

一个用于管理多仓库依赖升级的命令行工具，支持负责人意见收集、延期申请管理、版本校验和许可清单导出。

## 功能特性

- 📦 **版本校验**: 语义化版本号自动校验，最低版本要求检查
- 👤 **负责人意见确认**: 收集和验证各仓库负责人的升级意见
- ⏳ **延期冲突检测**: 检测和管理延期申请，避免冲突
- 📊 **批次推进**: 按批次管理升级计划
- 📋 **许可清单导出**: 导出可升级仓库的许可清单
- 📁 **来源追踪**: 完整记录每条数据的来源文件位置
- ❌ **坏行保留**: 保留解析失败的原始数据，便于排查
- 🔄 **结果稳定**: 重复运行同一批材料结果稳定，不受排序影响

## 安装

```bash
pip install -e .
```

或安装依赖：

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 生成示例数据

```bash
dep-manage sample
```

这会在 `./sample_data` 目录下生成示例CSV文件。

### 2. 运行检查

```bash
dep-manage check \
  -r ./sample_data/repositories.csv \
  -d ./sample_data/dependencies.csv \
  -o ./sample_data/opinions.csv \
  -e ./sample_data/extensions.csv \
  -b ./sample_data/batches.csv
```

## 使用说明

### 命令行选项

```
dep-manage check [OPTIONS]

选项:
  -r, --repos PATH       仓库列表文件 (CSV/Excel)
  -d, --deps PATH        依赖包列表文件 (CSV/Excel)
  -o, --opinions PATH    负责人意见文件 (CSV/Excel)
  -e, --extensions PATH  延期申请文件 (CSV/Excel)
  -b, --batches PATH     升级批次文件 (CSV/Excel)
  -O, --output-dir PATH  输出目录 (默认: ./reports)
  -f, --format TEXT      输出格式: json/csv/xlsx/all (默认: all)
  -q, --quiet            静默模式
```

### 数据文件格式

#### 1. 仓库列表 (repositories.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| name | 仓库名称 | service-user |
| owner | 负责人 | 张三 |
| current_version | 当前版本号 | 1.2.3 |

#### 2. 依赖包列表 (dependencies.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| package_name | 包名 | commons-utils |
| target_version | 目标版本 | 2.0.0 |
| min_version | 最低要求版本 | 1.8.0 |

#### 3. 负责人意见 (opinions.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| repo_name | 仓库名称 | service-user |
| owner | 负责人 | 张三 |
| opinion | 意见类型 | 同意/不同意/需要延期/待定 |
| comment | 备注说明 | 已完成测试 |
| date | 日期 | 2024-01-15 |

#### 4. 延期申请 (extensions.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| repo_name | 仓库名称 | service-payment |
| owner | 负责人 | 王五 |
| requested_by | 申请人 | 王五 |
| reason | 原因 | 正在进行重构 |
| requested_date | 申请日期 | 2024-01-15 |
| new_target_date | 新目标日期 | 2024-02-15 |
| status | 状态 | 已批准/申请中/已拒绝 |

#### 5. 升级批次 (batches.csv)

| 列名 | 说明 | 示例 |
|------|------|------|
| batch_id | 批次ID | BATCH-001 |
| name | 批次名称 | 第一批次升级 |
| target_date | 目标日期 | 2024-02-01 |
| packages | 包含的包(逗号分隔) | commons-utils,security-core |
| status | 状态 | 规划中/进行中/已完成 |

## 输出说明

运行后会在输出目录生成以下文件：

| 文件 | 说明 |
|------|------|
| dep_report_*.json | 完整的JSON格式报告 |
| dep_report_*.csv | CSV格式的仓库详情 |
| dep_report_*.xlsx | Excel格式报告(包含多个sheet) |
| dep_report_license_*.json | 许可清单(仅包含可升级的仓库) |

Excel报告包含三个sheet：
- 摘要：统计概览
- 仓库详情：每个仓库的详细检查结果
- 坏行记录：解析失败的行

## 核心规则

1. **语义版本校验**：使用packaging库进行严格的版本号校验
2. **负责人确认**：只有当负责人明确同意时才能批准升级
3. **延期冲突检测**：有已批准或待审批延期申请的仓库不能升级
4. **批次推进**：检测仓库涉及的升级批次，确保计划一致
5. **结果排序**：所有输出按仓库名称排序，确保结果可重复

## 项目结构

```
dep_manage_cli/
├── __init__.py
├── cli.py              # CLI入口
├── models/             # 数据模型
│   ├── __init__.py
│   └── models.py
├── parsers/            # 文件解析器
│   ├── __init__.py
│   └── parser.py
├── engine/             # 规则引擎
│   ├── __init__.py
│   └── rules.py
├── tracker/            # 来源追踪
│   ├── __init__.py
│   └── source_tracker.py
└── reports/            # 报告生成
    ├── __init__.py
    └── reporter.py
```

## 许可

MIT License
