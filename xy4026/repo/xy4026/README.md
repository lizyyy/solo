# 离线闸口对账器

线下展会检票组专用的本地命令行对账工具。展会现场网络经常不稳，几个入口的扫码枪只能各自导出 CSV，散场后需要把入场、退场和二次入场记录合在一起对账。

## 功能特性

- ✅ **设备时间修正**：自动修正各设备的时间漂移
- ✅ **重复扫码合并**：90秒内同一设备重复扫码自动合并
- ✅ **异常检测**：识别以下异常情况：
  - 未知票（不在票务名单中）
  - 黑名单票入场
  - 票种与入口不匹配
  - 先退场后入场
  - 普通票重复入场
  - 同一票多人同时扫码（疑似复制票）
  - 日志坏行
- ✅ **隔离区机制**：无法自动处理的记录放入 `quarantine.json`，不会静默丢失
- ✅ **报告导出**：Markdown 复盘报告 + CSV 异常清单
- ✅ **历史查询**：按日期、入口、异常类型查询历史对账结果

## 项目结构

```
offline_gate_reconciler/
├── __init__.py
├── cli.py              # CLI 入口
├── config.py           # 配置管理（init 命令）
├── csv_parser.py     # CSV 解析器
├── models.py         # 数据模型和异常类型
├── rules.py          # 规则引擎
├── reconciler.py     # 对账状态机（核心逻辑）
├── quarantine.py     # 隔离区管理
├── storage.py        # 存储层（JSON 台账、历史记录）
└── report.py         # 报告导出

sample_data/              # 示例数据
├── roster.csv           # 票务名单示例
├── log_device1_A1.csv  # 设备1（A1入口）日志
└── log_device2_A2.csv  # 设备2（A2入口）日志

tests/                   # 测试用例
└── test_core.py

setup.py
requirements.txt
README.md
```

## 安装

### 环境要求

- Python 3.9+

### 安装步骤

```bash
# 克隆或下载项目到本地
cd xy4026

# 安装依赖
pip install -r requirements.txt

# 安装为可执行命令
pip install -e .
```

安装完成后，可以使用 `gate-reconciler` 命令：

```bash
gate-reconciler --help
```

## 快速开始

### 1. 初始化项目

```bash
# 创建一个临时目录用于测试
mkdir -p /tmp/expo-test
cd /tmp/expo-test

# 初始化项目
gate-reconciler init --name "2026春季展会" --date "2026-05-01" --reentry-types "VIP"
```

这会创建以下目录结构：

```
expo-test/
├── reconciler-config.json    # 配置文件
├── data/
│   ├── rosters/             # 票务名单存储
│   └── logs/                # 扫码日志存储
├── output/
│   ├── reports/            # 报告输出
│   └── ledgers/            # 台账输出
├── history/                # 历史记录
└── quarantine/           # 隔离区
```

### 2. 导入票务名单

使用项目提供的示例数据：

```bash
# 从项目目录导入示例名单
gate-reconciler import-roster /Users/mac/pro/solocoder/pro/xy4026/repo/xy4026/sample_data/roster.csv
```

**票务名单 CSV 字段说明**：

| 字段 | 说明 | 示例 |
|------|------|------|
| 票号 | 唯一标识 | T001 |
| 姓名 | 持票人姓名 | 张三 |
| 手机号后四位 | 用于验证 | 1234 |
| 票种 | VIP/普通/媒体等 | VIP |
| 允许入口 | 逗号分隔，用引号包裹 | "A1,A2" |
| 是否黑名单 | 是/否 | 否 |

### 3. 导入扫码日志

导入多台设备的日志：

```bash
# 导入设备1日志（A1入口）
gate-reconciler import-log /Users/mac/pro/solocoder/pro/xy4026/repo/xy4026/sample_data/log_device1_A1.csv

# 导入设备2日志（A2入口）
gate-reconciler import-log /Users/mac/pro/solocoder/pro/xy4026/repo/xy4026/sample_data/log_device2_A2.csv
```

**扫码日志 CSV 字段说明**：

| 字段 | 说明 | 示例 |
|------|------|------|
| 设备号 | 扫码枪编号 | DEV001 |
| 入口 | 闸口标识 | A1 |
| 时间戳 | 扫码时间 | 2026-05-01 09:00:00 |
| 票号 | 扫描的票号 | T001 |
| 动作 | 入场/退场/二次入场 | 入场 |
| 操作员 | 操作员工号/姓名 | 操作员甲 |

**动作类型支持的中文/英文别名**：
- 入场：入场、进场、进入、entry
- 退场：退场、离场、离开、exit
- 二次入场：二次入场、再次入场、reentry

### 4. 执行对账

```bash
gate-reconciler reconcile
```

对账过程会：

1. 加载所有已导入的票务名单和扫码日志
2. 修正各设备的时间偏移
3. 按时间排序生成可信时间线
4. 合并90秒内的重复扫码
5. 检测各种异常
6. 生成台账、报告和异常清单

### 5. 查看输出结果

对账完成后，输出文件位于 `output/` 目录：

```
output/
├── reports/
│   ├── report_2026-05-01_*.md      # Markdown 复盘报告
│   └── anomalies_2026-05-01_*.csv   # CSV 异常清单
└── ledgers/
    └── ledger_2026-05-01_*.json      # 清洗后的 JSON 台账
```

**查看报告**：

```bash
# 查看生成的 Markdown 报告
cat output/reports/report_*.md
```

**导出台账**：

```bash
# 导出完整台账到指定位置
gate-reconciler export-ledger -o /tmp/my-ledger.json
```

### 6. 查询历史记录

```bash
# 查看所有历史对账记录
gate-reconciler history

# 按日期筛选
gate-reconciler history --date "2026-05-01"

# 按异常类型筛选
gate-reconciler history --anomaly-type "blacklisted"
```

### 7. 管理隔离区

```bash
# 查看隔离区统计
gate-reconciler quarantine

# 列出未处理的隔离条目
gate-reconciler quarantine --list

# 标记条目为已处理
gate-reconciler quarantine --resolve "条目ID" --resolution "人工核实后放行"
```

## 完整示例流程

以下是一个完整的测试流程，使用项目提供的示例数据：

```bash
#!/bin/bash

# 1. 创建测试目录
TEST_DIR="/tmp/expo-demo"
rm -rf "$TEST_DIR"
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# 2. 初始化项目
echo "=== 初始化项目 ==="
gate-reconciler init \
    --name "2026春季展会测试" \
    --date "2026-05-01" \
    --reentry-types "VIP"

# 3. 导入票务名单
echo ""
echo "=== 导入票务名单 ==="
PROJECT_DIR="/Users/mac/pro/solocoder/pro/xy4026/repo/xy4026"
gate-reconciler import-roster "$PROJECT_DIR/sample_data/roster.csv"

# 4. 导入扫码日志
echo ""
echo "=== 导入扫码日志 ==="
gate-reconciler import-log \
    "$PROJECT_DIR/sample_data/log_device1_A1.csv" \
    "$PROJECT_DIR/sample_data/log_device2_A2.csv"

# 5. 执行对账
echo ""
echo "=== 执行对账 ==="
gate-reconciler reconcile

# 6. 查看结果
echo ""
echo "=== 查看生成的报告 ==="
cat output/reports/report_*.md

# 7. 查询历史
echo ""
echo "=== 历史记录 ==="
gate-reconciler history

# 8. 查看隔离区
echo ""
echo "=== 隔离区状态 ==="
gate-reconciler quarantine

echo ""
echo "=== 测试完成！"
echo "输出文件位于: $TEST_DIR/output/"
```

## 配置说明

项目配置保存在 `reconciler-config.json` 中，可以手动编辑或通过命令修改。

### 配置项说明

```json
{
  "project_name": "2026春季展会",
  "event_date": "2026-05-01",
  "reentry_allowed_ticket_types": ["VIP"],
  "device_time_offsets": [
    {"device_id": "DEV001", "offset_seconds": 60},
    {"device_id": "DEV002", "offset_seconds": -30}
  ],
  "entry_rules": [
    {
      "entry_id": "A1",
      "entry_name": "主入口",
      "allowed_ticket_types": ["VIP", "普通"],
      "is_vip_only": false
    },
    {
      "entry_id": "A2",
      "entry_name": "VIP入口",
      "allowed_ticket_types": ["VIP"],
      "is_vip_only": true
    }
  ],
  "duplicate_scan_window_seconds": 90,
  "ticket_types": {
    "VIP": "VIP票",
    "普通": "普通票"
  }
}
```

### 设备时间偏移

`offset_seconds` 表示设备时间与真实时间的偏差：

- **正数**：设备时间比真实时间快（需要减去偏移）
- **负数**：设备时间比真实时间慢（需要加上偏移）

例如：
- `offset_seconds: 60 → 设备显示 09:01:00，实际是 09:00:00
- offset_seconds: -30 → 设备显示 08:59:30，实际是 09:00:00

## 异常类型说明

| 异常类型 | 说明 | 严重程度 |
|----------|------|----------|
| unknown_ticket | 未知票（不在票务名单中） | 错误 |
| blacklisted | 黑名单票入场 | 严重 |
| wrong_entry | 票种与入口不匹配 | 错误 |
| exit_before_entry | 先退场后入场 | 错误 |
| duplicate_entry | 普通票重复入场 | 错误 |
| simultaneous_scan | 同一票多人同时扫码（疑似复制票） | 严重 |
| bad_row | 日志坏行（解析失败） | 警告 |
| invalid_action_order | 无效的动作顺序 | 错误 |
| reentry_not_allowed | 票种不允许二次入场 | 错误 |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/test_core.py::TestConfig -v
```

## 命令参考

### init
初始化项目配置。

**选项**：
- `--name, -n`：项目名称（必填）
- `--date, -d`：展会日期，格式 YYYY-MM-DD（必填）
- `--reentry-types, -r`：允许二次入场的票种（可多次指定）

### import-roster
导入票务名单 CSV。

**参数**：
- `CSV_FILE`：CSV 文件路径

**选项**：
- `--name, -n`：名单名称（默认使用文件名）

### import-log
导入扫码日志 CSV（可一次导入多个文件）。

**参数**：
- `CSV_FILES`：一个或多个 CSV 文件路径

**选项**：
- `--name, -n`：日志名称前缀

### reconcile
执行对账。

### report
导出复盘报告和异常清单。

**选项**：
- `--format, -f`：输出格式，可选 md、csv、all（默认 all）

### export-ledger
导出清洗后的 JSON 台账。

**选项**：
- `--output, -o`：输出文件路径（不指定则显示摘要）

### history
查询历史对账结果。

**选项**：
- `--date, -d`：按日期筛选
- `--entry, -e`：按入口筛选
- `--anomaly-type, -a`：按异常类型筛选

### quarantine
管理隔离区。

**选项**：
- `--list, -l`：列出未处理的隔离条目
- `--resolve, -r`：标记指定 ID 的条目为已处理
- `--resolution, -m`：处理说明（配合 --resolve 使用）

## 常见问题

### Q: 如何处理设备时间不一致？

A: 在配置文件的 `device_time_offsets` 中设置各设备的时间偏移。对账时会自动修正所有日志的时间戳。

### Q: 如何添加新的入口规则？

A: 编辑 `reconciler-config.json`，在 `entry_rules` 数组中添加新的入口配置，或使用配置管理器的 API。

### Q: 隔离区的记录会被保留多久？

A: 隔离区的记录会一直保留，直到手动标记为已处理并清理。使用 `gate-reconciler quarantine` 命令管理。

### Q: 如何处理未知票？

A: 未知票会被记录为异常，但不会影响其他票的对账。可以在隔离区中查看详情，人工核实后再做处理。

## 许可证

MIT License
