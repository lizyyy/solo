# RPC 迁移评审服务

一个用于帮助团队从老 RPC 接口迁移到 gRPC 的本地后端服务，提供自动化对比、差异检测、人工确认和报告导出功能。

## 功能特性

- **多格式导入**: 支持导入 `rpc-services.yaml` 和 `proto/*.proto` 文件
- **迁移任务管理**: 创建、运行、跟踪迁移评审任务
- **多维度对比**:
  - 字段对比（请求/响应字段、类型、嵌套结构）
  - Deadline/超时对比
  - 状态码对比（HTTP 状态码 vs gRPC 状态码）
  - 重试语义对比
  - 错误码映射对比
  - 元数据/Header 对比
  - 幂等键检查
- **模拟适配器**: 内置 legacy-rpc 和 grpc 两个模拟适配器，支持测试
- **数据持久化**: 所有任务、差异、确认记录存储到 SQLite
- **报告导出**: 支持 Markdown 和 JSON 格式报告
- **坏样例校验**: 内置对比器有效性测试样例

## 技术栈

- **语言**: Python 3.9+
- **Web 框架**: Flask 2.3+
- **ORM**: Flask-SQLAlchemy
- **数据库**: SQLite
- **其他依赖**: PyYAML, protobuf, grpcio

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python app.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 初始化样例数据

```bash
curl -X POST http://localhost:5000/api/seed
```

这将导入样例的 RPC 服务定义、Proto 文件、迁移任务和坏样例。

## API 文档

所有 API 都可以通过 curl 调用。

### 健康检查

```bash
curl http://localhost:5000/api/health
```

### 导入 rpc-services.yaml

```bash
# 通过文件上传
curl -X POST -F "file=@rpc-services.yaml" http://localhost:5000/api/rpc-services

# 或通过 JSON 直接发送内容
curl -X POST -H "Content-Type: application/json" -d @rpc-services.json http://localhost:5000/api/rpc-services
```

### 导入 Proto 文件

```bash
# 通过文件上传
curl -X POST -F "file=@user_service.proto" http://localhost:5000/api/proto-services

# 或通过 JSON
curl -X POST -H "Content-Type: application/json" -d '{
  "filename": "user_service.proto",
  "content": "syntax = \"proto3\"; package demo; ..."
}' http://localhost:5000/api/proto-services
```

### 查看已导入的服务

```bash
# 查看老 RPC 服务
curl http://localhost:5000/api/rpc-services

# 查看 Proto 服务
curl http://localhost:5000/api/proto-services
```

### 创建迁移评审任务

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "name": "用户服务迁移评审",
  "description": "评审 UserService 从老 RPC 到 gRPC 的迁移",
  "rpc_service_id": 1,
  "proto_service_id": 1,
  "config": {
    "legacy_adapter": {
      "base_url": "http://legacy-api.example.com",
      "timeout_ms": 30000
    },
    "grpc_adapter": {
      "target": "grpc-api.example.com:50051"
    },
    "retry_policy": {
      "max_attempts": 3
    }
  }
}' http://localhost:5000/api/tasks
```

### 查看任务列表

```bash
curl http://localhost:5000/api/tasks
```

### 查看单个任务详情

```bash
curl http://localhost:5000/api/tasks/1
```

### 运行迁移评审任务

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "test_cases": [
    {
      "method": "GetUser",
      "request": {
        "user_id": "user_001",
        "include_details": true
      },
      "metadata": [
        {"key": "Authorization", "value": "Bearer test_token"}
      ],
      "deadline_ms": 10000
    },
    {
      "method": "CreateUser",
      "request": {
        "request_id": "req_12345",
        "username": "new_user",
        "email": "user@example.com",
        "password": "secret123"
      },
      "deadline_ms": 5000
    }
  ]
}' http://localhost:5000/api/tasks/1/run
```

### 查看任务的差异列表

```bash
curl http://localhost:5000/api/tasks/1/differences
```

### 人工确认差异

```bash
curl -X POST -H "Content-Type: application/json" -d '{
  "type": "ignore",
  "comment": "该字段为 gRPC 新增字段，老 RPC 不需要",
  "confirmed_by": "developer_a"
}' http://localhost:5000/api/differences/1/confirm
```

确认类型:
- `accept`: 接受差异（需要修改实现）
- `reject`: 拒绝差异（认为是错误）
- `ignore`: 忽略差异（业务允许）

### 导出报告

```bash
# Markdown 格式
curl -o report.md http://localhost:5000/api/tasks/1/export/markdown

# JSON 格式
curl -o report.json http://localhost:5000/api/tasks/1/export/json
```

### 坏样例校验

```bash
# 查看所有坏样例
curl http://localhost:5000/api/bad-examples

# 运行单个坏样例校验
curl -X POST http://localhost:5000/api/bad-examples/1/run

# 创建自定义坏样例
curl -X POST -H "Content-Type: application/json" -d '{
  "example_type": "field_mismatch",
  "name": "自定义字段缺失测试",
  "description": "测试对比器对嵌套字段缺失的检测",
  "test_data": {
    "legacy": {
      "user": {
        "profile": {
          "avatar": "url"
        }
      }
    },
    "grpc": {
      "user": {}
    }
  },
  "expected_issues": [
    {"issue_type": "missing_field"}
  ]
}' http://localhost:5000/api/bad-examples
```

## 项目结构

```
.
├── app.py                 # Flask 主应用
├── config.py              # 配置文件
├── models.py              # 数据库模型
├── requirements.txt       # 依赖列表
├── README.md              # 本文档
├── adapters/              # 适配器
│   ├── __init__.py
│   ├── legacy_rpc_adapter.py   # 老 RPC 适配器
│   └── grpc_adapter.py         # gRPC 适配器
├── comparators/           # 对比器
│   ├── __init__.py
│   ├── base_comparator.py      # 基类
│   ├── field_comparator.py     # 字段对比
│   ├── deadline_comparator.py  # 超时对比
│   ├── status_code_comparator.py # 状态码对比
│   ├── retry_comparator.py     # 重试对比
│   ├── error_mapping_comparator.py # 错误映射对比
│   └── metadata_comparator.py  # 元数据对比
├── parsers/               # 解析器
│   ├── __init__.py
│   ├── rpc_services_parser.py  # YAML 解析
│   └── proto_parser.py         # Proto 解析
├── reports/               # 报告生成器
│   ├── __init__.py
│   ├── markdown_report.py      # Markdown 报告
│   └── json_report.py          # JSON 报告
└── seed/                  # 样例数据
    ├── __init__.py
    └── sample_data.py         # 样例数据和坏样例
```

## 对比维度说明

### 1. 字段对比 (Field)

检测以下问题：
- **字段缺失**: gRPC 响应缺少老 RPC 中存在的字段
- **额外字段**: gRPC 响应多出老 RPC 中没有的字段
- **类型不匹配**: 相同字段名但类型不同
- **值不匹配**: 相同字段但值不同
- **列表长度不匹配**: 数组元素数量不同

### 2. 超时对比 (Deadline)

检测以下问题：
- **Deadline 设置差异过大** (超过 5 秒容差)
- **Deadline 过短** (少于 1 秒)
- **响应时间差异过大**

### 3. 状态码对比 (Status Code)

检测以下问题：
- **成功/失败不一致**: 老 RPC 成功但 gRPC 失败，或反之
- **状态码映射错误**: HTTP 状态码与 gRPC 状态码映射不符合标准

标准映射表：
| HTTP 状态码 | gRPC 状态码 | gRPC 名称 |
|-------------|-------------|-----------|
| 200         | 0           | OK |
| 400         | 3           | INVALID_ARGUMENT |
| 401         | 16          | UNAUTHENTICATED |
| 403         | 7           | PERMISSION_DENIED |
| 404         | 5           | NOT_FOUND |
| 409         | 6           | ALREADY_EXISTS |
| 429         | 8           | RESOURCE_EXHAUSTED |
| 500         | 13          | INTERNAL |
| 501         | 12          | UNIMPLEMENTED |
| 503         | 14          | UNAVAILABLE |
| 504         | 4           | DEADLINE_EXCEEDED |

### 4. 重试语义对比 (Retry)

检测以下问题：
- **最大重试次数不匹配**
- **初始退避时间不匹配**
- **最大退避时间不匹配**
- **退避乘数不匹配**
- **可重试错误码不匹配**

### 5. 错误映射对比 (Error Mapping)

检测以下问题：
- **错误码缺少 gRPC 映射**
- **错误码映射不正确**
- **HTTP 状态码与 gRPC 状态码映射不一致**

### 6. 元数据对比 (Metadata)

检测以下问题：
- **元数据缺失**: gRPC 缺少老 RPC 传递的元数据
- **元数据值不匹配**: 相同元数据键但值不同
- **幂等键缺失**: 老 RPC 定义了幂等键但 gRPC 没有
- **幂等键不匹配**: 幂等键定义不一致

## 内置坏样例

系统内置了 6 个坏样例，用于验证对比器的有效性：

| 样例名称 | 类型 | 预期检测结果 |
|---------|------|-------------|
| 字段缺失 - gRPC 缺少必填字段 | field_mismatch | 检测到 2 个 missing_field |
| 类型不匹配 - 字段类型不一致 | field_mismatch | 检测到 3 个 type_mismatch |
| Deadline 差异过大 | deadline_mismatch | 检测到 deadline_mismatch |
| 状态码不匹配 - 成功/失败不一致 | status_code_mismatch | 检测到 success_mismatch |
| 元数据缺失 - gRPC 缺少认证头 | metadata | 检测到 metadata_missing |
| 重试策略不匹配 | retry | 检测到 max_attempts_mismatch 和 initial_backoff_mismatch |

## 使用流程建议

1. **导入服务定义**: 将 `rpc-services.yaml` 和 proto 文件导入系统
2. **创建迁移任务**: 关联老 RPC 服务和对应的 gRPC 服务
3. **准备测试用例**: 定义请求参数、元数据、超时等
4. **运行评审任务**: 系统自动模拟调用并对比
5. **审查差异**: 检查自动检测到的差异
6. **人工确认**: 对差异进行确认（接受/拒绝/忽略）
7. **导出报告**: 生成 Markdown 或 JSON 报告供团队评审

## 适配器配置

### Legacy RPC 适配器配置

```json
{
  "base_url": "http://legacy-api.example.com",
  "timeout_ms": 30000,
  "method_handlers": {
    "GetUser": {
      "latency_ms": 100,
      "response_data": {
        "user_id": "123",
        "username": "test"
      }
    },
    "CreateUser": {
      "should_fail": true,
      "error_code": "ALREADY_EXISTS",
      "error_message": "User already exists"
    }
  }
}
```

### gRPC 适配器配置

```json
{
  "target": "grpc-api.example.com:50051",
  "timeout_ms": 30000,
  "method_handlers": {
    "GetUser": {
      "latency_ms": 50,
      "grpc_code": 0,
      "response_data": {
        "user_id": "123",
        "username": "test"
      }
    }
  }
}
```

## 数据库模型

- **RpcService**: 老 RPC 服务定义
- **RpcMethod**: 老 RPC 方法定义
- **ProtoService**: Proto 服务定义
- **ProtoMethod**: Proto 方法定义
- **ProtoMessage**: Proto 消息定义
- **MigrationTask**: 迁移评审任务
- **MethodMapping**: 方法映射关系
- **ComparisonResult**: 对比结果
- **Difference**: 差异记录
- **ManualConfirmation**: 人工确认记录
- **ExportRecord**: 导出记录
- **BadExample**: 坏样例校验记录

## 注意事项

1. **模拟适配器**: 当前适配器为模拟实现，实际使用时需要替换为真实的 RPC 客户端
2. **数据安全**: SQLite 数据库文件存储在本地，注意敏感信息保护
3. **类型映射**: 对比器内置了基本的类型映射，复杂类型可能需要自定义
4. **自定义对比**: 可以通过扩展 `BaseComparator` 添加新的对比维度

## 许可证

MIT License
