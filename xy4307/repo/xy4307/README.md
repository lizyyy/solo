# 培养箱巡检日志整理器

一个专为实验室值班同学设计的本地自动化脚本，用于整理培养箱巡检日志，识别异常情况，生成巡检报告。

## 功能特性

- **多文件导入**: 支持导入多个设备CSV文件和批次CSV文件
- **数据合并**: 按箱号和时间自动合并设备数据与批次数据
- **异常识别**:
  - 传感器断点（数据采集间隔过长）
  - 温湿度越界
  - 开门后恢复超时
  - 批次时间窗缺失
  - 重复记录
- **报告生成**:
  - Markdown巡检报告
  - CSV摘要
  - 待复核清单
- **历史存储**: 使用JSON存储处理历史，支持按箱号/批次查询
- **灵活配置**: 可自定义温湿度范围、断点阈值等参数

## 安装

### 环境要求

- Node.js 16.0 或更高版本

### 安装步骤

```bash
# 进入项目目录
cd incubator-log-manager

# 安装依赖
npm install
```

## 快速开始

### 使用示例数据运行完整流程

项目提供了示例数据，位于 `examples/` 目录下，包含：

- `examples/device_csv/`: 设备导出的CSV文件（2台培养箱数据）
- `examples/batch_csv/`: 手写批次清单CSV

运行以下命令即可体验完整流程：

```bash
# 基础使用
node index.js import --device ./examples/device_csv/ --batch ./examples/batch_csv/

# 或者使用npm脚本
npm run test
```

运行成功后，会在 `output/` 目录下生成以下文件：
- `report-YYYY-MM-DDTHH-MM-SS.mmmZ.md`: 完整的巡检报告
- `summary-YYYY-MM-DDTHH-MM-SS.mmmZ.csv`: 异常摘要CSV
- `review-YYYY-MM-DDTHH-MM-SS.mmmZ.md`: 待复核清单

## 命令详解

### import - 导入并分析数据

```bash
node index.js import [选项]
```

#### 选项

| 选项 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--device <path>` | `-d` | 设备CSV文件或目录路径 | 必填 |
| `--batch <path>` | `-b` | 批次CSV文件或目录路径 | 必填 |
| `--output <dir>` | `-o` | 输出目录 | `./output` |
| `--temp-range <min,max>` | `-t` | 温度范围，用逗号分隔 | `36.0,38.0` |
| `--humidity-range <min,max>` | `-H` | 湿度范围，用逗号分隔 | `80,95` |
| `--gap-minutes <minutes>` | `-g` | 传感器断点阈值(分钟) | `60` |
| `--recovery-minutes <minutes>` | `-r` | 开门恢复阈值(分钟) | `15` |

#### 使用示例

```bash
# 基本用法
node index.js import --device ./device_data/ --batch ./batch_data/

# 自定义参数
node index.js import \
  --device ./device_data/ \
  --batch ./batch_data/ \
  --output ./reports/ \
  --temp-range 35.5,37.5 \
  --humidity-range 75,90 \
  --gap-minutes 30 \
  --recovery-minutes 10
```

### query - 查询处理历史

```bash
node index.js query [选项]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--id <id>` | 按记录ID查询 |
| `--box-id <boxId>` | 按箱号查询 |
| `--batch-id <batchId>` | 按批次号查询 |
| `--date <date>` | 按日期查询 (格式: YYYY-MM-DD) |
| `--start-date <date>` | 日期范围起始 |
| `--end-date <date>` | 日期范围结束 |
| `--json` | 以JSON格式输出 |

#### 使用示例

```bash
# 按箱号查询
node index.js query --box-id INC001

# 按批次号查询
node index.js query --batch-id BATCH2025043001

# 按日期查询
node index.js query --date 2025-04-30

# 按日期范围查询
node index.js query --start-date 2025-04-01 --end-date 2025-04-30

# 以JSON格式输出
node index.js query --box-id INC001 --json
```

### list - 列出索引

```bash
node index.js list [选项]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--json` | 以JSON格式输出 |

#### 使用示例

```bash
# 列出所有箱号、批次号和日期
node index.js list

# 以JSON格式输出
node index.js list --json
```

### delete - 删除记录

```bash
node index.js delete [选项]
```

#### 选项

| 选项 | 说明 |
|------|------|
| `--id <id>` | 要删除的记录ID |
| `--all` | 删除所有记录 |
| `--force` | 强制删除，不确认 |

#### 使用示例

```bash
# 删除指定记录
node index.js delete --id proc_1234567890_abcdefgh

# 删除所有记录
node index.js delete --all --force
```

## 数据格式说明

### 设备CSV格式

设备导出的CSV需要包含以下列（列名大小写不敏感，支持中英文别名）：

| 列名（中文） | 别名（英文） | 说明 | 示例 |
|-------------|-------------|------|------|
| 箱号 | BoxID, 设备号 | 培养箱编号 | INC001 |
| 时间 | Time, 时间戳 | 记录时间 | 2025-04-30 08:00:00 |
| 温度 | Temperature | 温度值(°C) | 37.0 |
| 湿度 | Humidity | 湿度值(%) | 85 |
| 开门事件 | DoorEvent | 开门状态 | OPEN/CLOSE/1/0 |
| 报警码 | AlarmCode | 报警代码 | TEMP_HIGH |

#### 时间格式支持

- `2025-04-30 08:00:00`
- `2025/04/30 08:00:00`
- `04/30/2025 08:00:00`
- `2025-04-30`（默认时间 00:00:00）

#### 开门事件支持

- 开启: `OPEN`, `开启`, `开门`, `1`
- 关闭: `CLOSE`, `关闭`, `关门`, `0`

### 批次CSV格式

手写批次清单CSV需要包含以下列：

| 列名（中文） | 别名（英文） | 说明 | 示例 |
|-------------|-------------|------|------|
| 批次号 | BatchID | 批次编号 | BATCH2025043001 |
| 箱号 | BoxID | 培养箱编号 | INC001 |
| 开始时间 | StartTime | 批次开始时间 | 2025-04-30 08:00:00 |
| 结束时间 | EndTime | 批次结束时间（可选） | 2025-04-30 12:00:00 |
| 样本数量 | SampleCount | 样本数量 | 24 |
| 操作员 | Operator | 操作员姓名 | 张三 |
| 备注 | Remarks | 备注信息 | 细胞培养A组 |

## 异常类型说明

| 异常类型 | 严重程度 | 说明 |
|---------|---------|------|
| 传感器断点 | WARNING | 相邻两条记录的时间间隔超过设定阈值 |
| 温度越界 | ERROR | 温度超出设定的正常范围 |
| 湿度越界 | ERROR | 湿度超出设定的正常范围 |
| 开门恢复超时 | WARNING | 开门后超过设定时间才关闭或恢复正常 |
| 门未关闭 | ERROR | 检测到开门事件后未检测到关闭事件 |
| 重复记录 | WARNING | 检测到时间、温度、湿度完全相同的记录 |
| 批次时间窗缺失 | ERROR | 批次对应的时间窗口内没有设备数据 |

## 项目结构

```
incubator-log-manager/
├── index.js              # CLI入口文件
├── package.json          # 项目配置
├── src/
│   ├── parser.js         # CSV解析模块
│   ├── rules.js          # 异常检测规则模块
│   ├── storage.js        # 历史存储模块
│   └── reporter.js       # 报告生成模块
├── examples/
│   ├── device_csv/       # 示例设备CSV文件
│   │   ├── incubator_001.csv
│   │   └── incubator_002.csv
│   └── batch_csv/        # 示例批次CSV文件
│       └── batches.csv
├── output/               # 输出目录（运行后生成）
└── data/                 # 历史数据目录（运行后生成）
```

## 模块说明

### parser.js - 解析模块

负责解析设备CSV和批次CSV文件，支持：
- 单文件解析
- 目录批量解析
- 多种日期格式解析
- 中英文列名映射

### rules.js - 规则模块

实现各种异常检测规则：
- `checkSensorGaps`: 检测传感器断点
- `checkTemperatureRange`: 检测温度越界
- `checkHumidityRange`: 检测湿度越界
- `checkDoorRecoveryTime`: 检测开门恢复超时
- `checkDuplicateRecords`: 检测重复记录
- `checkBatchTimeWindow`: 检测批次时间窗缺失
- `mergeRecords`: 合并设备数据与批次数据

### storage.js - 存储模块

使用JSON文件存储处理历史，提供：
- 按ID/箱号/批次/日期查询
- 索引管理
- 记录删除

### reporter.js - 报告模块

生成各类报告：
- `generateMarkdownReport`: 生成Markdown巡检报告
- `generateCSVSummary`: 生成CSV异常摘要
- `generateReviewList`: 生成待复核清单

## 常见问题

### Q1: 如何处理不同格式的CSV文件？

答：解析器已支持多种列名别名。如果你的CSV列名不被识别，可以修改 `src/parser.js` 中的列名映射，或者将CSV列名调整为文档中说明的格式。

### Q2: 可以自定义温湿度范围吗？

答：可以。使用 `import` 命令时，通过 `--temp-range` 和 `--humidity-range` 参数自定义范围。例如：

```bash
node index.js import \
  --device ./data/ \
  --batch ./batches/ \
  --temp-range 35.5,37.5 \
  --humidity-range 75,90
```

### Q3: 历史数据存储在哪里？

答：历史数据存储在 `data/` 目录下，包括：
- `history.json`: 完整的处理历史
- `indexes.json`: 索引数据（按箱号、批次、日期）

### Q4: 如何查看生成的报告？

答：报告生成在 `output/` 目录下（或通过 `--output` 指定的目录）。你可以用以下方式查看：

```bash
# 查看Markdown报告
open output/report-*.md

# 查看CSV摘要
open output/summary-*.csv
```

## 示例数据说明

示例数据位于 `examples/` 目录，包含以下异常场景供测试：

| 异常类型 | 所在文件 | 说明 |
|---------|---------|------|
| 传感器断点 | incubator_001.csv | 12:00 到 14:00 间隔120分钟 |
| 温度越界 | incubator_001.csv | 15:30 时温度 38.2°C |
| 开门恢复超时 | incubator_001.csv | 09:30开门，10:00关闭（间隔30分钟） |
| 重复记录 | incubator_001.csv | 18:00 两条相同记录 |
| 湿度越界 | incubator_002.csv | 多处湿度超出范围 |
| 温度越界 | incubator_002.csv | 多处温度超出范围 |
| 门未关闭 | incubator_002.csv | 最后一条记录门状态为OPEN |
| 批次时间窗缺失 | batches.csv | BATCH2025043004 对应箱号 INC003 无设备数据 |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
