# Font Fallback Checker

国际化字体回退链路预检 CLI 工具，用于在发布前检查多语言字体回退链路上的潜在问题。

## 功能特性

- **缺字检查**: 检查样本文本中的字符是否能在字体回退链中找到
- **Emoji 风险检查**: 检测 Emoji 在 RTL 文本、连续序列中的显示风险
- **阿拉伯文方向性风险**: 检查 RTL 文本（阿拉伯文、希伯来文）中的方向性问题
- **变量字体轴超范围检查**: 验证变量字体轴的请求值是否在有效范围内
- **无用子集检查**: 识别未被使用的字体子集定义

## 项目结构

```
font-fallback-checker/
├── src/
│   ├── cli/
│   │   └── index.ts          # CLI 入口
│   ├── parsers/
│   │   ├── index.ts          # 解析器入口
│   │   ├── fontsParser.ts    # fonts.json 解析
│   │   ├── samplesParser.ts  # samples.csv 解析
│   │   ├── fallbackParser.ts # fallback.yaml 解析
│   │   └── subsetsParser.ts  # subsets/ 目录解析
│   ├── rules/
│   │   ├── index.ts          # 规则引擎入口
│   │   ├── glyphChecker.ts   # 缺字检查
│   │   ├── emojiChecker.ts   # Emoji 风险检查
│   │   ├── arabicChecker.ts  # 阿拉伯文方向性检查
│   │   ├── variableAxisChecker.ts # 变量字体轴检查
│   │   └── subsetChecker.ts  # 无用子集检查
│   ├── reporters/
│   │   ├── index.ts          # 报告生成器入口
│   │   ├── csvReporter.ts    # missing_glyphs.csv 生成
│   │   ├── markdownReporter.ts # font_report.md 生成
│   │   └── htmlReporter.ts   # preview.html 生成
│   ├── types/
│   │   └── index.ts          # TypeScript 类型定义
│   └── utils/
│       └── unicode.ts        # Unicode 工具函数
├── samples/
│   └── data/
│       ├── fonts.json        # 字体配置示例
│       ├── samples.csv       # 多语言样本示例
│       ├── fallback.yaml     # 回退链配置示例
│       └── subsets/          # 子集定义示例
├── package.json
├── tsconfig.json
└── README.md
```

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 使用方法

### 基本命令

```bash
npm run demo
```

这将使用示例数据运行预检并生成报告。

### 自定义数据目录

```bash
# 使用 TypeScript 直接运行
npx ts-node src/cli/index.ts --data-dir ./my-data --output-dir ./my-output

# 或者使用编译后的版本
node dist/cli/index.js -d ./my-data -o ./my-output
```

### 命令行参数

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--data-dir` | `-d` | `data` | 数据目录路径 |
| `--output-dir` | `-o` | `output` | 输出目录路径 |
| `--verbose` | `-v` | - | 显示详细输出 |
| `--quiet` | `-q` | - | 静默模式，只显示错误 |
| `--help` | `-h` | - | 显示帮助信息 |

### 示例命令

```bash
# 详细模式
npm run start -- --data-dir samples/data --output-dir samples/output --verbose

# 静默模式
npm run start -- -d samples/data -o samples/output -q

# 查看帮助
npm run start -- --help
```

## 数据文件格式

### 1. fonts.json

字体配置文件，定义可用的字体及其属性。

```json
{
  "fonts": [
    {
      "name": "NotoSansCJKsc",
      "family": "Noto Sans CJK SC",
      "path": "fonts/NotoSansCJKsc-Regular.otf",
      "supportedScripts": ["Hani", "Hira", "Kana"],
      "weight": 400,
      "style": "normal"
    },
    {
      "name": "NotoSans",
      "family": "Noto Sans",
      "path": "fonts/NotoSans-Regular.ttf",
      "supportedScripts": ["Latn", "Grek", "Cyrl"],
      "isVariable": true,
      "variableAxes": [
        {
          "tag": "wght",
          "name": "Weight",
          "min": 100,
          "max": 900,
          "default": 400
        }
      ]
    }
  ]
}
```

### 2. samples.csv

多语言样本文本，用于检查字体支持情况。

```csv
id,language,script,text,description
sample-001,zh-CN,Hani,你好世界，这是一个中文字符测试。,简体中文基本测试
sample-002,en,Latn,Hello World! This is an English text test.,英文基本测试
sample-003,ar,Arab,النسخة 123 من التطبيق,阿拉伯文包含数字（方向性风险）
```

### 3. fallback.yaml

字体回退链配置，定义不同语言/脚本的字体优先级。

```yaml
defaults:
  baseFonts:
    - NotoSans
    - NotoSansCJKsc
  emojiFont: NotoColorEmoji

chains:
  - language: zh-CN
    script: Hani
    fonts:
      - NotoSansCJKsc
      - NotoSans

  - language: en
    script: Latn
    fonts:
      - NotoSans
```

### 4. subsets/ 目录

字体子集定义，每个 YAML 文件定义一个子集的 Unicode 范围。

**subsets/basic_latin.yaml**:
```yaml
name: Basic Latin
description: 基本拉丁字符集 (ASCII)
unicodeRanges:
  - start: 0x0000
    end: 0x007F
    name: Basic Latin
  - start: 0x0080
    end: 0x00FF
    name: Latin-1 Supplement
```

Unicode 范围可以使用十进制或十六进制字符串（如 `"U+0041"` 或 `"0x0041"`）。

## 输出文件

运行工具后，输出目录将包含以下文件：

### 1. missing_glyphs.csv

包含所有在字体回退链中无法找到的字符详情。

| 列名 | 说明 |
|------|------|
| Sample ID | 样本标识符 |
| Language | 语言代码 |
| Script | 书写系统 |
| Character | 字符 |
| Code Point | Unicode 码点 (U+XXXX) |
| Decimal | 十进制码点 |
| Sample Text | 完整样本文本 |
| Fallback Chain | 字体回退链 |
| Missing In Fonts | 缺失该字符的字体列表 |

### 2. font_report.md

完整的 Markdown 格式报告，包含：

- 执行摘要
- 缺字检查结果
- Emoji 风险检查
- 阿拉伯文方向性风险
- 变量字体轴问题
- 无用子集
- 验证错误

### 3. preview.html

交互式 HTML 报告，支持：

- 概览卡片
- 标签页导航
- 表格排序和筛选
- 颜色编码的状态指示

## 异常样本示例

工具能够检测以下类型的异常样本：

### 1. 阿拉伯文方向性风险

```csv
sample-007,ar,Arab,النسخة 123 من التطبيق متاحة الآن,阿拉伯文包含数字
sample-008,ar,Arab,😊 مرحبا بالعالم 😊,阿拉伯文包含Emoji
```

**检测到的问题**:
- 混合方向字符（LTR 数字 + RTL 文字）
- Emoji 在 RTL 文本中的方向性问题
- 中性字符（标点符号）的潜在 Bidi 算法重排风险

### 2. 变量字体轴超范围

```json
{
  "name": "NotoSans",
  "isVariable": true,
  "variableAxes": [
    {
      "tag": "wght",
      "name": "Weight",
      "min": 100,
      "max": 900,
      "default": 400
    }
  ]
}
```

**检测到的问题**:
- 请求字重 50 低于最小值 100
- 请求字重 1000 高于最大值 900

### 3. 无用子集

如果子集定义了但样本中没有使用任何该范围内的字符，工具会标记为无用子集。

## 脚本标签参考

| 标签 | 说明 |
|------|------|
| Latn | 拉丁字母 |
| Cyrl | 西里尔字母 |
| Grek | 希腊字母 |
| Hani | 汉字（中日韩统一表意文字） |
| Hira | 平假名 |
| Kana | 片假名 |
| Hang | 谚文（韩文） |
| Arab | 阿拉伯文 |
| Hebr | 希伯来文 |
| Deva | 天城文（印地语等） |
| Thai | 泰文 |

## 退出码

| 码 | 含义 |
|------|------|
| 0 | 成功，所有规则通过 |
| 1 | 一个或多个规则检查失败 |
| 2 | 执行错误（文件未找到、解析错误等） |

## 开发

### 运行测试

```bash
# 目前没有测试框架，使用示例数据进行手动测试
npm run demo
```

### 代码结构

- **parsers/**: 负责解析各种输入文件格式
  - 每个解析器都有完善的错误处理
  - 返回结构化数据和验证错误

- **rules/**: 实现各种检查规则
  - 每个规则返回 `RuleResult<T>` 结构
  - 包含通过/失败状态和问题列表

- **reporters/**: 生成输出报告
  - CSV: 机器可读的缺字列表
  - Markdown: 人类可读的详细报告
  - HTML: 交互式可视化报告

## 许可证

MIT
