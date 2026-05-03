# Beacon Inspector - 海事航标灯巡检包复核工具

一个用于换季前航标灯巡检数据复核的 TypeScript CLI 工具。

## 功能特性

- **validate** - 校验输入文件的字段格式和坐标有效性
- **run** - 按天重建每个航标的电池余量、灯质状态、告警消缺和恶劣天气复巡窗口
- **export** - 导出 issues.csv 与 beacon_report.md

## 边界情况处理

### 1. 跨日天气窗口
工具能够识别连续多天的恶劣天气，并正确计算复巡窗口。恶劣天气结束后，自动生成 3 天的复巡窗口期（恶劣天气结束后第 1-4 天）。

### 2. 巡检记录缺坐标
当航标缺少坐标信息时，工具会：
- 在校验阶段发出警告（而非错误）
- 继续后续的数据处理和分析
- 在报告中标记该航标需要补充坐标信息

## 安装

```bash
npm install
```

## 使用方法

### 1. 准备数据

在数据目录中放置以下 5 个文件：

| 文件名 | 格式 | 说明 |
|--------|------|------|
| buoys.csv | CSV | 航标基本信息 |
| battery_logs.jsonl | JSON Lines | 电池日志记录 |
| repairs.csv | CSV | 维修和巡检记录 |
| weather.csv | CSV | 天气记录 |
| lamp_rules.yaml | YAML | 灯质规则配置 |

### 2. 校验数据

```bash
# 使用开发模式
npm run dev -- validate --data-dir ./sample_data

# 或编译后运行
npm run build
node dist/index.js validate --data-dir ./sample_data
```

### 3. 运行数据处理

```bash
npm run dev -- run --data-dir ./sample_data --output ./output
```

### 4. 导出报告

```bash
npm run dev -- export --data-dir ./sample_data --output-dir ./output
```

## 完整工作流程示例

```bash
# 1. 校验数据
npm run dev -- validate --data-dir ./sample_data

# 2. 处理数据并保存中间结果
npm run dev -- run --data-dir ./sample_data --output ./output

# 3. 导出最终报告
npm run dev -- export --data-dir ./sample_data --output-dir ./output
```

## 输入文件格式

### buoys.csv（航标基本信息）

```csv
id,name,latitude,longitude,type,battery_capacity,lamp_type,install_date
BUOY-001,东港1号灯浮,30.2541,121.5678,cardinal,100,LED_TypeA,2024-01-15
```

**字段说明**：
- `id` - 航标唯一标识
- `name` - 航标名称
- `latitude` - 纬度（可为空，会触发警告）
- `longitude` - 经度（可为空，会触发警告）
- `type` - 航标类型
- `battery_capacity` - 电池容量
- `lamp_type` - 灯质类型
- `install_date` - 安装日期

### battery_logs.jsonl（电池日志）

每行一个 JSON 对象：

```json
{"buoy_id":"BUOY-001","timestamp":"2024-04-01T08:00:00","voltage":12.5,"current":0.5,"temperature":22.5,"state_of_charge":85}
```

### repairs.csv（维修记录）

```csv
id,buoy_id,repair_date,technician,issue_type,description,resolved,resolution_date
R-001,BUOY-001,2024-03-15,张三,inspection,季度常规巡检,true,2024-03-15
```

**特殊 issue_type**：
- `inspection` - 巡检记录
- `reinspection` - 复巡记录

### weather.csv（天气记录）

```csv
date,time,wind_speed,wind_direction,visibility,wave_height,weather_condition,is_severe
2024-04-02,12:00,35,SE,2000,3.5,storm,true
```

**恶劣天气判定**：
- `is_severe=true` 标记为恶劣天气
- 或 `wind_speed > 30`（风速 > 30）
- 或 `visibility < 1000`（能见度 < 1000米）

### lamp_rules.yaml（灯质规则）

```yaml
rules:
  - lamp_type: LED_TypeA
    daily_consumption: 2.5
    min_voltage: 10.5
    max_voltage: 14.0
    critical_soc: 20
    inspection_interval_days: 30

default_rule:
  lamp_type: default
  daily_consumption: 2.5
  min_voltage: 10.5
  max_voltage: 14.0
  critical_soc: 20
  inspection_interval_days: 30
```

## 输出文件

### issues.csv

包含所有检测到的问题，按严重程度排序：

| 列名 | 说明 |
|------|------|
| id | 问题唯一标识 |
| buoy_id | 航标ID |
| buoy_name | 航标名称 |
| date | 发现日期 |
| issue_type | 问题类型 |
| description | 问题描述 |
| severity | 严重程度 (low/medium/high/critical) |
| status | 状态 (open/in_progress/resolved) |
| assigned_to | 负责人 |

### beacon_report.md

Markdown 格式的完整报告，包含：
- 基本信息（报告周期、航标总数等）
- 电池状态概览
- 灯质状态概览
- 天气影响分析
- 问题清单（按严重程度排序）

## 项目结构

```
.
├── src/
│   ├── index.ts              # CLI 入口
│   ├── types/
│   │   └── index.ts          # 类型定义
│   ├── commands/
│   │   ├── validate.ts       # 校验命令
│   │   ├── run.ts            # 数据处理命令
│   │   └── export.ts         # 导出命令
│   └── utils/
│       ├── file-reader.ts    # 文件读取工具
│       ├── validator.ts      # 数据校验工具
│       ├── data-processor.ts # 数据处理逻辑
│       └── exporter.ts       # 报告导出工具
├── sample_data/              # 示例数据
│   ├── buoys.csv
│   ├── battery_logs.jsonl
│   ├── repairs.csv
│   ├── weather.csv
│   └── lamp_rules.yaml
├── output/                   # 输出目录
├── package.json
├── tsconfig.json
└── README.md
```

## 使用示例数据测试

项目包含完整的示例数据，可以直接运行测试：

```bash
# 校验示例数据
npm run dev -- validate --data-dir ./sample_data

# 处理示例数据
npm run dev -- run --data-dir ./sample_data --output ./output

# 导出报告
npm run dev -- export --data-dir ./sample_data --output-dir ./output
```

示例数据中包含以下测试场景：
- **BUOY-005** - 缺少坐标信息（测试边界情况 2）
- **2024-04-02 至 2024-04-03** - 连续恶劣天气（测试边界情况 1）
- **BUOY-003** - 电池电量持续下降，最终达到临界状态
- **BUOY-004** - 灯质故障未解决

## 命令行选项

### validate 命令

```bash
beacon-inspector validate --data-dir <path>
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| --data-dir | 数据目录路径 | ./data |

### run 命令

```bash
beacon-inspector run --data-dir <path> [--skip-validation] [--output <path>]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| --data-dir | 数据目录路径 | ./data |
| --skip-validation | 跳过数据校验 | false |
| --output | 处理结果输出目录 | ./output |

### export 命令

```bash
beacon-inspector export --data-dir <path> --output-dir <path> [--skip-validation]
```

| 选项 | 说明 | 默认值 |
|------|------|--------|
| --data-dir | 数据目录路径 | ./data |
| --output-dir | 输出目录路径 | ./output |
| --skip-validation | 跳过数据校验 | false |

## License

ISC
