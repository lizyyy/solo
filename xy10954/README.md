# 生鲜到货温度检查 CLI

一个本地可运行的命令行工具，用于合并生鲜到货单与温度枪记录，判断哪些批次需要拒收。

## 功能特性

- ✅ **参数解析**: 使用 commander 提供清晰的命令行接口
- ✅ **输入校验**: 验证文件存在性、格式和必填字段
- ✅ **错误提示**: 清晰的中文错误信息和验证反馈
- ✅ **可配置输出**: 支持自定义输出目录
- ✅ **CSV 合并**: 智能匹配批次 ID，处理格式差异
- ✅ **阈值判断**: 根据最高温度判断是否拒收
- ✅ **供应商统计**: 按供应商和品类统计拒收率
- ✅ **异常样本**: 保留异常温度样本的原始位置
- ✅ **报告导出**: 生成多种格式的输出报告

## 输出内容

1. **终端摘要**: 彩色输出，快速查看关键指标
2. **机器可读结果**: JSON 格式，包含完整数据
3. **质检报告**: Markdown 格式，便于分享和存档
4. **原始行号**: 所有坏记录和异常样本都可定位回原始文件行号

## 安装

**零依赖！** 无需安装任何 npm 包，直接使用 Node.js 运行即可。

```bash
# 无需 npm install，直接运行
node src/cli.js --help
```

## 使用方法

### 基本使用

```bash
node src/cli.js check -a data/arrival.csv -t data/temperature.csv
```

### 指定输出目录和阈值

```bash
node src/cli.js check \
  -a data/arrival.csv \
  -t data/temperature.csv \
  -o ./output \
  --default-threshold 8
```

### 查看帮助

```bash
node src/cli.js check --help
```

## 参数说明

| 参数 | 缩写 | 说明 | 默认值 |
|------|------|------|--------|
| `--arrival` | `-a` | 到货单 CSV 文件路径 (必填) | - |
| `--temperature` | `-t` | 温度记录 CSV 文件路径 (必填) | - |
| `--output` | `-o` | 输出目录路径 | `./output` |
| `--default-threshold` | - | 默认拒收温度阈值 (℃) | `8` |
| `--verbose` | - | 显示详细处理信息 | - |

## CSV 文件格式要求

### 到货单 (arrival.csv)

| 字段 | 说明 | 必填 |
|------|------|------|
| batchId | 批次号 | ✅ |
| supplier | 供应商 | ✅ |
| category | 品类 | ✅ |
| quantity | 数量 | ✅ |
| arrivalDate | 到货日期 | ✅ |

### 温度记录 (temperature.csv)

| 字段 | 说明 | 必填 |
|------|------|------|
| batchId | 批次号 | ✅ |
| temperature | 温度 (℃) | ✅ |
| measureTime | 测量时间 | ✅ |
| measurePoint | 测量点 | ✅ |

## 输出文件

运行后会在输出目录生成以下文件：

1. **results.json**: 机器可读的完整结果数据
2. **report.md**: 给同事看的 Markdown 格式质检报告

## 示例数据

项目包含示例数据文件：
- `data/arrival.csv`: 示例到货单（包含2条坏记录用于测试）
- `data/temperature.csv`: 示例温度记录（包含2条坏记录用于测试）

## 项目结构

```
fresh-temperature-cli/
├── src/
│   ├── cli.js              # 主入口和命令行解析
│   ├── validator.js        # 输入验证
│   ├── csvHandler.js       # CSV 读写和数据合并
│   ├── temperatureChecker.js  # 温度检查逻辑
│   └── outputGenerator.js  # 输出生成
├── data/
│   ├── arrival.csv         # 示例到货单
│   └── temperature.csv     # 示例温度记录
├── output/                  # 输出目录 (自动创建)
├── package.json
└── README.md
```

## 核心逻辑

1. **数据读取**: 读取两个 CSV 文件，保留原始行号
2. **数据验证**: 验证必填字段，标记坏记录
3. **数据合并**: 通过批次号匹配温度记录
4. **温度计算**: 计算每批次的平均/最高/最低温度
5. **拒收判断**: 最高温度 ≥ 阈值则拒收
6. **统计分析**: 按供应商和品类统计
7. **报告生成**: 生成三种格式的输出