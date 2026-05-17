# 📸 snapshot-dedup - 快照文件去重工具

一个功能完整的 CLI 工具，用于扫描、检测和清理备份/快照目录中的重复文件。

## ✨ 功能特性

- **🔍 智能扫描**: 递归扫描目录，支持多种过滤选项
- **🧮 哈希检测**: 使用 SHA-256/MD5 算法确保内容一致
- **📂 同名分组**: 按文件名分组，支持忽略扩展名
- **🎯 灵活保留策略**: 支持按时间、大小、目录优先级保留文件
- **📊 多种输出**:
  - 终端彩色摘要报告
  - JSON 机器可读结果
  - Markdown 分享报告（适合发给同事）
  - Bash 删除脚本
- **⚠️ 异常追踪**: 保留坏行和异常样本的原始位置和原因

## 📦 安装

```bash
npm install -g .
```

## 🚀 快速开始

### 基本使用

```bash
# 扫描当前目录，显示终端摘要
snapshot-dedup

# 扫描指定目录并输出所有报告
snapshot-dedup ./backups --json --md --script
```

### 常用示例

```bash
# 备份目录去重，保留最新文件
snapshot-dedup ./snapshots --strategy newest --keep-per-hash 1 --md

# 优先保留 production 目录的文件
snapshot-dedup ./backups --prefer-dir production --prefer-dir stable --json

# 排除临时文件，只处理 1MB 以上的文件
snapshot-dedup ./data --exclude .tmp --exclude .log --min-size 1MB --script
```

## 📖 完整命令选项

### 📤 输出选项

| 选项 | 说明 |
|------|------|
| `--json [path]` | 输出 JSON 结果文件 (默认: dedup-results.json) |
| `--md [path]` | 输出 Markdown 报告 (默认: dedup-report.md) |
| `--script [path]` | 生成 bash 删除脚本 (默认: dedup-delete.sh) |

### 🎯 保留策略

| 选项 | 说明 |
|------|------|
| `--strategy <name>` | 保留策略: `newest`(最新), `oldest`(最早), `largest`(最大), `smallest`(最小) |
| `--keep-per-hash <n>` | 每个哈希值保留多少个文件 (默认: 1) |
| `--keep-per-group <n>` | 每个分组最多保留多少个文件 (默认: 不限制) |

### 🔍 扫描选项

| 选项 | 说明 |
|------|------|
| `--algorithm <name>` | 哈希算法: `sha256`, `sha1`, `md5` (默认: sha256) |
| `--follow-symlinks` | 跟随符号链接 |
| `--max-depth <n>` | 最大扫描深度 |
| `--min-size <size>` | 最小文件大小 (如: 100KB, 1MB) |
| `--ignore-extension` | 分组时忽略文件扩展名 |
| `--case-insensitive` | 文件名大小写不敏感 |
| `--concurrency <n>` | 哈希计算并发数 (默认: 4) |

### 📋 过滤选项

| 选项 | 说明 |
|------|------|
| `--prefer-dir <dir>` | 优先保留此目录下的文件 (可多次使用) |
| `--exclude <pattern>` | 排除匹配的文件/目录 (可多次使用) |
| `--include <pattern>` | 只处理匹配的文件 (可多次使用) |
| `--preserve <pattern>` | 必须保留的文件 (可多次使用) |

## 📄 输出文件说明

### 1. JSON 结果文件 (`dedup-results.json`)

包含完整的去重分析数据，包含：
- 元数据和扫描配置
- 扫描摘要统计
- 分组详情和哈希变体
- 保留/删除建议
- 异常和错误列表

### 2. Markdown 报告 (`dedup-report.md`)

适合分享给同事的格式化报告，包含：
- 执行摘要表格
- 重复分组详情（按节省空间排序）
- 异常报告表格
- 完整删除文件清单（可折叠）

### 3. 删除脚本 (`dedup-delete.sh`)

**安全设计**: 默认开启 `DRY_RUN` 模式，只预览不实际删除。

```bash
# 预览删除
./dedup-delete.sh

# 确认后实际执行
DRY_RUN= ./dedup-delete.sh
```

## 🔄 工作流程

1. **目录扫描**: 递归扫描目标目录，收集文件元数据
2. **哈希计算**: 流式计算文件内容哈希（支持快速哈希）
3. **同名分组**: 按文件名分组，检测同一文件的多个版本
4. **哈希分析**: 在组内按哈希分组，识别完全重复的文件
5. **规则应用**: 根据保留策略决定保留/删除哪些文件
6. **报告生成**: 输出终端摘要、JSON、Markdown 报告

## ⚠️ 安全提示

1. **先预览后执行**: 始终先查看报告，确认后再执行删除
2. **备份重要数据**: 对关键文件先备份再去重
3. **检查异常列表**: 关注无法读取/权限错误的文件
4. **使用 DRY_RUN**: 删除脚本默认预览模式，确认后再执行

## 📁 项目结构

```
snapshot-dedup/
├── bin/
│   └── snapshot-dedup.js    # CLI 入口
├── src/
│   ├── scanner.js           # 目录扫描
│   ├── hasher.js            # 哈希计算
│   ├── grouper.js           # 同名分组
│   ├── retention.js         # 保留规则引擎
│   └── reporter.js          # 报告生成
├── package.json
└── README.md
```

## 🛠️ CI 集成

可以方便地集成到 CI 流程中自动清理重复快照：

```yaml
# .github/workflows/dedup.yml
name: Cleanup Snapshots
on:
  schedule:
    - cron: '0 2 * * 0'  # 每周日凌晨 2 点
jobs:
  dedup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm install -g ./snapshot-dedup
      - run: snapshot-dedup ./snapshots --json --script
      - run: ./dedup-delete.sh  # 需要手动确认或移除 DRY_RUN
```

## 📄 License

MIT
