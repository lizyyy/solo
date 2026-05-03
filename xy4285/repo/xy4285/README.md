# 短剧出海字幕交付工具 (Subtitle Deliver Tool)

一款面向短剧出海团队的本地自动化交付工具，支持 SRT/VTT 字幕文件的扫描、校验、报告生成和打包交付。

## 功能特性

- 📂 **目录扫描** - 递归扫描项目目录中的所有 SRT/VTT 字幕文件
- 🔍 **多格式支持** - 同时支持 SRT 和 VTT 两种字幕格式解析
- ⏱️ **时间轴校验** - 检测时间重叠、持续时间过长/过短、字幕间隔问题
- 📝 **文本校验** - 检查空行、行长度、标点符号、阅读速度
- 🚫 **敏感词检测** - 支持自定义禁用词列表，支持大小写敏感配置
- 📁 **命名规范检查** - 验证文件名是否符合平台规范
- 🌍 **语言覆盖验证** - 检查每集各平台所需语言版本是否齐全
- 📊 **多格式报告** - 生成终端摘要、Markdown 详细报告、CSV 明细表
- 📦 **平台打包** - 自动将通过校验的文件按平台分类打包

## 快速开始

### 环境要求

- Node.js 16+
- npm 或 yarn

### 安装

```bash
# 克隆项目后安装依赖
npm install

# 编译 TypeScript
npm run build

# 全局链接（可选）
npm link
```

### 使用命令

#### 1. 生成规则配置文件

```bash
# 使用默认规则生成配置文件
subtitle-deliver init

# 或指定输出路径
subtitle-deliver init ./my-rules.json
```

#### 2. 扫描字幕目录

```bash
# 使用默认规则扫描
subtitle-deliver scan ./path/to/subtitles

# 使用自定义规则文件
subtitle-deliver scan ./path/to/subtitles -r ./delivery-rules.json

# 指定输出目录
subtitle-deliver scan ./path/to/subtitles -o ./output

# 禁用某些输出
subtitle-deliver scan ./path/to/subtitles --no-markdown --no-csv
```

#### 3. 验证规则配置

```bash
subtitle-deliver validate-rule ./delivery-rules.json
```

## 项目结构

```
xy4285/
├── src/
│   ├── cli.ts              # CLI 入口
│   ├── types.ts            # 类型定义
│   ├── subtitle-parser.ts  # SRT/VTT 字幕解析器
│   ├── rules-engine.ts     # 规则引擎（校验逻辑）
│   ├── scanner.ts          # 目录扫描器
│   └── exporter.ts         # 报告生成与文件打包
├── tests/
│   ├── subtitle-parser.test.ts
│   └── rules-engine.test.ts
├── examples/
│   ├── delivery-rules.json    # 示例规则配置
│   ├── good/                   # 正常样例
│   │   ├── tiktok_ep001_zh.srt
│   │   ├── tiktok_ep001_en.srt
│   │   └── tiktok_ep001_es.srt
│   └── bad/                    # 异常样例
│       ├── tiktok_ep002_zh.srt    # 包含多种问题
│       ├── tiktok_ep002_en.vtt    # VTT格式问题
│       ├── wrong_filename.srt      # 命名问题
│       └── youtube_ep001_zh.srt    # 语言覆盖问题
├── package.json
├── tsconfig.json
└── README.md
```

## 规则配置说明

规则配置文件是一个 JSON 文件，包含以下几个部分：

### platforms (平台配置)

定义每个交付平台及其所需的语言版本。

```json
{
  "platforms": [
    {
      "name": "TikTok",
      "code": "tiktok",
      "requiredLanguages": ["zh", "en", "es"]
    },
    {
      "name": "YouTube",
      "code": "youtube",
      "requiredLanguages": ["zh", "en", "es", "pt"]
    }
  ]
}
```

### languages (语言配置)

定义不同语言的阅读速度和每行限制。

```json
{
  "languages": [
    {
      "code": "zh",
      "name": "Chinese",
      "readingSpeed": 8,
      "maxLinesPerCue": 2
    },
    {
      "code": "en",
      "name": "English",
      "readingSpeed": 15,
      "maxLinesPerCue": 2
    }
  ]
}
```

- `readingSpeed`: 每秒可读字符数
- `maxLinesPerCue`: 每个字幕最多行数

### timing (时间轴规则)

```json
{
  "timing": {
    "minGapBetweenCues": 40,
    "minCueDuration": 300,
    "maxCueDuration": 7000,
    "allowOverlap": false
  }
}
```

- `minGapBetweenCues`: 字幕间最小间隔（毫秒）
- `minCueDuration`: 单条字幕最小持续时间（毫秒）
- `maxCueDuration`: 单条字幕最大持续时间（毫秒）
- `allowOverlap`: 是否允许时间轴重叠

### text (文本规则)

```json
{
  "text": {
    "allowEmptyLines": false,
    "maxLineLength": 40,
    "checkPunctuation": true
  }
}
```

### forbiddenWords (禁用词规则)

```json
{
  "forbiddenWords": {
    "enabled": true,
    "words": ["敏感词", "禁止", "违规", "forbidden", "violate"],
    "caseSensitive": false
  }
}
```

### naming (命名规则)

```json
{
  "naming": {
    "pattern": "{platform}_{episode}_{language}.{ext}",
    "requiredParts": ["platform", "episode", "language"],
    "separator": "_"
  }
}
```

**命名规范示例**：
- `tiktok_ep001_zh.srt` - TikTok 平台，第1集，中文
- `youtube_ep002_en.vtt` - YouTube 平台，第2集，英文

支持的分隔符：`_` 或 `-` 或 `.`

## 正常样例说明

`examples/good/` 目录下的文件都是符合规范的样例：

### tiktok_ep001_zh.srt

```srt
1
00:00:01,000 --> 00:00:03,500
大家好，欢迎观看本期内容。

2
00:00:03,800 --> 00:00:06,200
今天我们来聊聊短剧出海的趋势。
```

**符合规范的特点**：
- ✅ 文件名格式正确：`{platform}_{episode}_{language}.srt`
- ✅ 时间轴不重叠，间隔合理（>40ms）
- ✅ 每条字幕持续时间在 300ms ~ 7000ms 之间
- ✅ 中文句末有标点
- ✅ 阅读速度合理
- ✅ 无禁用词

### tiktok_ep001_zh.srt + tiktok_ep001_en.srt + tiktok_ep001_es.srt

这三个文件组合在一起，**完全符合 TikTok 平台的语言覆盖要求**（需要 zh、en、es 三种语言）。

## 异常样例说明

`examples/bad/` 目录下的文件包含各种常见问题：

### tiktok_ep002_zh.srt - 多重问题示例

```srt
1
00:00:01,000 --> 00:00:03,500
大家好，这里有敏感词需要处理。  🔴 包含禁用词

2
00:00:03,400 --> 00:00:05,000
这个字幕和上一个时间重叠了。  🔴 时间重叠（-100ms）

3
00:00:05,000 --> 00:00:05,200
这个字幕持续时间太短。  🔴 仅200ms（要求>300ms）

4
00:00:06,000 --> 00:00:14,000
这是一个非常长的字幕...  🟡 持续8秒（要求<7秒）

5
00:00:14,100 --> 00:00:16,000
这里有
空行问题           🟡 包含空行

需要修复

6
00:00:16,500 --> 00:00:17,000
这是一行非常非常非常...长的文本  🟡 行过长
```

### tiktok_ep002_en.vtt - VTT 格式问题

```vtt
WEBVTT

1
00:00:01.000 --> 00:00:03.500
Hello, this has forbidden word.  🔴 包含禁用词 "forbidden"

2
00:00:03.400 --> 00:00:05.000
This subtitle overlaps.  🔴 时间重叠
```

### wrong_filename.srt - 命名问题

文件名 `wrong_filename.srt` 存在以下问题：
- 🔴 缺少平台标识
- 🔴 缺少集数信息
- 🔴 缺少语言代码

### youtube_ep001_zh.srt - 语言覆盖问题

YouTube 平台需要 **zh、en、es、pt** 四种语言，但只有 zh 版本存在：
- ❌ 缺少 en（英语）
- ❌ 缺少 es（西班牙语）
- ❌ 缺少 pt（葡萄牙语）

## 报告输出说明

### 终端摘要

运行 `scan` 命令后，终端会显示：

```
============================================================
           字幕交付工具 - 扫描报告摘要
============================================================

📊 统计概览
────────────────────────────────────────
  总文件数: 6
  ✅ 通过校验: 3
  ❌ 存在错误: 3

⚠️  问题统计
────────────────────────────────────────
  🔴 错误 (Error): 8
  🟡 警告 (Warning): 5
  🔵 提示 (Info): 0

📂 问题分类
────────────────────────────────────────
  ⏱️  时间轴: 3
  📝 文本内容: 4
  🚫 禁用词: 2
  📁 文件命名: 3
  🌍 语言覆盖: 1

🌍 语言覆盖检查
────────────────────────────────────────
  ✅ 覆盖完整: 1
  ❌ 缺少语言: 2
     - [tiktok] 第0002集: 缺少 en, es
     - [youtube] 第0001集: 缺少 en, es, pt

🔴 关键错误列表 (前10项)
────────────────────────────────────────

  📄 tiktok_ep002_zh.srt [00:00:01,000]
     └─ 字幕 #1 包含禁用词：敏感词
     💡 建议: 请替换或移除禁用词

  ...

============================================================
           ⚠️  扫描完成，请修复错误后重试
============================================================
```

### Markdown 报告

生成的 Markdown 报告包含：
- 📊 统计概览表格
- ⚠️ 问题统计表格
- 📂 平台文件分布
- 🌍 语言覆盖检查详情
- 🔴 错误详情（按文件分组）
- 🟡 警告详情（按文件分组）

### CSV 明细

生成的 CSV 文件包含所有问题的详细信息，包含以下列：
- 文件名
- 严重级别
- 分类
- 字幕序号
- 开始时间
- 结束时间
- 问题描述
- 建议

## 运行测试

```bash
# 运行所有测试
npm test

# 运行特定测试
npm test -- tests/subtitle-parser.test.ts
```

## 常见问题

### Q1: 如何添加新的禁用词？

修改规则配置文件中的 `forbiddenWords.words` 数组：

```json
{
  "forbiddenWords": {
    "enabled": true,
    "words": ["敏感词", "禁止", "违规", "你的新禁用词"],
    "caseSensitive": false
  }
}
```

### Q2: 如何调整阅读速度阈值？

修改规则配置文件中的 `languages` 部分：

```json
{
  "languages": [
    {
      "code": "zh",
      "name": "Chinese",
      "readingSpeed": 10,
      "maxLinesPerCue": 2
    }
  ]
}
```

### Q3: 文件名支持哪些分隔符？

支持以下分隔符自动识别：
- 下划线：`_` (推荐)
- 连字符：`-`
- 点号：`.`

例如：
- `tiktok_ep001_zh.srt` ✅
- `tiktok-ep001-zh.srt` ✅
- `tiktok.ep001.zh.srt` ✅

### Q4: 如何忽略某些警告？

目前工具不支持单独忽略某些警告类型。建议：
1. 修复所有错误（Error 级别）
2. 对于警告（Warning 级别），根据实际情况决定是否修复

### Q5: 支持哪些语言代码？

默认支持：
- `zh` - 中文
- `en` - 英语
- `es` - 西班牙语
- `pt` - 葡萄牙语
- `ar` - 阿拉伯语
- `id` - 印尼语
- `vi` - 越南语
- `th` - 泰语
- `ja` - 日语
- `ko` - 韩语

可在规则配置中添加更多语言。

## 许可证

MIT License
