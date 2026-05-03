# 称重日志分析工具 (Weighing Log Analyzer)

一个用于离线回放和分析串口称重仪表日志的 TypeScript CLI 工具，专为产线质检同事设计。

## 功能特性

- **多格式帧解析**: 支持三种 STX/ETX 帧格式（type1, type2, type3）
- **稳定称重重建**: 连续 3 个稳定帧才视为有效称重
- **皮重计算**: 自动计算净重（毛重 - 皮重）
- **智能风险检测**:
  - 校准过期检测
  - 重量跳变检测
  - 重复帧检测
  - 跨午夜批次归属错位检测
  - 重量超差检测
- **多格式报告输出**:
  - `issues.csv` - 问题列表
  - `weighing_report.md` - 详细分析报告
  - `timeline.html` - 交互式 HTML 时间线

## 项目结构

```
├── src/
│   ├── cli.ts              # CLI 入口文件
│   ├── types.ts            # TypeScript 类型定义
│   ├── parser/             # 解析器模块
│   │   ├── index.ts
│   │   ├── deviceProfiles.ts    # YAML 设备配置解析
│   │   ├── calibration.ts       # CSV 校准记录解析
│   │   ├── batches.ts           # CSV 批次数据解析
│   │   └── serialLog.ts         # 串口日志帧解析
│   ├── rules/              # 规则引擎模块
│   │   ├── index.ts
│   │   └── engine.ts            # 分析规则和检测逻辑
│   └── reporter/           # 报告生成模块
│       ├── index.ts
│       ├── issuesCsv.ts          # issues.csv 生成
│       ├── weighingReport.ts     # Markdown 报告生成
│       └── htmlTimeline.ts       # HTML 时间线生成
├── samples/                # 示例数据
│   ├── serial.log
│   ├── device_profiles.yaml
│   ├── calibration.csv
│   └── batches.csv
├── output/                 # 输出目录（运行时生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行演示

使用示例数据运行演示：

```bash
npm run demo
```

演示将分析 `samples/` 目录下的示例数据，并将报告输出到 `output/` 目录。

### 手动运行

```bash
npm run start -- \
  --log ./path/to/serial.log \
  --profiles ./path/to/device_profiles.yaml \
  --calibration ./path/to/calibration.csv \
  --batches ./path/to/batches.csv \
  --output ./output
```

## 输入文件格式

### 1. serial.log (串口日志)

每一行的格式：
```
YYYY-MM-DD HH:MM:SS[.mmm] [STATION_ID] Data: <STX><frame_content><ETX>
```

支持的帧格式：

**Type1 (简单格式)**:
```
[S10.000]    # S=stable, 后跟重量值
[U9.999]     # U=unstable
```

**Type2 (逗号分隔)**:
```
STX500.00,SETX    # 重量,状态
STX600.00,UETX    # U=unstable
```

**Type3 (JSON/键值对)**:
```
[{"weight":25.0000,"status":"stable"}]
[W:25.0001 S:stable]
```

### 2. device_profiles.yaml (设备配置)

```yaml
devices:
  - station_id: WEIGH01
    device_model: WeighMaster-3000
    stx: "["           # 帧起始标记
    etx: "]"           # 帧结束标记
    unit: kg           # 单位: kg, g, lb
    tare: 0.5          # 皮重
    precision: 3       # 小数精度
    frame_format: type1  # 帧格式: type1, type2, type3
```

### 3. calibration.csv (校准记录)

```csv
station_id,calibration_date,expire_date,calibrated_by,certificate_number
WEIGH01,2024-01-15,2024-07-15,Zhang San,CAL-2024-001
```

### 4. batches.csv (批次记录)

```csv
batch_id,start_time,end_time,product_id,product_name,target_weight,tolerance_min,tolerance_max,station_id
BATCH-2024-001,2024-07-01 08:00:00,2024-07-01 16:00:00,PROD-A,产品A,10.0,-0.2,0.2,WEIGH01
```

## 输出文件

运行完成后，输出目录包含以下文件：

### 1. issues.csv

问题列表，包含以下列：
- `issue_id`: 问题唯一标识
- `timestamp`: 发生时间
- `station_id`: 工位 ID
- `issue_type`: 问题类型
- `severity`: 严重程度
- `description`: 描述
- `details`: 详细信息（JSON）

### 2. weighing_report.md

详细的 Markdown 格式报告，包含：
- 分析摘要
- 问题统计（按类型和严重程度）
- 问题详情
- 称重事件详情（按工位）
- 工位状态
- 问题类型说明

### 3. timeline.html

交互式 HTML 时间线，包含三个标签页：
- **时间线**: 按时间顺序显示称重事件和问题
- **问题列表**: 按严重程度排序的问题列表
- **工位状态**: 各工位的状态摘要

## 问题类型说明

| 问题类型 | 说明 | 严重程度 |
|---------|------|---------|
| `calibration_expired` | 校准过期 | critical |
| `weight_jump` | 重量跳变（异常波动） | high |
| `weight_out_of_tolerance` | 重量超差 | high |
| `midnight_batch_misalignment` | 跨午夜批次错位 | medium |
| `bad_frame` | 坏帧（格式错误） | medium |
| `duplicate_frame` | 重复帧 | low |
| `unstable_reading` | 不稳定读数 | low |
| `missing_data` | 数据缺失 | medium |

## 错误处理

工具设计了完善的错误处理机制：

1. **坏帧处理**: 格式错误的帧不会导致程序崩溃，而是被记录为 `bad_frame` 问题
2. **解析异常**: 解析过程中的异常会被捕获并记录
3. **文件缺失**: 缺少必要参数或文件时给出友好的错误提示

## 构建

```bash
npm run build
```

构建产物输出到 `dist/` 目录。

## License

MIT
