# 契约样例漂移 API

用于解决联调群里"响应样例到底是不是最新"的争议问题，追踪接口契约变更导致的样例漂移。

## 技术栈
- Go 1.x
- SQLite（本地持久化）
- Gorilla Mux（路由）

## 核心功能

### 数据模型
1. **接口契约 (Contract)** - 接口定义、JSON Schema、版本
2. **样例载荷 (Sample)** - 响应/请求样例、来源、哈希去重
3. **字段解释 (FieldExplanation)** - 字段类型、必填性、备注
4. **消费方 (Consumer)** - 下游服务、版本
5. **确认记录 (Confirmation)** - 消费方对样例的确认
6. **漂移记录 (DriftRecord)** - 字段漂移类型、期望值、实际值
7. **异常记录 (ExceptionRecord)** - 异常路径的原始输入和处理结论

### 检测规则
- 字段类型不匹配
- 必填字段缺失
- 额外字段出现
- 枚举值非法
- 数组项类型不一致
- 重复样例幂等拦截

## 快速开始

### 1. 安装依赖
```bash
go mod tidy
```

### 2. 启动服务
```bash
go run main.go
```
服务将在 `http://localhost:8080` 启动

### 3. 初始化样例数据（新开一个终端）
```bash
go run scripts/init_data.go
```

## API 接口一览

### 契约管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/contracts` | 创建契约 |
| GET | `/api/v1/contracts` | 查询所有契约 |
| GET | `/api/v1/contracts/{id}` | 查询单个契约 |

### 样例管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/samples` | 导入样例（自动去重） |
| GET | `/api/v1/samples` | 查询所有样例 |
| GET | `/api/v1/samples?contract_id={id}` | 按契约查询样例 |
| POST | `/api/v1/samples/{id}/analyze` | 分析样例漂移 |

### 漂移管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/drifts` | 查询所有漂移记录 |
| GET | `/api/v1/drifts?contract_id={id}` | 按契约查询漂移 |
| GET | `/api/v1/drifts?status={open/resolved}` | 按状态查询 |
| POST | `/api/v1/drifts/{id}/confirm` | 确认漂移 |
| POST | `/api/v1/drifts/{id}/resolve` | 标记已解决 |

### 消费方管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/consumers` | 注册消费方 |
| GET | `/api/v1/consumers` | 查询所有消费方 |
| POST | `/api/v1/consumers/{id}/confirm` | 消费方确认样例 |

### 报告导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/reports/drift/{contract_id}` | 导出漂移统计报告 |
| GET | `/api/v1/reports/full/{contract_id}` | 导出完整报告 |

### 异常处理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/exceptions` | 查询所有异常记录 |
| GET | `/api/v1/exceptions/{id}` | 查询单个异常 |
| POST | `/api/v1/exceptions/{id}/fix` | 标记已修复 |

## CURL 示例

### 创建契约
```bash
curl -X POST http://localhost:8080/api/v1/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "user_info",
    "version": "v1.0.0",
    "method": "GET",
    "path": "/api/v1/users/{id}",
    "schema": {
      "type": "object",
      "properties": {
        "id": {"type": "string"},
        "name": {"type": "string"},
        "email": {"type": "string"}
      },
      "required": ["id", "name"]
    },
    "description": "用户信息查询接口"
  }'
```

### 导入样例
```bash
curl -X POST http://localhost:8080/api/v1/samples \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": 1,
    "payload": {
      "id": "U001",
      "name": "张三",
      "email": "zhangsan@example.com"
    },
    "source": "test_log_20240515"
  }'
```

### 分析样例漂移
```bash
curl -X POST http://localhost:8080/api/v1/samples/1/analyze
```

### 查询漂移记录
```bash
curl http://localhost:8080/api/v1/drifts?contract_id=1&status=open
```

### 导出漂移报告
```bash
curl http://localhost:8080/api/v1/reports/drift/1
```

### 消费方确认样例
```bash
curl -X POST http://localhost:8080/api/v1/consumers/1/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "sample_id": 2,
    "status": "acknowledged",
    "comment": "确认漂移，计划下版本修复"
  }'
```

## 被规则拦截的路径演示

### 1. 重复导入相同样例（幂等拦截）
```bash
# 第一次导入成功
curl -X POST http://localhost:8080/api/v1/samples \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": 1,
    "payload": {"user_id": "U123", "order_id": "ORD001", "amount": 100},
    "source": "test1"
  }'

# 第二次导入相同 payload，被幂等拦截
curl -X POST http://localhost:8080/api/v1/samples \
  -H "Content-Type: application/json" \
  -d '{
    "contract_id": 1,
    "payload": {"user_id": "U123", "order_id": "ORD001", "amount": 100},
    "source": "test2"
  }'
# 返回: {"id":1,"message":"duplicate sample, returning existing record"}
```

### 2. 相同契约版本重复创建（唯一性约束）
```bash
curl -X POST http://localhost:8080/api/v1/contracts \
  -H "Content-Type: application/json" \
  -d '{
    "name": "order_create",
    "version": "v1.0.0",
    "method": "POST",
    "path": "/api/v1/orders"
  }'
# 第二次返回: contract with same name and version already exists (HTTP 409)
```

### 3. 消费方重复确认相同样例
```bash
curl -X POST http://localhost:8080/api/v1/consumers/1/confirm \
  -H "Content-Type: application/json" \
  -d '{"sample_id": 2, "status": "confirmed"}'
# 第二次返回: sample already confirmed by this consumer (HTTP 409)
```

### 4. 查看异常记录（所有拦截路径都留痕）
```bash
curl http://localhost:8080/api/v1/exceptions
```

## 漂移类型说明

| 类型 | 说明 | 严重程度 |
|------|------|----------|
| `missing_required_field` | 必填字段缺失 | high |
| `type_mismatch` | 字段类型不匹配 | high |
| `enum_value_violation` | 枚举值非法 | high |
| `extra_field` | 出现额外字段 | medium |
| `array_item_type_mismatch` | 数组项类型不一致 | medium |

## 数据存储

数据存储在当前目录的 `contract_drift.db` SQLite 文件中。

数据库表结构:
- `contracts` - 契约表
- `samples` - 样例表（含 SHA256 哈希去重）
- `field_explanations` - 字段解释表
- `consumers` - 消费方表
- `confirmations` - 确认记录表
- `drift_records` - 漂移记录表
- `exception_records` - 异常记录表

## 典型工作流

1. **开发联调阶段**
   - 开发人员导入接口契约
   - 自动化测试脚本导入样例
   - 系统自动分析漂移

2. **争议排查阶段**
   - 查询某契约下的所有漂移记录
   - 查看漂移的字段、期望值、实际值
   - 查看异常记录中的原始输入

3. **消费方确认阶段**
   - 下游服务注册为消费方
   - 消费方确认收到漂移通知
   - 记录修复计划

4. **报告阶段**
   - 导出漂移统计报告
   - 按严重程度排序
   - 跟踪解决进度
