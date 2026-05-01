# 资料包交付巡检器

一个给公司内训负责人用的本地命令行工具，用于在打包资料给新员工前进行完整性检查。

## 功能特性

- **智能扫描**：解析所有 Markdown 文档中的相对链接、图片引用和标题锚点
- **全面检查**：
  - ✅ 检测缺失文件引用
  - ✅ 检查路径大小写不一致问题
  - ✅ 防止路径遍历安全风险
  - ✅ 检测同名附件冲突
  - ✅ 发现未被引用的大文件
  - ✅ 检查标题层级跳跃
  - ✅ 验证锚点引用有效性
- **高效缓存**：跳过未变化文件，配置变化时强制重扫
- **灵活打包**：复制通过检查的文件到 dist 目录，生成 manifest.json
- **详细报告**：支持 Markdown 和 CSV 两种报告格式

## 项目结构

```
xy4022/
├── src/
│   └── checker/
│       ├── __init__.py              # 包初始化
│       ├── cli/
│       │   ├── __init__.py
│       │   └── main.py              # CLI 入口 (init/scan/pack/report/cache)
│       ├── config/
│       │   ├── __init__.py
│       │   └── models.py            # 数据模型定义
│       ├── markdown_parser/
│       │   ├── __init__.py
│       │   └── parser.py            # Markdown 解析器
│       ├── rules/
│       │   ├── __init__.py
│       │   └── validator.py         # 规则校验引擎
│       ├── cache/
│       │   ├── __init__.py
│       │   └── manager.py           # 缓存管理器
│       ├── manifest/
│       │   ├── __init__.py
│       │   └── generator.py         # Manifest 生成器
│       ├── packer/
│       │   ├── __init__.py
│       │   └── packer.py            # 文件打包器
│       ├── reporter/
│       │   ├── __init__.py
│       │   └── exporter.py          # 报告导出器
│       └── utils/
│           ├── __init__.py
│           └── helpers.py           # 工具函数
├── examples/
│   └── sample_materials/            # 示例资料目录（用于测试）
├── setup.py                         # 安装配置
├── requirements.txt                 # 依赖列表
└── README.md
```

## 安装方式

### 方式一：开发模式安装（推荐）

```bash
# 进入项目目录
cd /path/to/xy4022

# 安装依赖
pip install -r requirements.txt

# 开发模式安装
pip install -e .
```

### 方式二：直接运行

```bash
cd /path/to/xy4022
pip install -r requirements.txt

# 直接运行 CLI
python -m checker.cli.main --help
```

## 命令说明

### `checker init` - 初始化项目

创建项目配置文件和忽略规则。

```bash
# 基本初始化（使用默认值）
checker init

# 指定根目录和输出目录
checker init --root ./materials --dist ./output

# 指定大文件阈值（MB）
checker init --large-file-threshold 10
```

**参数说明：**

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--root` | `-r` | `.` | 资料根目录 |
| `--dist` | `-d` | `dist` | 输出目录 |
| `--large-file-threshold` | `-l` | `5` | 大文件阈值（MB） |

**生成的文件：**

- `.checkerrc.json` - 项目配置文件
- `.checkerignore` - 忽略规则文件（类似 `.gitignore`）

---

### `checker scan` - 扫描资料目录

扫描资料根目录，执行所有规则检查。

```bash
# 基本扫描
checker scan

# 详细模式（显示解析详情）
checker scan --verbose

# 不使用缓存，强制重新扫描
checker scan --no-cache

# 指定根目录（覆盖配置）
checker scan --root ./materials
```

**检查项：**

1. **缺失文件** - Markdown 中引用的文件不存在（错误）
2. **路径大小写不一致** - 引用路径与实际文件大小写不同（警告）
3. **路径遍历** - 引用跳出根目录的路径（错误，安全风险）
4. **同名文件冲突** - 不同目录下存在同名文件（警告）
5. **未引用的大文件** - 超过阈值且未被任何文档引用的文件（警告）
6. **标题层级跳跃** - 如从 h2 直接跳到 h4（警告）
7. **无效锚点** - 引用的标题锚点不存在（警告）

**退出码：**
- `0` - 扫描完成，无错误（可能有警告）
- `1` - 发现错误，需要修复

---

### `checker pack` - 打包资料

将通过检查的资料复制到 dist 目录，生成 manifest.json。

```bash
# 基本打包
checker pack

# 强制覆盖已存在的输出目录
checker pack --force

# 指定输出目录（覆盖配置）
checker pack --output ./my-output
```

**前提条件：**
- 必须先运行 `checker scan`
- 扫描结果不能有错误（警告可以）

**生成的文件：**
- `dist/` - 包含所有打包文件
- `dist/manifest.json` - 文件清单，包含路径、sha256、大小、引用来源

---

### `checker report` - 导出报告

导出巡检报告，支持 Markdown 和 CSV 格式。

```bash
# 导出默认格式（Markdown）
checker report

# 指定格式
checker report --format csv
checker report --format all  # 同时导出两种格式

# 指定输出目录和文件名
checker report --output ./reports --name my_report
```

**参数说明：**

| 参数 | 简写 | 默认值 | 说明 |
|------|------|--------|------|
| `--format` | `-f` | `markdown` | 报告格式：markdown / csv / all |
| `--output` | `-o` | `reports` | 输出目录 |
| `--name` | `-n` | `scan_report` | 报告文件名（不含扩展名） |

**报告内容：**
- 概览统计
- 错误详情（按类型分组）
- 警告详情（按类型分组）
- 摘要总结

---

### `checker cache` - 管理缓存

查看或清除缓存。

```bash
# 查看缓存状态
checker cache

# 清除所有缓存和配置
checker cache --all
```

## 验证完整流程

### 使用示例资料目录

项目提供了 `examples/sample_materials` 目录，包含用于测试的示例数据。

```bash
# 1. 进入项目目录
cd /path/to/xy4022

# 2. 进入示例资料目录
cd examples/sample_materials

# 3. 初始化配置
checker init --root . --dist ../../dist

# 4. 扫描资料（会发现示例中的问题）
checker scan --verbose

# 5. 查看报告
checker report --format all

# 6. 修复问题后重新扫描
# （手动修复 onboarding.md 中的错误引用）

# 7. 打包
checker pack --force

# 8. 查看生成的 manifest
cat ../../dist/manifest.json
```

### 示例资料中的测试场景

`examples/sample_materials/docs/onboarding.md` 包含以下测试场景：

| 问题类型 | 示例 |
|----------|------|
| 缺失文件 | `[不存在的文档](./nonexistent.md)` |
| 大小写问题 | `[系统访问](./Images/ORG-CHART.PNG)` |
| 路径遍历 | `[敏感文件](../../secret.txt)` |
| 无效锚点 | `[跳转到不存在的锚点](#不存在的章节)` |
| 标题层级跳跃 | `system-access.md` 中的 h2→h4 |
| 同名文件 | `templates/employee-handbook.pdf` 和 `archive/employee-handbook.pdf` |

### 预期的扫描结果

第一次扫描 `examples/sample_materials` 时，应该会发现：

- **错误**：
  - 缺失文件引用
  - 路径遍历风险

- **警告**：
  - 路径大小写不一致
  - 同名文件冲突
  - 标题层级跳跃
  - 无效锚点

## 配置说明

### `.checkerrc.json` 配置项

```json
{
  "root_dir": ".",
  "dist_dir": "dist",
  "cache_dir": ".checker_cache",
  "ignore_patterns": [
    "**/__pycache__/**",
    "**/.git/**",
    "**/.DS_Store",
    "**/node_modules/**",
    "**/*.pyc"
  ],
  "large_file_threshold": 5242880,
  "report_dir": "reports"
}
```

### `.checkerignore` 忽略规则

支持 glob 模式，每行一个规则：

```
# 忽略规则示例
**/.git/**
**/__pycache__/**
**/node_modules/**
**/*.tmp
**/test-*.md
```

## Manifest 文件格式

打包后生成的 `manifest.json` 格式：

```json
{
  "version": "1.0",
  "generated_at": "2026-05-01T10:00:00",
  "total_files": 8,
  "entries": [
    {
      "path": "README.md",
      "sha256": "a1b2c3d4...",
      "size": 1024,
      "referenced_by": []
    },
    {
      "path": "docs/onboarding.md",
      "sha256": "e5f6g7h8...",
      "size": 2048,
      "referenced_by": [
        "README.md"
      ]
    }
  ]
}
```

## 缓存机制说明

### 缓存策略

1. **文件级缓存**：基于文件修改时间和大小，跳过未变化的文件
2. **配置感知**：配置或忽略规则变化后强制重新扫描
3. **增量更新**：只重新扫描变化的文件

### 缓存失效条件

- 修改了 `.checkerrc.json`
- 修改了 `.checkerignore`
- 使用 `--no-cache` 参数

## 依赖说明

| 包名 | 版本 | 用途 |
|------|------|------|
| click | >=8.0.0 | CLI 框架 |
| rich | >=10.0.0 | 终端美化输出 |
| python-dotenv | >=0.19.0 | 环境变量管理 |

## 开发说明

### 运行测试

```bash
# 使用示例数据测试
cd examples/sample_materials
checker init
checker scan
```

### 代码模块说明

1. **CLI 入口** (`cli/main.py`)：处理命令行参数，调用各模块
2. **Markdown 解析** (`markdown_parser/parser.py`)：解析链接、图片、标题
3. **规则校验** (`rules/validator.py`)：实现所有检查规则
4. **缓存管理** (`cache/manager.py`)：缓存逻辑
5. **打包器** (`packer/packer.py`)：文件复制和 manifest 生成
6. **报告导出** (`reporter/exporter.py`)：Markdown/CSV 报告生成

## License

内部使用工具。
