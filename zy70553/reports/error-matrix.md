# gRPC 错误码矩阵报告

*生成时间: 2026/5/17 12:46:11*

## 摘要

| 指标 | 数值 |
|------|------|
| 总错误码数量 | 4 |
| SDK语言数量 | 3 |
| 可重试(Safe) | 1 |
| 不可重试(Never) | 2 |
| 有争议(Controversial) | 1 |
| 差异数量 | 1 |

## 重试分类

### ✅ 可重试 (Safe Retry)

- UNAVAILABLE (14)

### ❌ 不可重试 (Never Retry)

- OK (0)
- NOT_FOUND (5)

### ⚠️ 有争议 (Controversial)

- INTERNAL (13): go=COND, java=COND, python=RETRY

## 🔀 SDK差异

### INTERNAL (13) - 重试策略不匹配

- go: code=13, retry=COND
- java: code=13, retry=COND
- python: code=13, retry=RETRY

## SDK对比

| 错误码 | 名称 | GO | JAVA | PYTHON |
|--------|------|------|------|------|
| 0 | OK | NO_RETRY | NO_RETRY | NO_RETRY |
| 5 | NOT_FOUND | NO_RETRY | NO_RETRY | NO_RETRY |
| 13 | INTERNAL | COND | COND | RETRY |
| 14 | UNAVAILABLE | RETRY | RETRY | RETRY |
