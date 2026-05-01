# 访谈字幕脱敏切片器

播客剪辑助理用的本地端侧工具，用于处理 Whisper 导出的字幕文件，进行敏感词检测、脱敏处理和内容切片。

## 功能特性

- **字幕导入**: 支持 SRT 和 VTT 格式
- **章节管理**: 导入章节 CSV，支持章节内外片段识别
- **规则引擎**: 支持正则表达式的敏感词匹配，内置手机号、邮箱、客户名、项目代号等默认规则
- **时间轴校验**: 检测字幕重叠、断句过长、章节外片段
- **敏感词脱敏**: 自动替换敏感内容为掩码，保持原文一致性
- **多格式导出**: 支持 Markdown 审核报告、CSV 切片表、JSON 时间轴、脱敏字幕

## 项目结构

```
podcast_sanitizer/
├── __init__.py          # 包初始化
├── __main__.py          # 入口文件
├── models.py            # 数据模型定义
├── subtitle_parser.py   # 字幕/章节/规则解析
├── timeline_validator.py # 时间轴校验
├── rule_engine.py       # 敏感词规则引擎
├── mask_mapper.py       # 脱敏映射处理
├── exporter.py          # 导出功能
├── project_manager.py   # 项目状态管理
└── cli.py               # 命令行接口

examples/                # 示例数据
├── sample.srt           # 示例 SRT 字幕
├── sample.vtt           # 示例 VTT 字幕
├── chapters.csv         # 示例章节
└── sensitive_rules.csv  # 示例敏感规则

tests/                   # 测试文件
├── test_subtitle_parser.py
├── test_timeline_validator.py
├── test_rule_engine.py
└── test_mask_mapper.py
```

## 快速开始

### 环境要求

- Python 3.8+
- 无需额外依赖（标准库即可运行）

### 安装

```bash
# 克隆或下载项目到本地
cd xy4076
```

### 使用示例数据验证全流程

#### 1. 创建临时工作目录

```bash
mkdir -p temp_work
cd temp_work
```

#### 2. 导入字幕、章节和规则

```bash
# 方式一：使用示例文件
python -m podcast_sanitizer import \
    --subtitle ../examples/sample.srt \
    --chapter ../examples/chapters.csv \
    --rules ../examples/sensitive_rules.csv

# 方式二：使用默认敏感词规则
python -m podcast_sanitizer import \
    --subtitle ../examples/sample.srt \
    --chapter ../examples/chapters.csv \
    --default-rules
```

#### 3. 扫描时间轴问题和敏感词

```bash
python -m podcast_sanitizer scan --verbose
```

你会看到类似输出：

```
[INFO] 开始扫描...

========================================
扫描结果汇总
========================================
总问题数: X

按问题类型:
  重叠字幕: X
  断句过长: X
  敏感词命中: X
  章节外片段: X

按严重程度:
  高 (high): X
  中 (medium): X
  低 (low): X
```

#### 4. 生成脱敏字幕

```bash
python -m podcast_sanitizer mask --verbose
```

输出示例：

```
[INFO] 开始脱敏处理...

========================================
脱敏结果汇总
========================================
脱敏项总数: X

按类别:
  phone: X
  email: X
  client: X
  project: X

包含敏感内容的字幕: X / X
```

#### 5. 导出所有成果

```bash
python -m podcast_sanitizer export --all --output-dir ./output --name my_podcast
```

导出的文件包括：

- `my_podcast_report.md` - Markdown 格式的审核报告
- `my_podcast_clips.csv` - 章节切片表
- `my_podcast_timeline.json` - 可回放的时间轴数据
- `my_podcast_masked.srt` - 脱敏后的 SRT 字幕
- `my_podcast_masked.vtt` - 脱敏后的 VTT 字幕

#### 6. 查看导出结果

```bash
# 查看审核报告
cat output/my_podcast_report.md

# 查看切片表
cat output/my_podcast_clips.csv

# 查看时间轴
cat output/my_podcast_timeline.json
```

## 命令详解

### import 命令

导入字幕、章节和规则文件。

```bash
python -m podcast_sanitizer import [选项]

选项:
  --subtitle, -s   字幕文件路径 (.srt 或 .vtt)
  --chapter, -c    章节CSV文件路径
  --rules, -r      敏感词规则CSV文件路径
  --default-rules  使用内置默认规则
  --work-dir, -w   工作目录 (默认: 当前目录)
```

**章节 CSV 格式:**
```csv
开始时间,标题,结束时间
00:00:00.000,开场介绍,00:00:15.000
00:00:15.000,嘉宾访谈,00:00:35.000
```

**规则 CSV 格式:**
```csv
pattern,category,description,mask_template
1[3-9]\d{9},phone,手机号码,[PHONE_{index}]
[\w.-]+@[\w.-]+\.\w+,email,电子邮箱,[EMAIL_{index}]
```

### scan 命令

扫描时间轴问题和敏感词。

```bash
python -m podcast_sanitizer scan [选项]

选项:
  --max-sentence-duration  最大断句时长(秒)，默认8秒
  --verbose, -v            显示详细信息
  --work-dir, -w           工作目录
```

**检测的问题类型:**
1. **重叠字幕** - 两条字幕时间轴有重叠
2. **断句过长** - 单条字幕持续时间超过阈值
3. **敏感词命中** - 匹配到敏感规则的内容
4. **章节外片段** - 字幕不在任何章节范围内

### mask 命令

生成脱敏字幕和映射表。

```bash
python -m podcast_sanitizer mask [选项]

选项:
  --verbose, -v   显示详细信息
  --work-dir, -w  工作目录
```

**脱敏特性:**
- 相同的原始文本会映射到相同的掩码
- 支持按类别区分掩码（如 `[PHONE_1]`、`[EMAIL_1]`）
- 保持原文结构，仅替换敏感内容

### export 命令

导出审核报告、切片表和时间轴。

```bash
python -m podcast_sanitizer export [选项]

选项:
  --report         导出Markdown审核报告
  --clips          导出CSV切片表
  --timeline       导出JSON时间轴
  --subtitle       导出脱敏字幕
  --all            导出所有文件 (推荐)
  --output-dir, -o 输出目录 (默认: ./output)
  --name, -n       输出文件名基础 (默认: podcast_sanitized)
  --report-title   报告标题 (默认: 播客字幕审核报告)
  --work-dir, -w   工作目录
```

## 内置敏感词规则

默认规则支持以下类型的敏感信息检测：

| 类别 | 描述 | 掩码模板 |
|------|------|----------|
| phone | 手机号码、固定电话 | `[PHONE_{index}]` |
| email | 电子邮箱地址 | `[EMAIL_{index}]` |
| client | 客户称谓（张总、王客户等） | `[CLIENT_{index}]` |
| project | 项目代号（PROJ_xxx、SPRINT_xxx等） | `[PROJECT_{index}]` |
| idcard | 身份证号码 | `[IDCARD_{index}]` |
| address | 住址信息 | `[ADDRESS_{index}]` |

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 或使用 unittest
python -m unittest discover tests/
```

## 自定义规则

你可以创建自己的敏感词规则 CSV 文件：

```csv
pattern,category,description,mask_template
保密合同,legal,法律敏感词,[LEGAL_{index}]
内部文档,internal,内部资料,[INTERNAL_{index}]
```

然后使用 `--rules` 参数导入：

```bash
python -m podcast_sanitizer import --rules my_rules.csv
```

## 完整工作流示例

```bash
# 1. 准备工作目录
mkdir -p /path/to/workspace
cd /path/to/workspace

# 2. 导入所有数据
python -m podcast_sanitizer import \
    --subtitle ./whisper_output.srt \
    --chapter ./chapters.csv \
    --default-rules

# 3. 扫描问题
python -m podcast_sanitizer scan --verbose

# 4. 执行脱敏
python -m podcast_sanitizer mask --verbose

# 5. 导出成果
python -m podcast_sanitizer export --all \
    --output-dir ./final_output \
    --name episode_001
```

## License

MIT
