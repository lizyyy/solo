# 换电柜热失控早期复盘工具 (thermal-review-cli)

一个用于社区换电柜热失控早期复盘的 TypeScript CLI 工具。

## 功能特性

- **数据验证 (validate)**: 验证输入数据的格式和完整性
- **数据分析 (analyze)**: 分析电池温度数据、换电事件，检测潜在风险
- **数据导出 (export)**: 导出风险项 CSV 和复盘报告 Markdown

### 核心分析能力

1. **温度斜率计算**: 计算电池在仓位内的温度变化率
2. **异常换入换出检测**: 检测短时间内同一电池重复入柜、快速换电等异常行为
3. **传感器断采检测**: 识别温度传感器数据缺失或异常
4. **跨午夜换电处理**: 正确处理跨日期的换电事件

## 快速开始

### 安装依赖

```bash
npm install
```

### 使用示例数据测试

项目提供了完整的示例数据，位于 `samples/` 目录下。

#### 1. 验证数据

```bash
npm run dev -- validate -d ./samples
```

#### 2. 分析数据

```bash
npm run dev -- analyze -d ./samples
```

#### 3. 导出结果

```bash
npm run dev -- export -d ./samples -o ./output
```

## 命令行使用

### 全局命令

```bash
npm run dev -- [command] [options]
```

### 可用命令

#### `validate` - 验证数据

验证输入数据文件的格式和完整性。

```bash
npm run dev -- validate [options]
```

**选项:**
- `-d, --data-dir <dir>`: 数据文件目录 (默认: 当前工作目录)
- `--cabinets <path>`: 自定义 cabinets.yaml 路径
- `--temperature <path>`: 自定义 slot_temperature.csv 路径
- `--swaps <path>`: 自定义 swap_events.jsonl 路径
- `--batteries <path>`: 自定义 battery_registry.csv 路径
- `--rules <path>`: 自定义 rules.yaml 路径

**示例:**
```bash
# 使用默认目录
npm run dev -- validate

# 指定数据目录
npm run dev -- validate -d ./data

# 指定单个文件路径
npm run dev -- validate --cabinets ./cabinets.yaml --rules ./rules.yaml
```

#### `analyze` - 分析数据

分析数据并检测热失控风险。

```bash
npm run dev -- analyze [options]
```

**选项:**
- 与 `validate` 命令相同

**示例:**
```bash
npm run dev -- analyze -d ./samples
```

#### `export` - 导出结果

导出分析结果到文件（risk_items.csv 和 thermal_review.md）。

```bash
npm run dev -- export [options]
```

**选项:**
- `-d, --data-dir <dir>`: 数据文件目录
- `-o, --output-dir <dir>`: 输出目录 (默认: 当前工作目录)
- 其他选项与 `validate` 相同

**示例:**
```bash
npm run dev -- export -d ./samples -o ./output
```

## 数据文件格式

### 1. cabinets.yaml

换电柜配置信息。

```yaml
cabinets:
  - cabinetId: CAB-001
    location: 北京市朝阳区建国路88号
    totalSlots: 12
    installedAt: '2024-01-15T00:00:00Z'
```

### 2. slot_temperature.csv

仓位温度传感器数据。

```csv
timestamp,cabinetId,slotId,temperature
2024-05-01T08:00:00Z,CAB-001,1,25.5
2024-05-01T08:05:00Z,CAB-001,1,25.8
```

**注意:**
- `temperature` 为空或 `null` 表示传感器断采

### 3. swap_events.jsonl

换电事件记录（JSON Lines 格式）。

```json
{"eventId":"EVT-001","timestamp":"2024-05-01T07:55:00Z","cabinetId":"CAB-001","slotId":1,"batteryId":"BAT-001","eventType":"in","operatorId":"OP-001"}
{"eventId":"EVT-002","timestamp":"2024-05-01T08:35:00Z","cabinetId":"CAB-001","slotId":1,"batteryId":"BAT-001","eventType":"out","operatorId":"OP-002"}
```

**字段说明:**
- `eventType`: `"in"` 表示换入，`"out"` 表示换出

### 4. battery_registry.csv

电池注册表。

```csv
batteryId,model,manufacturer,productionDate,capacity,status
BAT-001,Model-X,宁德时代,2023-01-15T00:00:00Z,50000,active
```

**字段说明:**
- `status`: `active` (活跃), `retired` (退役), `maintenance` (维护中)

### 5. rules.yaml

告警规则配置。

```yaml
globalSettings:
  maxGapMinutes: 10
  duplicateBatteryMinutes: 30

rules:
  - ruleId: RULE-001
    name: 温度快速上升检测
    type: temperature_slope
    threshold: 0.5
    timeWindowMinutes: 30
    severity: high
    enabled: true
```

**规则类型:**
- `temperature_slope`: 温度斜率检测
- `abnormal_swap`: 异常换电检测
- `sensor_failure`: 传感器故障检测

**严重程度:**
- `low`: 低
- `medium`: 中
- `high`: 高
- `critical`: 严重

## 输出文件

### risk_items.csv

检测到的风险项列表。

**字段:**
- `riskId`: 风险项唯一标识
- `batteryId`: 电池 ID
- `cabinetId`: 换电柜 ID
- `slotId`: 仓位 ID
- `riskType`: 风险类型
- `severity`: 严重程度
- `startTime`: 开始时间
- `endTime`: 结束时间
- `description`: 描述
- `relatedEventIds`: 相关事件 ID
- `temperatureSlope`: 温度斜率 (如有)
- `maxTemperature`: 最高温度 (如有)
- `status`: 状态
- `closedBy`: 关闭人
- `closedAt`: 关闭时间

### thermal_review.md

完整的复盘报告，包含：
- 数据验证概览
- 分析结果统计
- 电池仓位会话详情
- 风险项详细列表

## 特殊场景处理

### 1. 跨午夜换电

工具会正确处理跨日期的换电事件。例如：
- 换入时间: 2024-05-01T23:50:00Z
- 换出时间: 2024-05-02T00:25:00Z

这种场景会被正确识别为一个完整的会话。

### 2. 同一电池短时间重复入柜

当同一电池在短时间内（可配置）重复入柜时，会被检测为异常换电。

配置项: `rules.yaml` 中的 `globalSettings.duplicateBatteryMinutes`

### 3. 传感器断采

当温度数据存在以下情况时，会被标记为传感器断采：
- 温度值为空或 `null`
- 相邻数据点时间间隔超过阈值

配置项: `rules.yaml` 中的 `globalSettings.maxGapMinutes`

## 构建

```bash
npm run build
```

构建后的文件位于 `dist/` 目录。

## 项目结构

```
.
├── samples/              # 示例数据
│   ├── cabinets.yaml
│   ├── slot_temperature.csv
│   ├── swap_events.jsonl
│   ├── battery_registry.csv
│   └── rules.yaml
├── src/
│   ├── analyzers/        # 数据分析模块
│   ├── exporters/        # 数据导出模块
│   ├── readers/          # 数据读取模块
│   ├── types/            # 类型定义
│   ├── utils/            # 工具函数
│   ├── validators/       # 数据验证模块
│   └── index.ts          # CLI 入口
├── dist/                 # 构建输出
├── package.json
├── tsconfig.json
└── README.md
```

## 许可证

ISC
