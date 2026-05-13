# 配置灰度快照服务 (Config Gray Snapshot Service)

基于 Flask + SQLAlchemy 的本地后端服务，用于管理配置版本的灰度发布、命中评估、回滚控制和审计追踪。

## 核心功能

### 数据模型
- **ConfigVersion**: 配置版本管理
- **GrayCondition**: 灰度命中条件（支持表达式）
- **ReleaseBatch**: 发布批次（DRAFT → PENDING → RUNNING → PAUSED → COMPLETED/ROLLED_BACK）
- **HitSample**: 命中样本记录
- **RollbackPoint**: 回滚快照点
- **QueryToken**: 查询凭证（带权限和过期时间）
- **AuditLog**: 完整操作审计日志

### 业务规则
1. **快照保存**: 创建回滚点时自动保存状态快照
2. **命中解释**: 条件匹配 + 百分比阈值，返回命中原因
3. **批次发布**: 状态机控制发布流程，支持灰度比例调整
4. **回滚校验**: 回滚点一次性使用，回滚后标记样本无效
5. **查询审计**: 所有操作记录审计日志，支持凭证访问

### API 接口
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/configs | 创建配置版本 |
| POST | /api/v1/configs/{key}/conditions | 创建灰度条件 |
| POST | /api/v1/batches | 创建发布批次 |
| PUT | /api/v1/batches/{key}/status | 更新批次状态 |
| POST | /api/v1/batches/{key}/evaluate | 评估灰度命中 |
| POST | /api/v1/batches/{key}/rollback-points | 创建回滚点 |
| POST | /api/v1/rollbacks/{key}/execute | 执行回滚 |
| POST | /api/v1/tokens | 创建查询凭证 |
| GET | /api/v1/batches/{key}/history | 查询批次完整历史 |
| GET | /api/v1/health | 健康检查 |

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python run.py
```

服务将在 `http://localhost:5000` 启动

### 3. 运行集成测试
```bash
python tests/test_workflow.py
```

测试包含 4 个场景：
- ✅ 成功的灰度发布完整流程
- ✅ 发布异常时的回滚流程
- ✅ 边界情况和异常处理
- ✅ 数据持久化验证

## 使用示例

### 创建配置版本
```bash
curl -X POST http://localhost:5000/api/v1/configs \
  -H "Content-Type: application/json" \
  -d '{
    "config_name": "payment-service",
    "config_content": {"timeout": 30, "feature_flag": true},
    "version": "v2.1.0",
    "created_by": "engineer_zhang"
  }'
```

### 创建灰度条件
```bash
curl -X POST http://localhost:5000/api/v1/configs/{version_key}/conditions \
  -H "Content-Type: application/json" \
  -d '{
    "condition_type": "user_attribute",
    "condition_expression": "$is_vip == True",
    "created_by": "engineer_zhang",
    "description": "VIP 用户优先体验"
  }'
```

### 创建发布批次
```bash
curl -X POST http://localhost:5000/api/v1/batches \
  -H "Content-Type: application/json" \
  -d '{
    "version_key": "{version_key}",
    "batch_name": "gray-batch-001",
    "target_percentage": 50,
    "created_by": "release_manager"
  }'
```

### 推进发布状态
```bash
curl -X PUT http://localhost:5000/api/v1/batches/{batch_key}/status \
  -H "Content-Type: application/json" \
  -d '{
    "new_status": "running",
    "updated_by": "release_manager",
    "current_percentage": 30
  }'
```

### 评估灰度命中
```bash
curl -X POST http://localhost:5000/api/v1/batches/{batch_key}/evaluate \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "user_1001",
    "user_attributes": {"is_vip": true, "region": "beijing"}
  }'
```

## 技术特性

### 幂等性保证
- 重复提交同一用户命中请求不会创建脏数据
- 返回 `already_hit: true` 标记

### 数据持久化
- SQLite 数据库存储在 `data/gray_snapshot.db`
- 重启服务后所有状态、样本、审计日志完整保留

### 条件表达式
支持简单的表达式语法：
- `$is_vip == True`
- `$region == 'beijing'`
- `$level >= 5`

### 状态流转校验
```
DRAFT → PENDING → RUNNING ↔ PAUSED
                    ↓
               COMPLETED / ROLLED_BACK
```
无效状态转换返回 400 错误。

## 目录结构
```
config_gray_snapshot_service/
├── app/
│   ├── __init__.py      # Flask 应用工厂
│   ├── models.py        # 数据模型定义
│   ├── services.py      # 核心业务逻辑
│   └── routes.py        # API 路由
├── tests/
│   └── test_workflow.py # 集成测试脚本
├── data/                # 数据库文件目录
├── requirements.txt     # 依赖声明
├── run.py              # 启动入口
└── README.md
```
