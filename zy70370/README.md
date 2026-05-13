# 服务目录健康 API

## 项目概述

服务目录健康 API 是一个用于管理和监控微服务架构的健康状况的系统。它帮助平台团队跟踪服务的负责人、代码仓库、依赖关系、健康状态和下线计划，从而推动有效的服务治理。

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

### 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 核心功能

### 1. 服务管理

- **登记服务**: POST `/services`
- **查询服务**: GET `/services/{service_identifier}` （支持服务ID或服务名）
- **更新服务**: PUT `/services/{service_identifier}`
- **删除服务**: DELETE `/services/{service_identifier}`
- **列出服务**: GET `/services` （支持按状态和环境过滤）

### 2. 依赖管理

- **添加依赖**: POST `/services/{service_identifier}/dependencies`
- **移除依赖**: DELETE `/services/{service_identifier}/dependencies/{dependency_name}`
- **依赖拓扑**: GET `/dashboard/topology`

### 3. 健康检查

- **报告健康状态**: POST `/health-check`
- **查询服务健康**: GET `/services/{service_identifier}/health`

### 4. 治理仪表盘

- **完整度报告**: GET `/dashboard/completeness`
- **风险汇总**: GET `/dashboard/risks`
- **依赖拓扑**: GET `/dashboard/topology`

## 风险规则引擎

系统自动检测以下风险并打标签：

| 风险标签 | 风险等级 | 触发条件 |
|---------|---------|---------|
| `owner_inactive` | HIGH | 负责人状态为非活跃 |
| `missing_repository` | MEDIUM | 缺少代码仓库地址 |
| `dependency_offline` | CRITICAL | 依赖的服务已下线 |
| `dependency_deprecated` | HIGH | 依赖的服务已弃用 |
| `health_failing` | HIGH | 健康检查连续失败 |
| `deprecated_with_callers` | CRITICAL | 服务已弃用但仍有调用方 |
| `pending_deletion_with_callers` | CRITICAL | 服务申请下线但仍被调用 |
| `no_health_check` | MEDIUM | 缺少健康检查配置 |
| `deletion_overdue` | HIGH | 超过计划下线日期但仍在运行 |

## 服务状态流转

```
ACTIVE → DEPRECATED → PENDING_DELETION → OFFLINE
  ↓           ↓                ↓
  自动      连续健康       用户主动
标记正常    检查失败      申请下线
```

## 完整度统计

完整度评分基于以下三个关键指标：
1. **负责人完整**: 有活跃的负责人
2. **仓库完整**: 有有效的代码仓库地址
3. **监控完整**: 配置了健康检查端点

完整度得分 = (完整服务数 / 总服务数) × 100

---

## 补充说明

### 一、主要边界（Scope Boundaries）

#### 1. 数据存储边界
- **当前实现**: 内存存储（`services_db` 和 `service_name_index` 字典）
- **边界**: 
  - 服务重启后数据丢失
  - 不支持分布式部署
  - 不适合生产环境长期使用
- **预期扩展**: 需要迁移到持久化存储（如 PostgreSQL、MySQL 或 Redis）

#### 2. 服务标识符边界
- **支持两种识别方式**:
  - `service_id`: UUID 格式，全局唯一
  - `服务名称`: 人类可读，全局唯一
- **边界**:
  - 服务名称一旦创建可以修改，但必须保持唯一性
  - 依赖关系使用服务名称建立，而非 service_id
  - 删除服务时会自动清理名称索引

#### 3. 依赖关系边界
- **支持的关系类型**: 单向依赖（A 依赖 B）
- **自动维护**:
  - 添加依赖时，被依赖服务的 `dependents` 列表自动更新
  - 删除服务时，会检查是否有依赖方
  - 移除依赖时，双向关系同时清理
- **边界**:
  - 不支持循环依赖检测（显式设计，允许微服务间的循环调用）
  - 不支持依赖版本管理
  - 不支持运行时依赖的动态发现

#### 4. 健康检查边界
- **当前模式**: 被动报告模式
- **边界**:
  - API 只接收健康检查报告，不主动探测服务
  - 健康检查失败次数由调用方控制报告频率
  - 连续失败阈值可配置（`max_allowed_failures`）
  - 连续失败达到阈值后自动标记为 `DEPRECATED`

#### 5. 风险评估边界
- **计算时机**: 查询时实时计算
- **边界**:
  - 不做后台异步风险扫描
  - 风险标签是动态的，不持久化
  - 风险等级是静态映射，不支持权重配置

#### 6. 服务删除边界
- **保护机制**:
  - 如果服务仍有依赖方（`dependents` 非空），禁止删除
  - 删除前必须先解除所有依赖关系
- **边界**:
  - 不支持级联删除
  - 不支持软删除（删除后数据立即清除）

---

### 二、一个失败路径（Failure Path）

#### 场景: "服务申请下线但仍被依赖"

**路径描述**: 
服务 A 计划下线，但服务 B 仍在依赖它。如果平台团队没有及时发现这个依赖关系，直接下线服务 A，将导致服务 B 出现故障。

**具体步骤**:

1. **初始状态**
   - 服务 A（order-service）: 状态为 ACTIVE
   - 服务 B（payment-service）: 状态为 ACTIVE，依赖服务 A
   - 依赖关系: payment-service → order-service

2. **服务 A 申请下线**
   ```bash
   curl -X PUT "http://localhost:8000/services/order-service" \
     -H "Content-Type: application/json" \
     -d '{
       "status": "pending_deletion",
       "deletion_date": "2026-06-01"
     }'
   ```

3. **此时的风险状态**
   - 系统自动检测到风险: `pending_deletion_with_callers`
   - 风险等级: CRITICAL
   - 描述: "服务申请下线但仍被 1 个服务调用"

4. **失败场景 1: 未处理风险直接下线**
   ```bash
   # 尝试直接删除（会被系统阻止）
   curl -X DELETE "http://localhost:8000/services/order-service"
   # 响应: 400 Bad Request - "服务仍被其他服务依赖: ['payment-service']"
   ```

5. **失败场景 2: 强制下线（绕过 API 直接操作）**
   - 如果通过后台操作直接将服务 A 状态改为 `OFFLINE`
   - 服务 B 调用服务 A 时失败
   - 服务 B 的健康检查开始失败
   - 级联故障扩散到依赖服务 B 的其他服务

6. **系统保护机制**
   ```bash
   # 查询服务 A 的健康报告
   curl -s "http://localhost:8000/services/order-service/health" | python3 -m json.tool
   ```
   
   **响应中会包含**:
   ```json
   {
     "risk_tags": [
       {
         "tag": "pending_deletion_with_callers",
         "level": "critical",
         "description": "服务申请下线但仍被 1 个服务调用",
         "affected_services": ["order-service"]
       }
     ]
   }
   ```

7. **正确的处理路径**
   - 通知服务 B 的负责人迁移
   - 服务 B 移除对服务 A 的依赖
   - 等待服务 B 完成迁移
   - 确认没有依赖方后再下线服务 A

---

### 三、一次重复执行路径（Repeatable Execution Path）

#### 场景: "健康检查连续失败"

**路径描述**: 
服务的健康检查连续多次报告失败，系统自动将服务标记为弃用状态。这个过程是可重复的、幂等的。

**步骤分解**:

#### 第 1 次执行: 服务健康状态正常

```bash
# 1. 创建服务
curl -X POST "http://localhost:8000/services" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "demo-service",
    "owner": {
      "name": "测试负责人",
      "email": "test@example.com",
      "is_active": true
    },
    "repository_url": "https://github.com/example/demo",
    "environment": "production",
    "health_check_endpoint": "/health",
    "max_allowed_failures": 3
  }'

# 2. 报告健康状态
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "healthy"
  }'

# 3. 检查服务状态
# 预期: status = "active", consecutive_health_failures = 0
```

#### 第 2 次执行: 第 1 次健康检查失败

```bash
# 报告第 1 次失败
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "unhealthy",
    "details": "数据库连接超时"
  }'

# 检查状态
# 预期: 
#   health_status = "unhealthy"
#   consecutive_health_failures = 1
#   status = "active" (尚未达到阈值)
#   risk_tags: ["health_failing"]
```

#### 第 3 次执行: 第 2 次健康检查失败

```bash
# 报告第 2 次失败
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "unhealthy",
    "details": "数据库连接超时"
  }'

# 检查状态
# 预期:
#   consecutive_health_failures = 2
#   status = "active"
#   risk_tags: ["health_failing"] (描述更新为 "连续失败 2 次")
```

#### 第 4 次执行: 第 3 次健康检查失败（达到阈值）

```bash
# 报告第 3 次失败
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "unhealthy",
    "details": "数据库连接超时"
  }'

# 检查状态
# 预期:
#   consecutive_health_failures = 3
#   status = "deprecated" (自动降级！)
#   risk_tags: 
#     - "health_failing" (连续失败 3 次)
#     - 如果有依赖方，还会有 "deprecated_with_callers"
```

#### 第 5 次执行: 连续失败超过阈值

```bash
# 报告第 4 次失败
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "unhealthy",
    "details": "数据库连接超时"
  }'

# 检查状态
# 预期:
#   consecutive_health_failures = 4
#   status = "deprecated" (保持弃用状态)
#   状态不会进一步自动降级
```

#### 第 6 次执行: 服务恢复（幂等性验证）

```bash
# 报告健康
curl -X POST "http://localhost:8000/health-check" \
  -H "Content-Type: application/json" \
  -d '{
    "service_id": "<service_id>",
    "status": "healthy"
  }'

# 检查状态
# 预期:
#   consecutive_health_failures = 0 (重置！)
#   health_status = "healthy"
#   status = "deprecated" (注意: 状态需要人工恢复)
#   risk_tags: 不再包含 "health_failing"
```

#### 第 7 次执行: 再次失败（验证可重复性）

```bash
# 连续报告 3 次失败
for i in 1 2 3; do
  curl -X POST "http://localhost:8000/health-check" \
    -H "Content-Type: application/json" \
    -d '{
      "service_id": "<service_id>",
      "status": "unhealthy"
    }'
done

# 预期:
#   consecutive_health_failures 从 0 重新计数
#   达到 3 次后，即使已经是 deprecated 状态，行为保持一致
#   整个流程完全可重复
```

**关键特性**:
- **幂等性**: 相同的操作可以重复执行，结果一致
- **状态机清晰**: 失败计数和服务状态有明确的转换规则
- **可预测**: 每次执行的结果都可以根据输入准确预测
- **可恢复**: 服务恢复后计数器重置，流程可以重新开始

---

## API 端点速查

### 服务管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/services` | 创建新服务 |
| GET | `/services` | 列出所有服务 |
| GET | `/services/{id_or_name}` | 获取服务详情 |
| PUT | `/services/{id_or_name}` | 更新服务 |
| DELETE | `/services/{id_or_name}` | 删除服务 |

### 依赖管理
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/services/{id}/dependencies` | 添加依赖 |
| DELETE | `/services/{id}/dependencies/{dep}` | 移除依赖 |

### 健康检查
| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/health-check` | 报告健康状态 |
| GET | `/services/{id}/health` | 获取服务健康报告 |

### 仪表盘
| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/dashboard/completeness` | 完整度报告 |
| GET | `/dashboard/risks` | 风险汇总 |
| GET | `/dashboard/topology` | 依赖拓扑 |
| GET | `/health` | API 自身健康检查 |

## 运行示例脚本

```bash
# 先启动服务
python main.py

# 在另一个终端运行示例
chmod +x examples.sh
./examples.sh
```

## 生产环境注意事项

1. **数据持久化**: 当前实现使用内存存储，生产环境需要替换为数据库
2. **认证授权**: 添加 API 认证和权限控制
3. **审计日志**: 记录所有变更操作
4. **通知集成**: 风险触发时自动通知相关负责人
5. **定期扫描**: 添加后台任务定期检查服务状态
6. **数据备份**: 定期备份服务目录数据
