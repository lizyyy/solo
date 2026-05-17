# K8s 服务端口映射检查工具

快速定位 Kubernetes Service、Ingress 和 Pod 之间的端口映射问题。

## 功能特性

- ✅ **YAML 解析**: 支持多文档 YAML 文件，保留坏行位置和原因
- ✅ **端口对齐检查**: 自动检查 Service targetPort 与 Pod containerPort 是否匹配
- ✅ **Ingress 路由关联**: 验证 Ingress 引用的 Service 和端口是否存在
- ✅ **缺口定位**: 识别端口不匹配、服务不存在、标签选择器错误等问题
- ✅ **多种报告格式**:
  - 终端摘要（带颜色和表格）
  - 机器可读 JSON
  - 适合分享的 Markdown 报告
- ✅ **错误友好**: 坏数据时不抛 traceback，给出清晰的错误提示

## 安装

```bash
# 进入项目目录
cd k8s-port-mapper

# 安装依赖
pip install -r requirements.txt

# 安装 CLI 工具（可选）
pip install -e .
```

## 使用示例

### 1. 检查正常的配置文件

```bash
k8s-port-mapper check examples/sample.yaml
```

**预期输出**:
```
================================================================================
K8s 服务端口映射检查报告
================================================================================
生成时间: 2024-01-15 10:30:00

【资源统计】
  Service: 1 个
  Ingress: 1 个
  工作负载: 1 个

【缺口统计】
  错误: 0 个
  警告: 0 个

【Service 端口列表】
服务名        端口映射    命名空间
------------  ----------  ----------
my-app-serv   80->8080    default

================================================================================
检查完成: 未发现严重端口映射问题!
================================================================================

报告已生成:
  - JSON: ./reports/port_mapping_20240115_103000.json
  - Markdown: ./reports/port_mapping_20240115_103000.md
```

### 2. 检查有问题的配置文件

```bash
k8s-port-mapper check examples/bad_sample.yaml
```

**预期输出**会显示发现的错误：
- Service 的 targetPort (8080) 在 Pod 中不存在 (Pod 只有 3000)
- Service 的 selector 不匹配任何 Pod
- Ingress 引用的服务不存在
- Ingress 使用的端口不在 Service 的端口列表中
- YAML 解析错误的坏行记录

### 3. 仅解析文件（不进行检查）

```bash
k8s-port-mapper parse examples/*.yaml
```

### 4. 指定输出目录

```bash
k8s-port-mapper check *.yaml -o ./my-reports
```

### 5. 静默模式（只生成报告，不显示终端摘要）

```bash
k8s-port-mapper check *.yaml -q
```

### 6. 只生成特定格式的报告

```bash
# 只生成 JSON，不生成 Markdown
k8s-port-mapper check *.yaml --no-markdown
```

## 输入结构

工具支持的 K8s 资源类型：
- `Deployment`
- `StatefulSet`
- `DaemonSet`
- `Pod`
- `Service`
- `Ingress` (networking.k8s.io/v1)

### 示例输入文件结构

```yaml
# Deployment/StatefulSet/DaemonSet/Pod
apiVersion: apps/v1
kind: Deployment
metadata:
  name: my-app
spec:
  template:
    metadata:
      labels:
        app: my-app
    spec:
      containers:
      - name: my-app
        ports:
        - containerPort: 8080  # 检查此端口

---
# Service
apiVersion: v1
kind: Service
metadata:
  name: my-app-service
spec:
  selector:
    app: my-app  # 检查此 selector 是否匹配 Pod 标签
  ports:
  - port: 80
    targetPort: 8080  # 检查此端口是否在 Pod 中存在

---
# Ingress
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: my-app-ingress
spec:
  rules:
  - http:
      paths:
      - backend:
          service:
            name: my-app-service  # 检查此服务是否存在
            port:
              number: 80  # 检查此端口是否在 Service 中存在
```

## 输出位置

报告默认生成在 `./reports/` 目录下，文件名格式：

```
reports/
├── port_mapping_20240115_103000.json    # 机器可读的完整数据
└── port_mapping_20240115_103000.md      # 适合发给同事的 Markdown 报告
```

### JSON 报告结构

```json
{
  "metadata": { "timestamp": "...", "version": "0.1.0" },
  "summary": { "services_count": 1, "ingresses_count": 1, ... },
  "services": [...],
  "ingresses": [...],
  "workloads": [...],
  "gaps": [
    {
      "type": "SERVICE_TARGET_PORT_MISMATCH",
      "severity": "ERROR",
      "message": "...",
      "details": {...},
      "file": "path/to/file.yaml",
      "line_start": 42
    }
  ],
  "bad_lines": [
    {
      "line_number": 53,
      "content": "this is a bad line...",
      "error": "...",
      "file": "path/to/file.yaml"
    }
  ]
}
```

## 检查项说明

| 缺口类型 | 严重程度 | 说明 |
|---------|---------|------|
| `SERVICE_NO_PORTS` | ERROR | Service 没有定义任何端口 |
| `SERVICE_NO_SELECTOR` | WARNING | Service 没有定义 selector（可能是 headless service） |
| `SERVICE_NO_MATCHING_PODS` | WARNING | Service 的 selector 没有匹配到任何工作负载 |
| `SERVICE_TARGET_PORT_MISMATCH` | ERROR | Service 的 targetPort 在匹配的 Pod 中不存在 |
| `INGRESS_NO_PATHS` | ERROR | Ingress 没有定义任何路由路径 |
| `INGRESS_NO_SERVICE` | ERROR | Ingress 的路径没有指定后端服务 |
| `INGRESS_SERVICE_NOT_FOUND` | ERROR | Ingress 引用的服务不存在 |
| `INGRESS_PORT_MISMATCH` | ERROR | Ingress 使用的端口不在 Service 的端口列表中 |

## 退出码

- `0`: 检查成功，没有错误
- `1`: 命令执行错误（文件不存在、权限问题等）
- `2`: 检查成功，但发现了 ERROR 级别的缺口

## 常见问题

### Q: 为什么会出现 YAML 解析错误？
A: 工具会记录坏行的位置和内容，但不会因为局部错误中断整个检查。坏行所在的文档会被跳过，其他正确的 YAML 文档仍然会被解析。

### Q: 如何处理跨命名空间的引用？
A: 当前版本假设所有资源都在同一个命名空间，跨命名空间引用的检查功能正在开发中。

### Q: 支持哪些 Ingress API 版本？
A: 目前仅支持 `networking.k8s.io/v1`，这是 K8s 1.19+ 的标准版本。

## 开发

```bash
# 运行测试（TODO）
# python -m pytest tests/

# 本地安装测试
pip install -e .
```

## 许可证

MIT
