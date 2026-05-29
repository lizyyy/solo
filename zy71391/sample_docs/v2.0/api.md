---
maintainer: 王五
---

# API 参考 v2.0

## 认证

使用 Bearer Token 认证。

## 端点

### GET /users

获取用户列表。

- 权限: `users:read`
- 响应: [用户列表](#用户列表)

### POST /users

创建用户。

## 用户列表

返回字段说明：

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int | 用户 ID |
| name | string | 用户名 |

## 常见错误

参考 [v3.0 错误码](../v3.0/errors.md#错误码定义)。
