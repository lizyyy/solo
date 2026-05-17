# K8s 镜像标签漂移检测工具

一个用于检测 Kubernetes 集群中运行的容器镜像与部署清单中定义的镜像是否发生漂移的 CLI 工具。

## 功能特性

- ✅ **YAML 解析**: 支持解析 K8s 部署清单，提取镜像信息并保留原始位置
- 🔍 **集群对比**: 从 K8s 集群获取实际运行的镜像和 digest
- ⚖️ **漂移检测**: 对比期望镜像与实际镜像，识别漂移
- 📊 **多格式报告**: 支持终端彩色输出、JSON、Markdown 报告
- 📍 **位置追踪**: 保留异常样本的原始文件位置和代码行
- 🔄 **环境分组**: 支持按命名空间、工作负载类型等分组
- 🎯 **多工作负载支持**: Deployment、StatefulSet、DaemonSet、CronJob、Job、Pod 等

## 安装

```bash
npm install
npm link
```

## 使用方法

### 1. 检测镜像漂移

```bash
# 基本用法：指定部署清单和命名空间
k8s-image-drift detect -m ./manifests/*.yaml -n default

# 检测所有命名空间
k8s-image-drift detect -m ./manifests/*.yaml -A

# 严格标签匹配
k8s-image-drift detect -m ./manifests/*.yaml -s

# 输出报告
k8s-image-drift detect -m ./manifests/*.yaml --json report.json --markdown report.md

# 按工作负载分组
k8s-image-drift detect -m ./manifests/*.yaml -g workload
```

### 2. 列出集群中运行的镜像

```bash
# 列出默认命名空间的镜像
k8s-image-drift list-images

# 列出所有命名空间
k8s-image-drift list-images -A

# 输出到 JSON
k8s-image-drift list-images -A --json images.json
```

### 3. 解析部署清单

```bash
# 解析清单并显示
k8s-image-drift parse-manifest ./manifests/*.yaml

# 输出到 JSON
k8s-image-drift parse-manifest ./manifests/*.yaml --json parsed.json
```

## 命令选项

### detect 命令

| 选项 | 说明 | 默认值 |
|------|------|--------|
| `-m, --manifest <path...>` | 部署清单文件路径，支持 glob | 必填 |
| `-n, --namespace <ns>` | K8s 命名空间 | `default` |
| `-A, --all-namespaces` | 检测所有命名空间 | - |
| `-s, --strict-tag` | 严格匹配镜像标签 | - |
| `-g, --group-by <field>` | 结果分组: namespace\|kind\|status\|workload | `namespace` |
| `--kubeconfig <path>` | kubeconfig 文件路径 | - |
| `--context <name>` | K8s context 名称 | - |
| `--json <path>` | 输出 JSON 报告 | - |
| `--markdown <path>` | 输出 Markdown 报告 | - |
| `--no-color` | 禁用彩色输出 | - |

### 退出码

- `0`: 无漂移，无警告
- `1`: 存在警告但无漂移
- `2`: 存在镜像漂移

## 示例输出

### 终端报告

```
═══════════════════════════════════════════════════
         K8s 镜像标签漂移检测报告
═══════════════════════════════════════════════════

检测时间: 2024/5/15 14:30:00

📊 概要统计
─────────────────────────────────────────
┌────────────────┬────────────┬────────────────────┐
│ 指标           │ 数值       │ 说明               │
├────────────────┼────────────┼────────────────────┤
│ 总计检查       │ 15         │ 容器镜像           │
├────────────────┼────────────┼────────────────────┤
│ 匹配           │ 12         │ 一致的镜像         │
├────────────────┼────────────┼────────────────────┤
│ 漂移           │ 2          │ 发生漂移的镜像     │
├────────────────┼────────────┼────────────────────┤
│ 警告           │ 1          │ 存在警告的镜像     │
├────────────────┼────────────┼────────────────────┤
│ 漂移率         │ 13.33%     │ 漂移镜像占比       │
└────────────────┴────────────┴────────────────────┘
```

### Markdown 报告

工具会生成完整的 Markdown 报告，包含：
- 概要统计表格
- 漂移类型分布
- 每个漂移的详细信息
- 期望 vs 实际的对比
- 原始代码位置
- 未匹配的工作负载
- 错误信息

## 在 CI/CD 中使用

### GitHub Actions 示例

```yaml
name: Image Drift Detection

on:
  schedule:
    - cron: '0 0 * * *'
  workflow_dispatch:

jobs:
  detect-drift:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Run drift detection
        run: |
          node src/cli.js detect \
            -m ./k8s/manifests/*.yaml \
            -A \
            --json drift-report.json \
            --markdown drift-report.md
        continue-on-error: true
      
      - name: Upload reports
        uses: actions/upload-artifact@v4
        with:
          name: drift-reports
          path: |
            drift-report.json
            drift-report.md
      
      - name: Fail on drift
        run: |
          drifted=$(jq -r '.summary.drifted' drift-report.json)
          if [ "$drifted" -gt 0 ]; then
            echo "::error::Detected $drifted drifted images"
            exit 1
          fi
```

## 检测原理

1. **解析阶段**: 读取 YAML 部署清单，提取每个容器的镜像信息，记录原始文件位置和行号
2. **集群查询**: 通过 K8s API 获取所有运行中 Pod 的实际镜像信息和 container status
3. **对比匹配**: 根据命名空间、工作负载名称、容器名称进行匹配
4. **漂移识别**:
   - 对比镜像仓库是否一致
   - 对比镜像标签（严格模式下）
   - 对比镜像 digest（当清单中指定了 digest 时）
5. **报告生成**: 生成结构化的检测报告

## 支持的工作负载类型

- Deployment
- StatefulSet
- DaemonSet
- CronJob
- Job
- Pod
- ReplicaSet

## 项目结构

```
.
├── src/
│   ├── cli.js              # CLI 入口
│   ├── yaml-parser.js      # YAML 解析器
│   ├── k8s-client.js       # K8s API 客户端
│   ├── drift-detector.js   # 漂移检测核心逻辑
│   └── report-generator.js # 报告生成器
├── examples/               # 示例文件
├── package.json
└── README.md
```

## License

MIT
