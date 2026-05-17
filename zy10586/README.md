# Git 提交信息归类 CLI

自动读取 Git 提交记录，智能分类并生成美观的发版说明报告。

## ✨ 功能特性

- 📖 **智能读取** - 支持按时间范围、作者、分支等条件筛选提交
- 🏷️ **自动分类** - 内置 10+ 分类规则（修复、新功能、重构、配置、文档等）
- 📊 **路径分析** - 按模块、文件类型统计变更情况
- 🖥️ **终端摘要** - 彩色表格展示分类结果
- 📄 **多格式导出** - JSON、Markdown、HTML 三种报告格式
- ⚠️ **异常记录** - 坏数据保留原始位置和原因，友好错误提示

## 🚀 安装

```bash
# 克隆项目
git clone <repository-url>
cd git-commit-classifier

# 安装依赖
npm install

# 全局链接（可选）
npm link
```

## 📖 使用方法

### 基础命令

```bash
# 使用默认配置（最近 20 条提交）
node src/index.js

# 如果已执行 npm link，可以直接用：
git-classify
```

### 常用选项

| 选项 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--count <number>` | `-n` | 读取最近 N 条提交 | 20 |
| `--since <date>` | `-s` | 从指定日期开始 | - |
| `--until <date>` | `-u` | 到指定日期结束 | - |
| `--author <name>` | `-a` | 按作者筛选 | - |
| `--branch <name>` | `-b` | 指定分支 | HEAD |
| `--repo <path>` | - | Git 仓库路径 | 当前目录 |
| `--output <path>` | `-o` | 输出目录 | 当前目录 |
| `--json` | - | 导出 JSON 格式报告 | - |
| `--md` | - | 导出 Markdown 格式报告 | - |
| `--html` | - | 导出 HTML 格式报告 | - |
| `--all` | - | 导出所有格式报告 | - |
| `--no-console` | - | 不输出终端摘要 | - |

### 使用示例

```bash
# 查看最近 50 条提交并生成所有格式报告
git-classify -n 50 --all

# 查看最近一周的提交
git-classify --since "1 week ago"

# 查看指定作者在 2024 年 1 月的提交
git-classify --since "2024-01-01" --until "2024-01-31" --author "张三"

# 只导出 JSON 和 Markdown 报告，不显示终端输出
git-classify --json --md --no-console

# 指定仓库路径和输出目录
git-classify --repo ~/projects/my-app --output ~/reports --html
```

### 子命令

```bash
# 查看所有分类规则说明
git-classify categories

# 使用模拟数据测试分类功能（无需 Git 仓库）
git-classify test
```

## 🏷️ 分类规则

### 内置分类

| 分类 | Key | 说明 | 匹配规则示例 |
|------|-----|------|------------|
| 🐛 修复 | `fix` | Bug 修复 | `fix:`, `修复`, `bug` |
| ✨ 新功能 | `feature` | 新增功能 | `feat:`, `新增`, `添加` |
| ♻️ 重构 | `refactor` | 代码重构 | `refactor:`, `重构`, `优化` |
| ⚙️ 配置 | `config` | 配置变更 | `config:`, `配置`, `.json` 文件 |
| 📝 文档 | `docs` | 文档更新 | `docs:`, `文档`, `.md` 文件 |
| 🧪 测试 | `test` | 测试相关 | `test:`, `测试`, `.test.js` 文件 |
| 💅 样式 | `style` | 样式调整 | `style:`, `样式`, `.css` 文件 |
| 🏗️ 构建/CI | `build` | 构建系统 | `build:`, `ci:`, `.github/` 路径 |
| ↩️ 回滚 | `revert` | 回滚提交 | `revert:`, `回滚` |
| ⚡ 性能 | `perf` | 性能优化 | `perf:`, `性能`, `优化` |
| 📦 其他 | `other` | 未分类 | 所有未匹配的 |

### 分类优先级

系统按优先级顺序匹配，高优先级分类优先匹配：

1. 修复 (100)
2. 新功能 (90)
3. 重构 (80)
4. 配置 (70)
5. 文档 (60)
6. 测试 (50)
7. 样式 (40)
8. 构建/CI (35)
9. 回滚 (30)
10. 性能 (25)

## 📁 输入数据结构

### Git 提交对象

```javascript
{
  "hash": "完整 commit hash",
  "shortHash": "短 hash (7位)",
  "authorName": "作者姓名",
  "authorEmail": "作者邮箱",
  "date": "提交日期 (ISO 格式)",
  "subject": "提交标题",
  "files": [
    {
      "status": "文件状态 (A/M/D/R)",
      "path": "文件路径"
    }
  ],
  "rawLine": "原始行内容",
  "lineNumber": "行号"
}
```

## 📄 输出说明

### 终端输出

- 分类统计表格（数量、占比）
- 各分类提交列表（显示 Hash 和标题）
- 模块变更统计
- 异常记录（如有）

### JSON 报告 (`commit-classification.json`)

```javascript
{
  "generatedAt": "生成时间",
  "summary": {
    "totalCommits": 总提交数,
    "categories": { /* 各分类数量 */ }
  },
  "categories": { /* 各分类详细信息 */ },
  "errors": [ /* 错误记录 */ ],
  "rawData": [ /* 所有分类后的提交 */ ],
  "pathAnalysis": {
    "moduleChanges": [ /* 模块变更统计 */ ],
    "topPathChanges": [ /* 变更最多的文件 */ ]
  }
}
```

### Markdown 报告 (`release-notes.md`)

- 概览表格
- 各分类提交列表
- 模块变更统计
- 异常记录（如有）

### HTML 报告 (`release-notes.html`)

- 响应式设计，美观配色
- 分类统计卡片
- 提交详情列表
- 模块变更表格
- 异常记录区域

## 🔍 异常处理

遇到坏数据时，系统会：

1. **不抛异常中断** - 继续处理其他正常数据
2. **保留原始信息** - 记录行号、原始内容
3. **说明错误原因** - 提供人类可读的错误描述
4. **汇总报告展示** - 在终端和导出报告中显示

### 错误类型说明

| 错误类型 | 说明 |
|---------|------|
| `malformed_commit_line` | 提交行格式错误 |
| `malformed_file_line` | 文件状态行格式错误 |
| `classification_error` | 分类过程出错 |
| `empty_commit` | 提交对象为空 |
| `json_export_error` | JSON 导出出错 |
| `markdown_export_error` | Markdown 导出出错 |
| `html_export_error` | HTML 导出出错 |

## 📂 项目结构

```
git-commit-classifier/
├── src/
│   ├── index.js           # CLI 入口
│   ├── git-reader.js      # Git 日志读取
│   ├── classifier.js      # 分类引擎
│   ├── path-analyzer.js   # 路径分析
│   └── report-generator.js # 报告生成
├── package.json
└── README.md
```

## 🛠️ 技术栈

- **Node.js** - 运行环境
- **Commander.js** - CLI 框架
- **Chalk** - 终端彩色输出
- **cli-table3** - 终端表格

## 📝 License

MIT# 文档更新
