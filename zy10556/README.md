# Markdown 断章检查 CLI 工具

一个用于检查 Markdown 文档质量的命令行工具，专门解决文档拆分后常见的问题：重复标题、失效内部链接、标题层级混乱等。

## 功能特性

- ✅ **重复标题检测**：识别同一文件中重复的标题（会导致锚点跳转错误）
- ✅ **失效链接检测**：检查内部锚点链接和文件链接是否有效
- ✅ **标题层级验证**：检测标题层级跳跃问题（如从 H2 跳到 H5）
- ✅ **终端摘要输出**：彩色高亮显示检查结果
- ✅ **机器可读报告**：导出 JSON 格式报告，便于集成到 CI/CD
- ✅ **人类可读报告**：生成适合发给同事的 Markdown 格式报告
- ✅ **异常样本保留**：坏行保留原始位置和内容，方便定位修复

## 安装

```bash
# 克隆或下载项目后，在项目目录执行：
npm install

# 全局安装（可选，方便全局使用）
npm link
```

## 使用方法

### 1. 检查整个目录

```bash
# 检查指定目录下的所有 Markdown 文件
md-check check ./docs

# 自定义输出目录
md-check check ./docs -o ./my-reports

# 只生成特定格式的报告
md-check check ./docs -f json
md-check check ./docs -f terminal
md-check check ./docs -f human

# 显示详细信息
md-check check ./docs -v
```

### 2. 分析单个文件

```bash
# 显示单个文件的标题结构和链接列表
md-check analyze ./docs/chapter1.md
```

### 命令参数说明

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `-o, --output <dir>` | 报告输出目录 | `./reports` |
| `-f, --format <format>` | 报告格式：`all`、`terminal`、`json`、`human` | `all` |
| `-v, --verbose` | 显示详细处理信息 | - |

## 输出文件说明

运行检查后，会在输出目录生成以下文件：

| 文件名 | 说明 | 用途 |
|--------|------|------|
| `check-results.json` | 机器可读的完整检查结果 | CI/CD 集成、自动化处理 |
| `check-report.md` | 人类可读的检查报告 | 发给同事、文档修复参考 |

## 检查报告示例

### 终端输出示例

```
============================================================
📋 Markdown 文档检查摘要
============================================================
扫描目录: /path/to/docs
扫描时间: 2024-01-15T10:30:00.000Z

📊 统计信息:
  文件总数: 2
  标题总数: 15
  链接总数: 6

⚠️  发现 1 个重复标题:
  1. 简介
     文件: chapter1.md
     第 1 次出现: 第 3 行
     第 2 次出现: 第 15 行

❌ 发现 3 个失效链接:
  1. [查看第二章](#第二章-进阶教程)
     文件: chapter1.md:31
     原因: 锚点不存在: #第二章-进阶教程

⚠️  发现 2 个标题层级问题:
  1. 第二章 进阶教程
     文件: chapter2.md:1
     原因: 文档第一个标题应为 H1，但实际是 H2

总计发现 6 个问题需要修复。
```

### 人类可读报告示例

报告包含：
- 概览统计表格
- 重复标题详情（文件、行号、原文）
- 失效链接详情（原因、位置）
- 标题层级问题详情

## 输入数据结构

### JSON 报告字段说明

```json
{
  "scanTime": "2024-01-15T10:30:00.000Z",
  "scannedDir": "/path/to/docs",
  "totalFiles": 2,
  "totalHeadings": 15,
  "totalLinks": 6,
  "duplicateTitles": [
    {
      "file": "/path/to/chapter1.md",
      "title": "简介",
      "anchor": "简介",
      "occurrences": [
        { "line": 3, "raw": "## 简介" }
      ]
    }
  ],
  "brokenLinks": [
    {
      "file": "/path/to/chapter1.md",
      "line": 31,
      "text": "查看第二章",
      "target": "#第二章-进阶教程",
      "reason": "锚点不存在: #第二章-进阶教程",
      "raw": "- [查看第二章](#第二章-进阶教程) - 这个锚点不存在"
    }
  ],
  "invalidHeadings": [
    {
      "file": "/path/to/chapter2.md",
      "line": 1,
      "level": 2,
      "expectedLevel": 1,
      "text": "第二章 进阶教程",
      "raw": "## 第二章 进阶教程",
      "reason": "文档第一个标题应为 H1，但实际是 H2"
    }
  ],
  "fileAnalyses": [...]
}
```

## 错误处理

本工具采用友好的错误处理：
- 遇到错误时显示清晰的中文错误信息
- 不会抛出难以理解的 stack trace（除非使用 `-v` 参数）
- 异常样本保留原始行号和内容，方便定位问题

## 测试

项目包含测试用例，可以直接运行测试：

```bash
# 运行测试
npm test

# 或者直接运行
md-check check ./test/docs
```

## 技术栈

- Node.js
- Commander.js - 命令行框架
- Chalk - 终端彩色输出

## 许可证

MIT
