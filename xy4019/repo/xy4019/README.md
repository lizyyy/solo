# Subtitle Checker - 纪录片字幕质检工具

一个给纪录片字幕统筹用的本地命令行工具，用于质检和修复 SRT/VTT 格式的字幕文件。

## 功能特性

- **字幕解析**: 支持 SRT 和 VTT 两种字幕格式
- **质检规则**:
  - 时间轴重叠检测
  - 序号断裂检测
  - 单行文字过长检测
  - 阅读速度过快检测
  - 说话人名称不一致检测
  - 术语使用不一致检测
  - 禁用词命中检测
  - 空字幕检测
  - 时间码错误检测
- **报告生成**: 支持 Markdown 和 JSON 两种格式的质检报告
- **安全修复**: 支持重排序号、统一说话人和术语（生成副本，不覆盖原文件）
- **本地缓存**: 重复检查时跳过未变化的文件，配置变更后强制重新检查

## 安装

### 前置要求

- Python 3.8+
- pip

### 安装步骤

1. 克隆或下载项目到本地
2. 在项目目录下运行：

```bash
pip install -e .
```

或者使用 pip 安装依赖：

```bash
pip install -r requirements.txt
```

## 快速开始

### 1. 初始化项目

在字幕文件所在目录下初始化项目配置：

```bash
subtitle-checker init "我的纪录片项目"
```

这会在当前目录创建 `.subtitle-checker.json` 配置文件。

### 2. 配置说话人

添加说话人及其别名：

```bash
subtitle-checker speaker add "张教授" --alias "张老师" "张先生"
subtitle-checker speaker add "李博士" --alias "李医生"
subtitle-checker speaker add "王总"
```

查看已配置的说话人：

```bash
subtitle-checker speaker list
```

### 3. 配置术语

添加统一术语及其替代写法：

```bash
subtitle-checker term add "人工智能" --alt "AI" "机器智能" -c "技术"
subtitle-checker term add "访谈" --alt "采访" -c "内容"
```

查看已配置的术语：

```bash
subtitle-checker term list
```

### 4. 配置禁用词

添加需要检查的禁用词：

```bash
subtitle-checker forbidden add "敏感内容" -c "内容" -s "请替换为中性表述"
```

查看已配置的禁用词：

```bash
subtitle-checker forbidden list
```

### 5. 检查字幕

检查单个字幕文件：

```bash
subtitle-checker check examples/interview_ep01.srt
```

检查整个目录：

```bash
subtitle-checker check examples/
```

检查多个文件或目录：

```bash
subtitle-checker check file1.srt file2.vtt /path/to/dir
```

#### 常用选项

- `--no-cache`: 禁用缓存，强制重新检查
- `--format json`: 以 JSON 格式输出结果
- `--format md`: 以 Markdown 格式输出结果
- `--output report.json`: 将结果保存到文件
- `--severity error`: 只显示指定严重程度的问题（可多次使用）

示例：

```bash
subtitle-checker check examples/ --format json --output result.json
subtitle-checker check examples/ --severity critical --severity error
```

### 6. 生成报告

生成 Markdown 和 JSON 格式的质检报告：

```bash
subtitle-checker report examples/ --output-dir ./reports
```

只生成指定格式的报告：

```bash
subtitle-checker report examples/ --format md --output-dir ./reports
subtitle-checker report examples/ --format json --output-dir ./reports
```

### 7. 应用修复

应用安全修复（生成副本，不覆盖原文件）：

```bash
subtitle-checker apply examples/interview_ep01.srt
```

默认会在原文件同级目录生成 `_fixed` 后缀的文件，如 `interview_ep01_fixed.srt`。

#### 常用选项

- `--output-dir ./fixed`: 指定输出目录
- `--suffix "_corrected"`: 自定义文件名后缀
- `--fixer sequence`: 只使用指定的修复器（可多次使用）
- `--dry-run`: 预览修复内容但不实际写入文件

示例：

```bash
# 只统一说话人和术语
subtitle-checker apply examples/ --fixer speaker --fixer term

# 预览修复效果
subtitle-checker apply examples/ --dry-run

# 指定输出目录
subtitle-checker apply examples/ --output-dir ./output
```

### 8. 其他命令

查看当前配置：

```bash
subtitle-checker config-show
```

清除缓存：

```bash
subtitle-checker cache-clear
```

## 项目结构

```
subtitle-checker/
├── src/
│   └── subtitle_checker/
│       ├── __init__.py      # 包初始化
│       ├── models.py        # 数据模型定义
│       ├── parser.py        # 字幕解析器（SRT/VTT）
│       ├── config.py        # 配置管理
│       ├── cache.py         # 缓存管理
│       ├── rules.py         # 规则引擎
│       ├── reporter.py      # 报告生成
│       ├── fixer.py         # 修复器
│       └── cli.py           # CLI 入口
├── examples/                 # 示例字幕文件
│   ├── interview_ep01.srt
│   └── interview_ep02.vtt
├── requirements.txt          # 依赖列表
├── pyproject.toml            # 项目配置
└── README.md                 # 本文档
```

## 质检规则说明

| 规则类型 | 严重程度 | 说明 |
|---------|---------|------|
| OVERLAPPING_TIMELINE | ERROR | 相邻字幕时间轴重叠 |
| BROKEN_SEQUENCE | WARNING | 字幕序号不连续 |
| LINE_TOO_LONG | WARNING | 单行文字超过最大长度（默认 40 字） |
| READING_SPEED_TOO_FAST | WARNING | 阅读速度超过限制（默认 180 字/分钟） |
| SPEAKER_INCONSISTENT | WARNING/INFO | 说话人名称与配置不一致 |
| TERM_INCONSISTENT | WARNING | 术语使用与配置不一致 |
| FORBIDDEN_WORD | CRITICAL | 发现禁用词 |
| EMPTY_SUBTITLE | WARNING | 空字幕 |
| TIMECODE_ERROR | ERROR | 时间码错误（开始时间 >= 结束时间） |

## 安全修复说明

目前支持以下安全修复：

| 修复器 | 说明 |
|-------|------|
| sequence | 重新排序字幕序号，确保序号从 1 开始连续 |
| speaker | 将说话人别名统一替换为标准名称 |
| term | 将替代术语统一替换为标准术语 |

**重要提示**：
- 所有修复都会生成新文件，**不会覆盖原文件**
- 默认在原文件名后添加 `_fixed` 后缀
- 时间轴相关问题（如重叠、阅读速度过快）需要人工审核后手动修改

## 缓存机制

工具会自动缓存检查结果，以提高重复检查的效率：

- 缓存存储在 `.subtitle-checker-cache/check_cache.json`
- 当字幕文件内容未变化时，直接使用缓存结果
- 当配置文件（说话人、术语、禁用词）变更时，强制重新检查
- 可以使用 `--no-cache` 选项禁用缓存
- 可以使用 `subtitle-checker cache-clear` 手动清除缓存

## 配置文件说明

配置文件 `.subtitle-checker.json` 是 JSON 格式，包含以下内容：

```json
{
  "name": "我的纪录片项目",
  "speakers": [
    {
      "name": "张教授",
      "aliases": ["张老师", "张先生"],
      "is_primary": true
    }
  ],
  "terms": [
    {
      "correct": "人工智能",
      "alternatives": ["AI", "机器智能"],
      "category": "技术"
    }
  ],
  "forbidden_words": [
    {
      "word": "敏感内容",
      "category": "内容",
      "suggestion": "请替换为中性表述"
    }
  ],
  "max_line_length": 40,
  "max_reading_speed": 180,
  "min_gap_between_subtitles": 0.05,
  "subtitle_dirs": [],
  "output_dir": "./output"
}
```

### 配置选项说明

| 选项 | 类型 | 默认值 | 说明 |
|-----|------|-------|------|
| max_line_length | int | 40 | 单行最大文字数 |
| max_reading_speed | int | 180 | 最大阅读速度（字/分钟） |
| min_gap_between_subtitles | float | 0.05 | 字幕间最小间隔（秒） |

## 使用示例

### 完整工作流程示例

```bash
# 1. 进入字幕目录
cd /path/to/subtitles

# 2. 初始化项目
subtitle-checker init "纪录片项目 - 第3季"

# 3. 添加说话人配置
subtitle-checker speaker add "张教授" --alias "张老师" "张主任"
subtitle-checker speaker add "李博士" --alias "李研究员"
subtitle-checker speaker add "主持人" --alias "采访者"

# 4. 添加术语配置
subtitle-checker term add "人工智能" --alt "AI" "人工智慧" -c "技术"
subtitle-checker term add "深度学习" --alt "深度神经网络" -c "技术"
subtitle-checker term add "访谈" --alt "采访" -c "内容"

# 5. 添加禁用词
subtitle-checker forbidden add "不合适的词" -s "请使用中性表述"

# 6. 首次检查所有字幕
subtitle-checker check ./episodes/

# 7. 生成详细报告
subtitle-checker report ./episodes/ --output-dir ./reports

# 8. 应用安全修复（序号、说话人、术语）
subtitle-checker apply ./episodes/ --output-dir ./fixed

# 9. 再次检查修复后的文件
subtitle-checker check ./fixed/ --no-cache
```

### 使用示例文件测试

项目包含两个示例字幕文件，可以用来测试工具功能：

```bash
# 进入项目目录
cd /path/to/subtitle-checker

# 初始化项目
subtitle-checker init "测试项目"

# 添加示例配置
subtitle-checker speaker add "张教授" --alias "张老师"
subtitle-checker speaker add "李博士"
subtitle-checker speaker add "王总"
subtitle-checker term add "人工智能" --alt "AI" "机器智能"
subtitle-checker forbidden add "敏感内容"

# 检查示例文件
subtitle-checker check examples/

# 生成报告
subtitle-checker report examples/ --output-dir ./test-reports

# 应用修复
subtitle-checker apply examples/ --output-dir ./test-output
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
