# 预览环境租约API

本地可运行的预览环境租约管理REST API，用于解决测试环境被临时预览分支占满后，大家不知道哪些环境还能续租、哪些该释放的问题。

## 技术栈

- Python 3.x
- FastAPI - REST API 框架
- SQLAlchemy - ORM
- SQLite - 本地持久化存储
- Pydantic - 数据验证

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据（可选）

```bash
python init_sample_data.py
```

### 3. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 5. 运行自检测试

```bash
python test_lease_api.py
```

## 核心功能

### 数据模型

- **租约 (Lease)**: 分支名称、环境编号、占用人、租约时间、续租理由、状态
- **释放日志 (ReleaseLog)**: 释放人、释放理由、是否强制释放
- **审计日志 (AuditLog)**: 操作类型、原始输入、处理结论、操作人、是否成功

### 核心规则

1. **租约过期判断**: 自动检测并标记过期租约
2. **续租冲突检测**: 同一环境在重叠时间段内不能有多个租约
3. **强制释放**: 管理员可强制释放任何租约
4. **重复请求幂等**: 通过 `request_id` 保证重复请求不会重复创建
5. **占用报表**: 按环境、按人统计占用情况

## API 接口

### 租约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/leases/` | 创建租约 |
| GET | `/leases/{lease_id}` | 获取租约详情 |
| GET | `/leases/` | 查询租约列表（支持按分支、环境、占用人、状态筛选） |
| PUT | `/leases/{lease_id}/renew` | 续租/更新租约 |
| POST | `/leases/{lease_id}/release` | 释放租约（支持强制释放） |
| PUT | `/leases/{lease_id}/correct` | 人工修正租约 |
| POST | `/leases/recalculate` | 批量重新计算租约状态 |

### 报表与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/report/occupancy` | 获取占用报表 |
| GET | `/report/export` | 导出租约CSV |
| GET | `/audit-logs/` | 获取审计日志 |

### 其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |

## 典型使用场景

### 1. 创建租约

```bash
curl -X POST "http://localhost:8000/leases/" \
  -H "Content-Type: application/json" \
  -d '{
    "branch_name": "feature/new-feature",
    "env_id": "preview-01",
    "assignee": "developer.name",
    "lease_start": "2024-01-01T00:00:00",
    "lease_end": "2024-01-07T23:59:59",
    "renew_reason": "新功能联调测试",
    "request_id": "req-20240101-001"
  }'
```

### 2. 查询可续租环境

```bash
# 查询某个环境的所有租约
curl "http://localhost:8000/leases/?env_id=preview-01"

# 只看活跃租约
curl "http://localhost:8000/leases/?only_active=true"
```

### 3. 续租租约

```bash
curl -X PUT "http://localhost:8000/leases/1/renew" \
  -H "Content-Type: application/json" \
  -d '{
    "lease_end": "2024-01-14T23:59:59",
    "renew_reason": "延长测试时间，还需3天联调"
  }'
```

### 4. 管理员强制释放

```bash
curl -X POST "http://localhost:8000/leases/1/release" \
  -H "Content-Type: application/json" \
  -d '{
    "released_by": "admin",
    "release_reason": "环境资源回收",
    "force": true
  }'
```

### 5. 获取占用报表

```bash
curl "http://localhost:8000/report/occupancy"
```

## 测试覆盖

- ✅ 正常创建租约流程
- ✅ 重复请求幂等性
- ✅ 租约冲突检测
- ✅ 脏数据处理（无效时间）
- ✅ 租约过期自动标记
- ✅ 续租租约
- ✅ 正常释放租约
- ✅ 强制释放租约
- ✅ 人工修正租约
- ✅ 人工修正后重新计算状态
- ✅ 占用报表生成
- ✅ 审计日志记录
- ✅ 查询过滤器功能

## 目录结构

```
.
├── database.py           # 数据库配置
├── models.py             # 数据模型定义
├── schemas.py            # Pydantic 数据验证模式
├── services.py           # 核心业务逻辑
├── main.py               # FastAPI 主应用 & REST 接口
├── init_sample_data.py   # 样例数据初始化
├── test_lease_api.py     # 单元测试 & 自检脚本
├── requirements.txt      # Python 依赖
└── README.md             # 说明文档
```

## 异常处理

所有异常路径都会记录审计日志，包含：
- 原始请求输入
- 处理失败原因
- 操作人信息
- 时间戳
