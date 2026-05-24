# API Cassette 差异报告

**生成时间**: 2026/5/24 21:32:14
**比较文件**:
- 期望: `examples/expected.yml`
- 实际: `examples/actual.yml`


## 比较摘要

**状态**: ❌ 失败

| 指标 | 数值 |
|------|------|
| 期望请求数 | 2 |
| 实际请求数 | 3 |
| 匹配成功 | 2 |
| 新增请求 | 1 |
| 缺失请求 | 0 |
| 内容变更 | 3 |
| **错误** | **3** |
| **警告** | **1** |


## 差异详情

### 🔴 错误 (3)

#### 响应体差异

**描述**: 响应体存在差异

**源代码位置**:

- 期望: `examples/expected.yml:1`
- 实际: `examples/actual.yml:1`

<details>
<summary>查看 2 项详细差异</summary>

| 路径 | 类型 | 期望值 | 实际值 |
|------|------|--------|--------|
| `response.body.email` | 变更 | `john@example.com` | `john.doe@example.com` |
| `response.body.created_at` | 变更 | `2024-01-01T00:00:00Z` | `2024-01-15T00:00:00Z` |

</details>


#### 状态码差异

**描述**: 响应状态码不匹配: 期望 201，实际 200

**源代码位置**:

- 期望: `examples/expected.yml:11`
- 实际: `examples/actual.yml:11`

<details>
<summary>查看 1 项详细差异</summary>

| 路径 | 类型 | 期望值 | 实际值 |
|------|------|--------|--------|
| `response.status.code` | 变更 | `201` | `200` |

</details>


#### 响应体差异

**描述**: 响应体存在差异

**源代码位置**:

- 期望: `examples/expected.yml:11`
- 实际: `examples/actual.yml:11`

<details>
<summary>查看 2 项详细差异</summary>

| 路径 | 类型 | 期望值 | 实际值 |
|------|------|--------|--------|
| `response.body.id` | 变更 | `456` | `789` |
| `response.body.role` | 新增 | *(不存在)* | `user` |

</details>


### 🟡 警告 (1)

#### 新增请求

**描述**: 新增请求: DELETE https://api.example.com/users/999

**源代码位置**:

- 实际: `examples/actual.yml:21`



## 退出码信息

| 字段 | 值 |
|------|----|
| 退出码 | `1` |
| 名称 | `DIFFERENCES_FOUND` |
| 说明 | 发现一个或多个差异 |
| 建议 | 查看生成的差异报告，确认是接口变更还是脱敏问题 |


## 配置信息

<details>
<summary>查看比较配置</summary>

```json
{
  "ignoreOrder": true,
  "ignoreFields": [
    "body.id",
    "body.created_at",
    "body.updated_at",
    "body.timestamp",
    "query.timestamp",
    "query.nonce",
    "header.x-request-id",
    "header.x-trace-id"
  ],
  "maskingRules": [
    {
      "field": "authorization",
      "type": "header",
      "pattern": "^Bearer\\s+.+$",
      "replacement": "Bearer ***MASKED***"
    },
    {
      "field": "token",
      "type": "body",
      "pattern": ".+",
      "replacement": "***MASKED***"
    },
    {
      "field": "password",
      "type": "body",
      "pattern": ".+",
      "replacement": "***MASKED***"
    },
    {
      "field": "secret",
      "type": "body",
      "pattern": ".+",
      "replacement": "***MASKED***"
    }
  ],
  "normalizeHeaders": true,
  "normalizeJsonKeys": true,
  "tolerance": 0.8
}
```

</details>
