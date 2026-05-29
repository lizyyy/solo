# 接口契约差异报告

生成时间: 2026/5/29 22:40:50

## 概要

状态: ❌ 不兼容

| 指标 | 数量 |
|------|------|
| 总差异 | 5 |
| 破坏性变更 | 4 🔴 |
| 警告 | 1 🟡 |
| 提示 | 0 🔵 |

### 来源

- **基准**: 演示系统 (v1.0.0, openapi)
- **目标**: 演示系统 (vmock-1.0, mock)

## 🔴 破坏性变更 (1)

- **response.200.response**
  - 类型: 必填性变更
  - 预期: `false`
  - 实际: `true`
  - 上下文: Required status changed: false -> true

## 🟡 警告 (2)

- **param.page**
  - 类型: 移除参数
  - 上下文: Required parameter page is missing

- **param.status**
  - 类型: 移除参数
  - 上下文: Required parameter status is missing

## 缺失的端点 (3)

- `POST` /users - 创建用户
- `GET` /users/{id} - 获取用户详情
- `PUT` /users/{id} - 更新用户

## 新增的端点 (1)

- `GET` /users/1

## 响应样例

### GET /users

响应 200:

```json
{
  "code": 877,
  "data": [
    {
      "id": "id_3406",
      "name": "Eve",
      "email": "user28@example.com",
      "status": "active",
      "createdAt": "sample_createdAt_97"
    }
  ],
  "total": 185,
  "extraField": "sample_extraField_66"
}
```

### GET /users/1

响应 200:

```json
{
  "code": 943,
  "data": {
    "id": "id_3059",
    "name": "Diana",
    "email": "user7@example.com",
    "status": "active"
  }
}
```

