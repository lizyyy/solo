# CDN源站故障切换恢复条件后端API

基于 FastAPI + SQLite 实现的CDN源站故障切换恢复管理系统，支持健康判断、状态机流转、恢复提醒、幂等处理和报告导出。

## 功能特性

- **域名管理**: 主备源站配置、健康检查参数设置
- **切换状态机**: PENDING → SWITCHED → HEALTH_CHECKING → READY_TO_RESTORE → RESTORED → CLOSED
- **健康判断**: 基于阈值的连续健康检查评估
- **幂等处理**: 5分钟内相同创建人+原因的切换请求返回相同记录
- **冲突检测**: 同一域名禁止同时存在多个活跃切换
- **操作审计**: 保留原始输入、处理人、处理结论
- **报告导出**: CSV格式完整切换报告
- **恢复提醒**: 自动检测可恢复的切换记录

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## 造数脚本

创建测试域名和切换记录：

```bash
# 创建域名
curl -X POST "http://localhost:8000/domains/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "cdn.example.com",
    "primary_origin": "primary.example.com",
    "backup_origin": "backup.example.com",
    "health_check_url": "https://primary.example.com/health",
    "health_check_interval": 60,
    "success_threshold": 3,
    "failure_threshold": 3
  }'

# 创建第二个域名
curl -X POST "http://localhost:8000/domains/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_name": "static.example.com",
    "primary_origin": "origin1.static.com",
    "backup_origin": "origin2.static.com"
  }'
```

## CURL 主流程示例

### 完整切换恢复流程

```bash
# 1. 查询域名列表获取domain_id
curl "http://localhost:8000/domains/"

# 2. 创建切换请求（PENDING状态）
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "主源站机房网络故障，丢包率80%",
    "restore_condition": "主源站连续3次健康检查正常，网络延迟<50ms",
    "created_by": "ops_zhang"
  }'

# 3. 执行切换（SWITCHED状态）
curl -X POST "http://localhost:8000/switches/1/execute?operator=ops_zhang"

# 4. 开始健康检查（HEALTH_CHECKING状态）
curl -X POST "http://localhost:8000/switches/1/start-health-check?operator=system"

# 5. 上报健康检查结果（连续3次成功自动变为READY_TO_RESTORE）
for i in 1 2 3; do
  curl -X POST "http://localhost:8000/switches/1/health-checks" \
    -H "Content-Type: application/json" \
    -d "{
      \"target_origin\": \"primary.example.com\",
      \"status\": \"healthy\",
      \"response_time\": 45,
      \"status_code\": 200
    }"
  sleep 1
done

# 6. 查看切换详情（确认状态变为READY_TO_RESTORE）
curl "http://localhost:8000/switches/1"

# 7. 执行恢复（RESTORED状态）
curl -X POST "http://localhost:8000/switches/1/restore?operator=ops_zhang"

# 8. 关闭切换记录（CLOSED状态）
curl -X POST "http://localhost:8000/switches/1/close?operator=ops_zhang&reason=切换恢复流程完成，业务验证正常"

# 9. 导出报告
curl -O -J "http://localhost:8000/switches/1/report/export"
```

### 查询操作

```bash
# 查询所有切换记录
curl "http://localhost:8000/switches/"

# 按域名筛选
curl "http://localhost:8000/switches/?domain_id=1"

# 按状态筛选
curl "http://localhost:8000/switches/?status=switched"

# 获取切换报告
curl "http://localhost:8000/switches/1/report"

# 获取恢复提醒
curl "http://localhost:8000/reminders/restore"
```

## 冲突路径示例

### 1. 重复创建（幂等验证）

```bash
# 第一次创建
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "重复创建测试",
    "restore_condition": "测试",
    "created_by": "test_user"
  }'

# 5分钟内重复相同请求（返回相同ID，实现幂等）
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "重复创建测试",
    "restore_condition": "测试",
    "created_by": "test_user"
  }'
```

### 2. 并发切换冲突（同一域名多活跃切换）

```bash
# 创建第一个切换
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "第一个切换请求",
    "created_by": "user_a"
  }'

# 尝试创建第二个切换（返回409冲突）
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "第二个切换请求",
    "created_by": "user_b"
  }'
```

### 3. 非法状态流转

```bash
# 创建切换（PENDING）
curl -X POST "http://localhost:8000/switches/" \
  -H "Content-Type: application/json" \
  -d '{
    "domain_id": 1,
    "switch_reason": "状态流转测试",
    "created_by": "test_user"
  }'

# 直接尝试恢复（返回400，状态机不允许 PENDING → RESTORED）
curl -X POST "http://localhost:8000/switches/1/restore?operator=test_user"
```

### 4. 人工修正（强制状态流转）

```bash
# 人工修正状态，绕过状态机限制
curl -X POST "http://localhost:8000/switches/1/correct" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "closed",
    "operator": "super_admin",
    "reason": "紧急情况，需要强制关闭",
    "original_input": "线上告警，人工介入处理"
  }'
```

### 5. 撤回操作

```bash
# 创建切换后撤回
curl -X POST "http://localhost:8000/switches/1/cancel?operator=test_user&reason=误操作，不需要切换"
```

## Pytest 测试

### 运行所有测试

```bash
pytest test_main.py -v
```

### 运行特定测试

```bash
# 主流程测试
pytest test_main.py::test_happy_path_full_flow -v

# 幂等测试
pytest test_main.py::test_idempotency_same_switch -v

# 冲突测试
pytest test_main.py::test_concurrent_switch_conflict -v

# 状态流转测试
pytest test_main.py::test_invalid_status_transition -v
```

### 测试覆盖率

```bash
pytest test_main.py -v --cov=. --cov-report=html
```

## 状态机流转图

```
PENDING ──┬──→ SWITCHED ─────┬──→ HEALTH_CHECKING ─────┬──→ READY_TO_RESTORE ──→ RESTORED ──→ CLOSED
          │                   │                          │
          └──→ CANCELLED      └──→ CLOSED                └──→ SWITCHED
                                                          └──→ CLOSED

CANCELLED: 终态，不可再流转
CLOSED: 终态，不可再流转
```

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /domains/ | 创建域名 |
| GET | /domains/ | 域名列表 |
| GET | /domains/{id} | 域名详情 |
| POST | /switches/ | 创建切换 |
| GET | /switches/ | 切换列表 |
| GET | /switches/{id} | 切换详情 |
| POST | /switches/{id}/execute | 执行切换 |
| POST | /switches/{id}/start-health-check | 开始健康检查 |
| POST | /switches/{id}/health-checks | 上报健康检查 |
| POST | /switches/{id}/restore | 执行恢复 |
| POST | /switches/{id}/correct | 人工修正 |
| POST | /switches/{id}/cancel | 撤回切换 |
| POST | /switches/{id}/close | 关闭切换 |
| GET | /switches/{id}/report | 切换报告 |
| GET | /switches/{id}/report/export | 导出报告 |
| GET | /reminders/restore | 恢复提醒 |
| GET | /health | 服务健康检查 |

## 项目结构

```
.
├── main.py              # FastAPI 主应用
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据结构
├── services.py          # 核心业务逻辑
├── database.py          # 数据库配置
├── test_main.py         # pytest 测试用例
├── requirements.txt     # 依赖列表
└── README.md           # 项目文档
```