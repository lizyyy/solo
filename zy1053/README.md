# RefChecker - 参考文献一致性检查工具

一个用于学术论文写作的参考文献检查工具，帮助你在交稿前发现引用相关的各种问题。

## 功能特性

- ✅ **缺失引用检测**：找出正文中引用了但参考文献库中不存在的 key
- ✅ **未引用检测**：找出参考文献库中有但正文没引用的条目
- ✅ **重复文献检测**：根据 DOI、标题相似度、作者年份发现疑似重复
- ✅ **DOI 冲突检测**：检查同一个 DOI 的年份、作者、标题是否一致
- ✅ **重复 key 检测**：发现不同文献使用相同引用键的问题
- ✅ **多格式支持**：
  - 正文：Markdown (`[@key]`)、LaTeX (`\cite{key}`)
  - 参考文献：BibTeX (`.bib`)、RIS (`.ris`)
- ✅ **多种输出**：
  - 控制台摘要输出
  - Markdown 详细报告
  - JSON 结构化数据
  - 清洗后的 BibTeX 导出

## 安装

```bash
# 克隆或下载项目后，在项目根目录运行
pip install -e .
```

或者安装额外依赖以获得更好的标题相似度检测：

```bash
pip install -e ".[fuzzy]"
```

## 快速开始

项目目录下有 `examples/` 文件夹，包含示例论文和参考文献。可以直接运行测试：

```bash
cd /path/to/refchecker

# 基本检查
refchecker -t examples/paper.md -r examples/refs_main.bib

# 检查多个参考文献文件
refchecker -t examples/paper.md -r examples/refs_main.bib -r examples/refs_supp.bib

# 生成 Markdown 报告
refchecker -t examples/paper.md -r examples/refs_main.bib -r examples/refs_supp.bib -o report.md

# 导出清洗后的 BibTeX
refchecker -t examples/paper.md -r examples/refs_main.bib -r examples/refs_supp.bib --export-bib clean.bib

# 完整检查并输出所有报告
refchecker -t examples/paper.md \
           -r examples/refs_main.bib \
           -r examples/refs_supp.bib \
           -o report.md \
           -j details.json \
           --export-bib clean.bib
```

## 使用说明

### 命令行参数

```
refchecker [OPTIONS]

选项:
  -t, --text TEXT       正文文件 (Markdown 或 LaTeX)，可多次指定
  -r, --ref TEXT        参考文献文件 (.bib 或 .ris)，可多次指定
  -o, --report TEXT     输出 Markdown 报告文件路径
  -j, --json TEXT       输出 JSON 明细文件路径
  -e, --export-bib TEXT 导出清洗后的 BibTeX 文件路径
  --include-unused      导出时包含未被引用的参考文献
  --no-dedupe           导出时不进行去重
  --title-threshold INT 标题相似度阈值 (0-100，默认 85)
  -v, --verbose         详细输出模式
  -q, --quiet           安静模式
  --help                显示帮助信息
```

### 支持的引用格式

**Markdown (Pandoc 风格):**
- `[@key]` - 单个引用
- `[@key1; @key2]` - 多个引用
- `[text @key]` - 带正文的引用
- `[-@key]` - 抑制作者名

**LaTeX:**
- `\cite{key}`
- `\citet{key}`, `\citep{key}` (natbib)
- `\textcite{key}`, `\parencite{key}` (biblatex)
- `\cite[opt]{key1, key2}` - 带选项和多个 key

### 检测的问题类型

1. **缺失引用 (Missing Citations)**
   - 正文中引用了某个 key，但参考文献库中不存在
   - 常见原因：拼写错误、复制粘贴时遗漏、不同同学的 bib 文件没有合并

2. **未引用的参考文献 (Unused References)**
   - 参考文献库中有某个条目，但正文从未引用
   - 常见原因：删除了相关段落但忘记清理 bib 文件

3. **重复的引用键 (Duplicate Keys)**
   - 不同的文献条目使用了相同的引用 key
   - 常见原因：多个 bib 文件合并时产生冲突

4. **疑似重复文献 (Duplicate Candidates)**
   - 根据相同 DOI 或相似标题+作者+年份检测到的潜在重复
   - 常见原因：从不同数据库导出、多人协作时重复添加

5. **DOI 字段冲突 (DOI Conflicts)**
   - 同一个 DOI 对应了不同的作者、年份或标题
   - 常见原因：手动修改时出错、不同来源的元数据不一致

## 项目结构

```
refchecker/
├── refchecker/
│   ├── __init__.py
│   ├── models.py          # 数据模型定义
│   ├── checker.py         # 核心检查逻辑
│   ├── reporter.py        # 报告生成
│   ├── cli.py             # 命令行入口
│   └── parsers/
│       ├── __init__.py
│       ├── markdown.py    # Markdown 引用解析
│       ├── latex.py       # LaTeX 引用解析
│       ├── bibtex.py      # BibTeX 文件解析
│       └── ris.py         # RIS 文件解析
├── examples/
│   ├── paper.md           # 示例 Markdown 论文
│   ├── paper.tex          # 示例 LaTeX 论文
│   ├── refs_main.bib      # 主参考文献文件
│   ├── refs_supp.bib      # 补充参考文献（包含问题）
│   └── refs_ris.ris       # RIS 格式参考文献
├── setup.py
└── README.md
```

## 架构设计

工具采用分层架构，各模块职责清晰：

1. **解析层 (parsers/)** - 负责解析不同格式的文件
   - 不做任何检查，只负责将原始数据转换为统一的内部数据模型
   - 遇到格式错误时抛出明确的异常

2. **数据层 (models.py)** - 定义统一的数据结构
   - `ReferenceEntry`: 单条参考文献条目
   - `Citation`: 正文中的一处引用
   - `CheckResult`: 检查结果汇总
   - `ProjectAnalysis`: 完整的项目分析数据

3. **检查层 (checker.py)** - 实现各种检查规则
   - 每个检查规则是独立的方法
   - 输入是解析后的数据，输出是问题列表

4. **报告层 (reporter.py)** - 生成各种格式的输出
   - Markdown: 适合人类阅读的详细报告
   - JSON: 适合程序处理的结构化数据
   - BibTeX: 清洗后可直接使用的参考文献

5. **命令行层 (cli.py)** - 用户交互入口
   - 参数解析、文件收集、错误处理
   - 协调各模块完成完整的检查流程

## 示例运行

运行以下命令可以看到工具的完整功能：

```bash
# 在项目根目录执行
refchecker -t examples/paper.md -r examples/refs_main.bib -r examples/refs_supp.bib
```

预期输出包含：

- ❌ **1 个缺失引用**: `nonexistent2024paper` (故意在正文中引用了不存在的条目)
- ⚠️ **3 个未引用的参考文献**: `unusedref2023alpha`, `anotherunused2023` 等
- ⚠️ **2 个重复的引用键**: `lecun2015deep`, `floridi2018aiethics` (在两个 bib 文件中都有)
- ⚠️ **2 组疑似重复文献**: 根据相同 DOI 和相似标题检测
- ❌ **1 个 DOI 冲突**: `10.1016/j.cell.2018.02.010` 对应了不同的年份和作者

## 常见问题

### Q: 为什么有些重复检测不到？

A: 重复检测依赖 DOI 或标题+作者+年份的相似度。如果两条文献没有 DOI，且标题差异较大，可能无法检测到。可以通过 `--title-threshold` 调整标题相似度阈值。

### Q: 为什么 LaTeX 文件中的引用没找到？

A: 工具支持常见的 `\cite`, `\citet`, `\citep`, `\textcite`, `\parencite` 等命令。如果你使用了非常见的自定义宏包命令，可能无法识别。

### Q: BibTeX 解析失败怎么办？

A: 检查是否有语法错误，如未闭合的大括号、缺少逗号等。工具会给出具体的错误位置提示。

### Q: 可以同时检查 Markdown 和 LaTeX 文件吗？

A: 可以，使用多个 `-t` 参数即可：

```bash
refchecker -t paper1.md -t paper2.tex -r refs.bib
```

## 许可证

MIT License
