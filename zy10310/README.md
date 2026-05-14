# 租户导入预检 API

一个完整的租户数据导入预检服务，提供字段映射验证、依赖资源检查、错误分类、修复建议和凭证管理功能。

## 功能特性

### 📦 核心数据对象
- **导入包 (ImportPackage)**: 管理整个导入流程的状态和元数据
- **字段映射 (FieldMapping)**: 源字段到目标字段的映射配置验证
- **依赖资源 (DependencyResource)**: 检查外部依赖资源的可用性
- **预检错误 (PrecheckError)**: 记录校验错误，支持严重级别分类
- **修复建议 (FixSuggestion)**: 针对错误提供可操作的修复建议
- **通过凭证 (PassCertificate)**: 预检通过后颁发的凭证，支持撤销
- **审计日志 (AuditLog)**: 完整记录所有状态变更和操作

### 🔄 状态流转
```
CREATED → VALIDATING ─┬→ PASSED → COMPLETED
                      ├→ PENDING_REVIEW (人工审核)
                      └→ FAILED
CANCELLED (任何状态都可取消)
```

### 🛡️ 安全特性
- 基于内容哈希的重复提交防重机制
- 完整的操作审计（操作人、IP、User Agent、时间戳）
- 凭证管理（颁发、有效期、撤销）
- 规则版本追踪

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLAlchemy ORM (默认 SQLite，可扩展)
- **认证**: 可扩展的用户身份验证
- **ID生成**: UUID v7 (时间有序)

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload
```

服务将在 `http://localhost:8000` 启动

### 3. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口一览

### 导入包管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/packages` | 创建导入包 |
| GET | `/api/v1/packages` | 查询导入包列表 |
| GET | `/api/v1/packages/{id}` | 获取导入包详情 |

### 预检与状态管理
| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/packages/{id}/precheck` | 执行预检 |
| POST | `/api/v1/packages/{id}/status` | 推进状态 |
| POST | `/api/v1/packages/{id}/cancel` | 取消导入包 |

### 审计与导出
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/packages/{id}/audit-logs` | 查询审计日志 |
| POST | `/api/v1/packages/{id}/export` | 导出完整数据 |

### 凭证管理
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/packages/{id}/certificates` | 查询凭证列表 |
| POST | `/api/v1/packages/{id}/certificates/{cert_id}/revoke` | 撤销凭证 |

### 系统信息
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/` | 服务信息 |
| GET | `/health` | 健康检查 |
| GET | `/api/v1/rules/version` | 规则版本 |

## 运行测试样例

```bash
# 确保服务已启动
python test_examples.py
```

测试样例包含：
1. ✅ **成功流程**: 创建 → 预检 → 通过 → 导出
2. ❌ **问题流程**: 创建有问题的包 → 预检失败 → 查看错误 → 撤销
3. 🛡️ **防重测试**: 相同内容重复提交不会创建新记录
4. 🔄 **状态流转**: CREATED → PENDING_REVIEW → PASSED → 撤销凭证

## 核心规则校验

### 字段映射校验
- 源字段和目标字段不能为空
- 映射类型必须是: direct, transform, lookup, custom
- transform 类型需要提供转换规则

### 依赖资源校验
- 资源类型必须是: database, api, storage, queue
- 必需资源必须提供 resource_id

## 配置说明

编辑 `.env` 文件配置：

```env
DATABASE_URL=sqlite:///./tenant_import.db
SECRET_KEY=your-secret-key
RULES_VERSION=1.0.0
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── config.py          # 配置管理
│   ├── database.py        # 数据库连接
│   ├── models.py          # 数据模型
│   ├── schemas.py         # Pydantic 模式
│   ├── services.py        # 业务逻辑
│   └── main.py            # FastAPI 应用
├── requirements.txt
├── .env.example
├── .env
├── test_examples.py       # 测试样例
└── README.md
```

## 数据持久化

所有状态数据都保存在数据库中，重启服务后：
- 导入包状态不变
- 审计日志完整保留
- 凭证状态（已撤销/有效）不变
- 所有错误和修复建议都可查询

## 修复记录

### 🔧 Issue #1: 创建导入包时 package_id 为空导致 NOT NULL 约束失败

**问题描述**:
- 创建导入包时，SQLAlchemy 的 `default=generate_uuid` 在 flush 前不会执行
- 紧接着写入 AuditLog 时，`package.id` 仍然是 `None`
- 导致数据库抛出 `NOT NULL constraint failed: audit_logs.package_id`

**修复方案** (`app/services.py:119`):
```python
# 修复前: 依赖 SQLAlchemy default
package = ImportPackage(...)

# 修复后: 提前手动生成 id
package_id = generate_uuid()
package = ImportPackage(
    id=package_id,
    ...
)
```

**影响范围**: 此修复确保以下功能正常工作：
- ✅ 创建导入包 API
- ✅ 预检流程
- ✅ 状态推进
- ✅ 审计日志追溯
- ✅ 服务重启后数据一致性

## 扩展建议

1. **添加认证**: 集成 OAuth2 / JWT 进行用户认证
2. **数据库扩展**: 迁移到 PostgreSQL 支持更高并发
3. **规则引擎**: 支持动态加载和版本化管理校验规则
4. **通知集成**: 状态变更时发送邮件/消息通知
5. **文件上传**: 支持直接上传导入文件进行解析
