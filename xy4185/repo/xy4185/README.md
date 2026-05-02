# 演出字幕包巡检员

剧场字幕机管理员专用工具，巡演前快速校验字幕包。

## 功能特性

- **scan** - 建立字幕包索引，扫描所有字幕、字体、节目单
- **check** - 执行完整校验：编码、时间轴、节目单一致性、缺字、禁用词、双语对齐
- **fix** - 生成修补建议到临时目录，**不覆盖原文件**
- **report** - 导出 Markdown 报告、CSV 问题清单、JSON 审计包

## 安装

```bash
# 克隆或下载项目后，进入项目目录
cd xy4185

# 安装依赖
pip install -e .

# 或者使用 pip 安装开发依赖
pip install -e ".[dev]"
```

## 字幕包目录结构

工具会自动识别以下结构的字幕包：

```
巡演字幕包/
├── subtitles/
│   ├── zh-CN.srt          # 中文字幕
│   ├── en-US.srt          # 英文字幕
│   └── ...
├── fonts/
│   ├── Songti.ttf         # 字体文件
│   └── ...
├── program.csv             # 节目单
└── timecode.log            # 放映机时间码日志
```

## 使用方法

### 1. scan - 建立索引

扫描字幕包目录，建立完整索引：

```bash
subtitle-inspector scan ./examples

# 输出扫描结果到 JSON
subtitle-inspector scan ./examples -o scan_result.json
```

**输出示例：**
```
🎬 演出字幕包巡检员 v1.0.0
扫描目录: ./examples

📦 字幕包概览
├── 字幕文件 (2)
│   ├── zh-CN.srt - SRT | zh-CN | 10 条
│   └── en-US.srt - SRT | en-US | 9 条
├── 节目单 (4 个幕次)
│   └── program.csv
└── 字体文件 (0)
```

### 2. check - 执行校验

执行完整的校验规则：

```bash
# 执行所有校验
subtitle-inspector check ./examples

# 只显示错误及以上级别
subtitle-inspector check ./examples -s error

# 使用自定义规则配置
subtitle-inspector check ./examples -c config.json
```

**校验规则包括：**

| 类别 | 检查项 | 严重程度 |
|------|--------|----------|
| **编码** | UTF-8/GBK/Big5 编码正确性 | ERROR |
| **时间轴** | 相邻字幕时间重叠 | ERROR |
| **时间轴** | 时间轴空洞过大（可能缺字幕） | WARNING |
| **时间轴** | 时间码越界（超出放映机范围） | CRITICAL |
| **时间轴** | 字幕时长过短 | WARNING |
| **时间轴** | 开始时间 > 结束时间 | ERROR |
| **节目单** | 某幕次缺少对应字幕 | ERROR |
| **字体** | 字体缺字 | ERROR |
| **内容** | 禁用词/敏感词 | WARNING |
| **对齐** | 双语字幕数量不一致 | ERROR |
| **对齐** | 双语字幕时间轴不同步 | ERROR |

### 3. fix - 生成修补建议

在临时目录生成修补建议，**不会修改原文件**：

```bash
# 查看修补建议（不生成文件）
subtitle-inspector fix ./examples

# 生成修补建议到指定目录
subtitle-inspector fix ./examples -o ./fixed_suggestions
```

**输出的临时目录包含：**
- 原文件的完整副本
- `FIX_MANIFEST.json` - 修补计划清单
- 每个问题的具体建议

### 4. report - 导出报告

导出三种格式的报告：

```bash
# 导出报告到指定目录
subtitle-inspector report ./examples -o ./reports

# 自定义报告文件名前缀
subtitle-inspector report ./examples -o ./reports -n tour_2026_beijing
```

**生成的文件：**
- `{name}.md` - Markdown 格式报告（可直接查看）
- `{name}_issues.csv` - 问题清单（Excel 兼容，UTF-8-BOM）
- `{name}_audit.json` - 完整审计数据包（JSON 格式）

## 本地验证流程

### 使用示例数据测试

项目包含了示例数据，你可以直接用来测试：

```bash
# 1. 先安装项目
pip install -e .

# 2. 扫描示例目录
subtitle-inspector scan ./examples

# 3. 执行校验（会发现故意设置的问题）
subtitle-inspector check ./examples

# 4. 查看修补建议
subtitle-inspector fix ./examples

# 5. 导出完整报告
subtitle-inspector report ./examples -o ./test_reports
```

### 示例数据说明

`examples/` 目录中的示例数据**故意包含了一些问题**，用于演示工具的检测能力：

| 文件 | 包含的问题 |
|------|-----------|
| `zh-CN.srt` | 第1-2条时间轴重叠、第10条格式错误 |
| `en-US.srt` | 只有9条（比中文少1条）、时间轴与中文不同步 |
| `program.csv` | 定义4个幕次，某些时间段可能没有字幕 |

### 预期检测结果

对示例数据执行 `check` 命令，应该会检测到：

1. **时间轴重叠** - 第1条字幕结束时间晚于第2条开始时间
2. **双语数量不一致** - 中文10条 vs 英文9条
3. **时间轴不同步** - 多条中英字幕的开始/结束时间有差异
4. **时间码格式错误** - 第10条字幕时间格式不正确

## 规则配置

可以通过 JSON 配置文件自定义校验规则：

```json
{
  "timeline_gap": {
    "min_gap_ms": 0,
    "max_gap_ms": 5000
  },
  "timecode_bounds": {
    "max_hours": 3
  },
  "bilingual_alignment": {
    "tolerance_ms": 500
  },
  "banned_words": {
    "custom": ["自定义禁用词1", "自定义禁用词2"]
  }
}
```

使用方式：
```bash
subtitle-inspector check ./examples -c config.json
```

## 运行测试

```bash
# 安装开发依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=subtitle_inspector
```

## 项目结构

```
xy4185/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文档
├── src/
│   └── subtitle_inspector/
│       ├── __init__.py         # 版本信息
│       ├── cli.py              # CLI 入口
│       ├── models.py           # 数据模型定义
│       ├── subtitle_parser.py  # SRT/ASS 解析器
│       ├── font_detector.py    # 字体检测引擎
│       ├── rule_engine.py      # 校验规则引擎
│       ├── fix_plan.py         # 修补计划生成
│       └── reporter.py         # 报告生成器
├── tests/
│   ├── test_subtitle_parser.py
│   └── test_rule_engine.py
└── examples/
    ├── subtitles/
    │   ├── zh-CN.srt
    │   └── en-US.srt
    ├── program.csv
    └── timecode.log
```

## 注意事项

1. **不会修改原文件** - `fix` 命令只会在临时目录生成建议，原文件保持不变
2. **编码检测** - 工具会自动检测文件编码，推荐使用 UTF-8
3. **字体检测** - 安装 `fontTools` 可获得更精确的缺字检测：`pip install fonttools`
4. **时间码格式** - 支持 SRT 格式 (`HH:MM:SS,mmm`) 和 ASS 格式 (`H:MM:SS.cc`)

## 许可证

本工具仅供内部使用。
