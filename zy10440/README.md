# GPU 作业排队 API 服务

基于 Go + Gin + SQLite 实现的 GPU 作业排队管理系统，提供完整的 REST 接口、本地持久化和异常追踪功能。

## 核心功能

- ✅ **资源占用校验**：实时追踪各型号 GPU 使用情况
- ✅ **优先级仲裁**：按优先级和创建时间排序调度
- ✅ **超时释放**：自动检测并释放超时作业
- ✅ **重复申请幂等**：基于 request_id 保证幂等性
- ✅ **排队摘要导出**：完整的排队状态和异常报告导出
- ✅ **人工修正**：支持手动调整资源占用状态

## 快速开始

### 1. 启动服务

```bash
# 编译并启动
go build -o gpu-queue-api .
./gpu-queue-api

# 或直接运行
go run .
```

服务启动在 `http://localhost:8080`

### 2. 生成样例数据（验证功能）

新终端窗口执行：

```bash
# 确保服务已启动后执行
go run sample_data.go
```

该脚本会自动：
- 创建正常作业和排队作业
- 验证幂等性（重复提交同一作业）
- 展示作业完成后的调度过程
- 导出完整报告

## API 接口文档

### 基础路径：`/api/v1`

#### 作业管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/jobs` | 创建作业 |
| GET | `/jobs` | 查询作业列表（支持 status/gpu_model 过滤） |
| GET | `/jobs/:id` | 查询单个作业详情 |
| PUT | `/jobs/:id/status` | 更新作业状态 |

**创建作业请求示例**：
```json
{
  "name": "模型训练-ResNet50",
  "gpu_model": "RTX-3090",
  "gpu_count": 2,
  "user_id": "user_001",
  "priority": 5,
  "duration_min": 120,
  "request_id": "req_unique_12345"
}
```

**更新作业状态请求示例**：
```json
{
  "status": "completed",
  "remark": "训练正常完成"
}
```

#### 资源管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/gpu-resources` | 查询所有 GPU 资源状态 |
| PUT | `/gpu-resources/correction` | 人工修正资源占用 |

**人工修正请求示例**：
```json
{
  "gpu_model": "RTX-3090",
  "used_count": 4,
  "operator": "admin",
  "reason": "手动释放卡"
}
```

#### 排队与报告

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/queue-summary` | 获取排队摘要 |
| GET | `/release-events` | 查询资源释放事件 |
| GET | `/exception-logs` | 查询异常日志 |
| GET | `/report/export` | 导出完整排队报告 |

## 数据模型

### 作业状态流转

```
pending → queued → running → completed/failed/cancelled/timeout
```

### 预设 GPU 资源

系统初始化时自动创建以下 GPU 资源：

| GPU 型号 | 总数 |
|---------|------|
| RTX-3090 | 8 卡 |
| RTX-4090 | 4 卡 |
| A100 | 2 卡 |
| V100 | 4 卡 |

## 项目结构

```
.
├── main.go              # 程序入口，路由配置
├── models/              # 数据模型定义
│   ├── models.go        # 核心实体（Job、GPUResource等）
│   └── dto.go           # 请求/响应 DTO
├── storage/             # 数据持久层
│   ├── sqlite.go        # SQLite 初始化和基础操作
│   └── storage_methods.go  # 各实体存储方法
├── service/             # 业务逻辑层
│   └── queue_service.go # 排队核心逻辑
├── handler/             # API 处理器
│   └── handler.go       # Gin Handler 实现
├── sample_data.go       # 样例数据生成脚本
├── go.mod
└── go.sum
```

## 核心设计要点

### 1. 幂等性保证

通过 `request_id` 字段实现，同一 request_id 重复提交只会创建一次作业，直接返回已存在的作业。

### 2. 调度策略

- 作业创建时检查资源，可用则直接运行，否则进入排队
- 作业按「优先级 DESC + 创建时间 ASC」排序
- 资源释放时自动触发调度，按顺序分配给排队作业

### 3. 超时检测

后台定时任务每 5 分钟检测一次运行中作业，超过预计时长 2 倍的自动标记为 timeout 并释放资源。

### 4. 异常追踪

所有 API 请求异常都会记录：
- 原始请求输入
- 错误类型和消息
- 处理结论
- 发生时间

## 验收指南

### 1. 基本功能验证

```bash
# 启动服务
go run .

# 新终端运行样例脚本
go run sample_data.go
```

### 2. 幂等性验证

样例脚本会自动执行两次相同 request_id 的提交，验证是否返回同一作业 ID。

### 3. 状态推进验证

观察样例脚本输出：
- 作业完成后 GPU 占用数减少
- 排队作业自动被调度运行

### 4. 异常日志验证

构造错误请求（如缺少必填字段），然后访问：
```
GET /api/v1/exception-logs
```

### 5. 报告导出

```
GET /api/v1/report/export
```

验证报告包含：排队摘要、作业列表、异常统计。

## 技术栈

- **Web 框架**：Gin
- **数据库**：SQLite（本地文件）
- **UUID 生成**：google/uuid
- **Go 版本**：1.21+

## 数据库文件

数据存储在当前目录的 `gpu_queue.db` 文件中，可使用 SQLite 客户端直接查看。
