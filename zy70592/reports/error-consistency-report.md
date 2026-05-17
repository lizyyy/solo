# REST API 错误体一致性检查报告

## 检查元数据

| 项目 | 值 |
|------|-----|
| 输入文件 | `examples/test-api.yaml` |
| 检查时间 | 2026/5/17 11:56:40 |
| 接口总数 | 5 |
| 错误响应数 | 12 |

## 问题摘要

| 严重程度 | 数量 |
|----------|------|
| 🔴 错误 | 0 |
| 🟡 警告 | 9 |
| 🔵 信息 | 0 |
| **总计** | **9** |

## 状态码分组分析

| 状态码 | 分类 | 响应数 | 通用字段 |
|--------|------|--------|----------|
| 400 | 4xx Client Error | 3 | (无) |
| 401 | 4xx Client Error | 1 | message |
| 402 | 4xx Client Error | 1 | (无) |
| 404 | 4xx Client Error | 2 | (无) |
| 409 | 4xx Client Error | 1 | errorMessage |
| 500 | 5xx Server Error | 4 | (无) |

## 问题详情

### 🟡 警告

#### 错误响应缺少schema定义

- **位置**: `POST /users` [500]
- **建议**: 为错误响应添加明确的schema定义，包含错误信息字段

#### 错误响应缺少schema定义

- **位置**: `POST /orders` [402]
- **建议**: 为错误响应添加明确的schema定义，包含错误信息字段

#### 跨状态码通用字段 'error' 缺失

- **位置**: `GET /users` [401]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'error' 缺失

- **位置**: `POST /orders` [402]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'message' 缺失

- **位置**: `POST /orders` [402]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'message' 缺失

- **位置**: `GET /users/{id}` [404]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'message' 缺失

- **位置**: `DELETE /users/{id}` [404]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'error' 缺失

- **位置**: `POST /users` [409]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

#### 跨状态码通用字段 'message' 缺失

- **位置**: `POST /users` [409]
- **建议**: 考虑在所有错误响应中统一使用 error, message 等字段

## 💡 改进建议

1. 错误消息字段存在多种命名: error, message, msg, errorMessage, detail。建议统一使用 'message' 或 'error' 其中一个。
2. 以下状态码部分响应缺少schema: 402, 500。建议为所有错误响应添加明确的schema定义。

---

*报告生成于: 2026/5/17 11:56:40*
