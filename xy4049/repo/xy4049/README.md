# 多语字幕交付校对员

一个为短剧译制和字幕交付小组设计的本地自动化工具，用于自动化检查字幕质量、对齐多语言字幕、生成修复计划和导出交付报告。

## 功能特性

- **项目初始化**: 可配置的项目设置（语言列表、帧率、读速限制、命名模板等）
- **文件导入**: 支持 SRT/VTT 字幕、台本 CSV、交付清单 CSV，自动计算 SHA256 校验值
- **质量检查**:
  - 时间码格式校验
  - 字幕时间轴重叠检测
  - 空字幕检测
  - 序号断档检测
  - 同集多语言缺段检测
  - 读速超限检测（中文/英文分别配置）
  - 占位符或金额数字在翻译中丢失检测
  - 说话人标签不一致检测
  - 文件名与清单不匹配检测
- **跨语言对齐**: 按时间码/序号/台本对齐多语言字幕段落
- **修复计划**: 生成 dry-run 修复建议，不直接覆盖原始文件
- **人工复核**: 支持确认/驳回问题，反馈保存并影响下次检查
- **报告导出**: Markdown 交付复盘、CSV 问题清单、JSON 审计包
- **历史查询**: 按剧集、语言和问题类型查询历史检查结果

## 安装

### 方式一：pip 安装

```bash
pip install -e .
```

### 方式二：开发者模式

```bash
# 安装依赖
pip install click pydantic python-dateutil chardet

# 或使用项目配置
pip install -e ".[dev]"
```

安装完成后，使用 `subtitle-checker` 命令：

```bash
subtitle-checker --help
```

## 快速开始

### 使用示例数据验证流程

项目自带 `sample_data/` 目录，包含测试用的字幕文件和台本。

#### 1. 创建临时目录并初始化项目

```bash
# 创建工作目录
mkdir -p /tmp/subtitle-test && cd /tmp/subtitle-test

# 初始化项目
subtitle-checker init \
    --languages zh en \
    --frame-rate 25.0 \
    --max-speed-zh 6.0 \
    --max-speed-en 12.0 \
    --min-gap 40
```

#### 2. 导入示例文件

```bash
# 复制示例文件到工作目录
cp -r /Users/mac/pro/solocoder/pro/xy4049/repo/xy4049/sample_data/* .

# 导入文件（复制到 imports 目录）
subtitle-checker import --copy ep01_zh.srt ep01_en.srt script_ep01.csv manifest.csv
```

#### 3. 执行质量检查

```bash
subtitle-checker check
```

这会检测以下问题：
- 中文字幕第 1 条和第 2 条时间码重叠（3.400 < 3.500）
- 中文字幕序号断档（跳过了第 4 条）
- 中文字幕第 6 条读速过快（2 字 / 1 秒 = 2 字/秒，正常；但第 3 条有占位符）
- 中文字幕 `{公司名}` 和 `[日期]` 占位符在英文翻译中丢失
- 中英文说话人标签不一致（中文用"男主/女主"，英文用"Male Lead/Female Lead"）
- 文件名与交付清单不匹配（期望 `Drama_EP01_zh.srt`，实际是 `ep01_zh.srt`）

#### 4. 生成修复计划

```bash
subtitle-checker plan-fix
```

查看可自动修复和需要人工处理的项。

#### 5. 对齐多语言字幕

```bash
# 按时间码对齐
subtitle-checker align --source-lang zh --target-lang en --method timecode

# 或按序号对齐
subtitle-checker align --source-lang zh --target-lang en --method index
```

#### 6. 人工复核问题

```bash
# 列出所有问题
subtitle-checker review --list

# 查看某个问题详情（使用输出的问题 ID 前 8 位）
# subtitle-checker review <问题ID>

# 确认问题
# subtitle-checker review <问题ID> --action confirm --note "确实需要修复"

# 驳回问题（误报）
# subtitle-checker review <问题ID> --action dismiss --note "这个是正确的，不需要修改"
```

#### 7. 应用修复

```bash
# 先查看修复计划
subtitle-checker plan-fix

# 确认后应用修复（会写入 dist 目录）
subtitle-checker apply-fix --yes
```

#### 8. 导出交付报告

```bash
# 导出所有格式（Markdown、CSV、JSON）
subtitle-checker export

# 或单独导出某一格式
subtitle-checker export --format markdown
subtitle-checker export --format csv
subtitle-checker export --format json
```

#### 9. 查询历史记录

```bash
# 查看历史检查汇总
subtitle-checker history --summary

# 按集数筛选
subtitle-checker history --episode 1

# 按语言筛选
subtitle-checker history --language zh

# 按问题类型筛选
subtitle-checker history --issue-type overlap
```

## 完整命令参考

### init - 初始化项目

```bash
subtitle-checker init [OPTIONS]

选项:
  -l, --languages TEXT        支持的语言列表 (默认: zh, en)
  -f, --frame-rate FLOAT      视频帧率 (默认: 25.0)
  --max-speed-zh FLOAT        中文字幕最大读速 (字符/秒, 默认: 6.0)
  --max-speed-en FLOAT        英文字幕最大读速 (字符/秒, 默认: 12.0)
  --min-gap INTEGER           最小字幕间隔 (毫秒, 默认: 40)
  -o, --output-dir TEXT       输出目录 (默认: dist)
  -p, --platform-template TEXT  平台命名模板 (格式: 平台名=模板)
  --help                      显示帮助信息
```

### import - 导入文件

```bash
subtitle-checker import [OPTIONS] FILES...

参数:
  FILES...                    要导入的文件 (SRT/VTT/CSV)

选项:
  -l, --language TEXT         指定文件语言 (自动检测)
  -e, --episode INTEGER       指定集数 (自动检测)
  -c, --copy                  复制文件到 imports 目录
  --help                      显示帮助信息
```

### check - 执行质量检查

```bash
subtitle-checker check [OPTIONS]

选项:
  -f, --files PATH            指定检查的文件 (默认使用 imports 目录)
  --save / --no-save          是否保存到 quarantine.json (默认: 是)
  --help                      显示帮助信息
```

### align - 对齐多语言字幕

```bash
subtitle-checker align [OPTIONS]

选项:
  -s, --source-lang TEXT      源语言 (默认: zh)
  -t, --target-lang TEXT      目标语言 (默认: en)
  -m, --method TEXT           对齐方式 [timecode|index|script] (默认: timecode)
  -o, --output PATH           输出对齐结果的 JSON 文件路径
  --help                      显示帮助信息
```

### plan-fix - 生成修复计划

```bash
subtitle-checker plan-fix [OPTIONS]

选项:
  -q, --quarantine PATH       指定 quarantine.json 文件 (默认使用最新的)
  -o, --output PATH           输出修复计划的 JSON 文件路径
  --help                      显示帮助信息
```

### apply-fix - 应用修复

```bash
subtitle-checker apply-fix [OPTIONS]

选项:
  -p, --plan PATH             修复计划 JSON 文件 (默认使用最新检查结果)
  -y, --yes                   跳过确认提示
  --help                      显示帮助信息
```

### review - 人工复核

```bash
subtitle-checker review [OPTIONS] [ISSUE_ID]

参数:
  ISSUE_ID                    问题 ID (可选，不指定时显示列表)

选项:
  -a, --action TEXT           复核动作 [confirm|dismiss|pending]
  -n, --note TEXT             复核备注
  -l, --list                  列出所有问题
  --help                      显示帮助信息
```

### export - 导出报告

```bash
subtitle-checker export [OPTIONS]

选项:
  -f, --format TEXT           导出格式 [all|markdown|csv|json] (默认: all)
  -o, --output PATH           输出目录 (默认使用项目的 dist 目录)
  --help                      显示帮助信息
```

### history - 查询历史

```bash
subtitle-checker history [OPTIONS]

选项:
  -e, --episode INTEGER       按集数筛选
  -l, --language TEXT         按语言筛选
  -t, --issue-type TEXT       按问题类型筛选
  -n, --limit INTEGER         显示条数限制 (默认: 50)
  -s, --summary               显示汇总统计
  --help                      显示帮助信息
```

## 项目目录结构

```
subtitle-checker/
├── subtitle_checker/
│   ├── __init__.py          # 包初始化
│   ├── cli.py               # CLI 入口
│   ├── models.py            # 数据模型定义
│   ├── config.py            # 配置管理
│   ├── subtitle_parser.py   # SRT/VTT 字幕解析
│   ├── manifest_parser.py   # CSV 清单/台本解析
│   ├── validator.py         # 规则校验
│   ├── aligner.py           # 跨语言对齐
│   ├── fix_planner.py       # 修复计划
│   ├── review_store.py      # 人工复核存储
│   ├── exporter.py          # 报告导出
│   └── history.py           # 历史查询
├── sample_data/             # 示例数据
│   ├── ep01_zh.srt          # 中文字幕（含测试问题）
│   ├── ep01_en.srt          # 英文字幕（含测试问题）
│   ├── script_ep01.csv      # 台本 CSV
│   └── manifest.csv         # 交付清单 CSV
├── tests/                   # 单元测试
│   ├── __init__.py
│   └── test_models.py
├── pyproject.toml           # 项目配置
└── README.md                # 本文档
```

## 问题类型说明

| 问题类型 | 说明 | 严重程度 |
|---------|------|---------|
| `timecode_format` | 时间码格式错误 | CRITICAL |
| `overlap` | 时间轴重叠或间隔过小 | CRITICAL/WARNING |
| `empty_subtitle` | 空字幕 | WARNING |
| `sequence_gap` | 序号断档 | WARNING |
| `missing_segment` | 多语言缺段或条数不一致 | CRITICAL/WARNING |
| `reading_speed` | 读速超限 | WARNING |
| `placeholder_missing` | 占位符在翻译中丢失 | CRITICAL |
| `speaker_tag_mismatch` | 说话人标签不一致 | WARNING |
| `filename_mismatch` | 文件名与清单不匹配 | WARNING |
| `currency_mismatch` | 金额数字可能不匹配 | WARNING |

## 开发

### 运行测试

```bash
pytest
```

### 代码检查

```bash
ruff check subtitle_checker/
```

## 许可证

MIT License
