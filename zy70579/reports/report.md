# Proto 默认值风险扫描报告

**扫描时间**: 2026-05-17T11:43:15+08:00  
**扫描文件**: 3 个  

---

## 风险统计

| 风险等级 | 字段数量 | 说明 |
|---------|---------|------|
| 🔴 HIGH | 13 | 高度歧义，极易造成误解 |
| 🟡 MEDIUM | 3 | 中度歧义，可能造成误解 |
| 🟢 LOW | 2 | 低风险或无歧义 |
| ⚠️ 解析错误 | 1 | 语法问题无法解析 |

---

## 高风险字段详情

### 1. `Order.status`

- **位置**: [order.proto:16](testdata/order.proto#L16)
- **类型**: `OrderStatus`
- **隐式默认值**: `<nil>`
- **风险说明**: Enum default is first value 'PENDING' - could be ambiguous

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 2. `Order.user_id`

- **位置**: [order.proto:13](testdata/order.proto#L13)
- **类型**: `int64`
- **隐式默认值**: `0`
- **风险说明**: Zero value is ambiguous - could mean unset or intentionally zero

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 3. `Order.total_amount`

- **位置**: [order.proto:14](testdata/order.proto#L14)
- **类型**: `double`
- **隐式默认值**: `0`
- **风险说明**: Zero value is ambiguous - could mean unset or intentionally zero

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 4. `Order.order_id`

- **位置**: [order.proto:12](testdata/order.proto#L12)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 5. `User.age`

- **位置**: [user.proto:15](testdata/user.proto#L15)
- **类型**: `int32`
- **隐式默认值**: `0`
- **风险说明**: Zero value is ambiguous - could mean unset or intentionally zero

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 6. `User.id`

- **位置**: [user.proto:12](testdata/user.proto#L12)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 7. `User.name`

- **位置**: [user.proto:13](testdata/user.proto#L13)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 8. `User.email`

- **位置**: [user.proto:14](testdata/user.proto#L14)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 9. `User.balance`

- **位置**: [user.proto:17](testdata/user.proto#L17)
- **类型**: `float`
- **隐式默认值**: `0`
- **风险说明**: Zero value is ambiguous - could mean unset or intentionally zero

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 10. `User.status`

- **位置**: [user.proto:18](testdata/user.proto#L18)
- **类型**: `UserStatus`
- **隐式默认值**: `<nil>`
- **风险说明**: Enum default is first value 'UNKNOWN' - could be ambiguous

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 11. `CreateUserRequest.phone`

- **位置**: [user.proto:23](testdata/user.proto#L23)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 12. `CreateUserRequest.password`

- **位置**: [user.proto:24](testdata/user.proto#L24)
- **类型**: `string`
- **隐式默认值**: ``
- **风险说明**: Empty string '' is ambiguous - could be unset or intentionally empty

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

### 13. `CreateUserRequest.timestamp`

- **位置**: [user.proto:25](testdata/user.proto#L25)
- **类型**: `int64`
- **隐式默认值**: `0`
- **风险说明**: Zero value is ambiguous - could mean unset or intentionally zero

**建议**: 考虑使用 wrapper 类型 (如 `google.protobuf.Int32Value`) 或自定义 optional 语义

---

## 中风险字段详情

### 1. `Order.is_paid`

- **位置**: [order.proto:15](testdata/order.proto#L15)
- **类型**: `bool`
- **隐式默认值**: `false`
- **风险说明**: False could mean unset or intentionally false

### 2. `User.is_verified`

- **位置**: [user.proto:16](testdata/user.proto#L16)
- **类型**: `bool`
- **隐式默认值**: `false`
- **风险说明**: False could mean unset or intentionally false

### 3. `User.avatar`

- **位置**: [user.proto:19](testdata/user.proto#L19)
- **类型**: `bytes`
- **隐式默认值**: `[]`
- **风险说明**: Empty bytes could mean unset or intentionally empty

---

## 解析错误

以下行解析失败，已保留原始内容供排查：

### [order.proto:20](testdata/order.proto#L20)

**错误**: unrecognized syntax

```
这行是非法的，会导致解析错误
```

---

## Proto3 默认值参考

| 类型 | 默认值 | 歧义风险 |
|------|--------|----------|
| string | `""` | 🔴 HIGH |
| bool | `false` | 🟡 MEDIUM |
| int32/int64 | `0` | 🔴 HIGH |
| float/double | `0` | 🔴 HIGH |
| bytes | `[]` | 🟡 MEDIUM |
| enum | 第一个值 | 🔴 HIGH |
| message | `null` | 🟢 LOW |

---

## 调用示例参考

### 问题场景
```go
// 危险：无法区分是未设置还是真的为空
type User struct {
    Phone string `protobuf:"bytes,1,opt,name=phone"`
}

// client 端不设置字段
user := &User{}
// server 端收到 Phone = ""，无法判断用户是否真的没填电话
```

### 推荐方案
```proto
import "google/protobuf/wrappers.proto";

message User {
    google.protobuf.StringValue phone = 1;  // null 表示未设置
}
```
