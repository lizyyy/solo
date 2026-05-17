# API 枚举契约检查报告

**生成时间**: 5/17/2026, 11:58:03 PM

## 📊 概览

| 指标 | 数值 |
|------|------|
| 总枚举数 | 6 |
| ✅ 匹配枚举 | 0 |
| ❌ 不匹配枚举 | 6 |
| ⚠️  异常条目 | 0 |
| ❌ 处理错误 | 0 |

## 📁 扫描文件

### OpenAPI 文件

- `test/data/openapi-with-diff.yaml`

### 源代码文件

- `test/data/source-with-diff.ts`

## 🔍 枚举差异

### 📌 OrderStatus

#### ❌ 仅在源代码中存在

- `ON_HOLD` (行 7, 列 142)

### 📌 PaymentMethod

#### ❌ 仅在源代码中存在

- `APPLE_PAY` (行 14, 列 81)

### 📌 User_role

#### ❌ 仅在 OpenAPI 文档中存在

- `ADMIN`
- `USER`
- `GUEST`
- `MODERATOR`

### 📌 User_status

#### ❌ 仅在 OpenAPI 文档中存在

- `ACTIVE`
- `INACTIVE`

### 📌 UserRole

#### ❌ 仅在源代码中存在

- `ADMIN` (行 18, 列 1)
- `USER` (行 19, 列 19)
- `GUEST` (行 20, 列 36)
- `MODERATOR` (行 21, 列 55)

### 📌 UserStatus

#### ❌ 仅在源代码中存在

- `ACTIVE` (行 25, 列 1)
- `INACTIVE` (行 26, 列 21)

---

*此报告由 API Enum CLI 自动生成*