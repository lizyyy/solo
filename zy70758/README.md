# K8s 发布失败时间线分析后端 API

这是一个用于分析 Kubernetes 发布失败原因的后端 API 系统，可以解析 kubectl 输出，关联事件和 Pod 状态，识别发布失败根因，并生成结构化的 Markdown 报告。

## 功能特性

### 核心功能
- **kubectl 输出解析**: 解析 `kubectl get events`、`kubectl get pods`、`kubectl get deployments` 等命令的输出
- **事件排序与过滤**: 按时间排序事件，过滤 Warning/Error 级别事件
- **状态归因分析**: 基于模式匹配识别故障根因
- **镜像对比**: 比较新旧镜像标签、仓库变更
- **Markdown 报告生成**: 生成结构化的故障分析报告

### 支持的故障类型
- ImagePullBackOff (镜像拉取失败)
- CrashLoopBackOff (容器崩溃重启)
- ReadinessProbeFailed (就绪探针失败)
- LivenessProbeFailed (存活探针失败)
- InsufficientResources (资源不足)
- FailedScheduling (调度失败)
- ConfigError (配置错误)
- RBACError (权限错误)
- NetworkError (网络错误)

## 项目结构

```
.
├── main.py                    # FastAPI 主应用
├── database.py                # 数据库模型与连接
├── kubectl_parser.py          # kubectl 输出解析器
├── timeline_analyzer.py       # 事件分析与状态归因
├── markdown_generator.py      # Markdown 报告生成器
├── test_self_check.py         # 自检脚本
├── requirements.txt           # Python 依赖
└── README.md                  # 本文档
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检

```bash
python3 test_self_check.py
```

这将验证所有核心功能是否正常工作。

### 3. 启动服务

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

服务启动后，访问 http://localhost:8000/docs 查看 API 文档。

## API 使用说明

### 1. 创建发布记录

```bash
POST /api/v1/releases
```

请求体：
```json
{
  "namespace": "default",
  "deployment_name": "myapp",
  "old_image": "myregistry/myapp:v1.0",
  "new_image": "myregistry/myapp:v2.0",
  "events_output": "<kubectl get events 输出>",
  "pods_output": "<kubectl get pods 输出>"
}
```

### 2. 分析发布失败原因

```bash
POST /api/v1/releases/{release_id}/process
```

### 3. 获取发布详情

```bash
GET /api/v1/releases/{release_id}
```

### 4. 获取 Markdown 报告

```bash
GET /api/v1/releases/{release_id}/report
```

### 5. 获取发布列表

```bash
GET /api/v1/releases?namespace=default&skip=0&limit=20
```

### 6. 解析 kubectl 输出

```bash
POST /api/v1/parse/kubectl
```

请求体：
```json
{
  "events_output": "<kubectl get events 输出>",
  "pods_output": "<kubectl get pods 输出>"
}
```

### 7. 镜像对比

```bash
POST /api/v1/compare/images?old_image=myapp:v1.0&new_image=myapp:v2.0
```

## 错误响应说明

系统定义了以下错误码，让调用方能够清晰区分不同情况：

| 错误码 | 说明 |
|--------|------|
| `MISSING_FIELD` | 缺少必填字段 |
| `INVALID_STATE` | 状态不允许操作（如正在处理中） |
| `MANUAL_REVIEW_REQUIRED` | 置信度低，需要人工复核 |
| `ALREADY_PROCESSED` | 该发布已经处理过 |
| `NOT_FOUND` | 资源不存在 |

错误响应格式：
```json
{
  "detail": {
    "error_code": "MISSING_FIELD",
    "message": "缺少 namespace 字段",
    "details": {
      "field": "namespace"
    }
  }
}
```

## 使用示例

### 典型工作流程

1. **收集数据**：在 K8s 集群中执行命令获取诊断信息
   ```bash
   kubectl get events -n default > events.txt
   kubectl get pods -n default > pods.txt
   ```

2. **创建发布记录**：调用 API 创建记录，传入原始输出
   ```bash
   curl -X POST http://localhost:8000/api/v1/releases \
     -H "Content-Type: application/json" \
     -d '{
       "namespace": "default",
       "deployment_name": "myapp",
       "old_image": "myapp:v1.0",
       "new_image": "myapp:v2.0",
       "events_output": "'"$(cat events.txt)"'",
       "pods_output": "'"$(cat pods.txt)"'"
     }'
   ```

3. **执行分析**：触发分析流程
   ```bash
   curl -X POST http://localhost:8000/api/v1/releases/1/process
   ```

4. **获取报告**：下载结构化的 Markdown 分析报告
   ```bash
   curl http://localhost:8000/api/v1/releases/1/report > analysis_report.md
   ```

### 报告内容示例

生成的报告包含以下部分：
- 基本信息（命名空间、Deployment、时间）
- 失败分析摘要（根因、置信度）
- 镜像版本对比
- 事件时间线
- Pod 状态详情
- 关键事件详情
- 排查建议
- 通用排查命令

## 置信度说明

| 置信度 | 说明 |
|--------|------|
| HIGH | 有充分证据支持判断，准确性高 |
| MEDIUM | 有一定证据支持，建议结合上下文 |
| LOW | 证据不足，需要人工复核 |

## 数据库

系统使用 SQLite 作为持久化存储，数据库文件 `k8s_timeline.db` 会在首次启动时自动创建。

数据模型：
- `DeploymentRelease`: 发布记录
- `K8sEvent`: K8s 事件
- `PodStatus`: Pod 状态
- `ContainerStatus`: 容器状态
- `TimelineReport`: 时间线报告

## 自检

运行 `python3 test_self_check.py` 验证所有模块功能：
- kubectl 输出解析
- 事件排序与状态归因
- 镜像对比功能
- Markdown 报告生成

测试结果会保存到 `test_report.md`。

## 技术栈

- **FastAPI**: 现代、高性能的 Web 框架
- **SQLAlchemy**: ORM 工具
- **SQLite**: 轻量级数据库
- **Pydantic**: 数据验证

## 注意事项

1. 本系统基于自动化模式匹配分析，仅供排障参考
2. 关键生产故障请结合实际场景和日志综合判断
3. 建议与 CI/CD 流水线集成，实现发布失败自动分析

## License

MIT
