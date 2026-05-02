# Prepress Checker

包装印刷厂制版预检 CLI 工具，用于检查交付包中的刀模 SVG、订单信息、工艺规则和条码清单。

## 功能特性

- **SVG 刀模检查**: 检查 viewBox、尺寸单位、刀线闭合状态
- **出血边距检查**: 验证元素是否在安全区内
- **专色命名检查**: 检查专色名称是否符合规范
- **套准孔检查**: 验证套准孔的存在、位置和尺寸
- **条码检查**: 检查条码尺寸、安静区和安全区位置
- **多格式报告导出**: 支持 Markdown、CSV、JSON 三种格式

## 安装

```bash
npm install
```

## 编译

```bash
npm run build
```

## 使用方法

### 基本命令

```bash
# 使用 ts-node 直接运行
npx ts-node src/cli/index.ts check -s samples/dieline-valid.svg

# 或编译后运行
npm run build
node dist/cli/index.js check -s samples/dieline-valid.svg
```

### 完整参数示例

```bash
npx ts-node src/cli/index.ts check \
  -s samples/dieline-valid.svg \
  -o samples/order.csv \
  -r samples/rules.yaml \
  -b samples/barcodes.json \
  -d output/my-order \
  -n my-report \
  -f json csv md \
  -v
```

### 命令参数

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--svg` | `-s` | 刀模 SVG 文件路径 (必需) | - |
| `--order` | `-o` | 订单 CSV 文件路径 | - |
| `--rules` | `-r` | 工艺规则 YAML 文件路径 | 使用默认规则 |
| `--barcodes` | `-b` | 条码清单 JSON 文件路径 | - |
| `--output-dir` | `-d` | 报告输出目录 | `./output` |
| `--base-name` | `-n` | 报告文件名前缀 | `prepress-report` |
| `--formats` | `-f` | 输出格式: json, csv, md | 全部三种 |
| `--enable` | - | 启用指定规则分类 | - |
| `--disable` | - | 禁用指定规则分类 | - |
| `--verbose` | `-v` | 显示详细输出 | - |

### 其他命令

```bash
# 列出所有可用规则
npx ts-node src/cli/index.ts list-rules

# 创建默认工艺规则配置文件
npx ts-node src/cli/index.ts init-rules -o my-rules.yaml
```

## 示例数据

`samples/` 目录包含测试用例：

| 文件 | 说明 |
|------|------|
| `order.csv` | 订单信息示例 |
| `rules.yaml` | 工艺规则配置示例 |
| `barcodes.json` | 正常条码清单 |
| `dieline-valid.svg` | 有效的刀模 SVG |
| `dieline-no-viewbox.svg` | **边界情况**: 缺少 viewBox |
| `dieline-open-path.svg` | **边界情况**: 刀线未闭合 |
| `dieline-barcode-edge.svg` | 用于条码测试的 SVG |
| `barcodes-edge-case.json` | **边界情况**: 条码尺寸/位置问题 |
| `dieline-all-issues.svg` | 综合问题测试 SVG |

## 演示命令

### 1. 正常 SVG 检查

```bash
npx ts-node src/cli/index.ts check \
  -s samples/dieline-valid.svg \
  -o samples/order.csv \
  -r samples/rules.yaml \
  -b samples/barcodes.json \
  -d output/valid \
  -v
```

### 2. 测试缺少 viewBox 的 SVG

```bash
npx ts-node src/cli/index.ts check \
  -s samples/dieline-no-viewbox.svg \
  -o samples/order.csv \
  -r samples/rules.yaml \
  -d output/no-viewbox \
  -v
```

### 3. 测试刀线未闭合的 SVG

```bash
npx ts-node src/cli/index.ts check \
  -s samples/dieline-open-path.svg \
  -o samples/order.csv \
  -r samples/rules.yaml \
  -d output/open-path \
  -v
```

### 4. 测试条码边界情况

```bash
npx ts-node src/cli/index.ts check \
  -s samples/dieline-barcode-edge.svg \
  -o samples/order.csv \
  -r samples/rules.yaml \
  -b samples/barcodes-edge-case.json \
  -d output/barcode-edge \
  -v
```

### 5. 只启用特定规则

```bash
# 只检查刀线和条码
npx ts-node src/cli/index.ts check \
  -s samples/dieline-valid.svg \
  --enable dieline barcode \
  -d output/enabled-rules \
  -v
```

### 6. 禁用特定规则

```bash
# 禁用套准孔检查
npx ts-node src/cli/index.ts check \
  -s samples/dieline-valid.svg \
  --disable registration \
  -d output/disabled-rules \
  -v
```

## 输出报告

工具会生成三种格式的报告：

### 1. Markdown 报告 (`report.md`)

- 包含完整的检查结果摘要
- 问题按严重程度和类别分组
- 每个问题包含详情和建议

### 2. CSV 问题列表 (`issues.csv`)

- Excel 兼容格式 (UTF-8 BOM)
- 包含问题ID、严重程度、类别、描述、位置等字段

### 3. JSON 摘要 (`summary.json`)

```json
{
  "orderId": "ORD-2024-001",
  "timestamp": "2024-05-03T00:00:00.000Z",
  "status": "fail",
  "summary": {
    "total": 5,
    "critical": 1,
    "warning": 1,
    "info": 3
  },
  "issuesByCategory": {
    "viewbox": { "total": 1, "critical": 1, ... },
    "dieline": { "total": 1, "warning": 1, ... }
  }
}
```

## 规则分类

| 分类 | 说明 | 严重程度 |
|------|------|----------|
| `viewbox` | 检查 SVG viewBox 属性 | 警告/严重 |
| `dimension` | 检查 SVG 尺寸单位 | 警告 |
| `dieline` | 检查刀线闭合、颜色、线宽 | 严重 |
| `bleed` | 检查出血边距和安全区 | 警告 |
| `spot_color` | 检查专色命名规范 | 警告 |
| `registration` | 检查套准孔 | 警告 |
| `barcode` | 检查条码尺寸和位置 | 警告/严重 |

## 工艺规则配置

可以通过 YAML 文件自定义检查规则：

```yaml
# 出血边距设置
bleed:
  margin: 3
  unit: "mm"

# 专色命名规则
spotColors:
  allowedPrefixes:
    - "PANTONE"
    - "Spot"
    - "专色"
  caseSensitive: false

# 套准孔规则
registrationMarks:
  required: true
  size:
    min: 5
    max: 15
  positionTolerance: 2

# 条码规则
barcode:
  minWidth: 20
  maxWidth: 100
  minHeight: 10
  maxHeight: 50
  quietZone: 5

# 刀线规则
dieline:
  strokeColor: "#FF0000"
  strokeWidth: 0.5
  mustBeClosed: true
```

## 项目结构

```
src/
├── cli/
│   └── index.ts          # CLI 入口
├── parsers/
│   ├── index.ts          # 导出
│   ├── csvParser.ts      # CSV 解析
│   ├── svgParser.ts      # SVG 解析
│   ├── yamlParser.ts     # YAML 解析
│   └── jsonParser.ts     # JSON 解析
├── rules/
│   ├── index.ts          # 导出
│   ├── types.ts          # 规则类型
│   ├── engine.ts         # 规则引擎
│   ├── viewBoxRule.ts    # ViewBox 检查
│   ├── dimensionRule.ts  # 尺寸单位检查
│   ├── dielineRule.ts    # 刀线检查
│   ├── bleedRule.ts      # 出血边距检查
│   ├── spotColorRule.ts  # 专色命名检查
│   ├── registrationRule.ts # 套准孔检查
│   └── barcodeRule.ts    # 条码检查
├── report/
│   ├── index.ts          # 导出
│   ├── types.ts          # 报告类型
│   ├── exporter.ts       # 统一导出
│   ├── markdownExporter.ts # Markdown 导出
│   ├── csvExporter.ts    # CSV 导出
│   └── jsonExporter.ts   # JSON 导出
└── types/
    └── index.ts          # 公共类型

samples/                   # 示例数据
output/                    # 输出目录
```

## 许可证

MIT
