# Git 子模块漂移 CLI

一个功能完整的 Git 子模块版本漂移检测命令行工具，帮助你在构建失败之前发现子模块同步问题。

## 功能特性

- ✅ **子模块状态读取**: 支持嵌套子模块、游离头检测、本地修改检测
- 🔒 **锁定清单比对**: 支持 JSON、YAML、文本、Gradle、Makefile、CMake 等多种格式
- 📊 **风险排序**: 根据漂移程度自动评估风险级别
- 📋 **多格式输出**: 终端摘要、机器可读 JSON、团队共享 Markdown
- 🛠️ **构建日志诊断**: 从构建失败日志中快速定位子模块问题
- 🎯 **稳定退出码**: 便于集成到 CI/CD 流程中

## 安装

### 从源码安装

```bash
# 克隆或下载代码后，在项目根目录执行
pip install -e .
```

### 依赖要求

- Python 3.9+
- Git (命令行可用)

## 快速开始

### 基本扫描

```bash
# 扫描当前目录的 Git 仓库
git-submodule-drift scan

# 或使用短别名
gsd scan
```

### 指定锁定文件

```bash
# 使用自定义锁定清单
gsd scan -l submodules.lock.json

# 扫描指定仓库
gsd scan /path/to/repo -l /path/to/submodules.lock
```

### 生成报告

```bash
# 导出 JSON 和 Markdown 报告到指定目录
gsd scan -o reports/ --all-formats

# 只导出 JSON
gsd scan --json

# 只导出 Markdown
gsd scan --markdown
```

### 详细输出

```bash
# 显示详细表格
gsd scan -v

# 以树形结构显示子模块
gsd scan --tree
```

### CI/CD 集成

```bash
# 发现 high 及以上风险时返回非零退出码
gsd scan --fail-on high

# 严格模式：任何漂移都返回非零
gsd scan --strict
```

### 其他命令

```bash
# 生成当前子模块状态的锁定清单
gsd generate-lock -f json

# 分析构建日志中的子模块错误
gsd diagnose build.log
```

## 输入目录结构

### 标准 Git 子模块项目

```
your-repo/
├── .git/
├── .gitmodules          # Git 子模块配置（必需）
├── submodules.lock.json # 锁定清单（推荐，可选自动发现）
├── module-a/            # 子模块目录
├── module-b/            # 子模块目录
│   └── nested-module/   # 嵌套子模块
└── src/
```

### 锁定清单格式

#### JSON 格式 (`submodules.lock.json`)

```json
{
  "version": "1.0",
  "submodules": {
    "module-a": {
      "commit": "a1b2c3d4e5f6g7h8i9j0",
      "url": "https://github.com/example/module-a.git",
      "branch": "main"
    },
    "module-b/nested-module": {
      "commit": "0j9i8h7g6f5e4d3c2b1a",
      "url": "https://github.com/example/nested.git"
    }
  }
}
```

#### YAML 格式 (`submodules.lock.yaml`)

```yaml
version: "1.0"
submodules:
  module-a:
    commit: a1b2c3d4e5f6g7h8i9j0
    url: https://github.com/example/module-a.git
    branch: main
```

#### 纯文本格式 (`submodules.lock`)

```
# 提交哈希 子模块路径
a1b2c3d4e5f6g7h8i9j0 module-a
0j9i8h7g6f5e4d3c2b1a module-b/nested-module
```

### 锁定文件自动发现

如果未指定 `--lock-file`，工具会自动查找以下文件：
- `submodules.lock.json`
- `submodules.lock.yaml` / `submodules.lock.yml`
- `submodules.lock`
- `.gitmodules.lock`
- `versions.lock`

## 命令参考

### `scan` - 扫描子模块漂移

**参数:**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `repo_path` | Git 仓库路径（位置参数） | 当前目录 |
| `-l, --lock-file` | 锁定清单文件路径 | 自动发现 |
| `-o, --output-dir` | 报告输出目录 | 当前目录 |
| `-r, --recursive/--no-recursive` | 递归检测嵌套子模块 | `--recursive` |
| `-v, --verbose` | 显示详细信息表格 | 关闭 |
| `--json/--no-json` | 导出 JSON 报告 | 关闭 |
| `--markdown/--no-markdown` | 导出 Markdown 报告 | 关闭 |
| `--all-formats` | 导出所有格式报告 | 关闭 |
| `--tree` | 显示子模块树形结构 | 关闭 |
| `--fail-on <level>` | 超过风险级别时非零退出 | 关闭 |
| `--strict` | 严格模式，任何异常都非零退出 | 关闭 |

**退出码:**

| 退出码 | 含义 |
|--------|------|
| `0` | 正常，无漂移或低于阈值 |
| `1` | 执行错误 |
| `2` | 检测到漂移或风险超过阈值 |
| `3` | 诊断发现警告 |

### `diagnose` - 构建日志诊断

**参数:**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `build_log` | 构建日志文件路径（必需） | - |
| `repo_path` | Git 仓库路径 | 当前目录 |

**示例:**
```bash
gsd diagnose build.log
gsd diagnose /var/log/builds/failed.log /path/to/repo
```

### `generate-lock` - 生成锁定清单

**参数:**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `repo_path` | Git 仓库路径 | 当前目录 |
| `-f, --format` | 输出格式：`json`, `yaml`, `txt` | `json` |
| `-o, --output` | 输出文件路径 | `submodules.lock.<format>` |

**示例:**
```bash
gsd generate-lock
gsd generate-lock -f yaml -o my-lock.yml
```

## 风险级别说明

| 级别 | 颜色 | 说明 |
|------|------|------|
| **CRITICAL** | 🔴 红 | 严重：本地修改未提交或漂移超过 50 个提交 |
| **HIGH** | 🟠 橙 | 高危：漂移 21-50 个提交或子模块未初始化 |
| **MEDIUM** | 🟡 黄 | 中危：漂移 6-20 个提交 |
| **LOW** | 🔵 蓝 | 低危：漂移 1-5 个提交或游离头状态 |
| **NONE** | 🟢 绿 | 正常：版本一致无问题 |

## 状态说明

| 状态 | 符号 | 说明 |
|------|------|------|
| `clean` | ✓ | 版本一致，状态正常 |
| `drifted` | ⚠ | 版本漂移，与锁定版本不一致 |
| `detached` | → | 游离头状态，未在分支上 |
| `dirty` | ✱ | 包含未提交的本地修改 |
| `missing` | ✗ | 子模块目录不存在 |
| `uninitialized` | ○ | 子模块未初始化 |

## 坏数据处理指南

### 1. 缺失锁定清单

**问题:** 扫描时提示 "X 个子模块未在锁定清单中定义"

**解决方案:**
```bash
# 生成当前状态的锁定清单
gsd generate-lock

# 提交锁定清单到版本控制
git add submodules.lock.json
git commit -m "Add submodule lock file"
```

### 2. 无效锁定条目

**问题:** 提示 "X 个锁定条目在仓库中不存在"

**解决方案:**
- 检查子模块是否已被删除但锁定清单未更新
- 手动编辑锁定文件，移除不存在的条目
- 或重新生成锁定清单：`gsd generate-lock`

### 3. 子模块未初始化

**问题:** 子模块状态为 `uninitialized`

**解决方案:**
```bash
git submodule update --init --recursive
```

### 4. 子模块目录缺失

**问题:** 子模块状态为 `missing`

**解决方案:**
```bash
git submodule update --init --recursive
```

### 5. 游离头状态

**问题:** 子模块处于 `detached` 状态

**解决方案:**
```bash
cd path/to/submodule
git checkout main  # 或正确的分支名
```

### 6. 本地修改问题

**问题:** 子模块有未提交的本地修改

**解决方案:**
- 提交或储藏子模块内的修改
- 确认修改是否应该提交到子模块仓库

### 7. 提交哈希不匹配

**问题:** 锁定清单中的提交哈希在子模块中不存在

**解决方案:**
```bash
cd path/to/submodule
git fetch origin  # 获取最新提交
```

## 常见问题

### Q: 如何处理嵌套子模块？

A: 默认启用递归扫描 (`-r`)，会自动检测所有层级的子模块。可以用 `--no-recursive` 禁用。

### Q: 可以在 CI 中使用吗？

A: 完全可以。推荐使用 `--fail-on high --json` 组合，并检查退出码。

### Q: 支持哪些锁定文件格式？

A: 支持 JSON、YAML、纯文本，以及从 Gradle、Makefile、CMake 中提取提交哈希。

### Q: 子模块 URL 变更会影响检测吗？

A: 不会，检测基于路径和提交哈希，不比对 URL。

## 输出示例

### 终端输出

```
┌─────────────────────────────────────────┐
│        Git 子模块漂移检测报告            │
│ 仓库: /path/to/your/repo                │
│ 扫描时间: 2024-01-15T10:30:00.123456    │
└─────────────────────────────────────────┘

子模块总数     5
版本漂移       2
游离头         1
本地修改       0

⚠  警告: 1 个子模块未在锁定清单中定义
   - new-module

问题摘要（按风险排序）:
[⚠] module-a: 子模块超前锁定版本 12 个提交
[→] module-b: 子模块处于游离头状态
```

### Markdown 报告

查看生成的 `drift-report.md` 文件，包含：
- 摘要统计
- 问题分类列表
- 详细信息（提交信息、作者、日期）
- 建议操作步骤

### JSON 报告

查看生成的 `drift-report.json`，包含完整的结构化数据，便于脚本处理。

## 项目结构

```
src/git_submodule_drift/
├── __init__.py      # 版本信息
├── cli.py           # CLI 入口和参数解析
├── models.py        # 数据模型定义
├── git_reader.py    # Git 状态读取器
├── lock_parser.py   # 锁定清单解析器
├── drift_detector.py # 漂移检测和风险评估
└── reporter.py      # 多格式报告生成
```

## License

MIT
