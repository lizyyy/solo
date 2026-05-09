# 异常运费巡检 CLI

本地命令行工具，用于检测同一批物流单多次改重、改路线后的运费差异。

## 功能特性

- **init**: 初始化项目目录，创建配置和数据库
- **import-shipments**: 导入物流单数据，支持幂等导入和坏数据留痕
- **audit**: 执行运费异常巡检
- **report**: 生成 Markdown 格式巡检报告
- **history**: 查看历史巡检记录
- **export**: 导出 CSV/Markdown 格式报告

## 快速开始

### 1. 安装

```bash
cd freight-audit
pip install -e .
```

或者直接运行：

```bash
cd freight-audit
python -m pip install -e .
```

### 2. 初始化项目

创建一个工作目录并初始化：

```bash
mkdir -p /tmp/freight-workspace
cd /tmp/freight-workspace
freight-audit init
```

查看生成的目录结构：

```bash
ls -la
cat config.yaml
```

### 3. 第一次导入（初始数据）

```bash
freight-audit import-shipments /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_1_initial.csv
```

预期输出：
- 读取到 5 条记录
- [新增] 5 条新物流单
- [更新] 0 条物流单
- [变更] 0 个字段变更
- [跳过] 0 条重复记录
- [错误] 0 条坏数据

### 4. 第一次巡检

```bash
freight-audit audit -n "第一次巡检 - 初始数据"
```

预期输出：
- 待巡检物流单: 5 个 (5 条版本记录)
- 发现少量异常（SH001 和 SH005 运费偏离标准）

### 5. 第二次导入（修改后的数据 - 测试变化检测）

```bash
freight-audit import-shipments /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv -b batch2_modified
```

预期输出：
- 读取到 5 条记录
- [新增] 2 条新物流单 (SH006, SH007)
- [更新] 3 条物流单 (SH001, SH002, SH003)
- [变更] 多个字段变更已记录
- [跳过] 0 条重复记录
- [错误] 0 条坏数据

### 6. 第二次巡检（检测修改后的差异）

```bash
freight-audit audit -n "第二次巡检 - 检测改重改路线"
```

预期输出：
- 待巡检物流单: 7 个 (10 条版本记录)
- 发现多个异常：
  - SH001: 重量从 10kg 改到 12kg，运费从 ¥80 涨到 ¥95
  - SH002: 路线从广州改到深圳，运费从 ¥120 涨到 ¥180
  - SH003: 重量从 25kg 降到 20kg，运费从 ¥150 降到 ¥130
  - 多个物流单存在多个版本

### 7. 生成报告

查看最新巡检报告：

```bash
freight-audit report
```

保存报告到文件：

```bash
freight-audit report --save
```

查看指定巡检报告（替换为实际的巡检 ID）：

```bash
freight-audit report -r 2
```

### 8. 测试幂等导入（重复导入同一份文件）

```bash
freight-audit import-shipments /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv
```

预期输出：
- 读取到 5 条记录
- [新增] 0 条新物流单
- [更新] 0 条物流单
- [变更] 0 个字段变更
- [跳过] 5 条重复记录 (相同 shipment_no + version)
- [错误] 0 条坏数据

**关键点：重复导入不会产生副作用**

### 9. 测试坏数据留痕

```bash
freight-audit import-shipments /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_3_with_bad_data.csv -b batch3_bad_data
```

预期输出：
- 读取到 6 条记录
- [新增] 1 条新物流单 (SH010)
- [更新] 2 条物流单 (SH001 已存在会被跳过, SH005 v2)
- [变更] 若干字段变更
- [跳过] 1 条重复记录 (SH001 v2)
- [错误] 3 条坏数据已留痕

坏数据详情：
- SH008: weight 必须是数字 (值为 'abc')
- 第 4 行: shipment_no 不能为空
- SH011: version 不能为空

### 10. 第三次巡检（包含坏数据后的完整状态）

```bash
freight-audit audit -n "第三次巡检 - 完整状态"
```

### 11. 查看历史记录

查看简要历史：

```bash
freight-audit history
```

查看详细历史：

```bash
freight-audit history --full
```

### 12. 导出报告

导出 CSV 格式：

```bash
freight-audit export /tmp/freight-report.csv
```

导出 CSV 并包含变更记录：

```bash
freight-audit export /tmp/freight-report.csv --include-changes
```

导出 Markdown 格式：

```bash
freight-audit export /tmp/freight-report.md -f markdown
```

检查导出的文件：

```bash
ls -la /tmp/freight-report*
```

## 完整命令流程

```bash
# 1. 安装
cd freight-audit && pip install -e .

# 2. 初始化项目
mkdir -p /tmp/freight-workspace && cd /tmp/freight-workspace
freight-audit init

# 3. 导入初始数据
freight-audit import-shipments examples/batch_1_initial.csv

# 4. 第一次巡检
freight-audit audit -n "初始巡检"

# 5. 导入修改后的数据
freight-audit import-shipments examples/batch_2_modified.csv

# 6. 第二次巡检（检测改重改路线差异）
freight-audit audit -n "修改后巡检"

# 7. 查看报告
freight-audit report

# 8. 测试幂等导入
freight-audit import-shipments examples/batch_2_modified.csv

# 9. 导入含坏数据的批次
freight-audit import-shipments examples/batch_3_with_bad_data.csv

# 10. 第三次巡检
freight-audit audit -n "完整巡检"

# 11. 查看历史
freight-audit history

# 12. 导出报告
freight-audit export report.csv --include-changes
freight-audit export report.md -f markdown
```

## 配置说明

`config.yaml` 配置项：

```yaml
import:
  required_columns: [shipment_no, version]
  optional_columns: [weight, original_weight, route, original_route, freight_fee, standard_fee, shipper, receiver]
  encoding: utf-8
  delimiter: ','

audit:
  fee_tolerance_percent: 5.0          # 相对误差阈值百分比
  fee_tolerance_absolute: 10.0        # 绝对误差阈值
  tracked_fields:                     # 追踪变更的字段
    - weight
    - original_weight
    - route
    - original_route
    - freight_fee
  severity_thresholds:                # 严重程度阈值（费用差异）
    high: 50.0
    medium: 20.0
    low: 0.0

report:
  output_dir: reports                 # 报告输出目录
  default_format: markdown
```

## 异常检测类型

| 类型 | 说明 |
|------|------|
| multiple_versions | 同一物流单存在多个版本 |
| weight_change | 版本间重量变更 |
| route_change | 版本间路线变更 |
| fee_change | 版本间运费变更 |
| fee_deviation | 实际运费偏离标准运费 |

## 目录结构

```
project-dir/
├── config.yaml           # 配置文件
├── data/
│   └── freight_audit.db  # SQLite 数据库
├── reports/              # 报告输出目录
│   └── *.md              # 生成的 Markdown 报告
└── ...
```

## 数据库表结构

- `shipments`: 物流单主表（按版本存储）
- `shipment_changelog`: 字段变更记录
- `bad_records`: 导入失败的坏数据留痕
- `audit_runs`: 巡检运行记录
- `audit_findings`: 巡检发现的异常详情

## 命令参考

```bash
# 查看帮助
freight-audit --help
freight-audit init --help
freight-audit import-shipments --help
freight-audit audit --help
freight-audit report --help
freight-audit history --help
freight-audit export --help
```
