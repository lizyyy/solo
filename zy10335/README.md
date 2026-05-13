# 按需脱敏代理 API

数据脱敏代理服务 - 提供字段级脱敏、访问授权、审计追踪能力

## 项目概述

如果 按需脱敏代理 API 继续靠人肉确认，下一次故障还是查不清责任。本项目提供可重复调用的脱敏代理服务，确保每一次数据访问都有据可查。

## 技术栈

- Python 3.8+
- FastAPI - 高性能Web框架
- Pydantic - 数据验证
- Uvicorn - ASGI服务器

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload
```

服务默认运行在: `http://localhost:8000`

### 3. 访问接口文档

- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## 核心数据对象

### 代理规则 (ProxyRule)
- rule_id: 规则唯一标识
- name: 规则名称
- api_path: API路径匹配模式
- fields: 字段脱敏配置列表
- allowed_callers: 允许的调用方列表
- status: 规则状态 (DRAFT/ACTIVE/SUSPENDED/DEPRECATED)
- created_by: 创建人
- approved_by: 审批人

### 字段路径 (FieldPath)
- path: JSON路径表达式 (如 user.contact.phone)
- level: 脱敏级别
- pattern: 匹配正则模式

### 脱敏级别 (DesensitizationLevel)
- none: 不处理
- mask: 掩码 (保留首尾，中间替换为*)
- hash: MD5哈希
- encrypt: 加密标记
- remove: 删除字段

### 访问记录 (AccessRecord)
- record_id: 记录唯一标识
- rule_id: 关联规则ID
- caller: 调用方标识
- request_id: 请求ID（用于去重）
- api_path: 实际请求路径
- original_digest: 原始数据摘要（SHA256）
- desensitized_digest: 脱敏后数据摘要
- matched_fields: 匹配到的字段列表
- status: 处理状态
- accessed_at: 访问时间

## 关键接口

### 1. 健康检查

```
GET /health
```

### 2. 规则管理

**创建规则**
```
POST /api/v1/rules
Headers: X-User-Id: <创建人ID>
Body: {
  "name": "规则名称",
  "api_path": "/api/user/profile",
  "fields": [
    {"path": "user.contact.phone", "level": "mask"}
  ],
  "allowed_callers": ["service_order"]
}
```

**查询规则列表**
```
GET /api/v1/rules?status=ACTIVE
```

**查询单个规则**
```
GET /api/v1/rules/{rule_id}
```

**审批激活规则**
```
POST /api/v1/rules/{rule_id}/approve
Headers: X-User-Id: <审批人ID>
```

**暂停规则**
```
POST /api/v1/rules/{rule_id}/suspend
```

### 3. 脱敏校验

```
POST /api/v1/validate
Body: {
  "rule_id": "<规则ID>",
  "caller": "service_order",
  "request_id": "req_123456",
  "api_path": "/api/user/profile",
  "data": {
    "user": {
      "contact": {"phone": "13812345678"}
    }
  }
}
```

### 4. 审计查询

**查询访问记录**
```
GET /api/v1/records?rule_id=<规则ID>&caller=<调用方>
```

**查询单个记录**
```
GET /api/v1/records/{record_id}
```

## 一条会被拦截的路径示例

### 路径
```
user.contact.phone
```

### 脱敏规则配置
- 脱敏级别: mask (掩码)
- 匹配模式: 无 (匹配所有值)

### 原始数据
```json
{
  "user": {
    "name": "张三",
    "contact": {
      "phone": "13812345678",
      "email": "zhangsan@example.com"
    }
  }
}
```

### 脱敏后数据
```json
{
  "user": {
    "name": "张三",
    "contact": {
      "phone": "1********8",
      "email": "zhangsan@example.com"
    }
  }
}
```

## 测试数据

运行测试脚本，覆盖以下场景：

```bash
python test_data.py
```

### 1. 正常场景
- 创建脱敏规则
- 审批激活规则
- 执行脱敏请求（手机号被掩码、身份证被哈希）

### 2. 异常场景
- 规则不存在
- 调用方无权限
- 规则未激活（DRAFT状态）

### 3. 重复请求场景
- 相同request_id的重复请求
- 自动去重，返回缓存结果，不产生脏数据

### 4. 人工处理场景
- 查询所有访问记录
- 查询所有规则状态
- 审计追踪

## 核心特性

1. **字段级精确匹配**: 支持嵌套JSON路径匹配
2. **多级别脱敏**: 5种脱敏级别满足不同场景
3. **调用方授权**: 白名单机制控制访问权限
4. **重复请求去重**: 基于request_id防止重复处理
5. **数据摘要存证**: SHA256摘要确保数据不可篡改
6. **完整审计记录**: 所有访问都有记录，责任可追溯
7. **规则生命周期管理**: DRAFT->ACTIVE->SUSPENDED状态流转

## 错误码说明

| 错误码 | 说明 |
|--------|------|
| RULE_NOT_FOUND | 规则不存在 |
| RULE_NOT_ACTIVE | 规则未激活 |
| CALLER_NOT_ALLOWED | 调用方无权限 |
| VALIDATION_ERROR | 请求参数校验失败 |
| INTERNAL_ERROR | 服务内部错误 |
| CREATE_FAILED | 规则创建失败 |

## 项目结构

```
.
├── main.py           # FastAPI应用入口
├── models.py         # 数据模型定义
├── service.py        # 核心业务逻辑
├── test_data.py      # 测试数据脚本
├── requirements.txt  # 依赖声明
└── README.md         # 项目文档
```
