# Helm Template Diff CLI

Helm 模板渲染差异检查工具，用于比较 Helm Chart 在不同 values 文件下渲染出的 Kubernetes 资源清单差异。

## ✨ 功能特性

- 🔍 **模板渲染** - 调用本地 Helm CLI 渲染 Chart 模板
- 📋 **资源归一化** - 自动排序、去空、标准化处理，减少误报
- 🔄 **环境对比** - 多环境之间的差异检测（新增、删除、变更）
- 🔒 **敏感数据遮蔽** - 自动识别并遮蔽密码、密钥、Token 等敏感字段
- 📊 **多格式报告** - 终端彩色摘要、JSON 机器可读、Markdown 适合团队分享
- ⚠️ **错误处理** - 渲染错误时保留原始位置和原因，不抛出冗长堆栈

## 📋 前置要求

- Python 3.9+
- Helm CLI 3.x+ (已安装并在 PATH 中可用)

## 🚀 安装

```bash
# 克隆或下载代码后，在项目根目录执行
pip install -e .
```

或使用 pip 安装依赖：

```bash
pip install click pyyaml deepdiff jinja2 rich python-dotenv
```

安装后验证：

```bash
helm-diff --version
helm-diff --help
```

## 📖 使用指南

### 1. 对比多个环境

这是最常用的功能，用于比较不同 values 文件渲染出的资源差异：

```bash
helm-diff compare ./charts/myapp \
  -e base values/base.yaml \
  -e staging values/staging.yaml \
  -e production values/prod.yaml \
  -b base
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|------|------|--------|
| `CHART_PATH` | Helm Chart 目录路径（必需） | - |
| `-e, --env` | 环境名称 + values 文件路径，可多次指定 | - |
| `-b, --base-env` | 作为对比基准的环境名称 | base |
| `-o, --output-dir` | 报告输出目录 | helm-diff-reports |
| `-n, --namespace` | 渲染时使用的 Kubernetes 命名空间 | default |
| `-r, --release-name` | Helm Release 名称 | 自动生成 |
| `--mask-sensitive` | 启用/禁用敏感数据遮蔽 | 启用 |
| `--save-manifests` | 保存原始渲染的 YAML 文件 | 启用 |
| `--json-report` | 生成 JSON 格式报告 | 启用 |
| `--md-report` | 生成 Markdown 格式报告 | 启用 |
| `-v, --verbose` | 详细输出模式 | 禁用 |

### 2. 列出所有资源

查看单个 values 文件会渲染出哪些资源：

```bash
helm-diff list-resources ./charts/myapp values/staging.yaml
```

支持多种输出格式：

```bash
# JSON 格式
helm-diff list-resources ./charts/myapp values/staging.yaml -o json

# YAML 格式
helm-diff list-resources ./charts/myapp values/staging.yaml -o yaml
```

### 3. 渲染模板到文件

直接渲染模板并保存到文件（可选敏感数据遮蔽）：

```bash
helm-diff render ./charts/myapp values/staging.yaml -o rendered.yaml
```

## 📂 输出说明

运行 `helm-diff compare` 后，会在输出目录生成以下文件：

```
helm-diff-reports/
├── diff-base-staging-20240101-120000.json    # JSON 格式差异报告
├── diff-base-staging-20240101-120000.md      # Markdown 格式差异报告
├── diff-base-production-20240101-120000.json
├── diff-base-production-20240101-120000.md
├── manifests-base-20240101-120000.yaml        # base 环境原始渲染结果
├── manifests-staging-20240101-120000.yaml     # staging 环境原始渲染结果
└── manifests-production-20240101-120000.yaml  # production 环境原始渲染结果
```

### JSON 报告结构

```json
{
  "metadata": {
    "generated_at": "2024-01-01T12:00:00",
    "left_environment": "base",
    "right_environment": "staging",
    "left_values_file": "values/base.yaml",
    "right_values_file": "values/staging.yaml"
  },
  "summary": {
    "total_resources": { "base": 12, "staging": 15 },
    "status_counts": { "unchanged": 10, "changed": 2, "added": 3, "removed": 0 },
    "has_changes": true,
    "changed_count": 2,
    "added_count": 3,
    "removed_count": 0,
    "unchanged_count": 10
  },
  "resource_diffs": [
    {
      "resource_key": "deployment/default/myapp",
      "kind": "Deployment",
      "name": "myapp",
      "namespace": "default",
      "status": "changed",
      "diff": { /* deepdiff 格式的详细差异 */ },
      "left_source": { /* 归一化后的左侧资源 */ },
      "right_source": { /* 归一化后的右侧资源 */ }
    }
  ],
  "render_errors": {
    "base": [],
    "staging": []
  },
  "sensitive_data": {
    "total_masked": 3,
    "masked_fields": [
      { "path": "spec.template.spec.containers[0].env[1].valueFrom.secretKeyRef.name", "pattern_name": "secret" }
    ]
  }
}
```

### 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 执行成功，无差异或无错误 |
| 1 | 检测到资源差异或渲染错误 |
| 2 | 程序异常或参数错误 |
| 130 | 用户中断（Ctrl+C） |

## 🔍 敏感数据遮蔽

工具会自动识别并遮蔽以下模式的字段：

| 模式名称 | 匹配规则 |
|----------|----------|
| password | password, passwd, pwd, secret |
| api_key | api_key, apikey |
| token | token, bearer, jwt |
| certificate | cert, pem, key, crt |
| connection_string | connection_string, connstring |
| private_key | private_key, rsa, dsa |
| authorization | authorization, auth |
| credential | credential, creds |

遮蔽方式：
- 完整遮蔽：短字段直接替换为 `[MASKED]`
- 部分遮蔽：长字段保留前后4位，中间遮蔽

## 🎯 使用场景

### 1. Pull Request 自动化检查

在 CI 中添加 helm-diff，自动检查 values 变更是否符合预期：

```bash
# .github/workflows/helm-diff.yml
name: Helm Diff Check
on: [pull_request]
jobs:
  diff:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/setup-helm@v3
      - run: pip install -e .
      - run: |
          helm-diff compare ./charts/myapp \
            -e base values/base.yaml \
            -e staging values/staging.yaml
```

### 2. 发布前差异确认

在发布到生产环境前，确认 staging 和 production 的差异：

```bash
helm-diff compare ./charts/myapp \
  -e staging values/staging.yaml \
  -e production values/prod.yaml \
  -b staging
```

### 3. 团队评审分享

生成的 Markdown 报告可以直接粘贴到 MR/PR 评论中，方便团队成员查看变更。

## 📁 项目结构

```
src/helm_diff/
├── __init__.py        # 包初始化
├── cli.py             # CLI 入口和参数解析
├── renderer.py        # Helm 模板渲染器
├── normalizer.py      # 资源归一化处理器
├── differ.py          # 差异检测和对比引擎
├── masker.py          # 敏感数据遮蔽器
└── reporter.py        # 报告生成器（终端、JSON、Markdown）
```

## ⚙️ 高级配置

### 自定义忽略字段

在代码中使用 `ResourceNormalizer` 时，可以自定义忽略字段：

```python
from helm_diff.normalizer import ResourceNormalizer

ignore_fields = {
    "metadata": ["creationTimestamp", "resourceVersion", "my-custom-field"],
    "status": ["*"],  # 忽略整个 status 字段
}
normalizer = ResourceNormalizer(ignore_fields=ignore_fields)
```

### 添加敏感字段模式

```python
from helm_diff.masker import SensitiveDataMasker
import re

masker = SensitiveDataMasker()
masker.add_pattern("my_secret", re.compile(r"my_secret|private_key", re.IGNORECASE))
```

## 🐛 故障排除

### "Helm CLI is not available"

确保 Helm 已安装并在 PATH 中可用：

```bash
helm version
which helm
```

### "At least two environments are required"

确保使用 `-e` 参数指定了至少两个环境进行对比。

### 渲染失败但没有详细错误

添加 `-v` 参数查看详细错误信息：

```bash
helm-diff compare ... -v
```

## 📄 License

MIT License

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！
