# Mock 数据与 OpenAPI 契约一致性检查报告

> 生成时间: 2026-05-17T17:11:18.646Z

## 概览

| 指标 | 数量 |
|------|------|
| 检查的 Mock 文件 | 6 |
| ✅ 通过 | 2 |
| ❌ 失败 | 3 |
| ⚠️ 警告 | 0 |
| ❓ 未匹配 | 1 |
| 🔴 解析错误 | 0 |
| 📭 无 Schema | 0 |
| 总问题数 | 5 |
| - 错误 | 3 |
| - 警告 | 2 |
| 通过率 | 33.3% |

---

## ✅ 正常项 (2)

| 文件 | 方法 | 路径 | 状态码 | 字段数(契约/Mock) |
|------|------|------|--------|-------------------|
| good-user.json | GET | `/users/123` | 200 | 6/6 |
| users-list.json | GET | `/users` | 200 | 4/3 |


---

## ⚠️ 风险项 (3)

### ❌ missing-fields-user.json

- **方法**: GET
- **路径**: `/users/456`
- **状态码**: 200
- **问题统计**: 1 错误, 0 警告

#### ❌ 错误 (1)

**字段缺失**: `status`
  - 期望类型: `string`
  - 描述: 用户状态



---

### ❌ type-mismatch-user.json

- **方法**: GET
- **路径**: `/users/789`
- **状态码**: 200
- **问题统计**: 1 错误, 2 警告

#### ❌ 错误 (1)

**枚举值无效**: `status`
  - 允许值: [active, inactive, pending]
  - 实际值: `unknown`

#### ⚠️ 警告 (2)

**类型不匹配**: `age`
  - 期望: `integer`, 实际: `string`
  - 样例值: `"28"`

**额外字段**: `extraField`
  - 实际类型: `string`

---

### ❌ user-profile.json

- **方法**: GET
- **路径**: `/users/123/profile`
- **状态码**: 200
- **问题统计**: 1 错误, 0 警告

#### ❌ 错误 (1)

**字段缺失**: `notifications.push`
  - 期望类型: `boolean`



---

---

## ❌ 无法处理的样本 (1)

| 文件 | 状态 | 原因 |
|------|------|------|
| unmatched-endpoint.json | ❓ 未匹配 | No matching OpenAPI endpoint found for POST /unknown/endpoint |


---

## 检查配置

- OpenAPI 契约: `examples/openapi.yaml`
- Mock 路径: `examples/mocks/`
- 严格类型检查: ✅
- 检查可选字段: ❌

---

*此报告由 mock-contract-checker 自动生成*
