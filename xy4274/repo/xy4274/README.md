# 访谈脱敏打包员

一个用于处理口述史访谈资料的本地 CLI 工具，帮助档案馆工作人员管理脱敏流程，防止未授权片段被公开、同一个人化名不一致或字幕时间轴错位。

## 功能特性

- **多源文件解析**：支持 SRT 字幕、CSV 授权表、敏感姓名词典、音频切片清单
- **智能问题检测**：自动检测授权缺口、姓名泄露、时间轴重叠、缺音频等问题
- **脱敏处理**：支持姓名替换、手机号/身份证号等敏感信息脱敏
- **状态管理**：记录人工处理意见，支持问题状态跟踪
- **完整导出**：生成脱敏 SRT、Markdown 复核单、JSON 审计包

## 安装

### 环境要求

- Python 3.10 或更高版本

### 安装步骤

1. 克隆或下载项目代码
2. 在项目目录下执行：

```bash
pip install -e .
```

或者使用开发模式安装：

```bash
pip install hatch
hatch shell
```

## 快速开始

### 1. 初始化项目

在你的访谈资料目录下运行：

```bash
sanitizer init
```

这会生成示例文件，包括：
- `访谈实录.srt` - 示例字幕文件
- `受访者授权表.csv` - 授权信息表
- `敏感姓名词典.csv` - 敏感词列表
- `音频切片清单.csv` - 音频文件清单

### 2. 准备数据文件

将示例文件替换为你的真实数据，文件格式要求见下方「数据格式说明」。

### 3. 扫描检测问题

```bash
sanitizer scan
```

工具会自动扫描所有文件，检测并报告以下问题：
- 授权缺口：未授权的片段或人员
- 姓名泄露：字幕中出现的敏感姓名
- 时间轴重叠：字幕时间轴问题
- 缺音频：清单中不存在的音频文件

如需 JSON 格式输出：

```bash
sanitizer scan --json
```

### 4. 人工复核处理

查看所有问题：

```bash
sanitizer review
```

查看特定问题详情：

```bash
sanitizer review 1
```

更新问题状态：

```bash
sanitizer review 1 --status resolved --comment "已将张三替换为张大爷"
```

可用状态：
- `open` - 待处理
- `in_progress` - 处理中
- `resolved` - 已解决
- `wont_fix` - 不处理
- `needs_review` - 需复核

添加姓名覆盖规则（临时修改化名映射）：

```bash
sanitizer review --name "张三" --pseudonym "张大爷" --comment "主要受访者"
```

### 5. 导出结果

```bash
sanitizer export
```

这会在 `output` 目录下生成：
- `sanitized.srt` - 脱敏后的字幕文件
- `review_report.md` - Markdown 复核单
- `audit_package.json` - JSON 审计包

如需强制导出（忽略未解决的问题）：

```bash
sanitizer export --force
```

## 数据格式说明

### SRT 字幕文件

标准 SRT 格式：

```
1
00:00:01,000 --> 00:00:04,500
大家好，我是张三，今天很高兴能在这里接受访谈。

2
00:00:05,000 --> 00:00:09,000
我和李四是在 1980 年一起参加工作的。
```

### 受访者授权表 CSV

| 列名 | 说明 | 示例 |
|------|------|------|
| 姓名 | 受访者真实姓名 | 张三 |
| 化名 | 对外使用的化名 | 张大爷 |
| 授权状态 | 是否已授权 | 已授权/未授权 |
| 授权片段 | 分片段授权的时间范围（可选） | 00:00:00-00:05:00;00:10:00-00:15:00 |
| 备注 | 其他说明 | 主要受访者 |

示例：
```csv
姓名,化名,授权状态,授权片段,备注
张三,张大爷,已授权,,主要受访者
李四,李师傅,已授权,,同事
王五,王厂长,未授权,,涉及敏感内容
```

### 敏感姓名词典 CSV

| 列名 | 说明 | 示例 |
|------|------|------|
| 姓名 | 敏感姓名 | 张三 |
| 分类 | 人员分类 | 受访者,同事,领导 |
| 建议化名 | 建议使用的化名 | 张大爷 |
| 备注 | 其他说明 | 已确认授权 |

示例：
```csv
姓名,分类,建议化名,备注
张三,受访者,张大爷,
李四,同事,李师傅,
王五,领导,王厂长,
赵六,家属,赵阿姨,
```

### 音频切片清单 CSV

| 列名 | 说明 | 示例 |
|------|------|------|
| 片段索引 | 序号 | 1 |
| 文件路径 | 音频文件路径 | ./audio/segment_001.wav |
| 开始时间 | 对应字幕开始时间 | 00:00:00 |
| 结束时间 | 对应字幕结束时间 | 00:00:05 |
| 备注 | 片段说明 | 开场白 |

示例：
```csv
片段索引,文件路径,开始时间,结束时间,备注
1,./audio/segment_001.wav,00:00:00,00:00:05,开场白
2,./audio/segment_002.wav,00:00:05,00:00:10,工作经历
```

## 验证流程

### 完整工作流验证

1. **初始化验证**
   ```bash
   mkdir -p /tmp/test_interview && cd /tmp/test_interview
   sanitizer init
   ```
   确认生成了 4 个示例文件和 `.sanitizer` 目录。

2. **扫描验证**
   ```bash
   sanitizer scan
   ```
   确认工具能检测到示例文件中的问题（如王五未授权、敏感姓名出现在字幕中）。

3. **复核验证**
   ```bash
   sanitizer review
   sanitizer review 1 --status resolved --comment "测试处理"
   ```
   确认问题状态能正常更新。

4. **导出验证**
   ```bash
   sanitizer export --force
   ```
   确认 `output` 目录下生成了三个文件。

### 单元测试

运行项目测试：

```bash
pip install pytest
pytest tests/ -v
```

## 项目结构

```
interview-sanitizer/
├── pyproject.toml           # 项目配置
├── README.md               # 本文档
├── src/
│   └── interview_sanitizer/
│       ├── __init__.py     # 版本信息
│       ├── cli.py          # CLI 入口（init/scan/review/export）
│       ├── parser.py       # 解析校验模块
│       ├── sanitizer.py    # 脱敏规则模块
│       ├── storage.py      # 状态存储模块
│       └── exporter.py     # 导出模块
└── tests/
    ├── __init__.py
    ├── test_parser.py      # 解析器测试
    ├── test_sanitizer.py   # 脱敏器测试
    └── test_storage.py     # 存储测试
```

## 模块说明

### CLI 模块 (`cli.py`)
提供命令行界面，包含四个主要命令：
- `init`: 初始化项目，生成示例文件
- `scan`: 扫描文件，检测问题
- `review`: 管理问题状态和人工处理意见
- `export`: 导出脱敏结果

### 解析校验模块 (`parser.py`)
负责解析各种源文件并进行校验：
- `SRTParser`: 解析 SRT 文件，检测时间轴重叠
- `AuthorizationParser`: 解析授权表，处理授权范围
- `SensitiveNamesParser`: 解析敏感词词典
- `AudioManifestParser`: 解析音频清单，检查文件存在性
- `ProjectScanner`: 整合扫描，生成问题报告

### 脱敏规则模块 (`sanitizer.py`)
负责敏感信息脱敏处理：
- `NameSanitizer`: 姓名替换（支持化名映射）
- `SegmentSanitizer`: 片段授权检查
- `SRTSanitizer`: SRT 字幕整体脱敏
- `SanitizationRules`: 规则引擎（手机号、身份证号等）

### 状态存储模块 (`storage.py`)
负责项目状态管理：
- `StateManager`: 状态管理器（初始化、加载、保存）
- `IssueStatus`: 问题状态枚举
- 支持：问题状态跟踪、姓名覆盖规则、片段排除规则、导出历史

### 导出模块 (`exporter.py`)
负责导出各类输出文件：
- `SRTExporter`: 导出脱敏后的 SRT
- `MarkdownExporter`: 导出 Markdown 复核单
- `JSONAuditExporter`: 导出 JSON 审计包
- `Exporter`: 主导出器，整合导出流程

## 输出文件说明

### 脱敏 SRT (`sanitized.srt`)
所有敏感姓名已替换为化名的字幕文件，可直接用于公开。

### Markdown 复核单 (`review_report.md`)
包含：
- 扫描结果摘要（文件检测情况、问题统计）
- 详细问题列表（含处理状态和备注）
- 脱敏替换记录
- 复核人签字区域

### JSON 审计包 (`audit_package.json`)
完整的处理记录，用于审计追溯，包含：
- 项目信息（ID、目录、创建时间）
- 扫描结果（所有检测到的问题）
- 替换记录（原始内容→替换内容）
- 处理状态（问题状态、姓名覆盖、片段排除）
- 导出历史
- 元数据（工具版本、导出时间）

## 常见问题

### Q: 同一个人在不同文件中化名不一致怎么办？
A: 使用 `sanitizer review --name "姓名" --pseudonym "化名"` 添加覆盖规则，导出时会统一使用该化名。

### Q: 如何处理部分授权的情况？
A: 在授权表的「授权片段」列中指定允许的时间范围，格式为 `开始时间-结束时间`，多个片段用分号分隔。

### Q: 检测到的问题可以忽略吗？
A: 可以使用 `sanitizer review <序号> --status wont_fix --comment "原因"` 标记为不处理，或使用 `sanitizer export --force` 强制导出。

## 许可证

本工具仅供内部使用，请勿用于非法用途。
