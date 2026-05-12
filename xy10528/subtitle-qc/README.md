# 视频字幕质检 CLI 工具 (subtitle-qc)

一个面向内容团队的短视频字幕交付前质检工具，围绕错别字、时间轴重叠、敏感词和双语缺段展开全方位检查。

## ✨ 功能特性

- **错别字检查**：检测重复字、术语不一致等常见问题
- **时间轴重叠**：自动发现字幕时间轴重叠问题
- **敏感词检测**：自定义敏感词表，支持分级和自动替换
- **双语缺段检查**：对比中英文双语字幕段数和时间轴偏差
- **历史记录追踪**：记录每次质检会话和问题处理过程
- **人工修正审计**：记录修改前后差异和操作者信息
- **幂等性保障**：重复执行不会产生重复问题记录
- **多格式报告**：HTML 可视化报告 + JSON 结构化数据

## 🚀 快速开始

### 环境要求

- Node.js 18.x 或更高版本
- npm 或 yarn 包管理器

### 安装

```bash
cd subtitle-qc
npm install
npm run build
```

### 本地启动

编译完成后，有两种使用方式：

**方式一：直接运行编译后的代码**
```bash
node dist/index.js [command]
```

**方式二：全局安装后使用**
```bash
npm link
subtitle-qc [command]
```

## 📖 完整使用指南

### 1. 初始化项目

在当前目录初始化质检项目数据：

```bash
subtitle-qc init
```

输出示例：
```
✔ 字幕质检项目初始化成功

  项目信息:
  - 数据目录: ./.qc-data
  - 状态文件: ./.qc-data/state.json
  - 初始化时间: 2024/5/12 12:20:05
```

参数说明：
- `--force`：强制重新初始化（会清空现有数据）

### 2. 导入数据

#### 2.1 导入字幕文件

```bash
# 导入中文字幕
subtitle-qc import --subtitle examples/zh-bad.srt --language zh

# 导入英文字幕
subtitle-qc import --subtitle examples/en-bad.srt --language en

# 导入双语字幕（分别导入中文和英文）
subtitle-qc import --subtitle examples/bilingual-zh.srt --language zh
subtitle-qc import --subtitle examples/bilingual-en.srt --language en
```

#### 2.2 导入敏感词表

支持 JSON 和纯文本格式：

**JSON 格式（推荐）：**
```bash
subtitle-qc import --sensitive examples/sensitive-words.json
```

**纯文本格式：**
```
敏感词1,类别,等级,替换词
敏感词2,类别,等级
```

```bash
subtitle-qc import --sensitive sensitive-words.txt
```

敏感词等级说明：
- `high`：阻断级，必须处理，需要人工审核
- `medium`：警告级，建议处理
- `low`：信息级，参考性提示

#### 2.3 导入术语表

```bash
subtitle-qc import --terms examples/terms.json
```

术语表用于检查术语一致性，比如拼写规范：
- `color` → `colour`（英式拼写）
- `AI` → `人工智能`（中文规范）

#### 2.4 导入视频元数据

```bash
subtitle-qc import --metadata examples/metadata.json
```

### 3. 执行质检检查

```bash
subtitle-qc check
```

输出示例：
```
✔ 质检完成

  质检结果:
  - 会话ID: session_4dde88d534ee0f0f
  - 新增问题: 6
  - 历史问题: 0

┌────────────┬──────────┬────────────────────────────────────────┐
│ 级别       │ 数量     │ 说明                                   │
├────────────┼──────────┼────────────────────────────────────────┤
│ 阻断 (Blo… │ 3        │ 必须修复，否则不能发布                 │
├────────────┼──────────┼────────────────────────────────────────┤
│ 警告 (War… │ 3        │ 建议修复，可能影响观看体验             │
└────────────┴──────────┴────────────────────────────────────────┘
```

可选参数：
- `--no-overlap`：跳过时间轴重叠检查
- `--no-empty`：跳过空段落检查
- `--no-sensitive`：跳过敏感词检查
- `--no-typos`：跳过错别字检查
- `--no-terms`：跳过术语一致性检查

### 4. 查看问题详情

#### 4.1 列出所有问题

```bash
subtitle-qc detail
```

#### 4.2 按状态筛选

```bash
# 查看所有状态
subtitle-qc detail --status all

# 只查看待处理
subtitle-qc detail --status open

# 查看已修复
subtitle-qc detail --status fixed

# 查看已忽略
subtitle-qc detail --status ignored
```

#### 4.3 查看单个问题详情

```bash
subtitle-qc detail --issue-id issue_d8c6dd81c25f3a73
```

#### 4.4 标记问题状态

**标记为已修复：**
```bash
subtitle-qc detail --fix issue_d8c6dd81c25f3a73 --operator 张三 --comment "已修正敏感词"
```

**标记为已忽略：**
```bash
subtitle-qc detail --ignore issue_01f328b758992730 --operator 李四 --comment "经确认无问题"
```

### 5. 生成质检报告

```bash
# 生成所有格式报告
subtitle-qc report

# 指定报告名称
subtitle-qc report --name final-report

# 只生成 HTML
subtitle-qc report --format html

# 只生成 JSON
subtitle-qc report --format json

# 指定输出目录
subtitle-qc report --output ./my-reports
```

报告示例输出：
```
✔ 质检报告生成成功

  报告概要:
  - 报告名称: demo-report
  - 字幕数量: 1
  - 问题总数: 6
  - 待处理: 6

┌────────────────────┬───────────────┬─────────────────────────┐
│ 指标               │ 数值          │ 状态                    │
├────────────────────┼───────────────┼─────────────────────────┤
│ 阻断级问题         │ 3             │ ❌ 需要修复             │
├────────────────────┼───────────────┼─────────────────────────┤
│ 发布状态           │               │ ❌ 阻断发布             │
└────────────────────┴───────────────┴─────────────────────────┘

  生成的报告文件:
  - reports/demo-report.json
  - reports/demo-report.html
```

### 6. 查看项目状态

```bash
subtitle-qc status
```

## 📝 问题类型说明

| 类型 | 严重度 | 说明 | 可自动修复 |
|------|--------|------|-----------|
| `timeline_overlap` | blocker | 时间轴重叠 | ❌ |
| `missing_segment` | warning | 疑似缺段（长间隔） | ❌ |
| `sensitive_word` | blocker/warning | 敏感词检测 | ✅（有替换词时） |
| `typo` | warning/info | 错别字/术语不一致 | ✅ |
| `empty_segment` | warning | 空段落 | ❌ |

## 🎬 主要演示路径（成功场景）

以下演示展示一个完整的质检流程，**最终可以发布**。

### 第一步：初始化

```bash
cd subtitle-qc
npm run build  # 确保已编译

# 初始化项目
node dist/index.js init
```

### 第二步：导入高质量字幕

```bash
# 导入没有问题的中文字幕
node dist/index.js import --subtitle examples/zh-good.srt --language zh

# 导入没有问题的英文字幕
node dist/index.js import --subtitle examples/en-good.srt --language en

# 导入敏感词表和术语表
node dist/index.js import --sensitive examples/sensitive-words.json
node dist/index.js import --terms examples/terms.json
```

### 第三步：执行检查

```bash
node dist/index.js check
```

预期输出：
```
✔ 质检完成
...
  ✅ 所有质检项通过！
```

### 第四步：生成报告

```bash
node dist/index.js report --name success-demo
```

预期输出：
```
...
│ 发布状态           │               │ ✅ 可以发布             │
...
```

**结果：生成报告显示「可以发布」**

## ⚠️ 失败路径演示

以下演示展示存在阻断级问题的场景。

### 第一步：导入有问题的字幕

```bash
# 清空之前的数据（如果有）
rm -rf .qc-data reports

# 重新初始化
node dist/index.js init

# 导入有问题的字幕
node dist/index.js import --subtitle examples/zh-bad.srt --language zh
node dist/index.js import --sensitive examples/sensitive-words.json
node dist/index.js import --terms examples/terms.json
```

### 第二步：执行检查

```bash
node dist/index.js check
```

预期输出：
```
  ⚠️  检测到 3 个阻断级问题，建议修复后重新检查
```

### 第三步：查看问题详情

```bash
# 列出所有问题
node dist/index.js detail

# 查看某个敏感词问题详情
node dist/index.js detail --issue-id <issue-id>
```

### 第四步：生成报告（阻断发布）

```bash
node dist/index.js report --name failure-demo
```

预期输出：
```
│ 阻断级问题         │ 3             │ ❌ 需要修复             │
...
│ 发布状态           │               │ ❌ 阻断发布             │
```

**结果：生成报告显示「阻断发布」，存在 3 个阻断级问题**

### 第五步：修复问题（人工干预）

```bash
# 标记一个错别字为已修复（可自动修复类型）
node dist/index.js detail --fix <typo-issue-id> --operator 内容编辑 --comment "已修正重复字"

# 标记一个时间轴问题为已忽略（需人工确认）
node dist/index.js detail --ignore <overlap-issue-id> --operator 内容主管 --comment "经确认是特效字幕重叠，可接受"
```

### 第六步：重新检查并生成最终报告

```bash
node dist/index.js check
node dist/index.js report --name final-fixed
```

## 📁 项目结构

```
subtitle-qc/
├── src/                     # 源代码
│   ├── index.ts            # CLI 入口
│   ├── types.ts            # 类型定义
│   ├── store.ts            # 状态存储
│   ├── parser.ts           # 字幕解析
│   ├── checker.ts          # 质检核心逻辑
│   ├── utils.ts            # 工具函数
│   └── commands/           # CLI 命令实现
│       ├── init.ts         # init 命令
│       ├── import.ts       # import 命令
│       ├── check.ts        # check 命令
│       ├── detail.ts       # detail 命令
│       └── report.ts       # report 命令
├── examples/               # 示例数据
│   ├── zh-good.srt         # 高质量中文字幕
│   ├── zh-bad.srt          # 有问题的中文字幕（演示用）
│   ├── en-good.srt         # 高质量英文字幕
│   ├── en-bad.srt          # 有问题的英文字幕
│   ├── bilingual-zh.srt    # 双语中文字幕
│   ├── bilingual-en.srt    # 双语英文字幕
│   ├── sensitive-words.json # 敏感词表
│   ├── terms.json          # 术语表
│   └── metadata.json       # 视频元数据
├── dist/                   # 编译输出
├── reports/                # 生成的报告
├── .qc-data/               # 项目数据（自动生成）
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 核心设计原则

### 1. 幂等性设计

- 重复导入相同文件（通过 MD5 checksum 判断）会自动跳过
- 重复执行 `check` 不会产生重复的问题记录
- 使用问题指纹（subtitleId + type + cueIndex + message）去重

### 2. 不覆盖原文件原则

- 系统只读取字幕文件，**绝不会修改或覆盖原文件**
- 所有建议修复都只记录在状态中
- 人工修正需要手动修改原文件后重新导入

### 3. 审计追踪

- 每个问题都有完整的历史记录
- 记录操作类型：detected, auto_fixed, manual_fixed, ignored, reopened
- 记录操作者和修改前后内容
- 记录操作时间戳

### 4. 分级管理

- **Blocker（阻断级）**：必须修复，否则 `report` 会返回非零退出码
- **Warning（警告级）**：建议修复，不影响发布
- **Info（信息级）**：参考性提示，可选择处理

## 🔧 开发说明

### 编译项目

```bash
npm run build
```

### 开发模式（直接运行 TypeScript）

```bash
npm run dev -- [command]
# 例如：
npm run dev -- init
npm run dev -- check
```

### 添加新的检查规则

在 `src/checker.ts` 中添加新的检查函数，然后在 `runAllChecks` 中调用：

```typescript
export function checkMyNewRule(subtitle: SubtitleFile): Issue[] {
  // 实现检查逻辑
  // 使用 createIssue() 创建问题
}
```

### 自定义敏感词表

创建 JSON 文件：
```json
[
  {
    "word": "敏感词",
    "category": "类别",
    "level": "high",
    "replacement": "***",
    "description": "说明"
  }
]
```

## 📊 报告格式

### HTML 报告

- 可视化展示，适合非技术人员
- 按严重度分组显示问题
- 显示原文和建议修改
- 质检历史记录

### JSON 报告

- 结构化数据，适合程序处理
- 包含完整的问题上下文
- 可集成到 CI/CD 流程

```json
{
  "generatedAt": 1778563205825,
  "summary": {
    "total": 6,
    "open": 6,
    "blockers": 3,
    "warnings": 3,
    "canPublish": false
  },
  "issues": [...],
  "subtitles": [...],
  "sessions": [...]
}
```

## ❓ 常见问题

**Q: 如何重置所有数据？**
A: 删除 `.qc-data` 目录，然后重新运行 `subtitle-qc init`

**Q: 支持哪些字幕格式？**
A: 目前支持 SRT 和 VTT 两种最常用的格式

**Q: 系统会修改我的原字幕文件吗？**
A: **绝对不会**。系统只读取文件，所有建议都记录在独立的状态文件中

**Q: 如何集成到 CI/CD？**
A: 使用 `subtitle-qc check`，如果有阻断级问题会返回非零退出码

**Q: 双语字幕如何检查？**
A: 分别导入中文字幕（`--language zh`）和英文字幕（`--language en`），系统会自动对比段数和时间轴

## 📄 许可证

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
