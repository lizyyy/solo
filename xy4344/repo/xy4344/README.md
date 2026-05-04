# 手语课复盘工具 (Sign Language Review Tool)

一个本地命令行工具，用于公益手语课复盘视频的质量检查和复核管理。

## 功能特性

- 📥 **多格式导入**: 支持 SRT 字幕、CSV/JSON 词汇表、环节表、学员反馈
- 🔍 **自动检查**: 
  - 字幕时间重叠检测
  - 词汇覆盖匹配检查
  - 环节顺序错位检测
  - 反馈闭环完整性检查
- 🌐 **Web 界面**: 本地 HTTP 服务，支持老师逐条复核并保存意见
- 💾 **数据持久化**: SQLite 本地数据库存储
- 📤 **多格式导出**: 
  - Markdown 复盘单
  - CSV 问题清单
  - JSON 审计包

## 安装

```bash
# 安装依赖
npm install
```

## 快速开始 - 使用示例数据

### 方式一：命令行完整流程

```bash
# 1. 导入示例数据
node src/cli.js --import examples

# 2. 运行检查
node src/cli.js --check

# 3. 导出所有格式
node src/cli.js --export all

# 4. 启动 Web 服务进行复核
node src/cli.js --serve
```

### 方式二：交互式菜单

直接运行不带参数的命令：

```bash
node src/cli.js
```

然后选择：
1. 选择「使用示例数据」
2. 选择「运行检查」
3. 选择「启动 Web 服务」

### 方式三：一键执行

```bash
# 一行命令完成导入、检查、导出
node src/cli.js --import examples --check --export all
```

## 命令行参数

| 参数 | 说明 | 示例 |
|------|------|------|
| `--import <path>` | 导入数据文件或目录 | `--import examples` |
| `--check` | 运行所有检查 | `--check` |
| `--serve` | 启动 Web 服务 | `--serve` |
| `--port <number>` | 指定 Web 服务端口 | `--port 8080` |
| `--export <type>` | 导出数据 | `--export all` |
| `--output <path>` | 导出目录 | `--output ./output` |
| `--examples` | 使用内置示例数据 | `--examples` |

### 导出类型

- `markdown` - Markdown 复盘单
- `csv` - CSV 格式（问题清单、字幕、词汇、环节、反馈）
- `json` - JSON 审计包
- `all` - 所有格式

## 检查规则

### 1. 字幕时间重叠检查

- **时间重叠**: 检测相邻字幕是否存在时间重叠
  - 重叠 > 1秒: 严重 (critical)
  - 重叠 ≤ 1秒: 警告 (warning)
- **时长过长**: 单条字幕超过 10 秒
- **内容为空**: 字幕没有文字内容

### 2. 词汇覆盖检查

- **词汇表词汇未出现**: 词汇表中定义的词汇未在字幕中出现
- **字幕词汇未定义**: 字幕中出现的词汇未在词汇表中定义

### 3. 环节顺序检查

- **顺序错位**: 环节实际顺序与定义顺序不一致
- **顺序颠倒**: 前后环节顺序号颠倒
- **顺序重复**: 多个环节使用相同顺序号

### 4. 反馈闭环检查

- **已闭环无回复**: 标记为已闭环但没有回复内容
- **状态异常**: 非标准状态值
- **未处理反馈**: 状态为 pending 的反馈

## 数据文件格式

### SRT 字幕文件

```srt
1
00:00:00,000 --> 00:00:05,000
大家好，欢迎来到手语公益课

2
00:00:05,000 --> 00:00:08,000
今天我们学习家庭相关的手语
```

### CSV 词汇表

| 字段 | 说明 |
|------|------|
| `id` / `序号` | 编号 (可选) |
| `word` / `词汇` / `vocabulary` | 词汇名称 |
| `meaning` / `含义` / `释义` | 词汇释义 |
| `category` / `分类` | 词汇分类 |
| `difficulty` / `难度` | 难度级别 |
| `tags` | 标签 (逗号分隔) |

**示例:**
```csv
id,word,meaning,category,difficulty,tags
1,爸爸,父亲,家庭,初级,家庭成员
2,妈妈,母亲,家庭,初级,家庭成员
```

### CSV 环节表

| 字段 | 说明 |
|------|------|
| `id` | 编号 (可选) |
| `name` / `环节名称` / `segment` | 环节名称 |
| `order` / `顺序` | 环节顺序号 |
| `startTime` / `开始时间` | 开始时间 |
| `endTime` / `结束时间` | 结束时间 |
| `duration` / `时长` | 时长 |
| `description` / `描述` | 环节描述 |
| `teacher` / `讲师` | 负责讲师 |
| `objectives` / `目标` | 环节目标 (逗号分隔) |

### CSV 学员反馈

| 字段 | 说明 |
|------|------|
| `id` | 编号 (可选) |
| `student` / `学员` / `name` | 学员姓名 |
| `question` / `问题` / `feedback` | 反馈内容 |
| `category` / `分类` / `type` | 反馈分类 |
| `status` / `状态` | 状态: pending/closed/resolved |
| `response` / `回复` / `回答` | 回复内容 |
| `submittedAt` / `提交时间` | 提交时间 |
| `closedAt` / `闭环时间` | 闭环时间 |

## Web 界面使用

启动服务后访问 `http://localhost:3000`

### 功能页面

1. **数据概览** - 查看各类数据统计和快捷操作
2. **字幕** - 查看所有字幕，支持复核
3. **词汇表** - 查看所有词汇，支持复核
4. **环节表** - 查看所有环节，支持复核
5. **学员反馈** - 处理学员反馈，填写回复
6. **问题清单** - 查看自动检查发现的问题，标记处理状态
7. **复核记录** - 查看所有复核历史

### 复核操作

1. 点击各页面中的「复核」按钮
2. 选择复核状态: 通过/需要修改/延期处理
3. 填写复核人姓名和意见
4. 点击「保存」

## 导出文件说明

### Markdown 复盘单

生成完整的复盘报告，包含：
- 数据概览
- 问题清单 (按类型分组)
- 字幕列表
- 手语词汇表
- 课堂环节
- 学员反馈
- 复核记录

### CSV 导出

- `问题清单.csv` - 所有检测到的问题
- `字幕列表.csv` - 所有字幕
- `词汇表.csv` - 所有词汇
- `环节表.csv` - 所有环节
- `学员反馈.csv` - 所有反馈

### JSON 审计包

完整的结构化数据，包含：
- 元信息 (生成时间、版本)
- 数据摘要 (数量统计)
- 所有数据 (字幕、词汇、环节、反馈)
- 问题列表
- 复核记录

## 完整使用示例流程

### 步骤 1: 准备数据文件

将以下文件放入一个目录（如 `my-data/`）:
- `subtitles.srt` - 字幕文件
- `vocabulary.csv` - 词汇表
- `segments.csv` - 环节表
- `feedback.csv` - 学员反馈

### 步骤 2: 导入数据

```bash
node src/cli.js --import my-data/
```

### 步骤 3: 运行检查

```bash
node src/cli.js --check
```

查看输出的问题列表:
```
  检查结果:
    总计问题: 8
    - 时间重叠: 2
    - 词汇覆盖: 2
    - 环节顺序: 1
    - 反馈闭环: 3
```

### 步骤 4: 启动 Web 服务复核

```bash
node src/cli.js --serve
```

打开浏览器访问 `http://localhost:3000`，逐条处理问题和反馈。

### 步骤 5: 导出报告

```bash
node src/cli.js --export all --output ./report/
```

导出文件会生成在 `./report/` 目录下:
- `复盘报告.md`
- `问题清单.csv`
- `字幕列表.csv`
- `词汇表.csv`
- `环节表.csv`
- `学员反馈.csv`
- `审计包.json`

## 数据持久化

数据存储在项目根目录的 `.sl-review/review.db` SQLite 数据库中。

数据库包含以下表:
- `subtitles` - 字幕
- `vocabulary` - 词汇表
- `segments` - 环节表
- `feedback` - 学员反馈
- `issues` - 检测问题
- `reviews` - 复核记录

## 项目结构

```
.
├── src/
│   ├── cli.js              # 命令行入口
│   ├── database/           # 数据库层
│   │   └── index.js
│   ├── dao/                # 数据访问层
│   │   ├── subtitleDao.js
│   │   ├── vocabularyDao.js
│   │   ├── segmentDao.js
│   │   ├── feedbackDao.js
│   │   ├── issueDao.js
│   │   └── reviewDao.js
│   ├── parsers/            # 文件解析器
│   │   ├── srtParser.js
│   │   ├── csvParser.js
│   │   └── jsonParser.js
│   ├── checkers/           # 检查引擎
│   │   └── index.js
│   ├── exporters/          # 导出模块
│   │   ├── markdownExporter.js
│   │   ├── csvExporter.js
│   │   └── jsonExporter.js
│   └── server/             # Web 服务
│       ├── index.js
│       ├── api.js
│       └── public/
│           └── index.html
├── examples/               # 示例数据
│   ├── subtitles.srt
│   ├── vocabulary.csv
│   ├── segments.csv
│   └── feedback.csv
├── package.json
└── README.md
```

## 许可证

MIT License

## 常见问题

### Q: 如何重置数据？

删除 `.sl-review/` 目录即可清空所有数据。

```bash
rm -rf .sl-review/
```

### Q: 支持哪些文件编码？

推荐使用 UTF-8 编码保存文件。

### Q: 可以同时导入多个字幕文件吗？

可以，导入目录时会自动处理所有 SRT 文件。但注意：每次导入会覆盖已有数据。

### Q: 如何自定义检查规则？

编辑 `src/checkers/index.js` 中的检查逻辑。

---

**享受高效复盘！** 🎯
