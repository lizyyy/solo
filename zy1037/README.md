# Podcast Delivery Check (PDC)

播客交付体检 CLI 工具 - 在上传之前检查音频文件、响度、章节时间等。

## 功能特性

- ✅ **文件检查** - 验证音频文件是否存在
- 🎵 **格式分析** - 检查采样率、声道数、比特深度一致性
- 🔊 **响度检测** - 使用 RMS 近似计算响度（支持与目标值对比）
- 🔇 **静音检测** - 检测音频开头和结尾的过长静音
- 📝 **命名规则** - 验证文件名是否符合自定义规则
- 📖 **章节验证** - 检查章节时间是否有效且不超出音频长度
- 📊 **报告导出** - 支持导出 Markdown、HTML、JSON 三种格式报告

## 安装

### 环境要求

- Node.js >= 18.0.0
- npm 或 yarn

### 安装步骤

```bash
# 克隆仓库
git clone <repository-url>
cd podcast-delivery-check

# 安装依赖
npm install

# 编译 TypeScript
npm run build

# 链接到全局（可选）
npm link
```

## 快速开始

### 一键演示

运行完整演示流程，自动生成示例项目并执行检查：

```bash
npm run demo
```

### 手动流程

#### 1. 初始化项目

```bash
# 在当前目录初始化
npx pdc init

# 或指定目录
npx pdc init --output ./my-podcast

# 使用 JSON 格式
npx pdc init --format json
```

这会生成：
- `manifest.yaml` - 节目清单配置
- `audio/` - 音频文件目录
- `output/` - 报告输出目录
- `README.md` - 项目说明文档

#### 2. 准备音频文件

```bash
# 生成示例音频（包含故意设置的问题，用于测试）
npm run generate-samples -- --output ./audio --with-issues

# 或生成正常示例
npm run generate-samples -- --output ./audio
```

如果有真实音频文件，直接放入 `audio/` 目录即可。

#### 3. 检查音频文件

```bash
# 查看音频基本信息
npx pdc inspect manifest.yaml

# 详细输出
npx pdc inspect manifest.yaml --verbose

# 以 JSON 格式输出
npx pdc inspect manifest.yaml --json
```

#### 4. 执行完整验证

```bash
# 基础验证
npx pdc validate manifest.yaml

# 详细输出问题信息
npx pdc validate manifest.yaml --verbose

# 显示响度计算说明
npx pdc validate manifest.yaml --loudness-doc
```

#### 5. 导出报告

```bash
# 导出所有格式的报告
npx pdc report manifest.yaml

# 导出到指定目录
npx pdc report manifest.yaml --output ./reports

# 只导出特定格式
npx pdc report manifest.yaml --format html
npx pdc report manifest.yaml --format markdown
npx pdc report manifest.yaml --format json
```

## 命令详细说明

### init - 初始化项目

```bash
pdc init [options]

选项:
  -f, --format <format>    manifest 格式: yaml 或 json (默认: yaml)
  -n, --name <name>        播客名称 (默认: "我的播客")
  -e, --episode <episode>  节目期数 (默认: "EP001 - 第一期节目")
  -o, --output <directory> 输出目录 (默认: ".")
  --no-create-audio-dir    不创建 audio 目录
```

### inspect - 检查音频信息

```bash
pdc inspect [options] <manifest>

参数:
  manifest  manifest 文件路径

选项:
  -v, --verbose  详细输出
  --json         以 JSON 格式输出
```

### validate - 执行验证

```bash
pdc validate [options] <manifest>

参数:
  manifest  manifest 文件路径

选项:
  -v, --verbose      详细输出问题信息
  --json             以 JSON 格式输出
  --loudness-doc     显示响度计算说明文档
```

### report - 导出报告

```bash
pdc report [options] <manifest>

参数:
  manifest  manifest 文件路径

选项:
  -f, --format <format>  报告格式: markdown, html, json, 或 all (默认: all)
  -o, --output <path>    输出文件或目录
  -n, --name <name>      报告文件名 (不含扩展名) (默认: "delivery-check-report")
```

### generate-samples - 生成示例音频

```bash
npm run generate-samples -- [options]

选项:
  -o, --output <directory>   输出目录 (默认: "./audio")
  -r, --sample-rate <rate>   采样率 (Hz) (默认: "44100")
  --with-issues              生成包含问题的示例音频
```

## Manifest 格式说明

### 基础结构 (YAML)

```yaml
version: "1.0.0"

project:
  name: "播客名称"
  episode: "节目期数"
  publishDate: "2024-01-15"

settings:
  targetLoudness: -16      # 目标响度 (RMS dB)
  loudnessTolerance: 2     # 响度容差 (±dB)
  maxSilenceAtStart: 0.5   # 最大开头静音 (秒)
  maxSilenceAtEnd: 1.0     # 最大结尾静音 (秒)
  sampleRate: 44100        # 期望采样率 (可选)
  channels: 1              # 期望声道数 (可选)

namingRules:
  pattern: "^ep\\d{3}-[a-z0-9-]+\\.wav$"  # 文件名正则
  description: "文件名格式: epXXX-描述性名称.wav"
  examples:
    - "ep001-intro.wav"
    - "ep001-main.wav"

export:
  directory: "./output"

audioFiles:
  - id: "intro-001"
    path: "./audio/intro.wav"
    role: "intro"      # intro | main | ad | outro
    name: "片头"

chapters:
  - id: "chap-001"
    title: "开场问候"
    startTime: "0:00"
    audioRef: "intro-001"
```

### 字段说明

#### settings

| 字段 | 类型 | 说明 |
|------|------|------|
| targetLoudness | number | 目标响度 (RMS dB)，播客通常 -16 ~ -14 |
| loudnessTolerance | number | 响度容差，通常 2 dB |
| maxSilenceAtStart | number | 最大允许的开头静音（秒） |
| maxSilenceAtEnd | number | 最大允许的结尾静音（秒） |
| sampleRate | number | 期望的采样率（可选） |
| channels | number | 期望的声道数（可选） |

#### audioFiles.role

| 角色 | 说明 |
|------|------|
| intro | 片头/开场白 |
| main | 正片/主要内容 |
| ad | 广告口播 |
| outro | 片尾/结束语 |

#### 时间格式

支持以下时间格式：
- `0:00` - 分:秒
- `15:30.500` - 分:秒.毫秒
- `1:30:00` - 时:分:秒
- `3600` - 秒数

## 响度计算说明

### ⚠️ 重要提示

本工具使用 **RMS（均方根）** 近似计算响度，而非专业的 **LUFS**（Loudness Units Full Scale）。

### RMS vs LUFS

| 指标 | RMS（本工具） | LUFS（专业标准） |
|------|--------------|-----------------|
| 计算方式 | 简单的能量平均 | 基于听觉感知的加权（ITU-R BS.1770） |
| 时间窗口 | 全文件平均 | 分窗口分析（通常 400ms） |
| 门控 | 无 | 静音自动排除 |

### 近似关系

对于典型的语音/播客内容：
- **RMS -20 dB ≈ 感知响度 -16 LUFS**
- 这只是近似值，用于快速检查一致性

### 播客常用标准

| 平台 | 目标集成响度 | 峰值限制 |
|------|-------------|---------|
| Apple Podcasts | -16 LUFS | -1 dBTP |
| Spotify | -14 LUFS | -1 dBTP |
| YouTube | -14 LUFS | -1 dBTP |

### 建议

如果需要专业级响度分析，请使用：
- **Audacity** - 内置响度分析（免费）
- **ffmpeg + ebur128** - 命令行工具
- **专业 DAW** - Logic、Pro Tools、Reaper 等

## 项目结构

```
podcast-delivery-check/
├── bin/
│   └── pdc.js              # CLI 入口脚本
├── src/
│   ├── index.ts             # 主 CLI 入口
│   ├── types/
│   │   └── index.ts         # 类型定义
│   ├── utils/
│   │   └── time.ts          # 时间解析工具
│   ├── manifest/
│   │   └── parser.ts        # Manifest 解析器
│   ├── audio/
│   │   ├── index.ts         # 音频分析入口
│   │   ├── wav-parser.ts    # WAV 文件解析
│   │   ├── loudness.ts      # 响度计算
│   │   └── silence-detector.ts  # 静音检测
│   ├── validation/
│   │   └── validator.ts     # 规则校验器
│   ├── report/
│   │   └── generator.ts     # 报告生成器
│   ├── cli/
│   │   └── commands/
│   │       ├── init.ts      # init 命令
│   │       ├── inspect.ts   # inspect 命令
│   │       ├── validate.ts  # validate 命令
│   │       └── report.ts    # report 命令
│   └── scripts/
│       └── generate-samples.ts  # 示例音频生成
├── dist/                     # 编译输出
├── package.json
├── tsconfig.json
└── README.md
```

## 验证规则

工具会按以下规则进行验证：

### 1. 文件存在性检查 (error)
- 检查 manifest 中引用的所有音频文件是否存在

### 2. 命名规则检查 (warning)
- 验证文件名是否符合 `namingRules.pattern` 正则表达式

### 3. 章节时间验证 (error)
- 检查时间格式是否有效
- 检查时间是否为负数
- 检查时间是否超出关联音频的长度
- 检查是否有重复的章节时间

### 4. 格式一致性检查 (warning)
- 检查所有音频文件的采样率是否一致
- 检查所有音频文件的声道数是否一致
- 与 manifest.settings 中的期望值对比

### 5. 响度检查 (warning/error)
- 检查 RMS 响度是否在目标范围内
- 偏差超过容差的 2 倍时标记为 error
- 检查峰值是否过高（可能导致削波）
- 检查各音频段响度差异是否过大

### 6. 静音检测 (warning)
- 检测音频开头的静音时长
- 检测音频结尾的静音时长
- 与 manifest.settings 中的最大静音时长对比

## 报告格式

### JSON 报告

包含完整的机器可读数据：
- 项目信息
- 检查结果
- 所有音频文件的详细分析
- 所有问题及其上下文

### Markdown 报告

适合阅读和分享：
- 项目信息表格
- 统计摘要
- 建议列表
- 音频文件详情表格
- 问题详情（分严重级别）
- 章节信息
- 设置信息

### HTML 报告

美观的可视化报告：
- 响应式设计
- 彩色状态指示
- 表格样式
- 问题卡片式展示

## 异常处理

工具会优雅处理以下异常情况：

| 异常 | 处理方式 |
|------|---------|
| Manifest 文件不存在 | 输出明确错误信息，退出码 1 |
| Manifest 解析错误 (JSON/YAML 语法) | 显示具体解析错误位置 |
| 缺少必填字段 | 列出所有缺失字段 |
| 音频文件不存在 | 标记为 error，继续检查其他文件 |
| 音频格式不支持 | 标记为 warning，跳过详细分析 |
| 时间格式无效 | 标记为 error，给出有效格式示例 |
| 报告目录不可写 | 输出权限错误，退出码 1 |

## 示例命令链

完整的工作流程示例：

```bash
# 1. 初始化项目
npm run build
npx pdc init --output ./my-episode

cd ./my-episode

# 2. 生成示例音频（包含问题）
npx generate-samples --output ./audio --with-issues

# 3. 查看音频信息
npx pdc inspect manifest.yaml

# 4. 执行验证（会发现问题）
npx pdc validate manifest.yaml --verbose

# 5. 导出报告
npx pdc report manifest.yaml --output ./output

# 查看生成的报告
open ./output/delivery-check-report.html
```

## License

MIT

## 贡献

欢迎提交 Issue 和 Pull Request！
