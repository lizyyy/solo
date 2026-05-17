# 接口样本脱敏授权API

用于管理接口样本脱敏、授权审批和领取留痕的系统，解决测试同学复现问题时的数据安全问题。

## 功能特性

- **状态管理**：批次的草稿 → 待审批 → 已批准/已拒绝 → 已过期 → 已归档
- **历史追溯**：所有操作记录（创建、审批、领取、访问、异常）均可查
- **数据脱敏**：支持多种脱敏规则（掩码、哈希、截断、替换、移除）
- **授权审批**：领取需要审批，授权有时间限制，过期自动回收
- **领取留痕**：每次脱敏操作都记录访问日志
- **异常处理**：异常路径保留原始输入和处理依据
- **人工修正**：支持脱敏规则的人工修正和审批流程
- **数据导出**：支持JSON格式导出批次完整信息

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化样例数据

```bash
python init_data.py
```

这将创建：
- 5条脱敏规则（手机号、身份证号、姓名、邮箱、哈希）
- 1个已审批的样本批次（BATCH-2024-001）
- 4个API路径配置
- 5个敏感字段配置
- 1条已批准的领取记录

### 3. 启动服务

```bash
python main.py
```

或者使用uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API主页：http://localhost:8000/
- Swagger文档：http://localhost:8000/docs
- ReDoc文档：http://localhost:8000/redoc

## 核心数据模型

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| SampleBatch | 样本批次 | batch_no, status, created_by, expire_at |
| ApiPath | 接口路径 | path, method, sample_count |
| SensitiveField | 敏感字段 | field_path, rule_id |
| DesensitizationRule | 脱敏规则 | rule_type, mask_char, keep_start/end |
| AuthorizationScope | 授权范围 | allowed_users, max_claims, claim_hours |
| ClaimRecord | 领取记录 | claimant, purpose, status, expire_at |
| AccessLog | 访问日志 | claim_id, access_type, request_data |
| ExceptionRecord | 异常记录 | operation, original_input, error_message |
| ManualCorrection | 人工修正 | field_path, corrected_value, approved |

## API调用示例（curl）

### 1. 批次管理

#### 查询批次列表
```bash
curl -X GET "http://localhost:8000/batches/" -H "Content-Type: application/json"
```

#### 查询单个批次详情
```bash
curl -X GET "http://localhost:8000/batches/1" -H "Content-Type: application/json"
```

#### 创建新批次
```bash
curl -X POST "http://localhost:8000/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-2024-002",
    "name": "订单中心接口样本",
    "description": "订单相关接口样本数据",
    "created_by": "admin",
    "api_paths": [
      {"path": "/api/v1/order/create", "method": "POST", "sample_count": 100}
    ],
    "sensitive_fields": [
      {"field_path": "order.user_phone", "rule_id": 1}
    ],
    "authorization_scopes": [
      {"scope_type": "department", "scope_value": "qa", "max_claims": 5, "claim_hours": 24}
    ]
  }'
```

#### 提交审批
```bash
curl -X POST "http://localhost:8000/batches/1/submit" -H "Content-Type: application/json"
```

#### 审批通过
```bash
curl -X POST "http://localhost:8000/batches/1/approve?approver=manager&comment=审批通过" -H "Content-Type: application/json"
```

#### 拒绝审批
```bash
curl -X POST "http://localhost:8000/batches/1/reject?approver=manager&comment=脱敏规则不符合要求" -H "Content-Type: application/json"
```

#### 查看批次报告
```bash
curl -X GET "http://localhost:8000/batches/1/report" -H "Content-Type: application/json"
```

### 2. 领取管理

#### 申请领取
```bash
curl -X POST "http://localhost:8000/claims/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "claimant": "tester2",
    "claimant_email": "tester2@example.com",
    "purpose": "复现支付接口超时问题"
  }'
```

#### 查询领取记录
```bash
curl -X GET "http://localhost:8000/claims/?batch_id=1&status=pending" -H "Content-Type: application/json"
```

#### 批准领取
```bash
curl -X POST "http://localhost:8000/claims/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved",
    "approver": "admin",
    "approval_comment": "批准使用，有效期8小时"
  }'
```

#### 撤销领取
```bash
curl -X POST "http://localhost:8000/claims/1/revoke" \
  -H "Content-Type: application/json" \
  -d '{
    "revoke_reason": "测试完成，回收权限",
    "operator": "admin"
  }'
```

### 3. 数据脱敏

#### 脱敏处理（已授权）
```bash
curl -X POST "http://localhost:8000/desensitize" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "claim_id": 1,
    "data": {
      "user": {
        "name": "张三",
        "phone": "13812345678",
        "id_card": "110101199001011234",
        "email": "zhangsan@example.com",
        "password_hash": "abc123def456"
      },
      "order_id": "ORD123456789",
      "amount": 99.99
    }
  }'
```

预期输出：
```json
{
  "success": true,
  "data": {
    "user": {
      "name": "张*",
      "phone": "138****5678",
      "id_card": "110101********1234",
      "email": "zh*******@example.com",
      "password_hash": "8d969eef6ecad3c2"
    },
    "order_id": "ORD123456789",
    "amount": 99.99
  },
  "message": "脱敏完成",
  "applied_rules": [
    "user.phone: mask:手机号脱敏",
    "user.id_card: mask:身份证号脱敏",
    "user.name: mask:姓名脱敏",
    "user.email: mask:邮箱脱敏",
    "user.password_hash: hash:哈希脱敏"
  ]
}
```

### 4. 脱敏规则管理

#### 创建脱敏规则
```bash
curl -X POST "http://localhost:8000/rules/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "地址脱敏",
    "rule_type": "truncate",
    "pattern": "6",
    "description": "只保留地址前6个字符"
  }'
```

#### 查询所有规则
```bash
curl -X GET "http://localhost:8000/rules/" -H "Content-Type: application/json"
```

### 5. 异常记录查询

#### 查询未解决的异常
```bash
curl -X GET "http://localhost:8000/exceptions/?resolved=false" -H "Content-Type: application/json"
```

#### 标记异常已解决
```bash
curl -X POST "http://localhost:8000/exceptions/1/resolve" \
  -H "Content-Type: application/json" \
  -d '{
    "resolver": "admin",
    "resolution_comment": "已修复，升级到v2.1版本"
  }'
```

### 6. 人工修正

#### 创建人工修正申请
```bash
curl -X POST "http://localhost:8000/corrections/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 1,
    "field_path": "user.phone",
    "original_value": "138****5678",
    "corrected_value": "138****0000",
    "reason": "测试需要统一格式",
    "corrected_by": "tester1"
  }'
```

#### 审批人工修正
```bash
curl -X POST "http://localhost:8000/corrections/1/approve" \
  -H "Content-Type: application/json" \
  -d '{
    "approved_by": "admin",
    "approved": true
  }'
```

### 7. 数据导出

#### 导出批次数据
```bash
curl -X GET "http://localhost:8000/export/batches/1?format=json" -H "Content-Type: application/json"
```

### 8. 访问日志查询

```bash
curl -X GET "http://localhost:8000/access-logs/?claim_id=1" -H "Content-Type: application/json"
```

## 异常路径演示（拦截示例）

### 示例1：未授权的脱敏操作

此操作会被拦截并记录异常：

```bash
curl -X POST "http://localhost:8000/test/unauthorized-desensitize?batch_id=1&claim_id=99999" -H "Content-Type: application/json"
```

预期结果：
- HTTP 403 Forbidden
- 返回：{"detail": "未授权或领取已过期 - 此异常已被记录"}
- 异常记录表中会新增一条记录，包含原始输入、错误信息、处理依据

查询异常记录验证：
```bash
curl -X GET "http://localhost:8000/exceptions/?batch_id=1" -H "Content-Type: application/json"
```

### 示例2：触发全局异常处理

```bash
curl -X POST "http://localhost:8000/test/exception?operator=test_user" -H "Content-Type: application/json"
```

预期结果：
- 异常被全局处理器捕获
- 原始请求信息被完整记录
- 堆栈追踪被保存

### 示例3：对未审批批次申请领取

先创建一个草稿状态的批次，然后尝试领取：

```bash
# 创建批次（草稿状态）
curl -X POST "http://localhost:8000/batches/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_no": "BATCH-TEST-DRAFT",
    "name": "测试草稿批次",
    "description": "未审批的测试批次",
    "created_by": "admin"
  }'

# 尝试领取（会失败）
curl -X POST "http://localhost:8000/claims/" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_id": 2,
    "claimant": "tester1",
    "purpose": "尝试领取未审批批次"
  }'
```

预期结果：
- HTTP 400 Bad Request
- 返回：{"detail": "只有已审批的批次可以申请领取"}

## 核心业务规则

### 脱敏规则类型

| 类型 | 说明 | 配置参数 |
|------|------|----------|
| mask | 掩码替换 | mask_char, keep_start, keep_end |
| hash | SHA256哈希 | - |
| truncate | 截断 | pattern（截断长度） |
| replace | 正则替换 | pattern, replacement |
| remove | 移除字段 | - |

### 状态流转

**批次状态：**
```
draft（草稿）→ pending_approval（待审批）→ approved（已批准）
                                                  ↓
                                            rejected（已拒绝）
                                                  ↓
                                            expired（已过期）
                                                  ↓
                                            archived（已归档）
```

**领取状态：**
```
pending（待审批）→ approved（已批准）→ revoked（已撤销）
                          ↓
                      expired（已过期）
```

### 授权规则

1. 只有 `approved` 状态的批次可以被领取
2. 领取需要审批流程
3. 领取有时间限制，过期自动回收
4. 每个脱敏操作必须提供有效的 `claim_id`
5. 所有脱敏操作都记录访问日志

### 异常处理原则

1. 所有异常保留 **原始输入**
2. 记录 **错误信息** 和 **堆栈追踪**
3. 保存 **处理依据**（如：当时的配置状态）
4. 异常可以标记解决并记录解决方案

## 维护操作

### 批量过期领取记录
```bash
curl -X POST "http://localhost:8000/maintenance/expire-claims" -H "Content-Type: application/json"
```

## 项目结构

```
.
├── main.py              # 主应用入口，API路由
├── models.py            # 数据模型定义
├── schemas.py           # Pydantic模式（请求/响应）
├── services.py          # 核心业务逻辑（脱敏引擎、授权服务等）
├── database.py          # 数据库连接配置
├── init_data.py         # 初始化样例数据脚本
├── requirements.txt     # 依赖列表
├── README.md            # 本文档
└── sample_auth.db       # SQLite数据库（自动创建）
```

## 安全注意事项

1. 生产环境请替换为更安全的数据库（PostgreSQL/MySQL）
2. 建议添加用户认证（如JWT）
3. 定期备份数据库
4. 敏感字段配置需要双人审核
5. 领取记录定期审计

## 下一步开发建议

- 添加更多脱敏算法（如AES加密、格式保留加密）
- 支持批量脱敏处理
- 添加Web管理界面
- 集成消息通知（审批通知、过期提醒）
- 支持数据水印
- 添加数据使用统计报表
