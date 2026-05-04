# Course Checker - 课程讲义检查工具

一个本地命令行工具，用于在发课前检查一整套课程讲义，确保所有链接、图片、代码片段都能正常工作。

## 功能特性

- 📁 **递归扫描** - 自动发现目录中的 Markdown、HTML、图片、附件等文件
- 🔍 **智能验证** - 检查相对链接、章节锚点、图片和附件是否存在
- 🧪 **代码运行** - 识别 fenced code block，运行 JS/Python/Shell 示例
- 📊 **报告导出** - 生成 Markdown、HTML、JSON 三种格式的报告
- ⚠️ **精确定位** - 错误信息包含文件、行号、上下文和修复建议

## 问题类型分类

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `missing_file` | 链接/图片指向的文件不存在 | error |
| `bad_anchor` | 锚点指向的章节不存在 | warning |
| `code_error` | 代码片段运行失败 | error |
| `dangerous_command` | 检测到危险命令（rm -rf、eval等） | error |
| `config_error` | 配置问题 | warning |

## 安装

```bash
# 克隆仓库后安装依赖
npm install

# 构建项目
npm run build

# 全局安装（可选）
npm link
```

## 快速开始

### 1. 扫描目录

查看目录中有哪些文件：

```bash
# 扫描当前目录
course-checker scan

# 扫描指定目录
course-checker scan ./my-course

# 只显示汇总
course-checker scan ./my-course --summary

# 输出 JSON 格式
course-checker scan ./my-course --json
```

### 2. 验证链接和图片

检查所有内部链接、图片、锚点是否存在：

```bash
# 验证当前目录
course-checker validate

# 验证指定目录
course-checker validate ./my-course

# 遇到错误继续执行
course-checker validate ./my-course --ignore-errors
```

### 3. 运行代码片段

执行 Markdown 中的 fenced code block：

```bash
# 运行所有代码片段
course-checker run-snippets ./my-course

# 只运行指定章节的代码
course-checker run-snippets ./my-course --section "代码示例" --section "实践练习"

# 设置超时时间（毫秒）
course-checker run-snippets ./my-course --timeout 5000

# 允许运行危险命令（谨慎使用）
course-checker run-snippets ./my-course --allow-dangerous
```

### 4. 导出完整报告

执行完整检查流程并生成报告：

```bash
# 完整检查并导出报告
course-checker export ./my-course

# 不运行代码片段
course-checker export ./my-course --no-run-snippets

# 指定输出目录
course-checker export ./my-course --output-dir ./my-reports

# 快速命令（export 的别名）
course-checker check ./my-course
```

## 配置文件

在项目根目录创建 `.course-checker.json` 配置文件：

```json
{
  "ignore": {
    "patterns": [
      "node_modules/**",
      ".git/**",
      "temp/**"
    ],
    "links": [
      "https://example.com/*",
      "legacy-*.md"
    ],
    "snippets": [
      "chapter-05.md",
      "deprecated-section"
    ]
  },
  "validation": {
    "checkExternalLinks": false,
    "validateAnchors": true,
    "allowDangerousCommands": false
  },
  "execution": {
    "timeout": 30000,
    "workingDir": ".",
    "environments": {
      "NODE_ENV": "test"
    }
  },
  "report": {
    "outputDir": "./reports",
    "formats": ["json", "html", "markdown"],
    "includeDetails": true
  }
}
```

## 报告格式

生成的报告包含以下信息：

### 汇总信息

- **评分**：0-100 分的综合评分
- **风险等级**：low/medium/high
- **统计数据**：总检查数、通过数、失败数、跳过数

### 详细内容

- 扫描结果：文件类型统计
- 验证问题：缺失文件、坏锚点等
- 代码执行：失败的代码片段、危险命令
- 修复清单：按优先级排序的问题列表

### 输出格式

- **JSON**：完整的结构化数据，适合程序处理
- **HTML**：美观的网页报告，带 Bootstrap 样式
- **Markdown**：简洁的文本报告，方便嵌入文档

## 示例课程

项目包含两个示例课程目录：

### `examples/course-good/` - 正常的课程示例

所有链接、图片、代码都正确，可以用来测试工具的正常行为。

```bash
# 测试正常课程
course-checker check examples/course-good
```

### `examples/course-bad/` - 包含错误的课程示例

包含各种问题，用于测试工具的错误检测能力：

- 缺失的文件链接
- 不存在的图片
- 无效的锚点
- 语法错误的代码
- 运行时错误的代码
- 危险命令（rm -rf、eval 等）

```bash
# 测试有问题的课程
course-checker check examples/course-bad
```

## 支持的语言

| 语言 | 标识符 | 解释器 |
|------|--------|--------|
| JavaScript | `javascript`, `js` | `node` |
| Python | `python`, `py` | `python3` |
| Shell | `shell`, `bash`, `sh` | `bash`/`sh` |

## 危险命令检测

工具会自动检测以下危险模式：

### Shell
- `rm -rf` / `rm -fr`
- `sudo rm`
- `chmod 777`
- `>` / `>>`（重定向）
- `| bash` / `| sh`
- `curl.*bash` / `wget.*bash`

### JavaScript
- `eval()`
- `Function()` / `new Function()`
- `process.exit()`, `process.kill()`

### Python
- `os.system()`, `os.popen()`
- `subprocess.call()`, `subprocess.Popen()`
- `eval()`, `exec()`
- `shutil.rmtree()`

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，没有错误 |
| 1 | 发现错误（或高风险问题） |

## 开发

```bash
# 开发模式（使用 ts-node）
npm run dev -- scan examples/course-good

# 运行测试
npm test

# 监视测试
npm run test:watch

# 代码检查
npm run lint
```

## 项目结构

```
src/
├── index.ts              # CLI 入口
├── types/
│   └── index.ts          # 类型定义
├── utils/
│   └── index.ts          # 工具函数
├── scanner/
│   └── index.ts          # 目录扫描器
├── parser/
│   └── index.ts          # Markdown/HTML 解析器
├── validator/
│   └── index.ts          # 链接/图片验证器
├── snippet-runner/
│   └── index.ts          # 代码片段运行器
└── reporter/
    └── index.ts          # 报告生成器

examples/
├── course-good/          # 正常的课程示例
└── course-bad/           # 包含错误的课程示例
```

## 许可证

MIT
