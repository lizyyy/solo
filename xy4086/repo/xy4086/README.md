# 字幕时间轴修补器

**Subtitle Timeline Fixer** - 播客剪辑师专用的本地自动化工具

每期播客节目从不同软件导出的 SRT 字幕常存在各种问题：时间轴重叠、空字幕、说话人漏标、章节时间点对不上等。本工具提供一站式解决方案，从导入、检查、自动修复、人工复核到最终导出，完整覆盖播客字幕工作流。

## 功能特性

- **📥 导入支持**：SRT 字幕、CSV 嘉宾名单、章节草稿
- **🔍 规则检查**：
  - 时间轴重叠检测
  - 过长/过短字幕检测
  - 无效时间码（结束时间 ≤ 开始时间）
  - 说话人不在嘉宾名单
  - 说话人标签缺失
  - 章节时间点漂移
  - 空字幕
- **🔧 自动修复**：三种策略可选
  - 保守：仅修复明确的时间码错误
  - 中等：修复重叠 + 时间码（默认）
  - 激进：修复所有可自动修复的问题
- **📝 人工复核**：保存字幕确认状态，支持会话管理
- **📤 多格式导出**：修正 SRT、Markdown 章节稿、JSON 审计包

## 安装

```bash
# 克隆项目或下载源码
cd xy4086

# 安装依赖
pip install -e .
```

依赖：
- Python >= 3.9
- click >= 8.0.0
- rich >= 12.0.0

## 快速开始

使用 `examples/` 目录下的示例数据快速体验：

```bash
# 1. 检查问题
subtitle-fixer check --srt examples/sample_problematic.srt \
                     --csv examples/sample_speakers.csv \
                     --chapters examples/sample_chapters.txt

# 2. 自动修复（使用中等策略）
subtitle-fixer fix --strategy moderate

# 3. 导出所有文件
subtitle-fixer export --all
```

输出文件将生成在 `./output/` 目录。

## 命令详解

### import - 导入文件

```bash
subtitle-fixer import <srt_file> [OPTIONS]
```

**参数：**
- `srt_file`：SRT 字幕文件路径（必填）
- `--csv, -c`：嘉宾名单 CSV 文件
- `--chapters, -ch`：章节草稿文件

**示例：**
```bash
subtitle-fixer import episode_123.srt \
                     --csv guests.csv \
                     --chapters chapters.txt
```

### check - 规则检查

```bash
subtitle-fixer check [OPTIONS]
```

**参数：**
- `--srt, -s`：SRT 文件路径
- `--csv, -c`：嘉宾名单 CSV
- `--chapters, -ch`：章节草稿
- `--max-duration`：最大字幕时长（秒，默认 8.0）
- `--require-speaker`：要求说话人标签（默认开启）

**检查项说明：**

| 问题类型 | 严重程度 | 说明 |
|---------|---------|------|
| 时间轴重叠 | HIGH | 相邻字幕时间有重叠 |
| 无效时间码 | CRITICAL | 结束时间 ≤ 开始时间，或开始时间为负 |
| 过长字幕 | MEDIUM | 单条字幕超过设定时长 |
| 说话人不在名单 | HIGH | 字幕中的说话人未在嘉宾名单中 |
| 说话人漏标 | MEDIUM | 字幕缺少说话人标签 |
| 空字幕 | MEDIUM | 字幕内容为空 |
| 章节漂移 | MEDIUM | 章节时间点与字幕时间不符 |

### fix - 自动修复

```bash
subtitle-fixer fix [OPTIONS]
```

**参数：**
- `--strategy, -s`：修复策略
  - `conservative`：保守 - 仅修复明确的时间码错误
  - `moderate`：中等 - 修复重叠和时间码（默认）
  - `aggressive`：激进 - 修复所有可自动修复的问题
- `--output, -o`：输出文件路径（不指定则自动生成）

**自动修复能力：**

| 问题 | 保守 | 中等 | 激进 |
|-----|------|------|------|
| 时间轴重叠 | ❌ | ✅ | ✅ |
| 无效时间码 | ✅ | ✅ | ✅ |
| 负时间 | ✅ | ✅ | ✅ |
| 空字幕 | ❌ | ❌ | ✅ (删除) |
| 说话人漏标 | ❌ | ❌ | ✅ (推断) |
| 说话人别名标准化 | ✅ | ✅ | ✅ |
| 索引重新编号 | ✅ | ✅ | ✅ |

### review - 人工复核

```bash
subtitle-fixer review [OPTIONS]
```

**参数：**
- `--session, -s`：指定会话 ID（可选）
- `--approve, -a`：批准指定字幕索引（可多次使用）
- `--reject, -r`：拒绝指定字幕索引（可多次使用）
- `--comment, -c`：添加备注
- `--list, -l`：列出所有复核会话

**示例：**
```bash
# 列出所有会话
subtitle-fixer review --list

# 批准字幕 1、3、5
subtitle-fixer review --approve 1 --approve 3 --approve 5

# 拒绝字幕 2 并添加备注
subtitle-fixer review --reject 2 --comment "时间需要调整"
```

### export - 导出文件

```bash
subtitle-fixer export [OPTIONS]
```

**参数：**
- `--srt, -s`：输出 SRT 路径
- `--markdown, -m`：输出 Markdown 章节稿路径
- `--audit, -a`：输出 JSON 审计包路径
- `--all, -A`：导出所有格式
- `--include-speaker/--no-speaker`：SRT 中是否包含说话人标签（默认包含）

**输出格式说明：**

**1. SRT 字幕**
- 标准 SRT 格式
- 说话人标签以 `【姓名】` 前缀形式嵌入文本

**2. Markdown 章节稿**
```markdown
# 章节大纲

*生成时间: 2026-05-02 10:30:00*

---

## 1. 开场介绍

**时间**: 0:00 - 05:30

**说话人**: 主持人

章节内容描述...
```

**3. JSON 审计包**
包含完整的处理记录：
- 字幕列表及元数据
- 嘉宾名单
- 章节信息
- 校验结果
- 修复操作记录
- 复核状态

## 临时目录验证流程

以下步骤使用 `examples/` 中的示例数据进行完整演示：

### 步骤 1：准备测试数据

`examples/sample_problematic.srt` 包含以下问题：

| 字幕 # | 问题 |
|-------|------|
| 1-2 | 时间轴重叠（00:00:05,500 处重叠） |
| 3 | 过长字幕（持续 17 秒，远超建议 8 秒） |
| 4 | 无效时间码（结束时间 00:00:22,000 < 开始时间 00:00:25,000） |
| 6 | 空字幕 |
| 7 | 说话人漏标 |
| 9 | 说话人"未知嘉宾"不在嘉宾名单中 |

### 步骤 2：检查问题

```bash
# 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4086/repo/xy4086

# 执行检查
subtitle-fixer check --srt examples/sample_problematic.srt \
                     --csv examples/sample_speakers.csv \
                     --chapters examples/sample_chapters.txt
```

预期输出：
- 发现时间轴重叠问题
- 发现过长字幕（字幕 #3，17秒）
- 发现无效时间码（字幕 #4）
- 发现空字幕（字幕 #6）
- 发现说话人漏标（字幕 #7）
- 发现说话人不在名单（字幕 #9："未知嘉宾"）
- 发现章节漂移（章节从 00:00:00 开始，字幕从 00:00:02 开始）

### 步骤 3：自动修复

```bash
# 使用激进策略修复
subtitle-fixer fix --strategy aggressive
```

预期结果：
- 时间轴重叠已修复
- 无效时间码已修复
- 空字幕已删除
- 字幕 #7 的说话人从上下文推断为"李四"
- 索引已重新编号

### 步骤 4：人工复核

```bash
# 批准自动修复的内容
subtitle-fixer review --approve 1 --approve 2 --approve 3

# 对于需要手动处理的（如过长字幕），标记为拒绝
subtitle-fixer review --reject 2 --comment "需要手动拆分过长字幕"
```

### 步骤 5：导出最终文件

```bash
# 导出所有格式
subtitle-fixer export --all
```

输出文件位于 `./output/` 目录：
- `untitled_YYYYMMDD_HHMMSS.srt` - 修正后的字幕
- `untitled_chapters_YYYYMMDD_HHMMSS.md` - Markdown 章节稿
- `untitled_audit_YYYYMMDD_HHMMSS.json` - JSON 审计包

## 文件格式说明

### 嘉宾名单 CSV 格式

```csv
姓名,别名,角色,是否嘉宾
主持人,主播|主理人,节目主持人,否
张三,张老师|张先生,技术专家,是
李四,李博士,研究员,是
```

**字段说明：**
- `姓名`：标准名称（必填）
- `别名`：其他称呼，用 `|` 分隔
- `角色`：职位/身份描述
- `是否嘉宾`：是/yes/true/1 表示嘉宾

### 章节草稿格式

支持以下时间格式：
- `HH:MM:SS 章节标题` （如 `00:05:30 主题讨论`）
- `MM:SS 章节标题` （如 `5:30 主题讨论`）

示例：
```
# 以 # 开头的行是注释
00:00:00 开场介绍
00:05:30 嘉宾入场
00:15:00 主题讨论
00:45:00 互动问答
01:00:00 总结收尾
```

## 配置选项

可以通过环境变量或参数调整：

| 配置项 | 默认值 | 说明 |
|-------|-------|------|
| `max_subtitle_duration` | 8.0 秒 | 单条字幕最大建议时长 |
| `min_subtitle_duration` | 0.5 秒 | 单条字幕最小建议时长 |
| `max_gap_between_subtitles` | 5.0 秒 | 字幕间最大允许间隙 |
| `max_chapter_drift_seconds` | 30.0 秒 | 章节漂移警告阈值 |
| `require_speaker_label` | True | 是否要求说话人标签 |

## 测试

```bash
# 运行所有测试
pytest -v

# 运行特定测试文件
pytest tests/test_parser.py -v

# 显示覆盖率
pytest --cov=src/subtitle_fixer
```

## 项目结构

```
xy4086/
├── src/
│   └── subtitle_fixer/
│       ├── __init__.py      # 包入口
│       ├── cli.py           # CLI 主程序
│       ├── models.py        # 数据模型
│       ├── parser.py        # 解析器（SRT/CSV/章节）
│       ├── validator.py     # 规则校验器
│       ├── fixer.py         # 修补策略
│       ├── review.py        # 复核存储
│       ├── exporter.py      # 导出模块
│       └── utils.py         # 工具函数
├── tests/
│   ├── test_parser.py
│   ├── test_validator.py
│   └── test_fixer.py
├── examples/
│   ├── sample_problematic.srt   # 有问题的示例字幕
│   ├── sample_speakers.csv      # 示例嘉宾名单
│   └── sample_chapters.txt      # 示例章节草稿
├── setup.py
├── pyproject.toml
└── README.md
```

## 常见问题

**Q: 为什么有些问题无法自动修复？**

A: 某些问题需要人工判断：
- 过长字幕：需要了解上下文才能正确拆分
- 说话人不在名单：可能是拼写错误或新嘉宾
- 章节漂移：需要核对原始视频时间轴
- 时间轴间隙：可能是有意留白或遗漏字幕

**Q: 如何处理字幕中的说话人别名？**

A: 在嘉宾名单 CSV 的 `别名` 列中添加别名，工具会自动标准化。例如：
- CSV 中：`张三,张老师|张先生,技术专家,是`
- 字幕中 `【张老师】` 会被识别为 `张三`

**Q: 复核会话数据存储在哪里？**

A: 默认存储在 `~/.subtitle-fixer/reviews/` 目录，每个会话一个 JSON 文件。

## License

MIT License
