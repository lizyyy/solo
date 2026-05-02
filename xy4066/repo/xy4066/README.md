# 术语包离线守门员

会议同传/字幕团队本地端侧工具，用于大型发布会前术语检查。

## 功能特性

- **init**: 初始化项目配置
- **import-glossary**: 导入 CSV/JSON 术语包并合并版本
- **scan**: 读取 SRT/TXT 转写稿
- **check**: 找出以下问题：
  - 未命中术语（中文术语缺少对应英文译法）
  - 禁用译法（侮辱性词汇、广告合规词汇）
  - 重复缩写（同一个缩写对应多个术语）
  - 大小写不统一
  - 同一个中文名被翻成多个英文名
  - 姓名别名冲突
  - 上下文相似但译法不一致
- **report**: 导出 Markdown/CSV/JSON 修订清单

## 目录结构

```
glossary_guardian/
├── __init__.py          # 包初始化
├── __main__.py          # 执行入口
├── cli/
│   ├── __init__.py
│   └── cli.py           # CLI 命令实现
├── config/
│   ├── __init__.py
│   └── config.py        # 配置管理
├── engine/
│   ├── __init__.py
│   ├── rule_engine.py   # 规则引擎
│   └── similarity_matcher.py  # 相似度匹配
├── parsers/
│   ├── __init__.py
│   ├── glossary_parser.py    # 术语包解析器
│   └── transcript_parser.py  # 转写稿解析器
└── reporters/
    ├── __init__.py
    └── reporter.py      # 报告生成器

sample_data/              # 示例数据
├── glossary_v1.csv       # 术语表 v1
├── glossary_v2.csv       # 术语表 v2（用于测试合并）
├── forbidden_terms.csv   # 禁用词表
├── guest_list.csv        # 嘉宾名单
├── transcript_rehearsal.srt  # SRT 转写稿
└── transcript_rehearsal.txt  # TXT 转写稿

tests/                    # 测试文件
├── __init__.py
├── test_config.py
├── test_glossary_parser.py
└── test_transcript_parser.py
```

## 安装

```bash
# 直接使用（无需安装）
python -m glossary_guardian --help

# 或者在项目目录下使用
cd /path/to/xy4066
python -m glossary_guardian --help
```

## 快速开始：临时目录验证全流程

### 1. 创建临时目录并初始化项目

```bash
# 创建临时测试目录
mkdir -p /tmp/glossary_test
cd /tmp/glossary_test

# 初始化项目
python -m glossary_guardian init "2024科技发布会"
```

输出：
```
✅ 项目 '2024科技发布会' 初始化成功
   目录: /tmp/glossary_test
   创建时间: 2024-xx-xxTxx:xx:xx
```

### 2. 导入术语包

使用项目提供的示例数据：

```bash
# 导入第一版术语表
python -m glossary_guardian import-glossary /path/to/xy4066/sample_data/glossary_v1.csv --source "客户提供v1"

# 导入第二版术语表（测试合并功能）
python -m glossary_guardian import-glossary /path/to/xy4066/sample_data/glossary_v2.csv --source "客户提供v2"
```

输出示例：
```
✅ 术语包导入成功: /path/to/xy4066/sample_data/glossary_v1.csv
   合并条目: 16
```

### 3. 导入禁用词表

```bash
# 导入禁用词表
python -m glossary_guardian import-glossary /path/to/xy4066/sample_data/forbidden_terms.csv --forbidden
```

输出：
```
✅ 禁用词表导入成功: /path/to/xy4066/sample_data/forbidden_terms.csv
```

### 4. 导入嘉宾名单

```bash
# 导入嘉宾名单
python -m glossary_guardian import-glossary /path/to/xy4066/sample_data/guest_list.csv --guests
```

输出：
```
✅ 嘉宾名单导入成功: /path/to/xy4066/sample_data/guest_list.csv
```

### 5. 扫描转写稿

```bash
# 扫描 SRT 格式转写稿
python -m glossary_guardian scan /path/to/xy4066/sample_data/transcript_rehearsal.srt
```

输出：
```
✅ 转写稿扫描成功: /path/to/xy4066/sample_data/transcript_rehearsal.srt
   片段数量: 35
   识别说话人: 张三, 李四, 王五, 赵六, 记者
```

### 6. 查看项目信息

```bash
# 查看所有项目信息
python -m glossary_guardian list
```

输出示例：
```
📋 项目: 2024科技发布会
   创建时间: 2024-xx-xxTxx:xx:xx
   更新时间: 2024-xx-xxTxx:xx:xx

📚 术语表:
   总条目数: xx
   按分类:
      - 技术术语: xx
      - 活动术语: xx
      - 职位头衔: xx
      - 嘉宾名单: xx
   缩写定义: xx
   ⚠️  重复缩写: 0

🚫 禁用词表:
   总条目数: 14
   按分类:
      - 敏感词汇: 8
      - 广告合规: 6

👥 嘉宾名单:
   总人数: 6
   按单位:
      - 科技创新公司: 5
      - 投资集团: 1

📝 转写稿:
   文件数: 1
      - /path/to/xy4066/sample_data/transcript_rehearsal.srt
```

### 7. 执行术语检查

```bash
# 执行完整检查
python -m glossary_guardian check
```

输出示例：
```
🔍 开始执行术语检查...

📊 规则检查结果:
共发现 X 个问题
检查了 35 个片段

按严重程度分类:
  - HIGH: X 个
  - MEDIUM: X 个

按问题类型分类:
  - FORBIDDEN_TERM: X 个
  - CASE_INCONSISTENCY: X 个
  - ...

🔍 相似度检查结果:
   - 姓名变体问题: X
   - 翻译不一致问题: X
   - 相似上下文不同译法: X

⚠️  共发现 X 个问题，详情请查看报告
💾 检查结果已保存到: /tmp/glossary_test/.glossary-guardian/data/check_result.json
```

### 8. 导出报告

```bash
# 导出 Markdown 格式报告
python -m glossary_guardian report --format markdown --include-similarity

# 导出 CSV 格式报告
python -m glossary_guardian report --format csv

# 导出 JSON 格式报告
python -m glossary_guardian report --format json
```

输出：
```
✅ 报告已生成: /tmp/glossary_test/.glossary-guardian/reports/report_20240501_123456.md
   格式: markdown
   包含相似度检查: 是
```

### 9. 查看生成的报告

```bash
# 查看 Markdown 报告
cat /tmp/glossary_test/.glossary-guardian/reports/report_*.md

# 或者用编辑器打开
open /tmp/glossary_test/.glossary-guardian/reports/
```

## CLI 命令参考

### init - 初始化项目

```bash
glossary-guardian init <项目名称> [--directory <目录>]
```

参数：
- `项目名称`: 项目的名称
- `--directory, -d`: 项目目录路径（默认当前目录）

### import-glossary - 导入术语包

```bash
glossary-guardian import-glossary <文件路径> [--source <来源>] [--forbidden] [--guests] [--directory <目录>]
```

参数：
- `文件路径`: 术语文件路径（支持 CSV/JSON）
- `--source`: 术语来源标识（默认 user）
- `--forbidden`: 导入禁用词表
- `--guests`: 导入嘉宾名单
- `--directory, -d`: 项目目录路径

### scan - 扫描转写稿

```bash
glossary-guardian scan <文件路径> [--source <来源>] [--directory <目录>]
```

参数：
- `文件路径`: 转写稿文件路径（支持 SRT/TXT）
- `--source`: 来源标识（默认 scan）
- `--directory, -d`: 项目目录路径

### check - 执行术语检查

```bash
glossary-guardian check [--similarity-threshold <阈值>] [--directory <目录>]
```

参数：
- `--similarity-threshold`: 相似度阈值（默认 0.85）
- `--directory, -d`: 项目目录路径

### report - 导出报告

```bash
glossary-guardian report [--format <格式>] [--output <路径>] [--include-similarity] [--directory <目录>]
```

参数：
- `--format`: 报告格式（markdown/csv/json，默认 markdown）
- `--output`: 输出文件路径（默认项目 reports 目录）
- `--include-similarity`: 包含相似度检查结果
- `--directory, -d`: 项目目录路径

### list - 列出项目信息

```bash
glossary-guardian list [--type <类型>] [--directory <目录>]
```

参数：
- `--type`: 列出类型（glossary/transcripts/forbidden/guests/all，默认 all）
- `--directory, -d`: 项目目录路径

## 数据格式说明

### 术语表 CSV 格式

```csv
中文,英文,缩写,分类,备注
人工智能,Artificial Intelligence,AI,技术术语,核心技术术语
机器学习,Machine Learning,ML,技术术语,AI子领域
```

列说明：
- `中文`/`chinese`: 中文术语
- `英文`/`english`: 英文译法
- `缩写`/`abbreviation`: 英文缩写（可选）
- `分类`/`category`: 术语分类（可选）
- `备注`/`notes`: 备注说明（可选）

### 禁用词表 CSV 格式

```csv
禁用词,原因,替代词,分类
智障,侮辱性词汇,智力障碍,敏感词汇
最好的,绝对化词汇,优秀的,广告合规
```

列说明：
- `禁用词`/`term`: 禁用的术语
- `原因`/`reason`: 禁用原因（可选）
- `替代词`/`alternative`: 推荐替代词（可选）
- `分类`/`category`: 分类（可选）

### 嘉宾名单 CSV 格式

```csv
中文名,英文名,别名,职位,单位,备注
张三,Zhang San,张总,CEO,科技公司,CEO
李四,Li Si,李博士,CTO,科技公司,CTO
```

列说明：
- `中文名`/`chinese_name`: 嘉宾中文名
- `英文名`/`english_name`: 嘉宾英文名（可选）
- `别名`/`aliases`: 别名列表，逗号分隔（可选）
- `职位`/`title`: 职位（可选）
- `单位`/`organization`: 所属单位（可选）
- `备注`/`notes`: 备注（可选）

### SRT 转写稿格式

标准 SRT 格式：
```
1
00:00:01,000 --> 00:00:05,000
张三: 各位来宾，大家好！

2
00:00:05,000 --> 00:00:10,000
李四: 欢迎参加今天的发布会。
```

### TXT 转写稿格式

支持时间戳和说话人标识：
```
[00:00:01]
张三: 各位来宾，大家好！

[00:00:05]
李四: 欢迎参加今天的发布会。
```

## 运行测试

```bash
# 运行所有测试
python -m pytest tests/ -v

# 运行特定测试
python -m pytest tests/test_config.py -v
python -m pytest tests/test_glossary_parser.py -v
python -m pytest tests/test_transcript_parser.py -v
```

## 常见问题

### Q: 如何处理术语冲突？

A: 当导入多个术语包时，如果同一中文术语有不同的英文译法，系统会报告冲突。你可以：
1. 查看冲突列表
2. 手动修正术语表
3. 重新导入

### Q: 相似度阈值如何设置？

A: 默认阈值为 0.85（85% 相似度）。你可以通过 `--similarity-threshold` 参数调整：
- 0.70: 宽松匹配
- 0.85: 中等匹配（推荐）
- 0.95: 严格匹配

### Q: 支持哪些语言？

A: 目前主要针对中英双语场景设计，支持：
- 中文术语 → 英文译法检查
- 英文术语 → 中文术语检查
- 中英混合文本分析

## 许可证

MIT License
