# 冷链温度复盘器

食品工厂质检员专用的本地数据分析工具，用于智能分析冷藏车温度记录、开门记录和人工交接备注，自动识别违规和异常情况。

## 功能特性

- **多源数据解析**：支持温度记录CSV、开门记录CSV、人工交接备注
- **智能规则分析**：
  - 连续超温识别（持续超过安全阈值）
  - 短时开门导致的可解释波动
  - 传感器数据断点/漂移检测
  - 人工备注中的临时异常匹配
- **可视化输出**：生成交互式HTML图表，直观展示温度曲线和异常标注
- **报告导出**：Markdown复盘报告 + CSV问题清单
- **多维度关联**：按车辆和批次智能合并时间线，交叉验证开门事件和温度异常

## 项目结构

```
cold-chain-analyzer/
├── data/
│   └── sample/                    # 示例数据
│       ├── temperature.csv        # 温度记录示例
│       ├── door.csv               # 开门记录示例
│       └── notes.csv              # 人工备注示例
├── src/
│   ├── config/
│   │   └── constants.js           # 配置常量和阈值
│   ├── parsers/
│   │   ├── temperatureParser.js   # 温度数据解析器
│   │   ├── doorParser.js          # 开门数据解析器
│   │   ├── noteParser.js          # 备注数据解析器
│   │   └── dataMerger.js          # 数据合并器（按车辆/批次）
│   ├── analyzers/
│   │   └── rulesEngine.js         # 规则引擎（核心分析逻辑）
│   ├── visualizers/
│   │   └── chartGenerator.js      # 交互式图表生成器
│   ├── exporters/
│   │   ├── reportExporter.js      # Markdown报告导出
│   │   └── issuesExporter.js      # CSV问题清单导出
│   └── cli/
│       └── index.js               # CLI命令行入口
├── output/                         # 输出目录（运行时生成）
│   ├── charts/                     # 交互式HTML图表
│   ├── reports/                    # Markdown复盘报告
│   └── issues/                     # CSV问题清单
├── package.json
└── README.md
```

## 快速开始

### 1. 环境要求

- Node.js >= 16.0.0
- npm 或 yarn

### 2. 安装依赖

```bash
npm install
```

### 3. 使用示例数据验证完整流程

#### 方式一：使用预设命令

```bash
npm run demo
```

#### 方式二：手动执行分析命令

```bash
# 使用示例数据
node src/cli/index.js analyze --sample

# 或指定自定义数据文件
node src/cli/index.js analyze \
  --temperature data/sample/temperature.csv \
  --door data/sample/door.csv \
  --notes data/sample/notes.csv \
  --output ./output
```

### 4. 查看输出结果

运行成功后，在 `output` 目录下会生成以下内容：

```
output/
├── charts/
│   ├── chart_overview.html              # 总览图表
│   ├── chart_京A12345_BATCH001.html   # 车辆A批次1的温度曲线图
│   └── chart_沪B67890_BATCH002.html   # 车辆B批次2的温度曲线图
├── reports/
│   ├── report_summary.md                # 总览复盘报告
│   ├── report_京A12345_BATCH001.md    # 车辆A批次1的详细报告
│   └── report_沪B67890_BATCH002.md    # 车辆B批次2的详细报告
└── issues/
    ├── issues_all.csv                    # 所有问题的汇总清单
    ├── issues_京A12345_BATCH001.csv   # 车辆A批次1的问题清单
    └── issues_沪B67890_BATCH002.csv   # 车辆B批次2的问题清单
```

#### 查看交互式图表

直接用浏览器打开 HTML 文件即可：

```bash
# Mac系统
open output/charts/chart_京A12345_BATCH001.html

# Windows系统
start output/charts/chart_京A12345_BATCH001.html
```

## 配置说明

### 温度阈值配置（可在 src/config/constants.js 中调整）

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 安全温度上限 | 4°C | 超过此值视为超安全阈值 |
| 危险温度上限 | 8°C | 超过此值视为危险高温 |
| 最低温度下限 | -20°C | 低于此值视为超低温 |

### 时间规则配置

| 配置项 | 默认值 | 说明 |
|--------|--------|------|
| 连续超温判定时间 | 30分钟 | 温度持续超安全阈值多久算违规 |
| 短时波动判定时间 | 10分钟 | 开门后多久内的波动算可解释 |
| 传感器断点阈值 | 60分钟 | 数据间隔多久算断点 |
| 传感器漂移阈值 | 2°C | 温度突变多少算漂移 |
| 合理开门时间 | 5分钟 | 开门多久算合理（装卸货） |
| 关门后影响持续时间 | 30分钟 | 关门后多久内的温度波动算开门影响 |

## 数据格式要求

### 温度记录CSV

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 时间 | 时间戳 | 2026-05-03 06:00:00 |
| 温度 | 温度值(°C) | -1.2 |
| 车辆 | 车牌号或车辆ID | 京A12345 |
| 批次 | 运输批次号 | BATCH001 |

*注：字段名支持中英文变体，如 "temperature"、"temp"、"车厢温度" 等都能自动识别*

### 开门记录CSV

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 时间 | 时间戳 | 2026-05-03 06:20:00 |
| 门状态 | 0=关/1=开 | 0 |
| 车辆 | 车牌号或车辆ID | 京A12345 |

*注：门状态支持多种格式：0/1、closed/open、false/true、关门/开门*

### 人工备注CSV

| 字段名 | 说明 | 示例 |
|--------|------|------|
| 时间 | 时间戳（可选，支持从内容中提取） | 2026-05-03 08:30:00 |
| 备注 | 备注内容 | 注意：京A12345在07:40-08:30期间温度持续偏高 |
| 车辆 | 车牌号或车辆ID（可选） | 京A12345 |
| 类别 | 备注分类（可选） | temperature |

## 问题类型说明

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| 连续超温 | 中/高/严重 | 温度持续超过安全阈值一定时间 |
| 短时波动 | 低 | 开门后短时间内的温度波动（可解释） |
| 开门超时 | 中/高 | 开门时间超过合理范围 |
| 传感器断点 | 中/高 | 传感器数据采集中断 |
| 传感器漂移 | 低/中 | 传感器读数突然偏移 |
| 备注异常 | 中/高 | 人工备注中提及的异常情况 |

### 严重程度判定

| 严重程度 | 说明 |
|----------|------|
| 🔴 严重 | 温度严重超标(>8°C)或门长时间未关，可能影响食品安全 |
| 🔶 高 | 明显违规，需要进一步调查 |
| 🔵 中 | 轻微违规或潜在问题 |
| 🟢 低 | 可解释的波动或轻微异常 |

## 命令行参考

### analyze 命令

```bash
node src/cli/index.js analyze [选项]
```

**选项：**

| 选项 | 缩写 | 说明 |
|------|------|------|
| --temperature | -t | 温度记录CSV文件路径 |
| --door | -d | 开门记录CSV文件路径 |
| --notes | -n | 人工备注CSV文件路径 |
| --output | -o | 输出目录路径（默认：./output） |
| --sample | | 使用示例数据进行分析 |

### list 命令

查看示例数据信息：

```bash
node src/cli/index.js list
```

### info 命令

显示工具配置和规则说明：

```bash
node src/cli/index.js info
```

## 完整验证流程

### 步骤1：安装依赖

```bash
npm install
```

### 步骤2：运行示例分析

```bash
# 方式1：使用npm脚本
npm run demo

# 方式2：使用CLI命令
node src/cli/index.js analyze --sample
```

### 步骤3：验证输出

#### 检查生成的文件

```bash
# 列出输出目录
ls -la output/
ls -la output/charts/
ls -la output/reports/
ls -la output/issues/
```

#### 检查Markdown报告

```bash
# 查看总览报告
cat output/reports/report_summary.md

# 查看详细报告
cat output/reports/report_京A12345_BATCH001.md
```

#### 检查CSV问题清单

```bash
# 查看所有问题
cat output/issues/issues_all.csv

# 查看特定批次问题
cat output/issues/issues_京A12345_BATCH001.csv
```

#### 在浏览器中打开交互式图表

```bash
# Mac
open output/charts/chart_overview.html
open output/charts/chart_京A12345_BATCH001.html

# Windows
start output/charts/chart_overview.html
```

### 步骤4：预期结果

使用示例数据运行后，应检测到以下问题：

1. **京A12345 - BATCH001**：
   - 连续超温事件（约40分钟，最高温度9.5°C）
   - 开门后短时波动（可解释）
   - 人工备注提及的异常

2. **沪B67890 - BATCH002**：
   - 开门后短时波动（可解释）
   - 人工备注提及的异常
   - 压缩机问题相关备注

## 自定义数据使用

### 准备自己的数据

1. 参照示例数据格式准备CSV文件
2. 确保时间字段可解析（支持 ISO 格式、YYYY-MM-DD HH:mm:ss 等常见格式）
3. 车辆和批次字段用于分组分析，建议完整填写

### 运行分析

```bash
node src/cli/index.js analyze \
  --temperature /path/to/your/temperature.csv \
  --door /path/to/your/door.csv \
  --notes /path/to/your/notes.csv \
  --output /path/to/output
```

## 常见问题

### Q1：为什么某些温度波动没有被标记为违规？

A：工具会智能判断：
- 如果波动发生在开门后短时间内，会标记为"可解释的短时波动"
- 如果人工备注中有相关说明（如装卸货），也会降低严重程度

### Q2：如何调整判定阈值？

A：编辑 `src/config/constants.js` 文件，调整 `CONFIG` 对象中的相关参数。

### Q3：支持哪些时间格式？

A：支持大多数常见时间格式：
- ISO 8601：2026-05-03T06:00:00Z
- 标准格式：2026-05-03 06:00:00
- 中文格式：2026年5月3日 6时0分
- 相对时间：昨天 10点30分、今天 下午3点

### Q4：字段名必须严格匹配吗？

A：不需要，解析器会自动识别常见变体：
- 温度字段：温度、temperature、temp、当前温度、车厢温度
- 时间字段：时间、time、timestamp、datetime、日期时间
- 车辆字段：车辆、vehicle、车牌、车牌号、车号
- 批次字段：批次、batch、批次号、运输批次

## 更新日志

### v1.0.0 (2026-05-03)

- 初始版本发布
- 支持多源数据解析（温度、开门、备注）
- 实现6种问题类型的智能检测
- 生成交互式HTML图表
- 导出Markdown报告和CSV问题清单
- 支持按车辆和批次分组分析
- 包含完整的示例数据

## 许可证

MIT License
