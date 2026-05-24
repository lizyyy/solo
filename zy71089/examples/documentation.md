# 用户 API 文档

## 获取用户列表

使用 `GET /api/v1/users` 接口获取用户列表。

需要的权限：`user.read`

```python
# 使用 user.read 权限调用
response = client.get("/api/v1/users")
```

## 创建用户

使用 `POST /api/v1/users` 接口创建新用户。

**注意：此接口需要特殊权限。**

```python
response = client.post("/api/v1/users", json=data)
```

## 更新用户

使用 `PUT /api/v1/users/{id}` 接口更新用户信息。

需要的权限：`profile:write`（别名）

# 订单 API 文档

## 获取订单列表

使用 `GET /api/v1/orders` 接口获取订单列表。

需要的权限：`order.read`

## 创建订单

使用 `POST /api/v1/orders` 接口创建新订单。

需要的权限：`order.write` 或 `admin.full`
