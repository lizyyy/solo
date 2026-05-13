# 接口流量镜像控制器

一个基于 Go 语言实现的单体后端服务，提供接口流量镜像、字段脱敏、采样控制、异步投递和结果比对功能。

## 功能特性

- **流量镜像**: 将生产环境请求复制到测试环境
- **字段脱敏**: 支持多种脱敏策略（REDACT、MASK、HASH）
- **采样比例**: 0-1 可配置的采样率
- **异步投递**: 后台工作线程异步处理镜像请求
- **结果比对**: 自动比对不同环境的响应结果
- **幂等保证**: 基于 idempotency_key 确保重复提交不产生脏数据

## 项目结构

```
traffic-mirror-controller/
├── cmd/
│   └── main.go           # 程序入口
├── internal/
│   ├── model/            # 数据模型
│   │   └── model.go
│   ├── repository/       # 数据库层
│   │   └── sqlite.go
│   ├── service/          # 业务逻辑层
│   │   └── mirror.go
│   └── handler/          # HTTP 接口层
│       └── http.go
├── examples/             # 使用示例
│   └── demo.sh
├── go.mod
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
go mod download
```

### 2. 启动服务

```bash
go run cmd/main.go
```

服务将在 `http://localhost:8080` 启动

### 3. 运行演示脚本

```bash
chmod +x examples/demo.sh
bash examples/demo.sh
```

## API 接口

### 健康检查
```
GET /health
```

### 目标环境管理
```
POST /api/v1/targets          # 创建目标环境
GET  /api/v1/targets          # 列出所有目标环境
GET  /api/v1/targets/:id      # 获取单个目标环境
```

### 镜像规则管理
```
POST   /api/v1/rules               # 创建镜像规则（幂等）
GET    /api/v1/rules               # 列出所有镜像规则
GET    /api/v1/rules/:id           # 获取单个镜像规则
PATCH  /api/v1/rules/:id/status    # 更新规则状态
```

### 请求副本管理
```
POST  /api/v1/copies/submit    # 提交请求进行镜像
GET   /api/v1/copies           # 查询请求副本列表
```

### 比对结果
```
GET /api/v1/results         # 查询比对结果列表
```

## 数据对象

### MirrorRule（镜像规则）
- `id`: 规则ID
- `idempotency_key`: 幂等键（重复提交不会创建新规则）
- `name`: 规则名称
- `description`: 描述
- `source_path`: 源路径
- `source_method`: 源方法
- `sample_rate`: 采样率（0-1）
- `targets`: 目标环境ID列表
- `masking_fields`: 脱敏字段配置
- `status`: 状态（DRAFT/ACTIVE/PAUSED/DISABLED）
- `compare_mode`: 是否开启比对模式

### TargetEnvironment（目标环境）
- `id`: 环境ID
- `name`: 环境名称
- `base_url`: 基础URL
- `auth_type`: 认证类型
- `auth_token`: 认证令牌
- `headers`: 自定义请求头
- `timeout_sec`: 超时时间

### RequestCopy（请求副本）
- `id`: 副本ID
- `rule_id`: 关联规则ID
- `trace_id`: 追踪ID
- `target_env_id`: 目标环境ID
- `original_url`: 原始URL
- `method`: 请求方法
- `request_headers`: 请求头
- `request_body`: 请求体
- `masked_body`: 脱敏后的请求体
- `status_code`: 响应状态码
- `response`: 响应内容
- `error_msg`: 错误信息
- `status`: 状态（PENDING/DELIVERED/FAILED/COMPARED）

### CompareResult（比对结果）
- `id`: 结果ID
- `original_copy_id`: 原始副本ID
- `mirrored_copy_id`: 镜像副本ID
- `rule_id`: 规则ID
- `status_code_match`: 状态码是否匹配
- `body_match`: 响应体是否匹配
- `headers_match`: 请求头是否匹配
- `similarity_score`: 相似度评分（0-1）
- `diff_details`: 差异详情

## 脱敏类型

- `REDACT`: 完全替换为 `***REDACTED***`
- `MASK`: 部分脱敏（保留首尾字符）
- `HASH`: 哈希处理

## 状态流转

MirrorRule 状态：
```
DRAFT → ACTIVE ↔ PAUSED → DISABLED
```

RequestCopy 状态：
```
PENDING → DELIVERED → COMPARED
         ↓
        FAILED
```
