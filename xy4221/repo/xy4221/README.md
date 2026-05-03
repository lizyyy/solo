# 临电负载对账员 (Power Checker)

剧场演出搭建临时电力负载对账工具，用于校验配电箱导出的电流日志与班组手填的设备上电/下电记录是否一致。

## 功能特性

- 📥 **数据导入**: 支持导入配电箱CSV电流日志和设备上电/下电计划
- ✅ **数据校验**: 自动校验缺字段、时间格式、回路编号、单位和重复记录，坏行进隔离
- 🔍 **智能分析**: 
  - 按回路和时间窗计算峰值负载
  - 检测持续超载
  - 检测三相不平衡
  - 检测计划外上电
  - 检测人工/仪表时间偏差
- 👁️ **风险复核**: 可确认或忽略风险
- 📄 **报告导出**: 导出Markdown复核报告和CSV风险清单

## 安装

### 环境要求
- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或下载项目到本地
cd power-checker

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

验证安装：
```bash
power-checker --version
power-checker --help
```

## 快速开始

### 1. 初始化项目

```bash
# 创建新项目
power-checker init --name "某演唱会现场"
```

这会创建：
- `.power_checker.json` - 项目配置文件
- `.power_data/` - 数据存储目录

### 2. 配置回路信息

编辑 `.power_checker.json` 文件，配置实际的供电回路：

```json
{
  "project_name": "某演唱会现场",
  "show_name": "2024巡回演唱会",
  "date": "2024-05-15",
  "circuits": [
    {
      "id": "A1",
      "name": "主舞台灯光",
      "phase": "A",
      "rated_current": 32.0,
      "max_current": 40.0
    },
    {
      "id": "A2",
      "name": "侧舞台灯光",
      "phase": "A",
      "rated_current": 32.0,
      "max_current": 40.0
    },
    {
      "id": "B1",
      "name": "音响系统",
      "phase": "B",
      "rated_current": 32.0,
      "max_current": 40.0
    },
    {
      "id": "B2",
      "name": "视频系统",
      "phase": "B",
      "rated_current": 32.0,
      "max_current": 40.0
    },
    {
      "id": "C1",
      "name": "机械系统",
      "phase": "C",
      "rated_current": 32.0,
      "max_current": 40.0
    },
    {
      "id": "C2",
      "name": "备用回路",
      "phase": "C",
      "rated_current": 32.0,
      "max_current": 40.0
    }
  ],
  "time_window_minutes": 5,
  "overload_threshold_pct": 110.0,
  "phase_imbalance_threshold_pct": 15.0,
  "time_deviation_seconds": 300
}
```

### 3. 准备数据文件

#### 电流日志 CSV 格式

从配电箱导出的电流日志，格式如下：

```csv
timestamp,circuit_id,current,unit,phase,voltage,power_factor
2024-05-15 14:00:00,A1,25.5,A,A,220,0.95
2024-05-15 14:01:00,A1,26.2,A,A,220,0.94
2024-05-15 14:00:00,A2,18.3,A,A,220,0.95
```

**必填字段**:
- `timestamp`: 时间戳
- `circuit_id`: 回路编号（必须与配置一致）
- `current`: 电流值

**可选字段**:
- `unit`: 单位 (A/kW/W，默认A)
- `phase`: 相序 (A/B/C)
- `voltage`: 电压
- `power_factor`: 功率因数

#### 设备计划 CSV 格式

班组手填的设备上电/下电计划：

```csv
circuit_id,device_name,device_id,power_on_time,power_off_time,expected_current,unit
A1,主舞台追光灯,LIGHT-001,2024-05-15 13:55:00,2024-05-15 14:30:00,25,A
A1,主舞台LED屏,LIGHT-002,2024-05-15 14:10:00,2024-05-15 14:45:00,10,A
A2,侧舞台面光灯,LIGHT-003,2024-05-15 14:00:00,2024-05-15 14:30:00,18,A
```

**必填字段**:
- `circuit_id`: 回路编号
- `device_name`: 设备名称
- `device_id`: 设备编号

**可选字段**:
- `power_on_time`: 上电时间
- `power_off_time`: 下电时间
- `expected_current`: 预期电流
- `unit`: 单位

### 4. 导入数据

```bash
# 导入电流日志
power-checker import-log examples/sample_log.csv

# 导入设备计划
power-checker import-plan examples/sample_plan.csv
```

如果数据有问题，异常行会被隔离到 `.power_data/quarantine/` 目录。

### 5. 执行分析

```bash
# 使用配置的时间窗口（默认5分钟）
power-checker analyze

# 或指定时间窗口
power-checker analyze --window 10
```

分析内容包括：
- 各回路峰值负载
- 持续超载检测
- 三相不平衡检测
- 计划外上电检测
- 时间偏差检测

### 6. 复核风险

```bash
# 列出所有风险
power-checker review
power-checker review --list

# 查看特定风险详情
power-checker review -r <risk_id>

# 确认风险（确认是真实问题）
power-checker review -r <risk_id> --confirm

# 忽略风险（确认是误报）
power-checker review -r <risk_id> --ignore

# 带备注
power-checker review -r <risk_id> --confirm --note "已确认是灯光设备正常启动电流"
```

### 7. 导出报告

```bash
# 导出所有格式（Markdown + CSV）
power-checker export -o report

# 仅导出Markdown
power-checker export -o report -f md

# 仅导出CSV
power-checker export -o report -f csv
```

## 完整验证流程示例

使用项目附带的示例数据进行完整验证：

```bash
# 1. 初始化项目
power-checker init --name "示例演唱会"

# 2. 导入示例日志（包含A1回路在14:03-14:09持续超载35-38A）
power-checker import-log examples/sample_log.csv

# 3. 导入示例计划
power-checker import-plan examples/sample_plan.csv

# 4. 执行分析
power-checker analyze

# 预期结果:
# - A1回路峰值负载约36.8A，超过额定32A（115%）
# - 会检测到持续超载风险

# 5. 查看风险列表
power-checker review

# 6. 确认或忽略风险
power-checker review -r <risk_id> --confirm --note "灯光设备正常峰值"

# 7. 导出报告
power-checker export -o sample_report
```

### 测试异常数据隔离

```bash
# 创建新项目测试隔离功能
mkdir test_quarantine
cd test_quarantine
power-checker init --name "隔离测试"

# 导入包含错误的日志
power-checker import-log ../examples/sample_log_with_errors.csv

# 预期结果:
# - 第2行：缺少circuit_id -> 隔离
# - 第3行：current是"abc" -> 隔离
# - 第4行：unit是"XYZ" -> 有效但使用默认A，有警告
# - 第5行：circuit_id是"INVALID" -> 隔离
# - 第6-7行：与第2行重复 -> 第7行隔离
# - 第8行：时间戳无效 -> 隔离
```

## 配置参数说明

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `time_window_minutes` | 5 | 分析时间窗口（分钟） |
| `overload_threshold_pct` | 110.0 | 超载阈值（%，超过额定电流的百分比） |
| `phase_imbalance_threshold_pct` | 15.0 | 三相不平衡阈值（%） |
| `time_deviation_seconds` | 300 | 时间偏差阈值（秒） |
| `log_date_format` | "%Y-%m-%d %H:%M:%S" | 日志时间格式 |
| `plan_date_format` | "%Y-%m-%d %H:%M:%S" | 计划时间格式 |

## 风险类型说明

| 风险类型 | 说明 | 严重等级 |
|----------|------|----------|
| `sustained_overload` | 持续超载 | HIGH/CRITICAL |
| `phase_imbalance` | 三相不平衡 | MEDIUM/HIGH |
| `unplanned_power` | 计划外上电 | MEDIUM/HIGH |
| `time_deviation` | 时间偏差 | MEDIUM |
| `missing_field` | 缺少字段 | HIGH |
| `invalid_time` | 无效时间 | HIGH |
| `invalid_circuit` | 无效回路 | HIGH |
| `invalid_unit` | 无效单位 | MEDIUM |
| `duplicate_record` | 重复记录 | MEDIUM |

## 目录结构

```
power-checker/
├── power_checker/           # 主包
│   ├── __init__.py          # 版本信息
│   ├── cli.py               # CLI入口
│   ├── config.py            # 配置管理
│   ├── models.py            # 数据模型
│   ├── parser.py            # CSV解析和校验
│   ├── analyzer.py          # 分析规则
│   ├── storage.py           # 数据存储
│   └── exporter.py          # 报告导出
├── tests/                   # 测试文件
│   ├── test_config.py
│   ├── test_parser.py
│   └── test_analyzer.py
├── examples/                # 示例数据
│   ├── sample_log.csv
│   ├── sample_plan.csv
│   └── sample_log_with_errors.csv
├── pyproject.toml           # 包配置
├── requirements.txt         # 依赖
└── README.md               # 本文档
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-cov

# 运行所有测试
pytest tests/ -v

# 运行带覆盖率
pytest tests/ --cov=power_checker
```

## 常见问题

### Q1: 导入时报错"回路编号无效"
确保CSV中的`circuit_id`与配置文件中的回路`id`完全一致（大小写敏感）。

### Q2: 时间格式解析失败
支持的时间格式包括：
- `%Y-%m-%d %H:%M:%S` (2024-05-15 14:00:00)
- `%Y/%m/%d %H:%M:%S` (2024/05/15 14:00:00)
- `%Y-%m-%dT%H:%M:%S` (ISO格式)

可在配置中调整`log_date_format`和`plan_date_format`。

### Q3: 什么是持续超载？
指在配置的`time_window_minutes`时间窗口内，平均电流超过`overload_threshold_pct`阈值。例如默认配置下：5分钟窗口内平均电流超过额定电流的110%即触发风险。

### Q4: 隔离的数据去哪里了？
所有校验失败的数据会保存在 `.power_data/quarantine/` 目录下，可手动检查和修正后重新导入。

## 更新日志

### v0.1.0
- 初始版本
- 支持init、import-log、import-plan、analyze、review、export命令
- 支持持续超载、三相不平衡、计划外上电、时间偏差检测
- 支持Markdown和CSV报告导出

## 许可证

MIT License
