# 字幕时间轴检查工具 (Subtitle Timeline Checker)

一个为课程剪辑师设计的本地命令行工具，专门用于检查和整理字幕时间轴。

## 功能特性

- **多格式支持**: 支持 `.srt` 和 `.vtt` 两种常见字幕格式
- **递归扫描**: 自动递归扫描目录中的所有字幕文件
- **问题检测**:
  - 时间段重叠
  - 结束时间早于开始时间
  - 相邻字幕间隔过长
  - 同一秒内重复字幕
  - 字幕文本为空
  - 章节边界附近字幕跨段
- **自动修复**: 生成修正后的字幕副本（不覆盖原文件）
- **报告导出**: 支持导出 HTML 或 Markdown 格式的详细报告

## 安装

### 前置要求

- Python 3.9 或更高版本
- pip 包管理器

### 安装步骤

```bash
# 克隆或下载项目
cd zy1011

# 以可编辑模式安装
pip install -e .
```

安装完成后，可以使用 `subcheck` 命令。

## 使用方法

工具提供三个主要子命令：

### 1. scan - 检查并打印摘要

扫描字幕目录，检查所有问题并打印摘要信息。

```bash
# 基础扫描
subcheck scan ./examples/subtitles

# 带章节配置扫描
subcheck scan ./examples/subtitles -c ./examples/chapters.json

# 显示详细问题列表
subcheck scan ./examples/subtitles -v

# 自定义长间隔阈值（10秒）
subcheck scan ./examples/subtitles --long-gap 10000
```

**参数说明：**
- `DIRECTORY`: 包含字幕文件的目录路径（必需）
- `--chapters, -c`: 章节配置文件路径（可选）
- `--long-gap`: 长间隔阈值，单位毫秒，默认 5000ms（可选）
- `--verbose, -v`: 显示详细问题列表（可选）

### 2. fix - 生成修正后的字幕副本

自动修复发现的问题，生成修正后的字幕文件到指定目录（不覆盖原文件）。

```bash
# 基础修复
subcheck fix ./examples/subtitles -o ./fixed_subtitles

# 带章节配置修复
subcheck fix ./examples/subtitles -c ./examples/chapters.json -o ./fixed_subtitles

# 自动删除空字幕和重复字幕
subcheck fix ./examples/subtitles -o ./fixed_subtitles --fix-empty --fix-duplicate

# 覆盖已存在的输出文件
subcheck fix ./examples/subtitles -o ./fixed_subtitles --overwrite
```

**参数说明：**
- `DIRECTORY`: 包含字幕文件的目录路径（必需）
- `--output, -o`: 输出目录路径（必需）
- `--chapters, -c`: 章节配置文件路径（可选）
- `--long-gap`: 长间隔阈值，单位毫秒，默认 5000ms（可选）
- `--fix-empty`: 自动删除空字幕（可选）
- `--fix-duplicate`: 自动删除重复字幕（可选）
- `--overwrite`: 覆盖已存在的输出文件（可选）

### 3. report - 导出检查报告

生成详细的检查报告，支持 HTML 和 Markdown 格式。

```bash
# 生成 HTML 报告（默认）
subcheck report ./examples/subtitles -o ./report.html

# 生成 Markdown 报告
subcheck report ./examples/subtitles -o ./report.md -f markdown

# 带章节配置生成报告
subcheck report ./examples/subtitles -c ./examples/chapters.json -o ./report.html

# 显示详细信息
subcheck report ./examples/subtitles -o ./report.html -v
```

**参数说明：**
- `DIRECTORY`: 包含字幕文件的目录路径（必需）
- `--output, -o`: 输出报告文件路径（必需）
- `--chapters, -c`: 章节配置文件路径（可选）
- `--long-gap`: 长间隔阈值，单位毫秒，默认 5000ms（可选）
- `--format, -f`: 报告格式，可选 `html` 或 `markdown`，默认 `html`（可选）
- `--verbose, -v`: 显示详细问题列表（可选）

## 章节配置文件格式

章节配置使用 JSON 格式，用于检查字幕是否跨越章节边界。

示例 `chapters.json`:

```json
{
  "chapters": [
    {
      "title": "第一章：课程介绍",
      "start": "00:00:00.000",
      "end": "00:01:00.000"
    },
    {
      "title": "第二章：基础知识",
      "start": "00:01:00.000",
      "end": "00:03:00.000"
    }
  ]
}
```

**时间格式支持：**
- `HH:MM:SS,mmm` (SRT 格式)
- `HH:MM:SS.mmm` (VTT 格式)
- `MM:SS.mmm` (简化格式)

## 修复规则说明

### 自动修复的问题类型

1. **非法时间**（结束时间早于开始时间）
   - 将结束时间调整为开始时间 + 最小字幕时长（默认 500ms）

2. **时长为0的字幕**
   - 将结束时间调整为开始时间 + 最小字幕时长（默认 500ms）

3. **时间重叠**
   - 将后一个字幕的开始时间调整为前一个字幕结束时间 + 最小间隔（默认 50ms）
   - 如果调整后时长不足，则延长结束时间

### 可选修复（需要显式开启）

1. **空字幕**（`--fix-empty`）
   - 完全删除文本为空的字幕

2. **重复字幕**（`--fix-duplicate`）
   - 删除在时间窗口内文本相同的重复字幕

## 问题严重程度

| 严重程度 | 说明 |
|---------|------|
| ERROR | 必须修复的严重问题 |
| WARNING | 建议修复的潜在问题 |
| INFO | 仅供参考的信息 |

## 问题类型

| 问题类型 | 说明 | 严重程度 |
|---------|------|---------|
| 时间重叠 | 两条字幕的时间范围有重叠 | ERROR |
| 非法时间 | 结束时间早于开始时间或时长为0 | ERROR |
| 间隔过长 | 相邻字幕间隔超过阈值 | WARNING |
| 重复字幕 | 同一时间窗口内有相同文本 | WARNING |
| 空文本 | 字幕文本为空 | WARNING |
| 跨章节 | 字幕跨越章节边界 | WARNING |
| 解析错误 | 无法解析的时间格式或行 | ERROR |

## 项目结构

```
subtitle-timeline-checker/
├── pyproject.toml              # 项目配置文件
├── subtitle_checker/
│   ├── __init__.py
│   ├── cli.py                  # CLI 入口
│   ├── models.py               # 数据模型定义
│   ├── parser.py               # 字幕解析器（SRT/VTT）
│   ├── checker.py              # 规则检查器
│   ├── fixer.py                # 字幕修复器
│   └── reporter.py             # 报告生成器
└── examples/
    ├── chapters.json           # 示例章节配置
    └── subtitles/
        ├── problems.srt        # 包含各种问题的示例字幕
        └── normal.vtt          # 正常格式的 VTT 示例
```

## 示例运行

### 使用示例数据测试

```bash
# 1. 扫描示例字幕
subcheck scan ./examples/subtitles -c ./examples/chapters.json -v

# 2. 修复字幕
subcheck fix ./examples/subtitles -c ./examples/chapters.json -o ./output/fixed --fix-empty --fix-duplicate

# 3. 生成报告
subcheck report ./examples/subtitles -c ./examples/chapters.json -o ./output/report.html
subcheck report ./examples/subtitles -c ./examples/chapters.json -o ./output/report.md -f markdown
```

### 示例字幕中的问题

`examples/subtitles/problems.srt` 包含以下问题用于测试：

1. 字幕 1 和 2 时间重叠
2. 字幕 3 结束时间早于开始时间
3. 字幕 4 文本为空
4. 字幕 5 和 6 间隔过长（10秒）
5. 字幕 7 和 8 内容重复
6. 字幕 9 时长为 0
7. 字幕 10 跨越章节边界

## 开发说明

### 本地开发安装

```bash
pip install -e .
```

### 代码模块说明

- **models.py**: 定义了所有数据模型（`SubtitleEntry`, `Chapter`, `Issue` 等）
- **parser.py**: 负责解析 SRT 和 VTT 格式的字幕文件
- **checker.py**: 实现所有检查规则
- **fixer.py**: 实现自动修复逻辑
- **reporter.py**: 生成 HTML 和 Markdown 报告
- **cli.py**: 命令行接口，使用 Click 库

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
