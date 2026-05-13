# 异常运费巡检 CLI

本地命令行工具，用于检测同一批物流单多次改重、改路线后的运费差异。

## 功能特性

- **init**: 初始化项目目录，创建配置和数据库
- **import-shipments**: 导入物流单数据，支持幂等导入和坏数据留痕
- **audit**: 执行运费异常巡检
- **report**: 生成 Markdown 格式巡检报告
- **history**: 查看历史巡检记录
- **export**: 导出 CSV/Markdown 格式报告

## 项目路径

请确保使用正确的路径（复制此项目时请替换为你的实际路径）：

- **项目源码目录**: `/Users/mac/pro/solo/workspaces/xy10151/freight-audit`
- **示例数据目录**: `/Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples`
- **工作目录示例**: `/tmp/freight-workspace`

## 快速开始

### 1. 安装

```bash
cd /Users/mac/pro/solo/workspaces/xy10151/freight-audit
python3 -m pip install -e .
```

安装后可执行命令：`/Users/mac/Library/Python/3.9/bin/freight-audit`

> 提示：可以将 `export PATH="/Users/mac/Library/Python/3.9/bin:$PATH"` 添加到 `~/.zshrc` 或 `~/.bashrc`

### 2. 初始化项目

创建一个工作目录并初始化：

```bash
mkdir -p /tmp/freight-workspace
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit init
```

预期输出：
```
[信息] 配置加载成功 (Hash: aa9ea4b5...)
项目目录: /private/tmp/freight-workspace
==================================================
[成功] 创建配置文件: /private/tmp/freight-workspace/config.yaml
[成功] 初始化数据库: /private/tmp/freight-workspace/data/freight_audit.db
[成功] 创建报告目录: /private/tmp/freight-workspace/reports
==================================================
```

查看生成的目录结构：

```bash
ls -la /tmp/freight-workspace
cat /tmp/freight-workspace/config.yaml
```

### 3. 第一次导入（初始数据）

使用绝对路径导入示例数据：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_1_initial.csv
```

预期输出：
```
[信息] 配置加载成功 (Hash: aa9ea4b5...)
导入文件: /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_1_initial.csv
批次名称: batch_20260513_XXXXXX
编码: utf-8
============================================================
读取到 5 条记录
------------------------------------------------------------
[新增] 5 条新物流单
[更新] 0 条物流单 (新版本)
[变更] 0 个字段变更已记录
[跳过] 0 条重复记录 (相同 shipment_no + version)
[错误] 0 条坏数据已留痕
============================================================
```

### 4. 第一次巡检

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "第一次巡检 - 初始数据"
```

预期输出：
```
[信息] 配置加载成功 (Hash: aa9ea4b5...)
开始巡检
配置 Hash: aa9ea4b582d56b4c1bbf3c0fe313c7d1
============================================================
待巡检物流单: 5 个 (5 条版本记录)
------------------------------------------------------------
巡检结果 (ID: 1):
...
```

### 5. 第二次导入（修改后的数据 - 测试变化检测）

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv \
  -b batch2_modified
```

预期输出：
```
[新增] 2 条新物流单
[更新] 3 条物流单 (新版本)
[变更] 6 个字段变更已记录
```

### 6. 第二次巡检（检测修改后的差异）

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "第二次巡检 - 检测改重改路线"
```

预期会发现以下异常：
- SH001: 重量 10kg→12kg，运费 ¥80→¥95
- SH002: 路线 广州→深圳，运费 ¥120→¥180（高严重）
- SH003: 重量 25kg→20kg，运费 ¥150→¥130

### 7. 生成报告

查看最新巡检报告：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit report
```

保存报告到文件：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit report --save
```

查看指定巡检报告（替换为实际的巡检 ID）：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit report -r 2
```

### 8. 测试幂等导入（重复导入同一份文件）

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv
```

预期输出（5 条全部跳过，无副作用）：
```
[新增] 0 条新物流单
[更新] 0 条物流单 (新版本)
[变更] 0 个字段变更已记录
[跳过] 5 条重复记录 (相同 shipment_no + version)
```

### 9. 测试坏数据留痕

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_3_with_bad_data.csv \
  -b batch3_bad_data
```

预期输出：
```
[新增] 1 条新物流单
[更新] 1 条物流单 (新版本)
[变更] 2 个字段变更已记录
[跳过] 1 条重复记录
[错误] 3 条坏数据已留痕
============================================================
坏数据详情:
  第 3 行: weight 必须是数字
  第 4 行: shipment_no 不能为空
  第 6 行: version 不能为空
```

### 10. 测试配置变化反馈（重要！）

**场景：用户修改了 `config.yaml`，重跑时应该能看到清楚的反馈**

#### 10.1 先查看当前配置状态

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "使用默认配置"
```

注意观察输出中的配置 Hash。

#### 10.2 修改配置文件

修改 `/tmp/freight-workspace/config.yaml`，调整严重程度阈值：

```bash
cat > /tmp/freight-workspace/config.yaml << 'EOF'
import:
  required_columns:
    - shipment_no
    - version
  encoding: utf-8
  delimiter: ','

audit:
  fee_tolerance_percent: 10.0
  fee_tolerance_absolute: 20.0
  severity_thresholds:
    high: 100.0
    medium: 50.0
    low: 10.0

report:
  output_dir: reports
  default_format: markdown
EOF
```

#### 10.3 使用 verbose 模式验证配置变化

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit -v audit -n "使用修改后配置"
```

**预期会看到配置变化的清楚反馈**：
```
[信息] 配置加载成功 (Hash: XXXXXXXX...)
[信息] 检测到自定义配置:
       ~ audit.fee_tolerance_percent: 5.0 -> 10.0
       ~ audit.fee_tolerance_absolute: 10.0 -> 20.0
       ~ audit.severity_thresholds.high: 50.0 -> 100.0
       ~ audit.severity_thresholds.medium: 20.0 -> 50.0
       ~ audit.severity_thresholds.low: 0.0 -> 10.0
```

#### 10.4 对比两次巡检结果

观察配置变化前后的巡检差异：
- 配置 Hash 不同
- 异常数量可能变化（因为阈值调整了）

#### 10.5 测试配置文件错误场景

故意破坏配置文件格式，验证错误反馈：

```bash
echo "invalid yaml ::: ::: :::" > /tmp/freight-workspace/config.yaml

cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "测试配置错误"
```

**预期会看到清楚的错误反馈**：
```
[警告] 配置文件解析错误: 第 1 行: 键值对格式错误
       使用默认配置运行
```

恢复正确配置：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit init --force
```

### 11. 查看历史记录

查看简要历史：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit history
```

查看详细历史：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit history --full
```

### 12. 导出报告

导出 CSV 格式：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit export /tmp/freight-report.csv
```

导出 CSV 并包含变更记录和坏数据：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit export /tmp/freight-report.csv --include-changes
```

导出 Markdown 格式：

```bash
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit export /tmp/freight-report.md -f markdown
```

检查导出的文件：

```bash
ls -la /tmp/freight-report*
head -10 /tmp/freight-report.csv
```

## 完整命令流程（可一步一步复制执行）

> 注意：请将 `/Users/mac/pro/solo/workspaces/xy10151/freight-audit` 替换为你的实际项目路径

```bash
# ========== 1. 安装 ==========
cd /Users/mac/pro/solo/workspaces/xy10151/freight-audit
python3 -m pip install -e .

# ========== 2. 初始化项目 ==========
rm -rf /tmp/freight-workspace
mkdir -p /tmp/freight-workspace
cd /tmp/freight-workspace
/Users/mac/Library/Python/3.9/bin/freight-audit init

# ========== 3. 导入初始数据 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_1_initial.csv

# ========== 4. 第一次巡检 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "初始巡检"

# ========== 5. 导入修改后的数据 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv \
  -b batch2_modified

# ========== 6. 第二次巡检（检测改重改路线差异） ==========
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "修改后巡检"

# ========== 7. 测试幂等导入 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_2_modified.csv

# ========== 8. 导入含坏数据的批次（测试坏数据留痕） ==========
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments \
  /Users/mac/pro/solo/workspaces/xy10151/freight-audit/examples/batch_3_with_bad_data.csv \
  -b batch3_bad

# ========== 9. 第三次巡检 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit audit -n "完整巡检"

# ========== 10. 测试配置变化反馈（关键验证点！） ==========
# 记录当前配置 Hash
/Users/mac/Library/Python/3.9/bin/freight-audit -v audit -n "配置变化前"

# 修改配置
cat > /tmp/freight-workspace/config.yaml << 'EOF'
import:
  required_columns:
    - shipment_no
    - version
  encoding: utf-8
  delimiter: ','

audit:
  fee_tolerance_percent: 10.0
  fee_tolerance_absolute: 20.0
  severity_thresholds:
    high: 100.0
    medium: 50.0
    low: 10.0

report:
  output_dir: reports
  default_format: markdown
EOF

# 验证配置变化能被检测到
/Users/mac/Library/Python/3.9/bin/freight-audit -v audit -n "配置变化后"

# ========== 11. 查看历史 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit history

# ========== 12. 查看和保存报告 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit report
/Users/mac/Library/Python/3.9/bin/freight-audit report --save

# ========== 13. 导出报告 ==========
/Users/mac/Library/Python/3.9/bin/freight-audit export /tmp/final_report.csv --include-changes
/Users/mac/Library/Python/3.9/bin/freight-audit export /tmp/final_report.md -f markdown
```

## 验证点清单

| # | 验证项 | 预期结果 |
|---|--------|----------|
| 1 | `init` 命令 | 成功创建 config.yaml、data/、reports/ |
| 2 | 第一次 import | 新增 5 条物流单 |
| 3 | 第一次 audit | 巡检 ID=1，0 或少量异常 |
| 4 | 第二次 import | 新增 2 条，更新 3 条，6 个字段变更 |
| 5 | 第二次 audit | 巡检 ID=2，发现 12 条异常（含改重改路线） |
| 6 | 幂等导入测试 | 5 条全部跳过，无副作用 |
| 7 | 坏数据测试 | 3 条坏数据留痕，清楚显示错误原因 |
| 8 | verbose 模式 | 显示配置 Hash 和自定义配置差异 |
| 9 | 配置变化重跑 | 配置 Hash 变化，verbose 模式显示差异 |
| 10 | 配置错误场景 | 黄色警告，显示具体错误行号，回退默认配置 |
| 11 | report 命令 | 生成 Markdown 格式报告 |
| 12 | history 命令 | 显示多次巡检历史，配置 Hash 不同 |
| 13 | export CSV | 导出异常记录（含变更记录和坏数据） |
| 14 | export Markdown | 导出 Markdown 格式报告 |

## 配置说明

`config.yaml` 配置项：

```yaml
import:
  required_columns: [shipment_no, version]
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
- `audit_runs`: 巡检运行记录（含配置 Hash）
- `audit_findings`: 巡检发现的异常详情

## 命令参考

```bash
# 查看帮助
/Users/mac/Library/Python/3.9/bin/freight-audit --help
/Users/mac/Library/Python/3.9/bin/freight-audit init --help
/Users/mac/Library/Python/3.9/bin/freight-audit import-shipments --help
/Users/mac/Library/Python/3.9/bin/freight-audit audit --help
/Users/mac/Library/Python/3.9/bin/freight-audit -v audit --help   # 显示配置变化
/Users/mac/Library/Python/3.9/bin/freight-audit report --help
/Users/mac/Library/Python/3.9/bin/freight-audit history --help
/Users/mac/Library/Python/3.9/bin/freight-audit export --help
```
