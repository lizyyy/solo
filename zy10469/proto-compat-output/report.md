# Proto 兼容性检查报告

生成时间: 2026/5/17 03:56:54

## 检查状态: ❌ 不兼容

## 摘要统计

| 类型 | 数量 |
|------|------|
| ❌ 错误 | 3 |
| ⚠️ 警告 | 1 |
| ℹ️ 信息 | 2 |
| **总计** | **6** |

## 快照信息

- 快照版本: v1
- 创建时间: 2026-05-16T20:56:54.061Z

## ❌ 错误

### 1. 字段编号 2 被复用: 原字段 "name" -> 新字段 "full_name"

- **代码**: `FIELD_NUMBER_REUSED`
- **原始位置**: test-v1.proto:7
- **新位置**: test-v2.proto:7
- **字段编号**: 2

### 2. 字段编号 4 被复用: 原字段 "age" -> 新字段 "phone"

- **代码**: `FIELD_NUMBER_REUSED`
- **原始位置**: test-v1.proto:9
- **新位置**: test-v2.proto:9
- **字段编号**: 4

### 3. 字段 example.v1.User.age (编号 4) 的类型改变: int32 -> string

- **代码**: `FIELD_TYPE_CHANGED`
- **位置**: test-v2.proto, 行 9
- **字段**: example.v1.User.age
- **字段编号**: 4

## ⚠️ 警告

### 1. 方法 example.v1.UserService.GetUser 被删除

- **代码**: `METHOD_REMOVED`
- **位置**: 行 30

## ℹ️ 信息

### 1. 新增字段 example.v1.User.status (编号 5)

- **代码**: `FIELD_ADDED`
- **位置**: test-v2.proto, 行 10
- **字段**: example.v1.User.status
- **字段编号**: 5

### 2. 新增枚举值 example.v1.User.CreateUserRequest.CreateUserResponse.UserStatus.SUSPENDED (编号 3)

- **代码**: `ENUM_VALUE_ADDED`
- **位置**: 行 27

## Proto 文件概览

### 消息 (Messages)

| 消息名称 | 文件 | 字段数 |
|----------|------|--------|
| example.v1.User | test-v2.proto | 5 |
| example.v1.User.CreateUserRequest | test-v2.proto | 3 |
| example.v1.User.CreateUserRequest.CreateUserResponse | test-v2.proto | 1 |
| example.v1.User.CreateUserRequest.CreateUserResponse.GetUserRequest | test-v1.proto | 1 |

### 枚举 (Enums)

| 枚举名称 | 文件 | 值数 |
|----------|------|------|
| example.v1.User.CreateUserRequest.CreateUserResponse.UserStatus | test-v2.proto | 4 |

### 服务 (Services)

| 服务名称 | 文件 | 方法数 |
|----------|------|--------|
| example.v1.UserService | test-v2.proto | 1 |

---
*此报告由 proto-compat 工具自动生成*