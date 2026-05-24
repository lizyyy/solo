# GitHub CODEOWNERS Coverage CLI

一个强大的命令行工具，用于分析 GitHub CODEOWNERS 文件的覆盖率，帮助你找出没有负责人的文件。

## ✨ 功能特性

- **规则解析**：完整支持 GitHub CODEOWNERS 语法，包括规则顺序优先级
- **路径匹配**：使用 gitignore 风格的模式匹配
- **团队别名**：支持团队别名展开和团队改名映射
- **灵活过滤**：支持排除指定目录和文件
- **空目录检测**：可选检测和覆盖空目录
- **多格式输出**：
  - 终端彩色摘要
  - JSON 机器可读报告
  - Markdown 团队友好报告
- **验证功能**：验证 owner 名称有效性
- **CI 友好**：稳定的退出码，支持最小覆盖率门槛

## 🚀 快速开始

### 安装

```bash
pip install -e .
```

### 基础使用

```bash
# 分析当前目录
codeowners-coverage

# 指定仓库目录
codeowners-coverage --repo ./myproject

# 输出到指定目录
codeowners-coverage --output-dir ./reports
```

## 📖 详细用法

### 命令行参数

```bash
codeowners-coverage [OPTIONS]
```

#### 输入选项

| 参数 | 说明 |
|------|------|
| `-r, --repo PATH` | 仓库根目录（默认：当前目录） |
| `-c, --codeowners PATH` | CODEOWNERS 文件路径（默认：自动检测） |
| `-t, --team-aliases PATH` | 团队别名 YAML 文件路径 |

#### 过滤选项

| 参数 | 说明 |
|------|------|
| `-e, --exclude PATTERN` | 排除模式（gitignore 风格），可多次指定 |
| `--no-default-excludes` | 不使用默认排除模式 |
| `--include-empty-dirs` | 包含空目录进行覆盖率检查 |

#### 输出选项

| 参数 | 说明 |
|------|------|
| `-o, --output-dir PATH` | 报告输出目录（默认：当前目录） |
| `-f, --format FORMAT` | 输出格式：terminal/json/markdown/all（默认：all） |
| `--base-filename NAME` | 输出文件基础名称 |
| `--append-timestamp` | 输出文件名附加时间戳 |
| `--no-overwrite` | 不覆盖已存在的输出文件 |

#### 验证选项

| 参数 | 说明 |
|------|------|
| `--valid-owners LIST` | 有效 owner 名称列表（逗号分隔） |
| `--valid-owners-file PATH` | 包含有效 owner 名称的文件（每行一个） |

#### 行为选项

| 参数 | 说明 |
|------|------|
| `--fail-on-uncovered` | 存在未覆盖文件时返回非零退出码 |
| `--fail-on-invalid` | 存在无效 owner 时返回非零退出码 |
| `--min-coverage PERCENT` | 最小覆盖率要求（0-100） |

## 📁 团队别名配置

创建 `team_aliases.yaml` 文件：

```yaml
aliases:
  "@org/frontend-team":
    - "@org/alice"
    - "@org/bob"
  "@org/backend-team":
    - "@org/charlie"
    - "@org/david"
  "@org/all-engineers":
    - "@org/frontend-team"
    - "@org/backend-team"

renames:
  "@org/old-team-name": "@org/new-team-name"
  "@org/legacy-team": "@org/modern-team"
```

使用：
```bash
codeowners-coverage --team-aliases team_aliases.yaml
```

## 🎯 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功 |
| 1 | 配置错误 |
| 2 | 输入参数错误 |
| 3 | 文件未找到 |
| 4 | 验证失败 |
| 5 | 存在未覆盖文件 |
| 10 | 运行时错误 |

## 📊 使用示例

### CI 集成

```bash
# 在 CI 中使用，覆盖率低于 90% 时失败
codeowners-coverage --min-coverage 90 --fail-on-uncovered
```

### 生成完整报告

```bash
codeowners-coverage \
  --repo ./myproject \
  --output-dir ./coverage-reports \
  --team-aliases ./teams.yaml \
  --include-empty-dirs \
  --append-timestamp
```

### 验证 owner 有效性

```bash
codeowners-coverage \
  --valid-owners "@org/team-a,@org/team-b,@org/team-c" \
  --fail-on-invalid
```

## 📂 项目结构

```
src/codeowners_coverage/
├── __init__.py          # 版本信息
├── cli.py               # 命令行入口
├── parser.py            # CODEOWNERS 规则解析
├── file_scanner.py      # 文件系统扫描
├── analyzer.py          # 覆盖率分析
├── team_mapping.py      # 团队别名映射
├── reporter.py          # 报告生成
└── constants.py         # 常量定义
```

## 🔧 核心技术点

### 规则匹配顺序

CODEOWNERS 文件按**从上到下**的顺序匹配，**最后一条匹配的规则**生效。本工具严格遵循此行为。

### 路径匹配语法

支持完整的 gitignore 风格模式：
- `*.js` - 匹配所有 JS 文件
- `/docs/` - 只匹配根目录下的 docs
- `docs/` - 匹配任意位置的 docs 目录
- `!src/generated/` - 否定模式，排除匹配

### 稳定性保证

- 所有输出列表均按字典序排序
- JSON 输出结构稳定
- 同一输入始终产生相同输出

## 📝 License

MIT
