# 🎬 字幕交付体检 (Subtitle Health Check)

一个用于播客和课程视频字幕/章节/广告点位校验的命令行工具，帮助你在上传前发现潜在问题。

## ✨ 功能特性

- **validate** - 完整校验：检查时间倒序、字幕重叠、静音空档、章节覆盖率、标题格式、广告点位、敏感词、超长字幕
- **fix-suggest** - 智能修复建议：给出剪辑同学能看懂的修复步骤，标出文件名和时间码
- **package** - 打包交付：把通过或带警告的交付文件整理成标准输出目录
- **export-report** - 导出报告：支持 Markdown、JSON、HTML 三种格式

## 📦 安装

### 环境要求
- Node.js 14.0 或更高版本
- npm 或 yarn

### 安装步骤

```bash
# 1. 克隆项目或下载源码
cd subtitle-health-check

# 2. 安装依赖
npm install

# 3. 编译 TypeScript
npm run build

# 4. （可选）全局安装
npm link
```

### 验证安装

```bash
# 查看帮助
node dist/cli/index.js --help

# 或者如果已全局安装
subtitle-health-check --help
# 或简写
shc --help
```

## 📁 项目目录结构

```
subtitle-health-check/
├── dist/                    # 编译后的 JavaScript 代码
├── src/                     # TypeScript 源代码
│   ├── cli/                # CLI 入口
│   ├── core/               # 核心逻辑
│   ├── parsers/            # 解析器
│   ├── validators/         # 校验器
│   ├── suggestions/        # 修复建议生成
│   ├── reporters/          # 报告生成
│   ├── packager/           # 打包模块
│   ├── types/              # 类型定义
│   └── utils/              # 工具函数
├── examples/               # 示例数据
│   ├── normal/            # 正常样例
│   ├── error-case-1/      # 异常样例 1（时间重叠、倒序等）
│   └── error-case-2/      # 异常样例 2（敏感词、静音空档等）
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 快速开始

### 项目目录结构要求

工具会自动扫描你的项目目录，建议按照以下结构组织文件：

```
your-project/
├── subtitles.srt           # 或 subtitles.vtt（字幕文件）
├── chapters.csv            # 章节信息
├── ads.csv                 # 广告点位（可选）
├── health-check.config.json # 配置文件（可选）
└── delivery/               # 交付文件目录（可选）
    ├── final-video.mp4
    └── ...
```

### 配置文件

可以在项目目录中创建 `health-check.config.json` 来自定义校验规则：

```json
{
  "maxSubtitleLength": 40,
  "maxSilenceGap": 5,
  "minChapterCoverage": 0.9,
  "sensitiveWords": ["敏感词1", "敏感词2"],
  "chapterTitlePattern": "^\\d+\\.\\s.*"
}
```

**配置选项说明：**

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `maxSubtitleLength` | number | 40 | 单条字幕最大字符数 |
| `maxSilenceGap` | number | 5 | 最大允许静音空档（秒） |
| `minChapterCoverage` | number | 0.9 | 最小章节覆盖率（0-1） |
| `sensitiveWords` | string[] | [] | 需要检测的敏感词列表 |
| `chapterTitlePattern` | string | "" | 章节标题格式正则表达式 |

## 📖 命令详解

### 1. validate - 校验项目

扫描项目目录并执行完整校验。

```bash
# 基本用法
shc validate /path/to/your/project

# 示例
shc validate examples/normal
```

**校验项说明：**

| 校验项 | 严重程度 | 说明 |
|--------|----------|------|
| 时间倒序 | 错误 | 字幕开始时间早于前一个字幕 |
| 时间重叠 | 错误 | 两个字幕时间段有重叠 |
| 字幕重叠 | 错误 | 任意字幕对之间的重叠检测 |
| 静音空档过长 | 警告 | 两个字幕之间的静音超过阈值 |
| 字幕过长 | 错误 | 单条字幕字符数超过限制 |
| 敏感词检测 | 警告 | 字幕中包含配置的敏感词 |
| 章节时间倒序 | 错误 | 章节开始时间顺序错误 |
| 章节覆盖率不足 | 警告 | 章节未覆盖足够的视频时长 |
| 章节标题格式错误 | 警告 | 标题不符合指定的正则模式 |
| 章节在字幕范围外 | 警告 | 章节开始/结束时间超出字幕范围 |
| 广告在字幕范围外 | 错误 | 广告点位时间超出字幕范围 |
| 广告无字幕重叠 | 警告 | 广告点位未落在任何字幕时间段内 |

**预期输出示例（正常样例）：**

```
============================================================
           🎬 字幕交付体检报告
============================================================

📅 检查时间: 2026/5/3 20:56:43
📁 项目路径: /path/to/examples/normal
📊 整体状态: ⚠️ 存在警告

------------------------------------------------------------
检查统计
------------------------------------------------------------

  🔴 错误: 0 项
  🟡 警告: 1 项
  🔵 信息: 0 项

------------------------------------------------------------
🎬 字幕文件检查
------------------------------------------------------------

  📄 subtitles.srt
     状态: ✅ 通过
     统计: 错误 0 | 警告 0

------------------------------------------------------------
📑 章节文件检查
------------------------------------------------------------

  📄 chapters.csv
     状态: ⚠️ 存在警告
     统计: 错误 0 | 警告 1

     问题列表:
        🟡 章节开始时间早于字幕：章节 "开场介绍" (00:00:00) 开始于字幕开始时间 00:00:01,000 之前

------------------------------------------------------------
📢 广告点位检查
------------------------------------------------------------

  📄 ads.csv
     状态: ✅ 通过
     统计: 错误 0 | 警告 0

============================================================
```

### 2. fix-suggest - 生成修复建议

根据校验结果生成详细的修复建议。

```bash
# 基本用法
shc fix-suggest /path/to/your/project

# 示例
shc fix-suggest examples/error-case-1
```

**建议优先级：**
- 🔴 **高优先级** - 必须修复的错误
- 🟡 **中优先级** - 建议修复的警告
- 🟢 **低优先级** - 可选的提示信息

**预期输出示例：**

```
📋 修复建议 (共 13 项)
============================================================

📊 优先级统计:
   🔴 高优先级: 10 项
   🟡 中优先级: 3 项
   🟢 低优先级: 0 项

🔴 问题 1/13
   问题类型: time_overlap
   文件: subtitles.srt
   时间: 00:00:01,000 - 00:00:08,200

   问题描述: 时间重叠：字幕 #1 与 字幕 #2 重叠 0.500 秒

   💡 修复建议:
      1. 打开文件: subtitles.srt
      2. 找到时间范围 00:00:01,000 - 00:00:08,200
      3. 检查字幕 #1 和 #2
      4. 将后一个字幕的开始时间调整到前一个字幕结束时间之后
      5. 或者缩短前一个字幕的结束时间，确保两个字幕之间至少有 0.1 秒间隔

------------------------------------------------------------
...（更多建议）
```

### 3. package - 打包交付文件

将项目文件整理成标准交付目录结构。

```bash
# 基本用法
shc package /path/to/your/project -o ./output

# 带选项
shc package /path/to/your/project \
  --output ./delivery-package \
  --include-warnings \
  --copy-source \
  --reports

# 示例
shc package examples/normal -o examples/normal/output
```

**命令选项：**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `-o, --output` | `./output` | 输出目录路径 |
| `--include-warnings` | `true` | 即使有警告也打包 |
| `--no-include-warnings` | - | 有错误时不打包 |
| `--copy-source` | `true` | 复制源文件到输出目录 |
| `--no-copy-source` | - | 不复制源文件 |
| `--reports` | `true` | 生成报告文件 |
| `--no-reports` | - | 不生成报告 |

**输出目录结构：**

```
output/
├── subtitles/           # 字幕文件
│   └── subtitles.srt
├── chapters/            # 章节文件
│   └── chapters.csv
├── ad-points/           # 广告点位文件
│   └── ads.csv
├── delivery/            # 交付文件
│   └── final-video.mp4
├── reports/             # 检查报告
│   ├── health-check-report-xxx.md
│   ├── health-check-report-xxx.json
│   └── health-check-report-xxx.html
├── MANIFEST.json        # 打包清单
└── README.txt           # 打包说明
```

**预期输出示例：**

```
✅ 打包完成！
   输出目录: /path/to/output
   复制文件: 4 个

📄 生成的报告:
   - reports/health-check-report-2026-05-03T12-57-32.md
   - reports/health-check-report-2026-05-03T12-57-32.json
   - reports/health-check-report-2026-05-03T12-57-32.html

📋 打包清单:
   包含文件: 4 个
   排除文件: 0 个
```

### 4. export-report - 导出报告

导出详细的检查报告。

```bash
# 基本用法
shc export-report /path/to/your/project -o ./reports

# 指定格式
shc export-report /path/to/your/project \
  --output ./reports \
  --format all

# 示例
shc export-report examples/normal -o examples/normal/reports
```

**命令选项：**

| 选项 | 默认值 | 说明 |
|------|--------|------|
| `-o, --output` | `./reports` | 输出目录路径 |
| `-f, --format` | `all` | 输出格式：`all`, `markdown`, `json`, `html` |

**支持的格式：**

- **Markdown** - 适用于文档和邮件分享
- **JSON** - 适用于程序处理
- **HTML** - 适用于浏览器查看

**预期输出示例：**

```
📄 生成报告到: /path/to/reports
   ✅ Markdown: health-check-report-2026-05-03T12-57-19.md
   ✅ JSON: health-check-report-2026-05-03T12-57-19.json
   ✅ HTML: health-check-report-2026-05-03T12-57-19.html

✅ 报告导出完成！
```

## 📄 文件格式说明

### 字幕文件格式 (.srt)

```
1
00:00:01,000 --> 00:00:04,500
欢迎收听本期播客节目

2
00:00:05,000 --> 00:00:08,200
今天我们要讨论一个非常有趣的话题
```

### 字幕文件格式 (.vtt)

```
WEBVTT

00:01.000 --> 00:04.500
欢迎收听本期播客节目

00:05.000 --> 00:08.200
今天我们要讨论一个非常有趣的话题
```

### 章节文件格式 (.csv)

```csv
start_time,title
00:00:00,开场介绍
00:00:05,话题引入
00:00:12,核心概念讲解
```

**可选列：**
- `end_time` - 章节结束时间
- `id` - 章节序号

### 广告点位文件格式 (.csv)

```csv
start_time,end_time,description
00:00:08,00:00:12,课程推广广告
00:00:28,00:00:32,赞助商广告
```

## 🎯 示例数据

项目包含 3 个示例目录，方便你测试工具的各种功能：

### 1. 正常样例 (`examples/normal`)

- ✅ 字幕时间轴正确
- ✅ 章节覆盖率正常
- ✅ 广告点位正确
- ⚠️ 只有一个小警告（章节开始时间早于字幕 1 秒）

**测试命令：**
```bash
shc validate examples/normal
shc package examples/normal -o examples/normal/output
```

### 2. 异常样例 1 (`examples/error-case-1`)

包含多种常见错误：
- 🔴 字幕时间重叠
- 🔴 字幕时间倒序
- 🔴 单条字幕过长（41 字符）
- 🔴 章节时间倒序
- 🔴 广告点位在字幕范围之外
- 🟡 静音空档过长（14 秒）
- 🟡 章节覆盖率不足

**测试命令：**
```bash
shc validate examples/error-case-1
shc fix-suggest examples/error-case-1
```

### 3. 异常样例 2 (`examples/error-case-2`)

包含其他类型的问题：
- 🟡 敏感词检测（配置了敏感词列表）
- 🟡 静音空档过长（6 秒）
- 🟡 章节覆盖率不足

**测试命令：**
```bash
shc validate examples/error-case-2
shc export-report examples/error-case-2 -o examples/error-case-2/reports
```

## 🔧 常见问题

### Q1: 工具找不到我的文件？

确保文件命名符合以下模式：
- 字幕文件：`*.srt` 或 `*.vtt`
- 章节文件：`chapters.csv`、`章节.csv`、`chapter.csv` 或名称包含 "chapter"、"章节"
- 广告文件：`ads.csv`、`广告.csv`、`ad-points.csv` 或名称包含 "ad"、"广告"

### Q2: 如何自定义校验规则？

在项目目录创建 `health-check.config.json` 文件，参考「配置文件」章节。

### Q3: 退出码含义？

| 退出码 | 含义 |
|--------|------|
| 0 | 执行成功，无错误（可能有警告） |
| 1 | 执行失败，存在错误 |

### Q4: 支持同时检查多个字幕文件吗？

是的，工具会自动扫描项目目录中的所有 `.srt` 和 `.vtt` 文件。

## 📊 开发指南

### 项目架构

```
┌─────────────────────────────────────────────────────────┐
│                      CLI Layer                            │
│  (参数解析、命令调度、输出格式化)                         │
├─────────────────────────────────────────────────────────┤
│                      Core Layer                           │
│  (项目扫描、健康检查服务、业务逻辑编排)                   │
├───────────────┬───────────────┬─────────────────────────┤
│   Parsers     │  Validators   │      Utilities          │
│  (文件解析)    │  (规则校验)    │    (工具函数)           │
├───────────────┴───────────────┴─────────────────────────┤
│                   Feature Modules                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────────┐   │
│  │ Suggestions │ │  Reporters  │ │   Packager      │   │
│  │ (修复建议)  │ │ (报告生成)  │ │  (打包导出)     │   │
│  └─────────────┘ └─────────────┘ └─────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

### 添加新的校验规则

1. 在 `src/validators/validator.ts` 中添加新的校验函数
2. 在 `src/types/index.ts` 中添加新的错误类型（如果需要）
3. 在 `src/suggestions/fix-suggestions.ts` 中添加对应的修复建议处理器

### 构建和测试

```bash
# 编译
npm run build

# 监听模式编译
npm run dev

# 运行测试
npm test
```

## 📝 更新日志

### v1.0.0

- 初始版本发布
- 支持 validate、fix-suggest、package、export-report 四个核心命令
- 支持 .srt 和 .vtt 字幕格式
- 支持章节 CSV 和广告点位 CSV 解析
- 支持 Markdown、JSON、HTML 报告导出
- 包含 3 个示例数据目录

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

---

**提示：** 第一次使用建议先运行 `examples/normal` 目录的测试，熟悉工具的输出格式。
