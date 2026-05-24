# Auth Scope 覆盖检查报告

> 生成时间: 2026-05-24 21:05:58

## 执行摘要

| 项目 | 数量 | 状态 |
|------|------|------|
| API 总数 | 7 | ✅ |
| Scope 总数 | 6 | ✅ |
| SDK 示例数 | 6 | ✅ |
| 文档片段数 | 8 | ✅ |
| SDK 缺口 | 3 | ❌ |
| 文档缺口 | 0 | ✅ |
| 调用缺口 | 0 | ✅ |

## 覆盖缺口详情

### ❌ POST /api/v1/users

- **类型**: sdk_mismatch
- **严重程度**: error
- **来源**: SDK Example: sdk_examples_2 (python)
- **文件定位**: `examples/sdk_examples.py:10`

- **期望 Scope**: `user.write`
- **实际 Scope**: `user.read`
- **❌ 缺少 Scope**: `user.write`
- **⚠️ 多余 Scope**: `user.read`

> 示例缺少必需权限。API 'POST /api/v1/users' 需要 scope: user.write; 示例仅声明了: user.read; 缺少: user.write 示例声明了多余的权限: user.read。这些权限对调用 API 'POST /api/v1/users' 不是必需的

### ❌ GET /api/v1/orders

- **类型**: sdk_mismatch
- **严重程度**: error
- **来源**: SDK Example: sdk_examples_4 (python)
- **文件定位**: `examples/sdk_examples.py:27`

- **期望 Scope**: `order.read`
- **实际 Scope**: `deprecated_scope`
- **❌ 缺少 Scope**: `order.read`
- **⚠️ 多余 Scope**: `deprecated_scope`

> 示例缺少必需权限。API 'GET /api/v1/orders' 需要 scope: order.read; 示例仅声明了: deprecated_scope; 缺少: order.read 示例声明了多余的权限: deprecated_scope。这些权限对调用 API 'GET /api/v1/orders' 不是必需的

### ⚠️ GET /api/v1/users

- **类型**: sdk_mismatch
- **严重程度**: warning
- **来源**: SDK Example: sdk_examples_6 (python)
- **文件定位**: `examples/sdk_examples.py:44`

- **期望 Scope**: `user.read`
- **实际 Scope**: `user.read, order.write`
- **⚠️ 多余 Scope**: `order.write`

> 示例声明了多余的权限: order.write。这些权限对调用 API 'GET /api/v1/users' 不是必需的

## 退出码说明

| 退出码 | 含义 |
|--------|------|
| 0 | Success |
| 1 | Input Error |
| 2 | Parse Error |
| 3 | Coverage Gap |
| 4 | Config Error |
| 5 | Internal Error |

## Scope 映射表

| 标准名称 | 别名 | 包含权限 |
|----------|------|----------|
| `user.read` | `user:read, profile:read` | `-` |
| `user.write` | `user:write, profile:write` | `user.read` |
| `order.read` | `order:read` | `-` |
| `order.write` | `order:write` | `order.read` |
| `admin.full` | `admin:*, root` | `user.read, user.write, order.read, order.write` |
| `deprecated_scope` | `-` | `-` |
