# 测试失败聚类 CLI (Test Failure Cluster)

自动聚类相似的测试失败，帮助维护者快速识别哪些是同一类错误、哪些是真新增。

## 功能特性

- 📊 **日志解析**: 支持多种测试框架日志格式
- 🔍 **堆栈归一化**: 移除时间戳、行号等噪声，提取核心错误特征
- 📈 **基线对比**: 与历史失败对比，识别新增/回归错误
- 🎯 **智能聚类**: 自动分组相似错误，生成聚类摘要
- 📋 **多格式输出**: 终端摘要、JSON、Markdown/HTML报告
- 🧪 **内置自检**: 一键验证解析、边界样本和报告导出

## 快速开始

### 安装

```bash
npm install
npm run build
npm link  # 全局链接 tfc 命令
```

### 基本使用

```bash
# 聚类当前测试失败
tfc cluster --input ./test-failures.log

# 与基线对比，识别新增错误
tfc cluster --input ./failures.json --baseline ./baseline.json

# 输出多种格式
tfc cluster -i ./failures.log --json result.json --md report.md

# 运行自检（验证所有功能）
tfc self-test
```

## 输入格式

支持两种输入格式：

### 1. 原始日志文件 (.log)

```
===== TEST FAILED =====
Test: LoginPage.should_display_error_message
Error: AssertionError: expected 'Success' to equal 'Error'
    at Context.<anonymous> (tests/login.spec.js:42:21)
    at processImmediate (internal/timers.js:464:21)
```

### 2. JSON 格式

```json
[
  {
    "testName": "LoginPage.should_display_error_message",
    "errorMessage": "AssertionError: expected 'Success' to equal 'Error'",
    "stackTrace": "at Context.<anonymous> (tests/login.spec.js:42:21)",
    "timestamp": "2024-01-15T10:30:00Z"
  }
]
```

## 输出说明

### 终端摘要

- 总失败数、聚类数
- 新增错误 vs 已有错误统计
- 每个聚类的代表样本和出现次数

### 机器可读结果 (JSON)

包含完整聚类信息、特征向量、基线对比结果。

### 团队报告 (Markdown)

适合直接发给同事的友好报告，包含：
- 概览统计
- 新增错误详情
- 高频错误聚类
- 异常/坏行记录

## 命令选项

```
tfc cluster [options]

选项：
  -i, --input <path>     输入文件路径（日志或JSON）
  -b, --baseline <path>  历史基线JSON文件路径
  -j, --json <path>      输出JSON结果路径
  -m, --md <path>        输出Markdown报告路径
  -t, --threshold <num>  相似度阈值 (默认: 0.7)
  -v, --verbose          显示详细信息

tfc self-test           运行自检，验证所有功能
```

## 示例

```bash
# 完整工作流
tfc cluster -i ./ci-failures.log -b ./prev-baseline.json -j cluster-result.json -m report.md

# 只看终端摘要
tfc cluster -i ./failures.log -t 0.8

# 生成当前基线供下次对比
tfc cluster -i ./failures.json -j current-baseline.json
```
