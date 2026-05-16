# 租户数据迁移护栏API

本地可运行的租户数据迁移护栏服务，提供迁移状态机、重复执行保护、数据校验、回滚点、异常处理和迁移报告导出功能。

## 功能特性

- **迁移阶段状态机**: 9个标准迁移阶段，严格的状态流转控制
- **重复执行保护**: 防止同一阶段重复推进导致数据脏写
- **异常处理**: 保留原始输入、处理上下文和最终结论
- **人工修正**: 支持人工干预，强制跳转到指定阶段
- **回滚点管理**: 关键阶段创建回滚快照点
- **数据校验**: 内置校验结果记录机制
- **迁移报告**: 完整的迁移过程导出报告

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 启动服务

```bash
# 方式1: 使用启动脚本
chmod +x start.sh
./start.sh

# 方式2: 直接运行
python main.py
```

服务启动后访问: http://localhost:8000/docs 查看API文档

### 运行测试

```bash
pytest test_migration.py -v
```

## API 接口

### 1. 创建迁移

```http
POST /api/migrations
Content-Type: application/json

{
    "tenant_id": "T001",
    "source_region": "beijing",
    "target_region": "shanghai",
    "created_by": "admin",
    "remarks": "租户T001迁移项目"
}
```

### 2. 查询迁移

```http
# 查询单个迁移
GET /api/migrations/{migration_id}

# 列表查询
GET /api/migrations?tenant_id=T001&active_only=true
```

### 3. 推进阶段

```http
POST /api/migrations/{migration_id}/advance
Content-Type: application/json

{
    "operator": "admin",
    "force": false,
    "validation_results": [...]
}
```

**重复执行保护**: 同一阶段处于IN_PROGRESS状态时，再次调用advance会失败，除非设置`force=true`

### 4. 完成阶段

```http
POST /api/migrations/{migration_id}/complete?status=success&operator=admin
```

### 5. 异常上报

```http
POST /api/migrations/{migration_id}/exceptions
Content-Type: application/json

{
    "error_type": "DatabaseError",
    "error_message": "Connection timeout",
    "raw_input": {"host": "db01", "port": 5432},
    "processing_context": {"timeout": 30},
    "operator": "admin"
}
```

### 6. 异常解决

```http
POST /api/migrations/{migration_id}/exceptions/{exception_id}/resolve?resolution=已修复网络&operator=admin
```

### 7. 人工修正

```http
POST /api/migrations/{migration_id}/manual-correction
Content-Type: application/json

{
    "resolution": "跳过预检，紧急修复中",
    "operator": "admin",
    "target_phase": "data_backup",
    "new_status": "in_progress"
}
```

### 8. 创建回滚点

```http
POST /api/migrations/{migration_id}/rollback-points?description=导出前快照&backup_location=s3://backup/snap123
```

### 9. 获取迁移摘要

```http
GET /api/migrations/{migration_id}/summary
```

### 10. 导出迁移报告

```http
GET /api/migrations/{migration_id}/export
```

下载JSON格式的完整迁移报告，包含：
- 迁移摘要信息
- 各阶段详细记录（含执行时长）
- 所有异常记录（原始输入、上下文、解决记录）
- 回滚点列表
- 人工修正历史

## 迁移阶段

| 阶段 | 说明 |
|------|------|
| initialized | 迁移初始化（自动完成） |
| pre_check | 迁移前置检查 |
| data_backup | 源数据备份 |
| data_export | 数据导出 |
| data_import | 数据导入 |
| data_validation | 数据校验 |
| switch_traffic | 流量切换 |
| post_cleanup | 后置清理 |
| completed | 迁移完成 |
| failed | 迁移失败 |
| rollback | 回滚中 |

## 项目结构

```
.
├── main.py              # FastAPI应用入口
├── models.py            # 数据模型定义
├── service.py           # 核心业务逻辑
├── test_migration.py    # 单元测试
├── requirements.txt     # 依赖列表
├── start.sh             # 启动脚本
└── README.md            # 项目文档
```

## 验收场景

### 场景1: 正常创建和查询

```bash
# 创建迁移
curl -X POST http://localhost:8000/api/migrations \
  -H "Content-Type: application/json" \
  -d '{"tenant_id":"T001","source_region":"beijing","target_region":"shanghai"}'

# 查询迁移
curl http://localhost:8000/api/migrations/{migration_id}
```

### 场景2: 重复执行保护

```bash
# 第一次推进（成功）
curl -X POST http://localhost:8000/api/migrations/{migration_id}/advance

# 第二次推进（失败 - 已在进行中）
curl -X POST http://localhost:8000/api/migrations/{migration_id}/advance
# 返回: 400 Bad Request - "Phase pre_check is already in progress"

# 强制推进（需要force=true）
curl -X POST http://localhost:8000/api/migrations/{migration_id}/advance \
  -H "Content-Type: application/json" \
  -d '{"force": true}'
```

### 场景3: 导出异常报告

```bash
# 上报异常
curl -X POST http://localhost:8000/api/migrations/{migration_id}/exceptions \
  -H "Content-Type: application/json" \
  -d '{"error_type":"DBError","error_message":"连接超时","raw_input":{"host":"db01"}}'

# 导出报告
curl http://localhost:8000/api/migrations/{migration_id}/export
```
