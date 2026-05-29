# 歌词押韵检查CLI

轻量级歌词检查工具，帮助词作者在创作阶段快速发现押韵、字数、重复词等问题，避免到录音棚才发现拗口。

## 功能特性

### ✅ 韵脚检查
- 支持 AABB / ABAB 押韵方案检测
- 自动提取每行韵脚（韵母）
- 多音字自动识别，给出可能读音
- 韵脚分组统计，找出最常用韵脚

### ✅ 字数统计
- 按行/按段统计汉字数
- 中英文混合识别与分别统计
- 行数一致性检查（自动计算基准和方差）
- 平均字数、最大最小字数统计

### ✅ 重复检测
- 重复词检测（支持标记"刻意重复"）
- 重复短语检测
- 重复行检测与相似度分析
- **副歌自动识别**（根据重复间隔和标记判断）
- 禁用词检查

### ✅ 场景复盘
- **多音字处理**：列出所有多音字及位置，支持复核确认
- **中英文混合**：识别混合行并评估影响等级
- **副歌误判标记**：支持将检测结果标记为"确认副歌"或"误判"
- 所有场景可记录、可追溯、可导出

### ✅ 报告导出
- 文本格式报告（便于阅读）
- JSON格式报告（便于程序处理）
- 包含综合评分和改进建议

### ✅ 版本管理
- 自动保存每个版本的歌词和检查结果
- 版本历史追溯
- 版本对比（行级diff）
- 去重保存（内容相同不重复保存）

## 快速开始

### 安装依赖

```bash
pip install pypinyin jieba
```

### 命令行使用

#### 1. 检查歌词文件

```bash
# 基本检查
python cli.py check examples/示例歌词.txt -t "追着风" -a "作词者名"

# 指定押韵方案和禁用词
python cli.py check examples/示例歌词.txt -s abab -f "痛苦,悲伤,寂寞"

# 不保存版本（仅查看结果）
python cli.py check examples/示例歌词.txt --no-save
```

#### 2. 查看已保存的歌曲

```bash
python cli.py list
```

#### 3. 查看某首歌的版本历史

```bash
python cli.py versions "追着风"
```

#### 4. 比较两个版本

```bash
python cli.py compare "追着风" v20260529_103000 v20260529_110000
```

### Python API 使用

```python
from lyrics_checker import LyricsChecker

checker = LyricsChecker()

lyrics = """我走在城市的黄昏
看夕阳慢慢地沉沦
街道上拥挤的人们
各自奔向回家的门"""

result = checker.check(
    lyrics_text=lyrics,
    song_title="歌名",
    author="作者",
    rhyme_scheme="aabb",
    forbidden_words=["痛苦", "悲伤"],
)

# 打印报告
checker.print_report(result)

# 获取综合评分
print(f"评分: {result['overall_score']['score']}")
```

## 项目结构

```
lyrics_checker/
├── __init__.py          # 包入口
├── rhyme.py            # 韵脚识别模块
├── word_count.py       # 字数统计模块
├── repetition.py       # 重复检测模块
├── polyphone.py        # 多音字和场景复盘模块
├── report.py           # 报告生成模块
├── version.py          # 版本管理模块
└── checker.py          # 主检查器（整合所有功能）

cli.py                  # 命令行入口
test_demo.py           # 功能演示脚本
examples/
└── 示例歌词.txt        # 示例歌词文件
reports/               # 报告输出目录（自动创建）
versions/              # 版本存储目录（自动创建）
```

## 核心模块说明

### RhymeChecker 韵脚检查器

主要方法：
- `get_line_final(line)` - 获取单行韵脚信息
- `check_rhyme_scheme(lines, scheme_type)` - 检查押韵方案
- `find_rhyme_groups(lines)` - 找出韵脚分组

返回结果包含：
- 每个字的拼音和韵母
- 多音字提示
- 押韵对匹配情况
- 人类可读的判断理由

### WordCounter 字数统计器

主要方法：
- `analyze_lines(lines)` - 分析所有行
- `analyze_paragraphs(paragraphs)` - 按段落分析
- `check_line_length_consistency(lines, target_length)` - 检查行数一致性

### RepetitionDetector 重复检测器

主要方法：
- `detect_repeated_words(text)` - 检测重复词
- `detect_repeated_lines(lines)` - 检测重复行
- `check_forbidden_words(text, forbidden_words)` - 检查禁用词

刻意重复标记：在行中添加 `[repeat]` 或 `[R]` 标记，该词会被视为刻意重复。

### PolyphoneHandler 场景复盘器

主要方法：
- `find_polyphones(text)` - 查找所有多音字
- `analyze_mixed_language(text)` - 分析中英文混合
- `create_*_scenario()` - 创建各种复盘场景
- `resolve_scenario(scenario_id, resolution_id)` - 标记场景已处理
- `generate_review_report()` - 生成复盘报告

### VersionManager 版本管理器

主要方法：
- `save_version(lyrics_text, song_title, ...)` - 保存版本
- `get_version(song_title, version_id)` - 获取版本内容
- `list_versions(song_title)` - 列出所有版本
- `compare_versions(song_title, v1, v2)` - 版本对比

## 检查报告说明

每次检查会生成一个综合报告，包含以下部分：

1. **基本信息**：歌名、作者、行数、段落数
2. **韵脚检查**：押韵方案匹配情况、韵脚分布
3. **字数统计**：汉字数、英文词数、一致性
4. **重复检测**：重复词/短语/行、疑似副歌
5. **多音字与混合语言**：待复核场景列表
6. **问题汇总**：按严重程度排序的所有问题
7. **综合评分**：A/B/C/D 四级评分及理由

## 典型使用场景

### 月底整理

```bash
# 批量检查本月歌词
for f in 本月歌词/*.txt; do
  python cli.py check "$f" -t "$(basename "$f" .txt)" --notes "月底整理"
done

# 查看所有歌曲状态
python cli.py list
```

### 课前准备

```bash
# 检查学生作业
python cli.py check 学生作品/张三.txt -t "张三的歌" -a "张三"

# 对比修改前后
python cli.py compare "张三的歌" v1 v2
```

### 团队协作

```python
# 将JSON报告接入内部系统
import json
from lyrics_checker import LyricsChecker

checker = LyricsChecker()
result = checker.check(lyrics, save_report=True)

# result['report_files']['json'] 就是报告文件路径
# 可以传给前端展示或存入数据库
```

## 输出示例

```
============================================================
  歌词检查报告
  生成时间: 2026-05-29 12:00:00
============================================================

【基本信息】
  标题: 追着风
  作者: 演示作者
  总行数: 54
  总段落: 8

【韵脚检查】
  押韵方案: AABB
  押韵对: 8/10
  问题数: 2
  押韵问题:
    - 第3/4行: 韵脚不匹配（en vs un）
    ...

【字数统计】
  汉字总数: 234
  平均每行: 7.2字
  字数范围: 5-10字

【重复检测】
  重复词: 5个
  疑似副歌: 1组

【综合评分】
  85分（B级）- 良好，建议微调
  判断理由: 基于0个错误、3个警告、0个提示项计算...
```

## 扩展开发

每个模块都是独立的，可以单独使用或扩展：

```python
# 单独使用韵脚检查
from lyrics_checker.rhyme import RhymeChecker

rc = RhymeChecker()
result = rc.get_line_final("我走在城市的黄昏")
print(result['primary_final'])  # 输出: 'en'

# 单独使用版本管理
from lyrics_checker.version import VersionManager

vm = VersionManager()
versions = vm.list_versions("我的歌")
```

## License

MIT
