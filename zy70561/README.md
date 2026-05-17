# Dockerfile 层缓存审计 CLI

镜像构建越来越慢？大家只知道 cache miss 多，却不知道是哪几层被无效修改打破。这个工具帮你自动排查缓存失效原因，不用再靠手工复制！

## ✨ 功能特性

- **🔍 智能解析**: 自动解析 Dockerfile 和构建日志
- **📍 层归因**: 精确定位哪一层破坏了缓存，原因是什么
- **📁 变更关联**: 关联文件变更与缓存失效的关系
- **💡 优化建议**: 基于分析结果给出具体的缓存优化建议
- **📊 多种输出**: 终端摘要、机器可读 JSON、适合发给同事的 Markdown 报告
- **⚠️ 异常保留**: 坏行或异常样本保留原始位置和原因，不抛原始 traceback

## 🚀 安装方式

### 方式一：源码安装（推荐）

```bash
# 克隆或下载代码到本地
cd /path/to/docker-cache-audit

# 安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

### 方式二：直接使用

```bash
python -m docker_cache_audit.cli audit Dockerfile build.log
```

## 📖 快速开始

### 1. 生成示例文件（推荐先试）

```bash
docker-cache-audit examples
```

这会在 `./examples` 目录下生成示例输入文件，方便你快速体验。

### 2. 执行审计

```bash
# 基础用法
docker-cache-audit audit path/to/Dockerfile path/to/build.log

# 带文件变更记录
docker-cache-audit audit Dockerfile build.log --file-changes changes.diff

# 指定输出目录
docker-cache-audit audit Dockerfile build.log -o ./my-reports

# 只生成机器可读结果
docker-cache-audit audit Dockerfile build.log --no-markdown
```

## 📁 输入目录结构

### 标准输入文件

```
your-project/
├── Dockerfile           # 必需 - 待分析的 Dockerfile
├── build.log            # 必需 - `docker build` 的完整输出日志
└── file-changes.diff    # 可选 - 文件变更记录（git diff 格式）
```

### 文件格式说明

#### Dockerfile
标准 Dockerfile 格式，支持多行指令（`\` 结尾）、注释等。

```dockerfile
FROM python:3.9-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY . .
```

#### 构建日志
`docker build` 命令的完整标准输出，包含 Step 信息和缓存状态。

```
Step 1/5 : FROM python:3.9-slim
 ---> Using cache
 ---> abcdef123456
Step 2/5 : WORKDIR /app
 ---> 123456abcdef
...
```

#### 文件变更记录（可选）
git diff 格式或简单的变更列表。

```
M requirements.txt
A setup.py
D old_file.py
```

## 📄 报告位置

默认输出到 `./audit-reports` 目录，每次运行生成两个文件：

```
audit-reports/
├── cache-audit-latest.json    # 机器可读结果 (API友好)
└── cache-audit-latest.md      # 友好报告，可直接发给同事
```

### 报告内容说明

#### 终端摘要
- 概览统计（总数、命中数、命中率）
- 每层的缓存状态和失效原因表格
- 解析错误和异常记录（保留原始位置）
- 优化建议列表

#### JSON 输出
完整的结构化数据，包含：
- 每层的详细信息（指令、摘要、耗时、大小等）
- 文件变更列表
- 解析错误详情（行号、原始内容、错误原因）
- 优化建议

#### Markdown 报告
格式化的报告，适合：
- 发给团队同事
- 粘贴到内部文档
- 作为 PR 评论附件

## 🛠️ 完整命令参考

```bash
# 查看帮助
docker-cache-audit --help
docker-cache-audit audit --help

# 完整参数示例
docker-cache-audit audit \
  ./Dockerfile \
  ./builds/build-2024-01-15.log \
  --file-changes ./git-diff.txt \
  --output-dir ./team-reports \
  --json \
  --markdown
```

## ❓ 常见问题

### Q: 遇到坏数据怎么办？
A: 工具不会直接抛出 traceback，而是：
- 在终端友好提示错误
- 将异常样本保留在报告的「异常记录」中
- 包含原始行号和出错内容，方便你定位问题

### Q: 日志不完整可以分析吗？
A: 可以！工具会尽可能解析可用的数据，无法解析的行会作为异常记录下来，不会中断分析流程。

### Q: 支持 BuildKit 日志吗？
A: 目前主要支持传统的 `docker build` 日志格式，BuildKit 支持在开发中。建议使用：
```bash
DOCKER_BUILDKIT=0 docker build . 2>&1 | tee build.log
```

## 🤝 反馈与贡献

如果遇到问题，请在报告中附上：
1. 你的输入文件（Dockerfile、build.log）
2. 终端输出的错误信息
3. JSON 报告中的「异常记录」部分

## 📝 版本历史

### v0.1.0
- ✅ Dockerfile 解析和构建日志解析
- ✅ 层归因与缓存失效原因分析
- ✅ 文件变更关联
- ✅ 终端彩色输出
- ✅ JSON 机器可读输出
- ✅ Markdown 友好报告
- ✅ 友好错误处理（不抛原始 traceback）
