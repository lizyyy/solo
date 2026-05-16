# 多租户密钥托管API

## 功能概述

本系统为多租户环境设计，提供完整的密钥生命周期管理，包括：

- **版本托管**：密钥版本自动生成，状态流转控制
- **引用追踪**：记录数据批次与密钥的关联关系，支持重复引用计数
- **轮换审批**：状态变更需审批，支持完整的审计日志
- **停用保护**：受保护密钥停用需提供理由，防止误操作
- **报告导出**：生成完整托管报告，包含密钥统计和操作审计

## 核心数据模型

### 1. 租户密钥 (TenantKey)
- `tenant_id`: 租户标识
- `key_version`: 密钥版本号 (自动生成)
- `purpose`: 用途 (DATA_ENCRYPTION/BACKUP/SIGNING)
- `status`: 状态 (PENDING/ACTIVE/ROTATING/DEPRECATED/DEACTIVATED)
- `encryption_material`: 密钥材料
- `is_protected`: 保护标志
- `metadata`: 扩展属性

### 2. 密钥引用 (KeyReference)
- `tenant_id`: 租户标识
- `key_version`: 密钥版本
- `data_batch_id`: 数据批次ID
- `reference_count`: 引用计数 (幂等性支持)
- `referenced_at`: 引用时间

### 3. 操作日志 (OperationLog)
- `operation_type`: 操作类型
- `tenant_id`: 租户标识
- `raw_input`: 原始输入 (保留)
- `processing_rules`: 处理依据 (保留)
- `conclusion`: 最终结论
- `success`: 是否成功
- `operator`: 操作人

### 4. 托管报告 (EscrowReport)
- `report_id`: 报告ID
- `tenant_id`: 租户标识
- `content`: 报告内容 (密钥统计+引用分析+操作审计)
- `generated_at`: 生成时间

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/v1/keys | 创建密钥 |
| POST | /api/v1/keys/query | 查询密钥 |
| POST | /api/v1/keys/reference | 记录密钥引用 |
| POST | /api/v1/keys/status | 推进密钥状态 |
| POST | /api/v1/keys/correct | 人工修正密钥 |
| POST | /api/v1/reports/export | 导出托管报告 |
| GET | /api/v1/logs/{tenant_id} | 查询操作日志 |
| GET | /api/v1/references/{tenant_id} | 查询引用记录 |
| GET | /health | 健康检查 |

## 状态流转图

```
PENDING → ACTIVE → ROTATING → DEPRECATED → DEACTIVATED
   │         │          │           │
   └─────────┴──────────┴───────────┘→ DEACTIVATED (紧急停用)
```

## 关键规则

1. **幂等性保证**：相同数据批次重复引用自动累加计数
2. **审批要求**：PENDING→ACTIVE状态转换必须提供审批人
3. **停用保护**：受保护且有引用的密钥停用必须提供理由
4. **字段保护**：人工修正仅允许修改指定字段
5. **审计完整**：所有操作(成功/失败)均记录原始输入、处理规则和结论

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行测试

#### 1. 服务层业务逻辑测试 (5/5)
```bash
python test_escrow.py
```
- ✅ 正常流程：完整密钥生命周期验证
- ✅ 脏数据处理：边界情况和异常输入处理
- ✅ 重复请求：幂等性和计数逻辑验证
- ✅ 人工修正：字段更新、报告重计算、审计日志
- ✅ 租户隔离：多租户数据完全隔离

#### 2. FastAPI接口集成测试 (10/10)
```bash
python test_api_integration.py
```
使用 `TestClient` 验证所有API接口：
- ✅ 健康检查接口
- ✅ 创建密钥接口 (POST)
- ✅ 查询密钥接口 (POST)
- ✅ 状态推进接口：激活、停用
- ✅ 密钥引用接口及幂等计数
- ✅ 查询引用记录接口
- ✅ 人工修正接口
- ✅ 导出报告接口
- ✅ 查询操作日志接口

### 启动API服务

```bash
python main.py
```

或使用uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

访问 http://localhost:8000/docs 查看Swagger文档

## 使用示例

### 1. 创建密钥

```bash
curl -X POST http://localhost:8000/api/v1/keys \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "TENANT001",
    "purpose": "data_encryption",
    "encryption_material": "-----BEGIN ENCRYPTED KEY-----...",
    "metadata": {"algorithm": "AES-256-GCM"},
    "operator": "admin@company.com"
  }'
```

### 2. 审批激活密钥

```bash
curl -X POST http://localhost:8000/api/v1/keys/status \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "TENANT001",
    "key_version": "TENANT001-DAT-20240101120000-v1",
    "target_status": "active",
    "approved_by": "security@company.com",
    "operator": "admin@company.com"
  }'
```

### 3. 记录数据批次引用

```bash
curl -X POST http://localhost:8000/api/v1/keys/reference \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "TENANT001",
    "key_version": "TENANT001-DAT-20240101120000-v1",
    "data_batch_id": "BATCH-2024-001",
    "purpose": "用户数据加密",
    "operator": "app_server_01"
  }'
```

### 4. 导出托管报告

```bash
curl -X POST http://localhost:8000/api/v1/reports/export \
  -H "Content-Type: application/json" \
  -d '{
    "tenant_id": "TENANT001",
    "report_type": "full_escrow",
    "operator": "auditor@company.com"
  }'
```

## 持久化

系统使用SQLite数据库 (`key_escrow.db`)，服务重启后：
- 所有密钥历史数据完整保留
- 所有引用记录可追溯查询
- 所有操作审计日志完整保留
- 历史报告可重新生成和导出

## 项目文件结构

```
.
├── main.py              # FastAPI应用入口
├── models.py            # 数据模型和Pydantic Schema
├── service.py           # 核心业务逻辑
├── database.py          # 数据库配置
├── test_escrow.py       # 自检测试脚本
├── requirements.txt     # 依赖列表
└── README.md           # 项目说明
```
